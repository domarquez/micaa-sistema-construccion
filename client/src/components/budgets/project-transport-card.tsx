/**
 * Ubicación de la obra → "Transporte y movilización" (divulgación progresiva).
 * Por defecto solo una línea: "📍 Dentro del 4º anillo (sin recargo)" o "📍 Obra a 31 km del centro · editar".
 * "editar" abre: volver a detectar, zona predefinida, km a mano y (opcional) pin en un mapa Leaflet.
 */
import { lazy, Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BASE_PRICE_NOTE, TRANSPORT_METHOD_LABELS, cityKmZero, faresPerDay, materialsPct, type CityKmZero, type TransportMethod } from "@shared/transport";

const ProjectLocationMap = lazy(() => import("./project-location-map"));

interface Props {
  project: any;
  onProjectChange?: (p: any) => void;
  compact?: boolean;
}

const fmtKm = (n: number) => n.toLocaleString("es-BO", { maximumFractionDigits: 1 });

export function transportSummaryText(project: any): string {
  const kz = cityKmZero(project?.city);
  const extra = Number(project?.extraKm ?? 0) || 0;
  const dist = project?.distanceKm != null ? Number(project.distanceKm) : null;
  const method = (project?.transportMethod || null) as TransportMethod | null;
  if (!method || method === "none") return `${kz?.zeroLabel ?? "Área urbana"} (sin recargo de transporte)`;
  if (method === "preset") {
    const z = kz?.zones.find((x) => x.key === project.transportZone);
    return extra > 0 ? `Zona: ${z?.label ?? project.transportZone} · ${fmtKm(extra)} km extra` : `${z?.label ?? kz?.zeroLabel} (sin recargo)`;
  }
  if (method === "manual") return extra > 0 ? `${fmtKm(extra)} km extra (ingresado a mano)` : "Sin recargo (0 km extra)";
  const where = dist != null ? `Ubicación detectada: ${fmtKm(dist)} km de ${kz?.center.name ?? "el centro"}` : "Ubicación detectada";
  return extra > 0 ? `${where} · ${fmtKm(extra)} km más allá del km cero` : `${where} · dentro del km cero (sin recargo)`;
}

export default function ProjectTransportCard({ project, onProjectChange, compact }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [km, setKm] = useState<string>("");
  const [showMap, setShowMap] = useState(false);
  const { data: cfg } = useQuery<{ kmZero: CityKmZero | null }>({
    queryKey: ["/api/transport/config", { city: project?.city || "Santa Cruz" }],
    enabled: open,
    staleTime: 3600_000,
  });
  if (!project?.id) return null;
  const kz = cfg?.kmZero ?? cityKmZero(project.city);
  const extra = Number(project.extraKm ?? 0) || 0;

  const save = async (body: any, okMsg: string) => {
    setBusy(true);
    try {
      const res = await apiRequest("PUT", `/api/projects/${project.id}/transport`, body);
      const data = await res.json();
      onProjectChange?.({ ...project, ...data.project });
      qc.invalidateQueries({ queryKey: ["/api/budgets"] });
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      const st = data.status;
      if (body.mode === "auto" && !st?.ok) {
        toast({ title: "No se pudo ubicar la dirección", description: "Elige la zona o ingresa los km a mano.", variant: "destructive" });
      } else {
        toast({ title: okMsg, description: transportSummaryText({ ...project, ...data.project }) });
      }
    } catch (e: any) {
      toast({ title: "Error", description: String(e?.message || e).slice(0, 160), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const center =
    project.latitude != null && project.longitude != null
      ? { lat: Number(project.latitude), lng: Number(project.longitude) }
      : kz
        ? { lat: kz.center.lat, lng: kz.center.lng }
        : { lat: -17.78328, lng: -63.18212 };

  return (
    <div className={`rounded-md border border-dashed ${compact ? "p-2" : "p-3"} text-xs sm:text-sm bg-slate-50`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <span className="text-slate-700">{transportSummaryText(project)}</span>
        <button type="button" className="text-primary underline underline-offset-2" onClick={() => setOpen((o) => !o)}>
          {open ? "cerrar" : "editar"}
        </button>
      </div>
      {extra > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          Se suma «Transporte y movilización» al presupuesto: materiales +{materialsPct(extra, 1).toLocaleString("es-BO", { maximumFractionDigits: 2 })} %
          (× factor de ciudad) y {faresPerDay(extra)} pasaje(s) extra por obrero·día.
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-slate-500">
            {BASE_PRICE_NOTE} {kz ? `Km cero: ${kz.zeroLabel} (≈ ${kz.radiusKm} km por calle desde ${kz.center.name}).` : ""}
            {project.geocodedAddress ? ` Dirección encontrada: ${String(project.geocodedAddress).slice(0, 120)}.` : ""}
            {project.transportMethod ? ` Método: ${TRANSPORT_METHOD_LABELS[project.transportMethod as TransportMethod] ?? project.transportMethod}.` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy || !project.location} onClick={() => save({ mode: "auto" }, "Ubicación detectada")}>
              Detectar desde la dirección
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setShowMap((s) => !s)}>
              {showMap ? "Ocultar mapa" : "Ajustar en el mapa"}
            </Button>
          </div>
          {kz && kz.zones.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-slate-600">Zona:</label>
              <select
                className="border rounded px-2 py-1 text-xs sm:text-sm max-w-full"
                disabled={busy}
                value={project.transportMethod === "preset" ? project.transportZone ?? "" : ""}
                onChange={(e) => e.target.value && save({ mode: "preset", zone: e.target.value }, "Zona guardada")}
              >
                <option value="">Elegir zona…</option>
                {kz.zones.map((z) => (
                  <option key={z.key} value={z.key}>
                    {z.label}{z.extraKm > 0 ? ` (+${z.extraKm} km)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-slate-600">Avanzado · km extra más allá del km cero:</label>
            <Input type="number" min={0} max={80} step={0.5} value={km} onChange={(e) => setKm(e.target.value)} className="w-24 h-8 text-xs" placeholder={String(extra)} />
            <Button type="button" size="sm" variant="outline" disabled={busy || km === ""} onClick={() => save({ mode: "manual", extraKm: Number(km) }, "Km guardados")}>
              Usar estos km
            </Button>
          </div>
          {showMap && (
            <Suspense fallback={<div className="h-56 grid place-items-center text-slate-400">Cargando mapa…</div>}>
              <p className="text-[11px] text-slate-500">Toca el mapa donde está la obra para recalcular la distancia.</p>
              <ProjectLocationMap
                center={center}
                kmZero={kz ? { lat: kz.center.lat, lng: kz.center.lng, name: kz.center.name, radiusKm: kz.radiusKm } : null}
                onPick={(p) => save({ mode: "pin", lat: p.lat, lng: p.lng }, "Ubicación marcada")}
              />
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
