# Ask packs (Extractor source of truth)

Ask packs under `scripts/data/ask-packs/*.json` are the **only** allowed source of
WhatsApp quote ask-lines for the Extractor.

## Rules

1. **Load ask lines from these JSON files.** Never invent vague placeholders such as
   `medida a confirmar`, `según plano`, or generic “perfil / plancha” without size.
2. **Every `askLine` must be a concrete commercial SKU** (size + unit length / sheet dims).
3. Prefer an existing `materialId`. If the catalog is missing the SKU, run
   `npx tsx scripts/ensure-ask-pack-materials.ts --apply` first so stubs exist, then
   refresh `materialId` in the pack (or rely on soft-match by `name` / `aliases`).
4. Do **not** change `materials.price` of existing rows when ensuring stubs.

## Pack: `acero_perfiles`

Structural steel profiles and black plates for construction quotes. See
`scripts/data/ask-packs/acero_perfiles.json`.

```bash
# Dry-run (default)
npx tsx scripts/ensure-ask-pack-materials.ts acero_perfiles

# Insert missing stubs on Railway / with DATABASE_URL
npx tsx scripts/ensure-ask-pack-materials.ts --apply
```
