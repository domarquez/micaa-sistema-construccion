/**
 * Divulgación progresiva (principio de diseño MICAA):
 * la app arranca mostrando SOLO materiales y la complejidad se abre a medida que el usuario profundiza.
 *
 *   0 MATERIALES   visitante o usuario sin WhatsApp verificado: precios, lista, publicar precio.
 *   1 INSCRITO     sesión + phone_verified: proyectos, presupuestos, sugerencia de plantillas.
 *   2 PROYECTO     (futuro) creación/modificación de proyecto: datos, diseño.
 *   3 SALIDAS      (futuro) PDF.
 *   4 CRONOGRAMAS  (futuro) cronogramas simples → complejos.
 *
 * Hoy los niveles 2–4 se habilitan junto con el 1 (FEATURE_LEVEL apunta a 1). Para abrirlos más adelante
 * basta con subir el número de la feature y decidir en computeDisclosureLevel cuándo se alcanza.
 * El rol admin siempre ve todo.
 */
export const LEVEL = { MATERIALS: 0, ENROLLED: 1, PROJECT: 2, OUTPUTS: 3, SCHEDULES: 4 } as const;
export const MAX_LEVEL = LEVEL.SCHEDULES;
export type DisclosureLevel = (typeof LEVEL)[keyof typeof LEVEL];

export const FEATURE_LEVEL = {
  materials: LEVEL.MATERIALS,
  projects: LEVEL.ENROLLED,
  templates: LEVEL.ENROLLED,
  catalog: LEVEL.ENROLLED, // actividades, herramientas, mano de obra, marketplace
  projectEdit: LEVEL.ENROLLED, // → LEVEL.PROJECT cuando se separe
  pdf: LEVEL.ENROLLED, // → LEVEL.OUTPUTS
  schedules: LEVEL.ENROLLED, // → LEVEL.SCHEDULES
} as const satisfies Record<string, DisclosureLevel>;
export type DisclosureFeature = keyof typeof FEATURE_LEVEL;

export interface DisclosureUser {
  role?: string | null;
  phoneVerified?: boolean | null;
}

export function computeDisclosureLevel(user: DisclosureUser | null | undefined): DisclosureLevel {
  if (!user) return LEVEL.MATERIALS;
  if (user.role === "admin") return MAX_LEVEL;
  if (user.phoneVerified) return LEVEL.ENROLLED;
  return LEVEL.MATERIALS;
}

export function canAccess(user: DisclosureUser | null | undefined, feature: DisclosureFeature): boolean {
  return computeDisclosureLevel(user) >= FEATURE_LEVEL[feature];
}

/** Rutas que requieren nivel > 0. Las no listadas (materiales, cuenta, login, proveedor, admin) no se tocan. */
const GATED_ROUTES: Array<[RegExp, DisclosureFeature]> = [
  [/^\/dashboard\/?$/, "projects"],
  [/^\/budgets(\/|$)/, "projects"],
  [/^\/plantillas(\/|$)/, "templates"],
  [/^\/(activities|custom-activities|tools|labor|marketplace)(\/|$)/, "catalog"],
];

export function featureForPath(path: string): DisclosureFeature | null {
  const p = path.split(/[?#]/)[0];
  for (const [re, f] of GATED_ROUTES) if (re.test(p)) return f;
  return null;
}
