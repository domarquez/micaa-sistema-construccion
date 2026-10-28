import { useState } from "react";
import { Link } from "wouter";
import { Building2, Megaphone, Star, LayoutTemplate } from "lucide-react";
import { adPlanPrice, micaaWaAdvertiseMsg, micaaWaUrl } from "@/lib/micaa-contact";
import { track } from "@/lib/analytics";

const PLANS = [
  {
    id: "destacado",
    title: "Destacado en la guía",
    icon: Star,
    desc: "Tu empresa aparece primero en /empresas con una insignia «Destacado». Ideal si querés que te encuentren al buscar proveedores.",
    priceEnv: "VITE_AD_PRICE_DESTACADO",
  },
  {
    id: "material",
    title: "Proveedor destacado en un material",
    icon: Building2,
    desc: "Salís primero en «Ver N proveedores» del material que elijas (cemento, acero, cerámica…). Los constructores te ven cuando comparan precios.",
    priceEnv: "VITE_AD_PRICE_MATERIAL",
  },
  {
    id: "banner",
    title: "Banner en páginas públicas",
    icon: LayoutTemplate,
    desc: "Espacio de banner en el inicio, materiales o la guía. Más visibilidad de marca para ferreterías y distribuidores.",
    priceEnv: "VITE_AD_PRICE_BANNER",
  },
];

export default function AnunciarPage() {
  const [companyName, setCompanyName] = useState("");
  const href = micaaWaUrl(micaaWaAdvertiseMsg(companyName));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-medium text-[var(--micaa-accent)]">
        <Megaphone className="mr-1 inline h-4 w-4" /> Publicidad en MICAA
      </p>
      <h1 className="mt-2 text-[22px] font-semibold text-[var(--micaa-fg)]">Anunciá tu empresa</h1>
      <p className="mt-2 text-base text-[var(--micaa-muted)]">
        MICAA lo usan arquitectos y constructores que buscan precios reales en Bolivia.
        Aparecé donde ya están mirando materiales y proveedores.
      </p>

      <ul className="mt-6 space-y-2 text-base text-[var(--micaa-fg)]">
        <li>• Te ven quienes comparan precios antes de comprar.</li>
        <li>• Enlace directo a tu WhatsApp o web.</li>
        <li>• Planes simples; sin contratos eternos.</li>
      </ul>

      <div className="mt-8 grid gap-4 sm:grid-cols-1">
        {PLANS.map((p) => {
          const Icon = p.icon;
          const price = adPlanPrice(p.priceEnv);
          return (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--micaa-line)] bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--micaa-accent-soft,#fff3e8)] text-[var(--micaa-accent)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-[var(--micaa-fg)]">{p.title}</h2>
                    <span className="text-sm font-medium text-[var(--micaa-accent)]">
                      {price === "consultar" ? "Precio: consultar" : `Desde ${price}`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--micaa-muted)]">{p.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-[var(--micaa-line)] bg-[var(--micaa-bg)] p-5">
        <label htmlFor="anunciar-empresa" className="text-sm font-medium text-[var(--micaa-fg)]">
          Nombre de tu empresa (opcional)
        </label>
        <input
          id="anunciar-empresa"
          className="mt-2 h-11 w-full rounded-lg border border-[var(--micaa-line)] bg-white px-3 text-base"
          placeholder="Ej. Ferretería El Constructor"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="cta-anunciar-whatsapp"
          onClick={() => track("whatsapp_click", { source: "anunciar" })}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--micaa-accent)] px-4 text-base font-medium text-white hover:opacity-95 sm:w-auto"
        >
          Escribir por WhatsApp
        </a>
        <p className="mt-2 text-xs text-[var(--micaa-muted)]">
          Te respondemos por el WhatsApp de MICAA. Las cotizaciones de materiales a proveedores
          siguen siendo aparte.
        </p>
      </div>

      <p className="mt-8 text-sm text-[var(--micaa-muted)]">
        ¿Ya estás en la guía?{" "}
        <Link href="/empresas" className="text-[var(--micaa-accent)] hover:underline">
          Ver empresas
        </Link>
        {" · "}
        <Link href="/contacto" className="text-[var(--micaa-accent)] hover:underline">
          Contacto
        </Link>
      </p>
    </div>
  );
}
