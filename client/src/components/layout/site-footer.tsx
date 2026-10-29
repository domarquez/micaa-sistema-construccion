import { Link } from "wouter";
import { micaaWaUrl, MICAA_WA_DEFAULT_MSG, MICAA_WHATSAPP_DISPLAY } from "@/lib/micaa-contact";
import { BcbExchangeRate } from "@/components/BcbExchangeRate";

/** Pie de página simple, compartido por todas las páginas públicas. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-[var(--micaa-line)] bg-[var(--micaa-bg)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-[var(--micaa-muted)] sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p>
            <span className="font-semibold text-[var(--micaa-fg)]">MICAA</span> © {year} · Precios y presupuestos de construcción en Bolivia
          </p>
          <BcbExchangeRate className="mt-1" />
          <p className="mt-1">
            WhatsApp:{" "}
            <a
              href={micaaWaUrl(MICAA_WA_DEFAULT_MSG)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--micaa-accent)] hover:underline"
            >
              {MICAA_WHATSAPP_DISPLAY}
            </a>
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/materiales" className="hover:text-[var(--micaa-fg)]">Materiales</Link>
          <Link href="/empresas" className="hover:text-[var(--micaa-fg)]">Empresas</Link>
          <Link href="/anunciar" className="hover:text-[var(--micaa-fg)]">Anunciá tu empresa</Link>
          <Link href="/contacto" className="hover:text-[var(--micaa-fg)]">Contacto</Link>
          <Link href="/lista" className="hover:text-[var(--micaa-fg)]">Mi lista</Link>
        </nav>
      </div>
    </footer>
  );
}
