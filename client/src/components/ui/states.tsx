import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fila gris animada; base de todos los estados de carga. */
export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-black/[0.06]", className)} />;
}

/** Lista de filas tipo "nombre / unidad ··· precio" mientras carga. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y divide-[var(--micaa-line)]", className)} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3">
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-4 w-3/5" />
            <SkeletonLine className="h-3 w-2/5" />
          </div>
          <SkeletonLine className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Estado vacío uniforme. */
export function EmptyState({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("py-8 text-center text-sm text-[var(--micaa-muted)]", className)}>
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
