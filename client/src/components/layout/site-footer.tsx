import { Link } from "wouter";

/** Pie de página simple, compartido por todas las páginas públicas. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-[var(--micaa-line)] bg-[var(--micaa-bg)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-[var(--micaa-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-[var(--micaa-fg)]">MICAA</span> © {year} · Precios y presupuestos de construcción en Bolivia
        </p>
        <nav className="flex gap-4">
          <Link href="/materiales" className="hover:text-[var(--micaa-fg)]">Materiales</Link>
          <Link href="/lista" className="hover:text-[var(--micaa-fg)]">Mi lista</Link>
        </nav>
      </div>
    </footer>
  );
}
