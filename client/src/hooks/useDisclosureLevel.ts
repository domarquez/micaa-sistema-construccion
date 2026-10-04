import { useAuth } from "@/hooks/useAuth";
import { canAccess, computeDisclosureLevel, type DisclosureFeature } from "@/lib/disclosure";

/** Nivel de divulgación progresiva del usuario actual. Ver client/src/lib/disclosure.ts. */
export function useDisclosureLevel() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const u = isAuthenticated ? (user as any) : null;
  const level = computeDisclosureLevel(u);
  return {
    level,
    isAuthenticated,
    isAdmin,
    phoneVerified: !!u?.phoneVerified,
    can: (feature: DisclosureFeature) => canAccess(u, feature),
    /** Qué le falta para subir al nivel 1: entrar (visitante) o verificar su WhatsApp (sesión sin teléfono verificado). */
    nextStep: (!isAuthenticated ? "login" : !u?.phoneVerified && !isAdmin ? "verify" : null) as "login" | "verify" | null,
  };
}
