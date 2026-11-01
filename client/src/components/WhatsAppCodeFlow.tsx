import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, ArrowLeft } from "lucide-react";

type WaConfig = {
  enabled: boolean;
  waLink: string | null;
  waNumber?: string | null;
  requestText: string;
  cooldownSeconds: number;
};

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
 * Login inbound-first: el usuario escribe a MICAA por WhatsApp ("Quiero mi código MICAA")
 * y MICAA responde. No hay envío outbound desde /api/auth/wa/request.
 */
export default function WhatsAppCodeFlow({ mode, onSuccess }: Props) {
  const [config, setConfig] = useState<WaConfig | null>(null);
  const [step, setStep] = useState<"start" | "code">("start");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [start, setStart] = useState<{ ref: string; waLink: string } | null>(null);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const autoVerifyRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/wa/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ enabled: false, waLink: null, requestText: "", cooldownSeconds: 60 }));
    fetch("/api/auth/wa/start", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && d.ref && d.waLink) setStart({ ref: d.ref, waLink: d.waLink });
      })
      .catch(() => {});
  }, []);

  const waHref = start?.waLink || config?.waLink || null;
  const base = mode === "login" ? "/api/auth/wa" : "/api/auth/wa/link";
  const phoneLooksOk = phone.replace(/\D/g, "").length >= 8;

  const goToCodeStep = () => {
    setError("");
    setMismatch(null);
    setInfo("Enviá el mensaje en WhatsApp. MICAA te responde con el código de 6 dígitos; escribilo acá.");
    setStep("code");
  };

  const verify = async (opts?: { useSender?: boolean; codeOverride?: string }) => {
    if (busy) return;
    const useSender = !!opts?.useSender;
    const codeValue = opts?.codeOverride ?? code;
    if (!useSender && !phoneLooksOk) {
      setError("Escribí el número de WhatsApp desde el que pediste el código.");
      return;
    }
    if (codeValue.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${base}/verify`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ phone, code: codeValue, ref: start?.ref, useSender }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 409 && data.code === "PHONE_MISMATCH") {
        setMismatch(data.senderMasked || "otro número");
        throw new Error(data.message);
      }
      if (!r.ok) throw new Error(data.message || "Código incorrecto. Revisá los 6 dígitos.");
      setMismatch(null);
      onSuccess(data);
    } catch (e: any) {
      setError(e.message);
      autoVerifyRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  // Auto-verifica al completar 6 dígitos
  useEffect(() => {
    if (step !== "code" || code.length !== 6 || busy || autoVerifyRef.current) return;
    if (!phoneLooksOk && !mismatch) return;
    autoVerifyRef.current = true;
    void verify({ codeOverride: code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step, phoneLooksOk]);

  if (config && !config.enabled) {
    return (
      <p className="text-xs text-muted-foreground text-center">
        El acceso por WhatsApp no está disponible en este momento.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {step === "start" ? (
        <>
          <p className="text-xs sm:text-sm text-muted-foreground text-center">
            Abrí WhatsApp, enviá el mensaje listo a MICAA y te respondemos con tu código. MICAA no inicia la conversación.
          </p>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-testid="button-wa-open"
              onClick={goToCodeStep}
            >
              <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
            </a>
          ) : (
            <Button type="button" className="w-full" disabled data-testid="button-wa-open">
              <MessageCircle className="w-4 h-4 mr-2" /> Cargando WhatsApp…
            </Button>
          )}
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground hover:underline"
            onClick={goToCodeStep}
            data-testid="button-wa-already-sent"
          >
            Ya envié el mensaje — ingresar código
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            autoVerifyRef.current = true;
            void verify();
          }}
          className="space-y-3"
        >
          {info && <p className="text-xs text-muted-foreground text-center">{info}</p>}
          <div className="space-y-1">
            <Label htmlFor="wa-phone" className="text-xs sm:text-sm">
              Número desde el que escribiste
            </Label>
            <Input
              id="wa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                autoVerifyRef.current = false;
                setPhone(e.target.value);
              }}
              placeholder="7123 4567"
              data-testid="input-wa-phone"
            />
            <p className="text-xs text-muted-foreground">Bolivia (+591) por defecto. Otro país: con +.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-code" className="text-xs sm:text-sm">
              Código de 6 dígitos
            </Label>
            <Input
              id="wa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => {
                autoVerifyRef.current = false;
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              placeholder="000000"
              className="text-center text-2xl tracking-widest"
              maxLength={6}
              data-testid="input-wa-code"
            />
          </div>
          {mismatch && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-primary text-primary"
              disabled={busy}
              onClick={() => verify({ useSender: true })}
              data-testid="button-wa-use-sender"
            >
              {mode === "login" ? "Entrar" : "Vincular"} con el WhatsApp {mismatch}
            </Button>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={code.length !== 6 || !phoneLooksOk || busy}
            data-testid="button-wa-verify"
          >
            {busy ? "Verificando..." : mode === "login" ? "Entrar" : "Vincular WhatsApp"}
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              className="text-muted-foreground hover:underline flex items-center gap-1"
              onClick={() => {
                setStep("start");
                setCode("");
                setError("");
                setInfo("");
                setMismatch(null);
                autoVerifyRef.current = false;
              }}
            >
              <ArrowLeft className="w-3 h-3" /> Volver
            </button>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                data-testid="link-wa-reopen"
              >
                Reabrir WhatsApp
              </a>
            )}
          </div>
        </form>
      )}
      {error && (
        <div className="text-red-600 text-xs bg-red-50 p-2 rounded-md border border-red-200" data-testid="text-wa-error">
          {error}
        </div>
      )}
    </div>
  );
}
