/**
 * Mapa mínimo (Leaflet + teselas OSM) para ajustar el pin de la obra.
 * Se carga con import() dinámico solo cuando el usuario pide "Ajustar en el mapa".
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  center: { lat: number; lng: number };
  kmZero: { lat: number; lng: number; name: string; radiusKm: number } | null;
  onPick: (p: { lat: number; lng: number }) => void;
}

export default function ProjectLocationMap({ center, kmZero, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    // Marcador como círculo (evita depender de las imágenes PNG del ícono por defecto)
    const marker = L.circleMarker([center.lat, center.lng], { radius: 9, color: "#dc2626", weight: 3, fillOpacity: 0.6 }).addTo(map);
    if (kmZero) {
      L.circle([kmZero.lat, kmZero.lng], { radius: kmZero.radiusKm * 1000 * 0.75, color: "#2563eb", weight: 1, fillOpacity: 0.04 })
        .addTo(map)
        .bindTooltip(`Km cero (aprox.): ${kmZero.name}`);
    }
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onPick({ lat: Math.round(e.latlng.lat * 1e6) / 1e6, lng: Math.round(e.latlng.lng * 1e6) / 1e6 });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="h-56 w-full rounded-md border" />;
}
