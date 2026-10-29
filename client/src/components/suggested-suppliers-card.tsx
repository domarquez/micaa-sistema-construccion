import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MessageCircle, Star } from "lucide-react";

type Suggested = {
  id: number;
  companyName: string;
  city?: string | null;
  logoThumbUrl?: string | null;
  logoUrl?: string | null;
  featuredActive?: boolean;
  matchedMaterials?: number;
  waLink?: string | null;
};

type Props = {
  city?: string | null;
  activityIds?: number[];
  materialIds?: number[];
};

export function SuggestedSuppliersCard({ city, activityIds = [], materialIds = [] }: Props) {
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (city?.trim()) p.set("city", city.trim());
    if (materialIds.length) p.set("materialIds", materialIds.slice(0, 80).join(","));
    if (activityIds.length) p.set("activityIds", activityIds.slice(0, 80).join(","));
    return p.toString();
  }, [city, activityIds, materialIds]);

  const enabled = !!(materialIds.length || activityIds.length);

  const { data, isLoading } = useQuery<Suggested[]>({
    queryKey: ["/api/public/suggested-suppliers", qs],
    queryFn: async () => {
      const r = await fetch(`/api/public/suggested-suppliers?${qs}`);
      if (!r.ok) throw new Error("suggested");
      return r.json();
    },
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) return null;
  if (isLoading) {
    return (
      <Card className="tech-card shadow-none border-[var(--micaa-line)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Proveedores sugeridos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Buscando empresas con precios en tu ciudad…</p>
        </CardContent>
      </Card>
    );
  }
  if (!data?.length) return null;

  return (
    <Card className="tech-card shadow-none border-[var(--micaa-line)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Proveedores sugeridos
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Empresas en {city || "tu zona"} con precios de materiales de este presupuesto.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-[12px] border border-[var(--micaa-line)] bg-white p-2.5"
          >
            {s.logoThumbUrl || s.logoUrl ? (
              <img
                src={s.logoThumbUrl || s.logoUrl || ""}
                alt=""
                className="h-10 w-10 rounded-md object-cover shrink-0 bg-muted"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-semibold truncate">{s.companyName}</p>
                {s.featuredActive && (
                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                    <Star className="w-3 h-3" /> Destacada
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {s.matchedMaterials || 0} material{(s.matchedMaterials || 0) === 1 ? "" : "es"} · {s.city || "—"}
              </p>
            </div>
            {s.waLink && (
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <a href={s.waLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                  WA
                </a>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
