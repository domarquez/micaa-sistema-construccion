import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Smartphone, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { serverLogout } from "@/lib/session";
import WhatsAppCodeFlow from "@/components/WhatsAppCodeFlow";

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("auth_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return d;
  }
}

export function ProfileNameCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setFirstName((user as any)?.firstName || "");
    setLastName((user as any)?.lastName || "");
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ firstName, lastName }),
      });
      if (!r.ok) throw new Error("No se pudo guardar");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Nombre guardado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información Personal</CardTitle>
        <CardDescription>Tu nombre es opcional.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="first-name">Nombre</Label>
            <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="last-name">Apellido</Label>
            <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function LinkWhatsAppCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const linked = (user as any)?.phone as string | null | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5 text-green-600" /> WhatsApp</CardTitle>
        <CardDescription>
          {linked ? `Vinculado: ${linked}. Puedes entrar con un código por WhatsApp, sin contraseña.` : "Vincula tu WhatsApp para entrar con un código, sin contraseña."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant={linked ? "outline" : "default"} onClick={() => setOpen(true)} data-testid="button-link-whatsapp">
            {linked ? "Cambiar número" : "Vincular WhatsApp"}
          </Button>
        ) : (
          <div className="max-w-sm">
            <WhatsAppCodeFlow
              mode="link"
              onSuccess={(data) => {
                setOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
                toast({ title: "WhatsApp vinculado", description: data.phone });
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type Device = { id: string; deviceName: string | null; authMethod: string; createdAt: string; lastSeenAt: string; current: boolean };

export function MyDevicesCard() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await fetch("/api/auth/devices", { credentials: "include", headers: authHeaders() });
      const data = await r.json();
      setDevices(r.ok ? data.devices : []);
    } catch {
      setDevices([]);
    }
  };
  useEffect(() => { load(); }, []);

  const finishLocalLogout = () => {
    localStorage.removeItem("auth_token");
    queryClient.clear();
    window.location.href = "/login";
  };

  const revoke = async (d: Device) => {
    setBusy(true);
    try {
      await fetch(`/api/auth/devices/${encodeURIComponent(d.id)}/revoke`, { method: "POST", credentials: "include", headers: authHeaders() });
      if (d.current) return finishLocalLogout();
      toast({ title: "Sesión cerrada en ese dispositivo" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const logoutThis = async () => {
    setBusy(true);
    await serverLogout(false);
    finishLocalLogout();
  };

  const logoutAll = async () => {
    if (!confirm("¿Cerrar sesión en todos tus dispositivos? Tendrás que entrar de nuevo con tu código.")) return;
    setBusy(true);
    await serverLogout(true);
    finishLocalLogout();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Mis dispositivos</CardTitle>
        <CardDescription>Cada dispositivo queda recordado 30 días desde su último uso (se renueva al usarlo). Solo se pide código en un dispositivo nuevo o si cierras su sesión.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {devices === null ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-500">No hay dispositivos recordados.</p>
        ) : (
          <ul className="divide-y">
            {devices.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-2" data-testid={`device-${d.id}`}>
                <div>
                  <p className="text-sm font-medium">
                    {d.deviceName || "Dispositivo"} {d.current && <span className="ml-1 text-xs text-green-700">(este dispositivo)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    Último uso: {fmt(d.lastSeenAt)} · {d.authMethod === "whatsapp" ? "WhatsApp" : "Contraseña"}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => revoke(d)}>
                  Cerrar sesión
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" disabled={busy} onClick={logoutThis} data-testid="button-logout-this">
            <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión en este dispositivo
          </Button>
          <Button variant="destructive" disabled={busy} onClick={logoutAll} data-testid="button-logout-all">
            Cerrar sesión en todos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
