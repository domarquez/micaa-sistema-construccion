/**
 * Company logo upload: square or wide; files under /uploads/company-logos (not in DB).
 * Warn if too small but still allow.
 */
import fs from "fs";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { supplierCompanies } from "@shared/schema";
import { refreshCompanyFeatureState } from "./company-features";

const uploadsRoot = path.join(process.cwd(), "uploads", "company-logos");
fs.mkdirSync(uploadsRoot, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error("Solo JPG, PNG o WebP"));
    }
    cb(null, true);
  },
});

type AuthReq = Request & { user?: { id: number } };

async function processLogo(buf: Buffer, companyId: number) {
  let sharp: any = null;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    /* optional */
  }
  const stamp = Date.now();
  const base = `c${companyId}-${stamp}`;

  if (!sharp) {
    const file = `${base}.bin`;
    fs.writeFileSync(path.join(uploadsRoot, file), buf);
    const url = `/uploads/company-logos/${file}`;
    return { logoUrl: url, thumbUrl: url, format: "square" as const, qualityWarn: true, width: 0, height: 0 };
  }

  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const ratio = w && h ? w / h : 1;
  const format: "square" | "wide" = ratio >= 1.35 ? "wide" : "square";
  const qualityWarn = w < 200 || h < 200;

  const mainW = format === "wide" ? 800 : 512;
  const mainH = format === "wide" ? Math.round(mainW / Math.max(ratio, 1.35)) : 512;
  const mainName = `${base}.webp`;
  const thumbName = `${base}-thumb.webp`;

  await sharp(buf)
    .rotate()
    .resize(mainW, mainH, { fit: format === "square" ? "cover" : "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(uploadsRoot, mainName));

  await sharp(buf)
    .rotate()
    .resize(96, 96, { fit: "cover" })
    .webp({ quality: 75 })
    .toFile(path.join(uploadsRoot, thumbName));

  return {
    logoUrl: `/uploads/company-logos/${mainName}`,
    thumbUrl: `/uploads/company-logos/${thumbName}`,
    format,
    qualityWarn,
    width: w,
    height: h,
  };
}

async function findMine(userId: number) {
  const r = await db.select().from(supplierCompanies).where(eq(supplierCompanies.userId, userId)).limit(1);
  return r[0] || null;
}

export function registerCompanyLogoRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: NextFunction) => void,
) {
  app.use("/uploads/company-logos", express.static(uploadsRoot));

  app.post(
    "/api/my-supplier-company/logo",
    requireAuth,
    upload.single("logo"),
    async (req: AuthReq, res: Response) => {
      try {
        const mine = await findMine(req.user!.id);
        if (!mine) return res.status(404).json({ message: "Todavía no registraste tu empresa" });
        if (!req.file?.buffer) return res.status(400).json({ message: "Subí una imagen (JPG/PNG/WebP)" });

        const out = await processLogo(req.file.buffer, mine.id);
        await db
          .update(supplierCompanies)
          .set({
            logoUrl: out.logoUrl,
            logoThumbUrl: out.thumbUrl,
            logoFormat: out.format,
            logoQualityWarn: out.qualityWarn,
            updatedAt: new Date(),
          } as any)
          .where(eq(supplierCompanies.id, mine.id));

        await refreshCompanyFeatureState(mine.id);
        const refreshed = await db.select().from(supplierCompanies).where(eq(supplierCompanies.id, mine.id)).limit(1);

        res.json({
          logoUrl: out.logoUrl,
          logoThumbUrl: out.thumbUrl,
          logoFormat: out.format,
          logoQualityWarn: out.qualityWarn,
          width: out.width,
          height: out.height,
          warning: out.qualityWarn
            ? "La imagen es chica (menos de 200px). Se ve bien en el listado, pero conviene una más nítida para la ficha."
            : null,
          company: refreshed[0],
        });
      } catch (e: any) {
        console.error("logo upload:", e);
        res.status(400).json({ message: e?.message || "No se pudo subir el logo" });
      }
    },
  );
}
