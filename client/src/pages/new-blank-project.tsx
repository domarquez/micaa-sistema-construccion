/**
 * Proyecto en blanco: reutiliza el editor multifase existente (nombre/ciudad → fases/actividades).
 * Ruta pública de superficie de precios + layout autenticado: /proyecto-nuevo
 */
import { useLocation } from "wouter";
import MultiphaseBudgetForm from "@/components/budgets/multi-phase-budget-form";

export default function NewBlankProjectPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="mx-auto max-w-5xl min-w-0 px-4 py-6" data-testid="page-new-blank-project">
      <div className="mb-4 min-w-0">
        <h1 className="text-xl font-bold text-[var(--micaa-fg)] sm:text-2xl">Proyecto nuevo en blanco</h1>
        <p className="mt-1 text-sm text-[var(--micaa-muted)]">
          Poné el nombre y la ciudad, después agregá fases y actividades a tu gusto.
        </p>
      </div>
      <MultiphaseBudgetForm onClose={() => setLocation("/proyectos")} />
    </div>
  );
}
