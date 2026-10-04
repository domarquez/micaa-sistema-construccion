import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { LayoutTemplate } from "lucide-react";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";

/** Nivel 1: si el usuario todavía no tiene proyectos/presupuestos, sugiere empezar desde una plantilla. */
export function TemplateSuggestionCard() {
  const { can, isAuthenticated } = useDisclosureLevel();
  const enabled = isAuthenticated && can("templates");
  const { data: budgets } = useQuery<unknown[] | null>({
    queryKey: ["/api/budgets"],
    enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (!enabled || !Array.isArray(budgets) || budgets.length > 0) return null;
  return (
    <Link href="/plantillas" data-testid="card-template-suggestion">
      <div className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-orange-300 bg-orange-50 p-4 transition-colors hover:bg-orange-100">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-600">
          <LayoutTemplate className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">Empieza desde una plantilla</p>
          <p className="text-sm text-muted-foreground">
            Casa, muro, baño, piscina, galpón… ajusta las medidas y obtén el costo al instante.
          </p>
        </div>
      </div>
    </Link>
  );
}
