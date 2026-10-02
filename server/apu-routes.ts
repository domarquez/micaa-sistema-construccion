/**
 * Endpoints del APU en vivo + overrides de precio (todos autenticados y con
 * chequeo de propiedad del proyecto → sin IDOR).
 *
 *  GET    /api/budget-items/:id/apu                       APU del ítem con opciones de precio por insumo
 *  POST   /api/budget-items/:id/reprice                   Recalcula y guarda unit_price/subtotal del ítem
 *  GET    /api/projects/:projectId/activities/:activityId/apu   Preview (overrides de proyecto) para ítems nuevos
 *  GET    /api/projects/:projectId/price-overrides        Lista overrides del proyecto
 *  PUT    /api/projects/:projectId/price-overrides        Crea/actualiza override (alcance ítem o proyecto) y reprecia
 *  DELETE /api/projects/:projectId/price-overrides        Elimina override y reprecia
 */
import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import {
  budgetItems,
  budgets,
  projects,
  materials,
  laborCategories,
  tools,
  projectPriceOverrides,
} from "../shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  computeActivityApu,
  materialPriceOptions,
  overridesTableExists,
  repriceAfterOverrideChange,
  repriceBudgetItem,
  getOptionalColumns,
} from "./apu-live";
import type { ApuInputType, ApuOverrideSource } from "../shared/apu";

type Mw = (req: Request, res: Response, next: NextFunction) => any;

const INPUT_TYPES: ApuInputType[] = ["material", "labor", "equipment"];
const SOURCES: ApuOverrideSource[] = ["base", "quote", "market", "manual"];

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function userIdOf(req: Request): number {
  return (req as any).user.id;
}

async function ownedProject(projectId: number, userId: number) {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return p || null;
}

/** Ítem + presupuesto + proyecto, solo si el proyecto es del usuario. */
async function ownedItem(itemId: number, userId: number) {
  const [row] = await db
    .select({
      id: budgetItems.id,
      budgetId: budgetItems.budgetId,
      activityId: budgetItems.activityId,
      phaseId: budgetItems.phaseId,
      quantity: budgetItems.quantity,
      unitPrice: budgetItems.unitPrice,
      subtotal: budgetItems.subtotal,
      projectId: projects.id,
    })
    .from(budgetItems)
    .innerJoin(budgets, eq(budgetItems.budgetId, budgets.id))
    .innerJoin(projects, eq(budgets.projectId, projects.id))
    .where(and(eq(budgetItems.id, itemId), eq(projects.userId, userId)))
    .limit(1);
  return row || null;
}

async function itemExtras(itemId: number) {
  const cols = await getOptionalColumns();
  if (!cols.has("budget_items.apu_computed_at")) return { apuComputedAt: null as string | null };
  const r: any = await db.execute(sql`SELECT apu_computed_at FROM budget_items WHERE id = ${itemId}`);
  const rows = Array.isArray(r) ? r : r.rows ?? [];
  const v = rows[0]?.apu_computed_at;
  return { apuComputedAt: v ? new Date(v).toISOString() : null };
}

function serializeItem(item: NonNullable<Awaited<ReturnType<typeof ownedItem>>>, extras: { apuComputedAt: string | null }) {
  return {
    id: item.id,
    budgetId: item.budgetId,
    projectId: item.projectId,
    activityId: item.activityId,
    phaseId: item.phaseId,
    quantity: parseFloat(String(item.quantity)),
    unitPrice: parseFloat(String(item.unitPrice)),
    subtotal: parseFloat(String(item.subtotal)),
    apuComputedAt: extras.apuComputedAt,
  };
}

async function inputExists(type: ApuInputType, id: number): Promise<boolean> {
  if (type === "material") {
    return (await db.select({ id: materials.id }).from(materials).where(eq(materials.id, id)).limit(1)).length > 0;
  }
  if (type === "labor") {
    return (
      (await db.select({ id: laborCategories.id }).from(laborCategories).where(eq(laborCategories.id, id)).limit(1))
        .length > 0
    );
  }
  return (await db.select({ id: tools.id }).from(tools).where(eq(tools.id, id)).limit(1)).length > 0;
}

function scopeWhere(projectId: number, budgetItemId: number | null, type: ApuInputType, inputId: number) {
  return and(
    eq(projectPriceOverrides.projectId, projectId),
    eq(projectPriceOverrides.inputType, type),
    eq(projectPriceOverrides.inputId, inputId),
    budgetItemId ? eq(projectPriceOverrides.budgetItemId, budgetItemId) : isNull(projectPriceOverrides.budgetItemId),
  );
}

const MIGRATION_PENDING = {
  message:
    "Overrides de precio no disponibles: falta aplicar migrations/0001_apu_live_overrides.sql en la base de datos",
  code: "APU_MIGRATION_PENDING",
};

export function registerApuRoutes(app: any, requireAuth: Mw) {
  // --- APU de un ítem (con opciones de precio) ---------------------------------
  app.get("/api/budget-items/:id/apu", requireAuth, async (req: Request, res: Response) => {
    try {
      const itemId = toInt(req.params.id);
      if (!itemId) return res.status(400).json({ message: "ID inválido" });
      const item = await ownedItem(itemId, userIdOf(req));
      if (!item) return res.status(404).json({ message: "Elemento no encontrado" });
      const apu = await computeActivityApu(item.activityId, item.projectId, item.id);
      res.json({ item: serializeItem(item, await itemExtras(item.id)), apu });
    } catch (error) {
      console.error("APU item error:", error);
      res.status(500).json({ message: "Error al calcular el APU del ítem" });
    }
  });

  // --- Recalcular y guardar el precio del ítem con el APU en vivo -------------
  app.post("/api/budget-items/:id/reprice", requireAuth, async (req: Request, res: Response) => {
    try {
      const itemId = toInt(req.params.id);
      if (!itemId) return res.status(400).json({ message: "ID inválido" });
      const item = await ownedItem(itemId, userIdOf(req));
      if (!item) return res.status(404).json({ message: "Elemento no encontrado" });
      const r = await repriceBudgetItem(item.id, item.projectId);
      const fresh = await ownedItem(itemId, userIdOf(req));
      res.json({ item: serializeItem(fresh!, await itemExtras(item.id)), budgetTotal: r.budgetTotal });
    } catch (error) {
      console.error("APU reprice error:", error);
      res.status(500).json({ message: "Error al recalcular el ítem" });
    }
  });

  // --- Preview del APU de una actividad dentro de un proyecto -----------------
  app.get(
    "/api/projects/:projectId/activities/:activityId/apu",
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const projectId = toInt(req.params.projectId);
        const activityId = toInt(req.params.activityId);
        if (!projectId || !activityId) return res.status(400).json({ message: "Parámetros inválidos" });
        const project = await ownedProject(projectId, userIdOf(req));
        if (!project) return res.status(404).json({ message: "Proyecto no encontrado" });
        const full = req.query.options === "1";
        const apu = await computeActivityApu(activityId, projectId, null, { includeOptions: full });
        res.json(apu);
      } catch (error) {
        console.error("APU preview error:", error);
        res.status(500).json({ message: "Error al calcular el APU" });
      }
    },
  );

  // --- Listar overrides --------------------------------------------------------
  app.get("/api/projects/:projectId/price-overrides", requireAuth, async (req: Request, res: Response) => {
    try {
      const projectId = toInt(req.params.projectId);
      if (!projectId) return res.status(400).json({ message: "ID inválido" });
      if (!(await ownedProject(projectId, userIdOf(req)))) return res.status(404).json({ message: "Proyecto no encontrado" });
      if (!(await overridesTableExists())) return res.json({ available: false, overrides: [] });
      const rows = await db.select().from(projectPriceOverrides).where(eq(projectPriceOverrides.projectId, projectId));
      res.json({ available: true, overrides: rows });
    } catch (error) {
      console.error("List overrides error:", error);
      res.status(500).json({ message: "Error al listar overrides" });
    }
  });

  // --- Crear / actualizar override --------------------------------------------
  app.put("/api/projects/:projectId/price-overrides", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = userIdOf(req);
      const projectId = toInt(req.params.projectId);
      if (!projectId) return res.status(400).json({ message: "ID inválido" });
      const project = await ownedProject(projectId, userId);
      if (!project) return res.status(404).json({ message: "Proyecto no encontrado" });
      if (!(await overridesTableExists())) return res.status(503).json(MIGRATION_PENDING);

      const body = req.body || {};
      const inputType = body.inputType as ApuInputType;
      const inputId = toInt(body.inputId);
      const source = body.source as ApuOverrideSource;
      const budgetItemIdIn = toInt(body.budgetItemId);
      const scope: "item" | "project" = body.scope === "project" ? "project" : body.scope === "item" ? "item" : budgetItemIdIn ? "item" : "project";
      const repriceItemId = toInt(body.repriceItemId) ?? budgetItemIdIn;

      if (!INPUT_TYPES.includes(inputType)) return res.status(400).json({ message: "inputType inválido" });
      if (!inputId) return res.status(400).json({ message: "inputId inválido" });
      if (!SOURCES.includes(source)) return res.status(400).json({ message: "source inválido" });
      if (scope === "item" && !budgetItemIdIn) return res.status(400).json({ message: "budgetItemId requerido para alcance ítem" });

      // Ítems deben pertenecer a ESTE proyecto (no a otro del mismo usuario)
      for (const id of [budgetItemIdIn, repriceItemId]) {
        if (!id) continue;
        const it = await ownedItem(id, userId);
        if (!it || it.projectId !== projectId) return res.status(404).json({ message: "Elemento no encontrado en el proyecto" });
      }
      if (!(await inputExists(inputType, inputId))) return res.status(404).json({ message: "Insumo no encontrado" });

      let quoteId: number | null = null;
      let supplierPriceId: number | null = null;
      let manualPrice: string | null = null;
      if (source === "quote" || source === "market") {
        if (inputType !== "material") {
          return res.status(400).json({ message: "Cotizaciones / MICAA Market solo aplican a materiales" });
        }
        const opts = await materialPriceOptions(inputId, project.city || "Santa Cruz");
        if (source === "quote") {
          quoteId = toInt(body.quoteId);
          supplierPriceId = toInt(body.supplierPriceId);
          if (!quoteId === !supplierPriceId) {
            return res.status(400).json({ message: "Indique quoteId o supplierPriceId (uno solo)" });
          }
          const key = supplierPriceId ? `supplier:${supplierPriceId}` : `quote:${quoteId}`;
          // Solo cotizaciones públicas de la ciudad del proyecto para este material
          if (!opts?.options.some((o) => o.key === key)) {
            return res.status(400).json({ message: "La cotización no corresponde a este material / ciudad del proyecto" });
          }
        }
      } else if (source === "manual") {
        const mp = typeof body.manualPrice === "number" ? body.manualPrice : parseFloat(String(body.manualPrice));
        if (!Number.isFinite(mp) || mp < 0 || mp > 1e8) return res.status(400).json({ message: "manualPrice inválido" });
        manualPrice = mp.toFixed(4);
      }

      const budgetItemId = scope === "item" ? budgetItemIdIn : null;
      const now = new Date();
      let saved: any = null;

      if (scope === "project" && source === "base") {
        // "Base" a nivel proyecto = sin override de proyecto
        await db.delete(projectPriceOverrides).where(scopeWhere(projectId, null, inputType, inputId));
      } else {
        const values = { source, quoteId, supplierPriceId, manualPrice, updatedAt: now };
        const upd = await db
          .update(projectPriceOverrides)
          .set(values)
          .where(scopeWhere(projectId, budgetItemId, inputType, inputId))
          .returning();
        if (upd.length) saved = upd[0];
        else {
          try {
            [saved] = await db
              .insert(projectPriceOverrides)
              .values({ projectId, budgetItemId, inputType, inputId, createdBy: userId, createdAt: now, ...values })
              .returning();
          } catch (err: any) {
            if ((err?.code || err?.cause?.code) !== "23505") throw err;
            [saved] = await db
              .update(projectPriceOverrides)
              .set(values)
              .where(scopeWhere(projectId, budgetItemId, inputType, inputId))
              .returning();
          }
        }
      }
      // Al elegir "todo el proyecto" desde un ítem, quitar el override de ítem que lo taparía
      if (scope === "project" && repriceItemId) {
        await db.delete(projectPriceOverrides).where(scopeWhere(projectId, repriceItemId, inputType, inputId));
      }

      const repriced = await repriceAfterOverrideChange(projectId, inputType, inputId, repriceItemId, scope === "project");
      res.json({ override: saved, scope, repriced });
    } catch (error) {
      console.error("Upsert override error:", error);
      res.status(500).json({ message: "Error al guardar el precio" });
    }
  });

  // --- Eliminar override -------------------------------------------------------
  app.delete("/api/projects/:projectId/price-overrides", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = userIdOf(req);
      const projectId = toInt(req.params.projectId);
      if (!projectId) return res.status(400).json({ message: "ID inválido" });
      if (!(await ownedProject(projectId, userId))) return res.status(404).json({ message: "Proyecto no encontrado" });
      if (!(await overridesTableExists())) return res.status(503).json(MIGRATION_PENDING);

      const src = { ...(req.query || {}), ...(req.body || {}) } as any;
      const inputType = src.inputType as ApuInputType;
      const inputId = toInt(src.inputId);
      const budgetItemIdIn = toInt(src.budgetItemId);
      const scope: "item" | "project" = src.scope === "project" ? "project" : src.scope === "item" ? "item" : budgetItemIdIn ? "item" : "project";
      const repriceItemId = toInt(src.repriceItemId) ?? budgetItemIdIn;
      if (!INPUT_TYPES.includes(inputType) || !inputId) return res.status(400).json({ message: "Parámetros inválidos" });
      if (scope === "item" && !budgetItemIdIn) return res.status(400).json({ message: "budgetItemId requerido para alcance ítem" });
      for (const id of [budgetItemIdIn, repriceItemId]) {
        if (!id) continue;
        const it = await ownedItem(id, userId);
        if (!it || it.projectId !== projectId) return res.status(404).json({ message: "Elemento no encontrado en el proyecto" });
      }

      const deleted = await db
        .delete(projectPriceOverrides)
        .where(scopeWhere(projectId, scope === "item" ? budgetItemIdIn : null, inputType, inputId))
        .returning();
      const repriced = await repriceAfterOverrideChange(projectId, inputType, inputId, repriceItemId, scope === "project");
      res.json({ deleted: deleted.length, repriced });
    } catch (error) {
      console.error("Delete override error:", error);
      res.status(500).json({ message: "Error al eliminar el precio" });
    }
  });
}
