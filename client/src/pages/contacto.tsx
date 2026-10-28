import { Link } from "wouter";
import { MessageCircle, Megaphone } from "lucide-react";
import {
  MICAA_WHATSAPP_DISPLAY,
  MICAA_WA_DEFAULT_MSG,
  micaaWaAdvertiseMsg,
  micaaWaUrl,
} from "@/lib/micaa-contact";
import { track } from "@/lib/analytics";

export default function ContactoPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-[22px] font-semibold text-[var(--micaa-fg)]">Contacto</h1>
      <p className="mt-2 text-base text-[var(--micaa-muted)]">
        Escribinos al WhatsApp de MICAA. Atendemos consultas del sitio, soporte y publicidad.
      </p>

      <div className="mt-8 rounded-xl border border-[var(--micaa-line)] bg-white p-5">
        <p className="text-sm text-[var(--micaa-muted)]">WhatsApp MICAA</p>
        <p className="mt-1 text-lg font-semibold text-[var(--micaa-fg)]">{MICAA_WHATSAPP_DISPLAY}</p>
        <a
          href={micaaWaUrl(MICAA_WA_DEFAULT_MSG)}
          onClick={() => track("whatsapp_click", { source: "contacto" })}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-base font-medium text-white hover:bg-[#1ebe57]"
        >
          <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--micaa-line)] bg-white p-5">
        <p className="flex items-center gap-2 text-base font-medium text-[var(--micaa-fg)]">
          <Megaphone className="h-4 w-4 text-[var(--micaa-accent)]" />
          ¿Querés anunciar tu empresa?
        </p>
        <p className="mt-1 text-sm text-[var(--micaa-muted)]">
          Mirá los planes y escribinos con el nombre de tu negocio.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/anunciar"
            className="inline-flex h-10 items-center rounded-lg border border-[var(--micaa-line)] px-4 text-sm font-medium text-[var(--micaa-fg)] hover:border-[var(--micaa-accent)]"
          >
            Ver planes
          </Link>
          <a
            href={micaaWaUrl(micaaWaAdvertiseMsg())}
            onClick={() => track("whatsapp_click", { source: "contacto-anunciar" })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center rounded-lg bg-[var(--micaa-accent)] px-4 text-sm font-medium text-white"
          >
            Pedir info por WhatsApp
          </a>
        </div>
      </div>

      <p className="mt-8 text-sm text-[var(--micaa-muted)]">
        <Link href="/" className="text-[var(--micaa-accent)] hover:underline">
          Volver al inicio
        </Link>
      </p>
    </div>
  );
}
