import type { ReactNode } from "react";
import { Link } from "wouter";
import { MessageCircle } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";
import type { DisclosureFeature } from "@/lib/disclosure";
import WhatsAppCodeFlow from "@/components/WhatsAppCodeFlow";

/** CTA único de inscripción: visitante → /login (WhatsApp crea la cuenta); con sesión sin verificar → vincular aquí mismo. */
export function WhatsAppSignupCta({ compact = false }: { compact?: boolean }) {
  const { nextStep } = useDisclosureLevel();
  if (compact) {
    return (
      <Link
        href={nextStep === "login" ? "/login" : "/inscribete"}
        className="whitespace-nowrap font-medium text-[var(--micaa-accent)]"
        data-testid="cta-whatsapp-compact"
      >
        Inscríbete con WhatsApp
      </Link>
    );
  }
  return (
    <div className="mx-auto my-10 max-w-md rounded-xl border bg-white p-6 text-center shadow-sm" data-testid="cta-whatsapp">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
        <MessageCircle className="h-5 w-5 text-green-700" />
      </div>
      <h2 className="text-lg font-semibold">Inscríbete con WhatsApp</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Es gratis y sin contraseña. Con tu WhatsApp verificado puedes crear proyectos, empezar desde una plantilla y armar presupuestos.
      </p>
      <div className="mt-4 text-left">
        {nextStep === "verify" ? (
          <WhatsAppCodeFlow
            mode="link"
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] })}
          />
        ) : (
          <Link
            href="/login"
            className="block w-full rounded-md bg-green-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-green-700"
          >
            Inscríbete con WhatsApp
          </Link>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Mientras tanto, puedes seguir viendo <Link href="/materiales" className="underline">precios de materiales</Link>.
      </p>
    </div>
  );
}

/** Muestra children si el usuario alcanza el nivel de la feature; si no, el CTA (nunca un error). */
export function DisclosureGate({ feature, children }: { feature: DisclosureFeature | null; children: ReactNode }) {
  const { can } = useDisclosureLevel();
  if (!feature || can(feature)) return <>{children}</>;
  return <WhatsAppSignupCta />;
}
