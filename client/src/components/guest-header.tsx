import { Link, useLocation } from "wouter";
import { loadLista } from "@/lib/lista";
import { CITY_LIST, getCity, setCity, type MicaaCity } from "@/lib/city";
import { useEffect, useState } from "react";
import { Menu, X, Download } from "lucide-react";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";
import { useAuth } from "@/hooks/useAuth";
import { useInstallPrompt } from "@/lib/pwa";
import { WhatsAppSignupCta } from "@/components/DisclosureGate";

const baseLinks = [
  { href: "/", label: "Inicio" },
  { href: "/materiales", label: "Materiales" },
  { href: "/lista", label: "Mi lista" },
  { href: "/publicar-precio", label: "Publicar precio" },
];

export function GuestHeader() {
  const [location] = useLocation();
  const { can, isAdmin, nextStep } = useDisclosureLevel();
  const { isAuthenticated, logout } = useAuth();
  const { canInstall, install } = useInstallPrompt();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [city, setCityState] = useState<MicaaCity>(() =>
    typeof window !== "undefined" ? getCity() : "Santa Cruz",
  );
  const member = can("projects");

  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    const sync = () => setCount(loadLista().items.length);
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("micaa-lista", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("micaa-lista", sync);
    };
  }, [location]);

  useEffect(() => {
    const syncCity = () => setCityState(getCity());
    syncCity();
    window.addEventListener("storage", syncCity);
    window.addEventListener("micaa-city", syncCity as EventListener);
    return () => {
      window.removeEventListener("storage", syncCity);
      window.removeEventListener("micaa-city", syncCity as EventListener);
    };
  }, []);

  const onCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = setCity(e.target.value);
    setCityState(next);
  };

  const isActive = (href: string) => location === href || (href !== "/" && location.startsWith(href));
  const label = (l: { href: string; label: string }) => `${l.label}${l.href === "/lista" && count > 0 ? ` (${count})` : ""}`;
  const links = member ? [...baseLinks.slice(0, 1), { href: "/proyectos", label: "Proyectos" }, ...baseLinks.slice(1)] : baseLinks;

  const citySelect = (cls: string) => (
    <select
      value={city}
      onChange={onCityChange}
      aria-label="Ciudad para precios"
      className={`h-8 rounded-md border border-[var(--micaa-line)] bg-transparent px-1.5 text-[12px] text-[var(--micaa-fg)] outline-none focus:border-[var(--micaa-accent)] ${cls}`}
    >
      {CITY_LIST.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--micaa-line)] bg-[var(--micaa-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-3xl items-center gap-3 px-4 text-sm">
        <Link href="/" className="font-semibold tracking-tight text-[var(--micaa-fg)]">
          MICAA
        </Link>

        {/* Desktop: enlaces en línea (igual que antes) */}
        <nav className="hidden flex-1 items-center gap-3 overflow-x-auto text-[var(--micaa-muted)] sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? "whitespace-nowrap text-[var(--micaa-fg)]" : "whitespace-nowrap hover:text-[var(--micaa-fg)]"}
            >
              {label(l)}
            </Link>
          ))}
        </nav>
        <label className="hidden shrink-0 items-center gap-1 text-[12px] text-[var(--micaa-muted)] sm:flex">
          <span className="hidden md:inline">Ciudad</span>
          {citySelect("max-w-[9.5rem]")}
        </label>
        {canInstall && (
          <button type="button" onClick={() => install()} className="hidden items-center gap-1 whitespace-nowrap text-[12px] text-[var(--micaa-muted)] hover:text-[var(--micaa-fg)] sm:flex" data-testid="button-install-app">
            <Download className="h-3.5 w-3.5" /> Instalar app
          </button>
        )}
        <div className="hidden sm:block">
          {member ? (
            isAdmin ? (
              <Link href="/dashboard" className="whitespace-nowrap text-[var(--micaa-accent)]">Panel</Link>
            ) : null
          ) : (
            <WhatsAppSignupCta compact />
          )}
        </div>

        {/* Móvil: logo + (CTA corto) + hamburguesa */}
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          {nextStep && (
            <Link
              href={nextStep === "login" ? "/login" : "/inscribete"}
              className="rounded-full bg-green-600 px-3 py-1 text-[12px] font-medium text-white"
              data-testid="cta-whatsapp-mobile"
            >
              Inscríbete
            </Link>
          )}
          <button
            type="button"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--micaa-fg)] hover:bg-black/[0.04]"
            data-testid="button-mobile-menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--micaa-line)] bg-[var(--micaa-bg)] sm:hidden" data-testid="mobile-menu">
          <nav className="mx-auto flex max-w-3xl flex-col px-4 py-2 text-[15px]">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`py-2.5 ${isActive(l.href) ? "font-medium text-[var(--micaa-fg)]" : "text-[var(--micaa-muted)]"}`}
              >
                {label(l)}
              </Link>
            ))}
            {member && (
              <Link href="/plantillas" className="py-2.5 text-[var(--micaa-muted)]">Desde plantilla</Link>
            )}
            {isAdmin && (
              <Link href="/dashboard" className="py-2.5 text-[var(--micaa-muted)]">Panel de administración</Link>
            )}
            <label className="flex items-center justify-between gap-2 py-2.5 text-[var(--micaa-muted)]">
              <span>Ciudad</span>
              {citySelect("max-w-[12rem]")}
            </label>
            {canInstall && (
              <button type="button" onClick={() => install()} className="flex items-center gap-2 py-2.5 text-left text-[var(--micaa-muted)]">
                <Download className="h-4 w-4" /> Instalar app
              </button>
            )}
            {nextStep ? (
              <Link
                href={nextStep === "login" ? "/login" : "/inscribete"}
                className="my-2 rounded-md bg-green-600 px-4 py-2.5 text-center font-medium text-white"
              >
                Inscríbete con WhatsApp
              </Link>
            ) : null}
            {isAuthenticated && (
              <button type="button" onClick={() => logout()} className="py-2.5 text-left text-[var(--micaa-muted)]">
                Cerrar sesión
              </button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
