/**
 * Claim flow helpers:
 * - Detect a Bolivian mobile in a WhatsApp reply from a salesperson phone
 *   belonging to a pending_claim company → store as pending_owner_phone (admin must approve).
 * - Admin can set / approve the responsible person's number.
 * NEVER auto-sends outreach; outreach only when Diego says «manda».
 */
import { sql } from "drizzle-orm";
import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { normalizeBoPhone } from "./supplier-guide";

const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Extract first BO mobile (591[67]XXXXXXX) from free text. */
export function extractBoMobileFromText(text: string, city?: string | null): string | null {
  if (!text) return null;
  // Prefer explicit +591 / 591 forms
  const m591 = text.match(/(?:\+?591[\s.-]*)([67]\d{7})/);
  if (m591) return "591" + m591[1];
  // Bare 8-digit mobile
  const m8 = text.match(/(?<!\d)([67]\d{7})(?!\d)/);
  if (m8) return normalizeBoPhone(m8[1], city || "Santa Cruz");
  return null;
}

function textOf(m: any): string {
  const msg = m?.message || {};
  if (typeof msg.conversation === "string") return msg.conversation;
  if (msg.extendedTextMessage?.text) return String(msg.extendedTextMessage.text);
  return "";
}

function pickMessages(payload: any): any[] {
  const data = payload?.data ?? payload;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.messages)) return data.messages;
  if (data.key || data.message) return [data];
  return [];
}

function senderPhoneRaw(m: any): string | null {
  const key = m?.key || {};
  const candidates = [key.remoteJid, key.remoteJidAlt, key.senderPn, m?.senderPn, key.participantAlt];
  for (const c of candidates) {
    if (typeof c === "string" && c.endsWith("@s.whatsapp.net")) {
      const d = c.replace(/@.*$/, "").replace(/:\d+$/, "").replace(/\D/g, "");
      if (/^591[67]\d{7}$/.test(d)) return d;
      if (/^[67]\d{7}$/.test(d)) return "591" + d;
    }
  }
  return null;
}

export type ClaimPhoneHit = {
  companyId: number;
  companyName: string;
  fromPhone: string;
  proposedOwnerPhone: string;
};

/**
 * Process Evolution messages.upsert: if sender is a sales contact of a pending_claim
 * company and the text contains a different BO mobile, park it as pending_owner_phone.
 * Does NOT auto-approve and does NOT send replies that promise account access.
 */
export async function handleClaimPhoneReplies(
  payload: any,
  opts: { instance?: string } = {},
): Promise<{ hits: ClaimPhoneHit[]; skipped: string[] }> {
  const skipped: string[] = [];
  const hits: ClaimPhoneHit[] = [];
  const event = String(payload?.event || "").toLowerCase().replace(/_/g, ".");
  if (event && event !== "messages.upsert") return { hits, skipped: ["event:" + event] };
  if (opts.instance && payload?.instance && payload.instance !== opts.instance) {
    return { hits, skipped: ["other_instance"] };
  }

  for (const m of pickMessages(payload)) {
    const key = m?.key || {};
    const jid = String(key.remoteJid || "");
    if (key.fromMe === true) { skipped.push("from_me"); continue; }
    if (/@g\.us$|@newsletter$|@broadcast$/.test(jid)) { skipped.push("not_dm"); continue; }
    const from = senderPhoneRaw(m);
    if (!from) { skipped.push("no_phone"); continue; }
    const text = textOf(m).trim();
    if (!text) { skipped.push("empty"); continue; }

    // Ignore pure login-code requests (handled elsewhere)
    if (/\bcodigo (de )?micaa\b/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      skipped.push("login_request");
      continue;
    }

    const proposed = extractBoMobileFromText(text);
    if (!proposed) { skipped.push("no_number_in_text"); continue; }
    if (proposed === from) { skipped.push("same_as_sender"); continue; }

    // Match company by salesperson phone (main or contacts sales)
    const found = rows(
      await db.execute(sql`
        select id, company_name as "companyName", city, claim_status as "claimStatus",
               phone_normalized as "phoneNormalized", contacts
        from supplier_companies
        where is_active
          and coalesce(claim_status,'') in ('pending_claim','')
          and (
            phone_normalized = ${from}
            or whatsapp = ${from}
            or exists (
              select 1 from jsonb_array_elements(coalesce(contacts,'[]'::jsonb)) c
              where c->>'phone' = ${from}
            )
          )
        order by case when claim_status = 'pending_claim' then 0 else 1 end, id
        limit 1`),
    );
    const co = found[0];
    if (!co) { skipped.push("no_company_for_sender"); continue; }

    await db.execute(sql`
      update supplier_companies set
        pending_owner_phone = ${proposed},
        pending_owner_phone_at = now(),
        pending_owner_phone_from = 'whatsapp_reply',
        updated_at = now()
      where id = ${co.id}`);

    hits.push({
      companyId: Number(co.id),
      companyName: co.companyName,
      fromPhone: from,
      proposedOwnerPhone: proposed,
    });
  }
  return { hits, skipped };
}

/** Attach approved owner phone to contacts and allow claim via that number. */
export async function approveOwnerPhone(companyId: number, phone?: string | null): Promise<{ ok: boolean; message: string }> {
  const r = rows(
    await db.execute(sql`
      select id, company_name, contacts, pending_owner_phone, city
      from supplier_companies where id = ${companyId} limit 1`),
  );
  const co = r[0];
  if (!co) return { ok: false, message: "Empresa no encontrada" };
  const raw = phone || co.pending_owner_phone;
  const norm = normalizeBoPhone(raw, co.city);
  if (!norm || !/^591[67]/.test(norm)) {
    return { ok: false, message: "Número móvil boliviano inválido" };
  }
  const contacts = Array.isArray(co.contacts) ? [...co.contacts] : [];
  if (!contacts.some((c: any) => c?.phone === norm && c?.role === "owner")) {
    contacts.push({ phone: norm, role: "owner", name: "Responsable", isPrimary: false });
  }
  await db.execute(sql`
    update supplier_companies set
      contacts = ${JSON.stringify(contacts)}::jsonb,
      pending_owner_phone = null,
      pending_owner_phone_at = null,
      pending_owner_phone_from = null,
      updated_at = now()
    where id = ${companyId}`);
  return { ok: true, message: `Responsable ${norm} vinculado a ${co.company_name}` };
}

/** Admin sets a proposed owner phone (still pending until approve) or sets+approves. */
export async function setPendingOwnerPhone(
  companyId: number,
  phoneRaw: string,
  from: "admin" | "whatsapp_reply" = "admin",
): Promise<{ ok: boolean; message: string; phone?: string }> {
  const norm = normalizeBoPhone(phoneRaw, "Santa Cruz");
  if (!norm || !/^591[67]/.test(norm)) {
    return { ok: false, message: "Número móvil boliviano inválido (ej. 70012345)" };
  }
  const r = rows(
    await db.execute(sql`
      update supplier_companies set
        pending_owner_phone = ${norm},
        pending_owner_phone_at = now(),
        pending_owner_phone_from = ${from},
        updated_at = now()
      where id = ${companyId}
      returning id, company_name`),
  );
  if (!r[0]) return { ok: false, message: "Empresa no encontrada" };
  return { ok: true, message: `Número pendiente de aprobación para ${r[0].company_name}`, phone: norm };
}

export function registerCompanyClaimAdminRoutes(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: NextFunction) => void,
) {
  app.get("/api/admin/suppliers/pending-claims", requireAdmin, async (_req, res) => {
    try {
      const r = rows(
        await db.execute(sql`
          select id, company_name as "companyName", city, phone_normalized as "phoneNormalized",
                 claim_status as "claimStatus", contacts, micaa_created as "micaaCreated",
                 pending_owner_phone as "pendingOwnerPhone",
                 pending_owner_phone_at as "pendingOwnerPhoneAt",
                 pending_owner_phone_from as "pendingOwnerPhoneFrom",
                 (select count(*)::int from user_material_prices u where u.supplier_company_id = s.id and u.is_public)
                 + (select count(*)::int from material_supplier_prices m where m.supplier_id = s.id and m.is_active) as "priceCount"
          from supplier_companies s
          where claim_status = 'pending_claim'
             or pending_owner_phone is not null
          order by pending_owner_phone_at desc nulls last, company_name`),
      );
      res.json(r);
    } catch (e) {
      console.error("pending-claims:", e);
      res.status(500).json({ message: "No se pudieron cargar los reclamos pendientes" });
    }
  });

  app.post("/api/admin/suppliers/:id/owner-phone", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const phone = String(req.body?.phone || "").trim();
      const approve = !!req.body?.approve;
      if (!Number.isFinite(id) || !phone) {
        return res.status(400).json({ message: "id y phone son obligatorios" });
      }
      const set = await setPendingOwnerPhone(id, phone, "admin");
      if (!set.ok) return res.status(400).json(set);
      if (approve) {
        const ap = await approveOwnerPhone(id, set.phone);
        if (!ap.ok) return res.status(400).json(ap);
        return res.json({ ...ap, approved: true, phone: set.phone });
      }
      res.json({ ...set, approved: false });
    } catch (e) {
      console.error("owner-phone:", e);
      res.status(500).json({ message: "No se pudo guardar el número responsable" });
    }
  });

  app.post("/api/admin/suppliers/:id/approve-owner-phone", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ message: "id inválido" });
      const phone = req.body?.phone ? String(req.body.phone) : null;
      const ap = await approveOwnerPhone(id, phone);
      if (!ap.ok) return res.status(400).json(ap);
      res.json(ap);
    } catch (e) {
      console.error("approve-owner-phone:", e);
      res.status(500).json({ message: "No se pudo aprobar el número" });
    }
  });
}
