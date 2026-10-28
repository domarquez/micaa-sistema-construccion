import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { BarChart3, Users, Clock, Search, Building2, FileText } from "lucide-react";

type Period = "day" | "week" | "month";

type AnalyticsReport = {
  period: string;
  totals: {
    pageViews: number;
    uniqueVisitors: number;
    sessions: number;
    registeredActive: number;
    anonymousVisitors: number;
    avgSessionMs: number;
    avgPageMs: number;
  };
  visitsByDay: { day: string; views: number; uniqueVisitors: number }[];
  topPages: { path: string; views: number }[];
  topSearches: { q: string; n: number }[];
  keyEvents: { eventType: string; n: number }[];
  topSuppliers: { company: string; n: number }[];
  timeBySection: { section: string; avgMs: number; samples: number }[];
};

function fmtMs(ms: number): string {
  if (!ms || ms < 1000) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function dayLabel(d: string): string {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("es-BO", { day: "2-digit", month: "short", timeZone: "America/La_Paz" });
  } catch {
    return String(d).slice(5, 10);
  }
}

const EVENT_LABELS: Record<string, string> = {
  material_search: "Búsqueda material",
  view_material: "Ver material",
  ver_proveedores: "Ver proveedores",
  company_view: "Ver empresa",
  budget_created: "Presupuesto creado",
  pdf_exported: "PDF exportado",
  login: "Login",
  registration: "Registro",
  whatsapp_click: "WhatsApp MICAA",
  anunciar_view: "Vistas /anunciar",
};

export default function AdminEstadisticas() {
  const [period, setPeriod] = useState<Period>("week");

  const { data, isLoading, error, refetch, isFetching } = useQuery<AnalyticsReport>({
    queryKey: ["/api/admin/analytics", period],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/analytics?period=${period}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("No se pudieron cargar las estadísticas");
      return res.json();
    },
  });

  const { data: summaryText } = useQuery<string>({
    queryKey: ["/api/admin/analytics/summary", period],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/analytics/summary?period=${period}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return "";
      return res.text();
    },
  });

  const chartData = useMemo(
    () =>
      (data?.visitsByDay || []).map((r) => ({
        ...r,
        label: dayLabel(String(r.day)),
      })),
    [data],
  );

  const t = data?.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#C2410C]">Estadísticas</h1>
          <p className="text-sm text-muted-foreground">
            Analytics propio de MICAA · sin IPs · sin bots ni dmarquez
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month"] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "outline"}
              className={period === p ? "bg-[#C2410C] hover:bg-[#9A3412]" : ""}
              onClick={() => setPeriod(p)}
            >
              {p === "day" ? "Hoy" : p === "week" ? "Semana" : "Mes"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            Actualizar
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {error && (
        <p className="text-sm text-red-600">
          No se pudieron cargar las estadísticas. ¿Estás con cuenta admin?
        </p>
      )}

      {t && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-[#C2410C]" /> Visitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{t.pageViews}</div>
              <p className="text-xs text-muted-foreground">page views</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4 text-[#C2410C]" /> Únicos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{t.uniqueVisitors}</div>
              <p className="text-xs text-muted-foreground">
                {t.registeredActive} registrados · {t.anonymousVisitors} anónimos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4 text-[#C2410C]" /> Sesión media
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{fmtMs(t.avgSessionMs)}</div>
              <p className="text-xs text-muted-foreground">página media {fmtMs(t.avgPageMs)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4 text-[#C2410C]" /> Sesiones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{t.sessions}</div>
              <p className="text-xs text-muted-foreground">sesiones distintas</p>
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visitas por día</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="views" name="Vistas" stroke="#C2410C" strokeWidth={2} />
                <Line
                  type="monotone"
                  dataKey="uniqueVisitors"
                  name="Únicos"
                  stroke="#EA580C"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-[#C2410C]" /> Top búsquedas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.topSearches?.length && (
              <p className="text-sm text-muted-foreground">Todavía no hay búsquedas registradas.</p>
            )}
            <ul className="space-y-1 text-sm">
              {data?.topSearches?.map((r) => (
                <li key={r.q} className="flex justify-between gap-2 border-b border-border/60 py-1.5">
                  <span className="truncate">{r.q}</span>
                  <span className="tabular-nums text-muted-foreground">{r.n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-[#C2410C]" /> Top proveedores vistos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.topSuppliers?.length && (
              <p className="text-sm text-muted-foreground">
                Útil para vender publicidad: aún no hay vistas de proveedores.
              </p>
            )}
            <ul className="space-y-1 text-sm">
              {data?.topSuppliers?.map((r) => (
                <li key={r.company} className="flex justify-between gap-2 border-b border-border/60 py-1.5">
                  <span className="truncate">{r.company}</span>
                  <span className="tabular-nums text-muted-foreground">{r.n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Páginas más vistas</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {(data?.topPages?.length || 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(data?.topPages || []).slice(0, 8).map((p) => ({
                    ...p,
                    short: p.path.length > 28 ? p.path.slice(0, 26) + "…" : p.path,
                  }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="short" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="views" name="Vistas" fill="#C2410C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Eventos clave</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {(data?.keyEvents || []).map((r) => (
                <li key={r.eventType} className="flex justify-between gap-2 border-b border-border/60 py-1.5">
                  <span>{EVENT_LABELS[r.eventType] || r.eventType}</span>
                  <span className="tabular-nums text-muted-foreground">{r.n}</span>
                </li>
              ))}
              {!data?.keyEvents?.length && (
                <p className="text-sm text-muted-foreground">Sin eventos todavía.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {(data?.timeBySection?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempo medio por sección</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 text-sm">
              {data!.timeBySection.map((r) => (
                <li key={r.section} className="flex justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="truncate font-mono text-xs">{r.section}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtMs(r.avgMs)} · {r.samples} muestras
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {summaryText && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumen para WhatsApp</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">{summaryText}</pre>
            <Button
              className="mt-3 bg-[#C2410C] hover:bg-[#9A3412]"
              size="sm"
              onClick={() => navigator.clipboard?.writeText(summaryText)}
            >
              Copiar texto
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
