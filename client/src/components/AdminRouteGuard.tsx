import type { ComponentType, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "wouter";

/** Bloquea /admin/* para no-admins: redirige o muestra «No autorizado». */
export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (!isAdmin) {
    return (
      <div
        className="mx-auto max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
        data-testid="admin-unauthorized"
        role="alert"
      >
        <h1 className="text-lg font-semibold text-foreground">No autorizado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta sección es solo para administradores. Si creés que es un error, escribinos por WhatsApp.
        </p>
        <a href="/" className="mt-4 inline-block text-sm text-[var(--micaa-accent)] underline">
          Volver al inicio
        </a>
      </div>
    );
  }

  return <>{children}</>;
}

/** Envuelve un page component para usarlo en &lt;Route component={...} /&gt;. */
export function withAdminGate<P extends object>(Page: ComponentType<P>) {
  function Gated(props: P) {
    return (
      <AdminRouteGuard>
        <Page {...props} />
      </AdminRouteGuard>
    );
  }
  Gated.displayName = `WithAdminGate(${Page.displayName || Page.name || "Page"})`;
  return Gated;
}
