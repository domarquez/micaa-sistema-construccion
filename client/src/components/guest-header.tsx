import { Link, useLocation } from "wouter";
import { loadLista } from "@/lib/lista";
import { CITY_LIST, getCity, setCity, type MicaaCity } from "@/lib/city";
import { useEffect, useState } from "react";
import { Building2, Download, Menu, X } from "lucide-react";
import { useDisclosureLevel } from "@/hooks/useDisclosureLevel";
import { useAuth } from "@/hooks/useAuth";
import { useInstallPrompt } from "@/lib/pwa";
import { AuthEntryControl } from "@/components/AuthEntryControl";

const baseLinks = [
  { href: "/", label: "Inicio" },
  { href: "/materiales", label: "Materiales" },
  { href: "/lista", label: "Mi lista" },
];
const publishLink = { href: "/publicar-precio", label: "Publicar precio" };

export function GuestHeader() {
  const [location] = useLocation();
  const { can, isAdmin } = useDisclosureLevel();
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
  // Progresivo: "Publicar precio" sólo con sesión iniciada.
  const withPublish = isAuthenticated ? [...baseLinks, publishLink] : baseLinks;
  const links = member ? [...withPublish.slice(0, 1), { href: "/proyectos", label: "Proyectos" }, ...withPublish.slice(1)] : withPublish;

  const citySelect = (cls: string) => (
    <select
      value={city}
      onChange={onCityChange}
      aria-label="Ciudad para precios"
      className={`h-9 rounded-md border bg-white border-[var(--micaa-line)] px-1.5 text-sm text-[var(--micaa-fg)] outline-none focus:border-[var(--micaa-accent)] ${cls}`}
    >
      {CITY_LIST.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--micaa-line)] bg-[var(--micaa-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 text-sm">
        <Link href="/" className="font-semibold tracking-tight text-[var(--micaa-fg)]">
          MICAA
        </Link>

        {/* Desktop: enlaces en línea */}
        <nav className="hidden flex-1 items-center gap-4 overflow-x-auto text-[var(--micaa-muted)] sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? "whitespace-nowrap font-medium text-[var(--micaa-fg)]" : "whitespace-nowrap hover:text-[var(--micaa-fg)]"}
            >
              {label(l)}
            </Link>
          ))}
          <Link
            href="/anunciar"
            className={isActive("/anunciar") ? "whitespace-nowrap font-medium text-[var(--micaa-accent)]" : "whitespace-nowrap text-[var(--micaa-accent)] hover:underline"}
            data-testid="link-registra-empresa-desktop"
          >
            Registrá tu empresa gratis
          </Link>
        </nav>
        <label className="hidden shrink-0 items-center gap-2 text-sm text-[var(--micaa-muted)] sm:flex">
          <span className="hidden md:inline">Ciudad</span>
          {citySelect("max-w-[9.5rem]")}
        </label>
        {canInstall && (
          <button type="button" onClick={() => install()} className="hidden items-center gap-1 whitespace-nowrap rounded-md border border-[var(--micaa-line)] px-2 py-1 text-sm font-medium text-[var(--micaa-fg)] hover:border-[var(--micaa-accent)] sm:flex" data-testid="button-install-app">
            <Download className="h-3.5 w-3.5" /> Instalar app
          </button>
        )}
        {isAdmin ? (
          <Link href="/dashboard" className="hidden whitespace-nowrap text-[var(--micaa-accent)] sm:inline">Panel</Link>
        ) : null}
        <div className="hidden sm:block">
          <AuthEntryControl />
        </div>

        {/* Móvil: auth + hamburguesa (sin CTA Inscribite duplicado) */}
        <div className="ml-auto flex items-center gap-2 sm:hidden">
          <AuthEntryControl />
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
          <nav className="mx-auto flex max-w-5xl flex-col px-4 py-2 text-base">
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
            <Link
              href="/anunciar"
              className="flex items-center gap-2 py-2.5 font-medium text-[var(--micaa-accent)]"
              data-testid="link-registra-empresa-mobile"
            >
              <Building2 className="h-4 w-4" /> Registrá tu empresa gratis
            </Link>
            <label className="flex items-center justify-between gap-2 py-2.5 text-[var(--micaa-muted)]">
              <span>Ciudad</span>
              {citySelect("max-w-[12rem]")}
            </label>
            {canInstall && (
              <button type="button" onClick={() => install()} className="flex items-center gap-2 py-2.5 text-left text-[var(--micaa-muted)]">
                <Download className="h-4 w-4" /> Instalar app
              </button>
            )}
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
