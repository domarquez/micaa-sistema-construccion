import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { loadLista } from "@/lib/lista";
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
