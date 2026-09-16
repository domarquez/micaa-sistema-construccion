import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { loadLista } from "@/lib/lista";
import { CITY_LIST, getCity, setCity, type MicaaCity } from "@/lib/city";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/materiales", label: "Materiales" },
  { href: "/lista", label: "Mi lista" },
  { href: "/publicar-precio", label: "Publicar precio" },
];

export function GuestHeader() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);
  const [city, setCityState] = useState<MicaaCity>(() =>
    typeof window !== "undefined" ? getCity() : "Santa Cruz",
  );

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

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--micaa-line)] bg-[var(--micaa-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-3xl items-center gap-3 px-4 text-sm">
        <Link href="/" className="font-semibold tracking-tight text-[var(--micaa-fg)]">
          MICAA
        </Link>
        <nav className="flex flex-1 items-center gap-3 overflow-x-auto text-[var(--micaa-muted)]">
          {links.map((l) => {
            const active = location === l.href || (l.href !== "/" && location.startsWith(l.href));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  active
                    ? "whitespace-nowrap text-[var(--micaa-fg)]"
                    : "whitespace-nowrap hover:text-[var(--micaa-fg)]"
                }
              >
                {l.label}
                {l.href === "/lista" && count > 0 ? ` (${count})` : ""}
              </Link>
            );
          })}
        </nav>
        <label className="flex shrink-0 items-center gap-1 text-[12px] text-[var(--micaa-muted)]">
          <span className="hidden sm:inline">Ciudad</span>
          <select
            value={city}
            onChange={onCityChange}
            aria-label="Ciudad para precios"
            className="h-8 max-w-[9.5rem] rounded-md border border-[var(--micaa-line)] bg-transparent px-1.5 text-[12px] text-[var(--micaa-fg)] outline-none focus:border-[var(--micaa-accent)]"
          >
            {CITY_LIST.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {isAuthenticated ? (
          <Link href="/dashboard" className="whitespace-nowrap text-[var(--micaa-accent)]">
            Más herramientas
          </Link>
        ) : (
          <Link href="/login" className="whitespace-nowrap text-[var(--micaa-accent)]">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
