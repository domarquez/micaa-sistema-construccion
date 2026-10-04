import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, ArrowLeft } from "lucide-react";

type WaConfig = { enabled: boolean; waLink: string | null; requestText: string; cooldownSeconds: number };

type Props = {
  mode: "login" | "link";
  /** login: {token, user, isNewUser}; link: {phone} */
  onSuccess: (data: any) => void;
};

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem("auth_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Flujo de código por WhatsApp.
 * Preferido: "Abrir WhatsApp" (el usuario nos escribe "Quiero mi código MICAA" y el servidor responde con el código).
 * Fallback: "Enviarme el código" (POST /api/auth/wa/request).
 */
export default function WhatsAppCodeFlow({ mode, onSuccess }: Props) {
  const [config, setConfig] = useState<WaConfig | null>(null);
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  // Flujo "Abrir WhatsApp" con ref: el server sabe desde qué número se pidió el código.
  const [start, setStart] = useState<{ ref: string; waLink: string } | null>(null);
  const [mismatch, setMismatch] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/wa/config").then((r) => r.json()).then(setConfig).catch(() => setConfig({ enabled: false, waLink: null, requestText: "", cooldownSeconds: 60 }));
    // Se pide al montar para que window.open sea síncrono al tocar el botón (bloqueadores de popups).
    fetch("/api/auth/wa/start", { method: "POST" })
      .then((r) => r.json())
      .then((d) => { if (d?.ok && d.ref && d.waLink) setStart({ ref: d.ref, waLink: d.waLink }); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const phoneLooksOk = phone.replace(/\D/g, "").length >= 8;
  const base = mode === "login" ? "/api/auth/wa" : "/api/auth/wa/link";

  const openWhatsApp = () => {
    const link = start?.waLink || config?.waLink;
    if (!link) return;
    setError("");
    setMismatch(null);
    window.open(link, "_blank", "noopener");
    setInfo("Envía el mensaje en WhatsApp y te responderemos con tu código.");
    setStep("code");
  };

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ phone }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data.retryAfterSeconds && data.code === "COOLDOWN") setCooldown(data.retryAfterSeconds);
        throw new Error(data.message || "No se pudo enviar el código");
      }
      setInfo("Te enviamos un código por WhatsApp. Vence en 5 minutos.");
      setCooldown(data.cooldownSeconds || 60);
      setStep("code");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e?: React.FormEvent, useSender = false) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ phone, code, ref: start?.ref, useSender }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 409 && data.code === "PHONE_MISMATCH") {
        setMismatch(data.senderMasked || "otro número");
        throw new Error(data.message);
      }
      if (!r.ok) throw new Error(data.message || "Código incorrecto. Revisa los 6 dígitos.");
      setMismatch(null);
      onSuccess(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (config && !config.enabled) {
    return <p className="text-xs text-gray-500 text-center">El acceso por WhatsApp no está disponible en este momento.</p>;
  }

  return (
    <div className="space-y-3">
      {step === "phone" ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="wa-phone" className="text-xs sm:text-sm">Tu número de WhatsApp</Label>
            <Input
              id="wa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="7123 4567"
              data-testid="input-wa-phone"
            />
            <p className="text-[10px] sm:text-xs text-gray-500">Bolivia (+591) por defecto. Otro país: escribe el número con +.</p>
          </div>
          <Button
            type="button"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!phoneLooksOk || !(start?.waLink || config?.waLink)}
            onClick={openWhatsApp}
            data-testid="button-wa-open"
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Abrir WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!phoneLooksOk || busy || cooldown > 0}
            onClick={sendCode}
            data-testid="button-wa-send"
          >
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Enviando..." : cooldown > 0 ? `Enviarme el código (${cooldown}s)` : "Enviarme el código"}
          </Button>
        </>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          {info && <p className="text-xs text-gray-600 text-center">{info}</p>}
          <div className="space-y-1">
            <Label htmlFor="wa-code" className="text-xs sm:text-sm">Código de 6 dígitos</Label>
            <Input
              id="wa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest"
              maxLength={6}
              data-testid="input-wa-code"
            />
          </div>
          {mismatch && (
            <Button type="button" variant="outline" className="w-full border-green-600 text-green-700" disabled={busy} onClick={() => verify(undefined, true)} data-testid="button-wa-use-sender">
              {mode === "login" ? "Entrar" : "Vincular"} con el WhatsApp {mismatch}
            </Button>
          )}
          <Button type="submit" className="w-full" disabled={code.length !== 6 || busy} data-testid="button-wa-verify">
            {busy ? "Verificando..." : mode === "login" ? "Entrar" : "Vincular WhatsApp"}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button type="button" className="text-gray-600 hover:underline flex items-center gap-1" onClick={() => { setStep("phone"); setCode(""); setError(""); setInfo(""); setMismatch(null); }}>
              <ArrowLeft className="w-3 h-3" /> Cambiar número
            </button>
            <button type="button" className="text-primary hover:underline disabled:opacity-50" disabled={busy || cooldown > 0} onClick={sendCode}>
              {cooldown > 0 ? `Reenviar (${cooldown}s)` : "Enviarme el código"}
            </button>
          </div>
        </form>
      )}
      {error && <div className="text-red-600 text-xs bg-red-50 p-2 rounded-md border border-red-200" data-testid="text-wa-error">{error}</div>}
    </div>
  );
}
