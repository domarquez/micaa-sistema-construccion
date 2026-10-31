import { useMemo, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useLocation } from "wouter";
import { micaaWaUrl, MICAA_WA_DEFAULT_MSG } from "@/lib/micaa-contact";
import { track } from "@/lib/analytics";
import { getCity } from "@/lib/city";

function buildContextMessage(location: string): { label: string; text: string }[] {
  const city = getCity() || "";
  const cityBit = city ? ` Ciudad: ${city}.` : "";
  const path = location.split("?")[0];

  const budgetMatch = path.match(/^\/budgets\/(\d+)/);
  const materialMatch = path.match(/^\/materiales\/(\d+)/);

  const baseCtx = `Página: ${path}.${cityBit}`;

  if (budgetMatch) {
    const id = budgetMatch[1];
    return [
      {
        label: "Consultar este presupuesto",
        text: `Hola MICAA, consulto el presupuesto #${id}. ${baseCtx}`,
      },
      {
        label: "Reportar falla o precio",
        text: `Hola MICAA, quiero reportar una falla o un precio incorrecto en el presupuesto #${id}. ${baseCtx}`,
      },
    ];
  }

  if (materialMatch) {
    const id = materialMatch[1];
    return [
      {
        label: "Consultar este material",
        text: `Hola MICAA, consulto el material #${id}. ${baseCtx}`,
      },
      {
        label: "Reportar falla o precio",
        text: `Hola MICAA, quiero reportar una falla o un precio incorrecto del material #${id}. ${baseCtx}`,
      },
    ];
  }

  if (path.startsWith("/budgets")) {
    return [
      {
        label: "Consultar presupuestos",
        text: `Hola MICAA, tengo una consulta sobre mis presupuestos. ${baseCtx}`,
      },
      {
        label: "Reportar falla o precio",
        text: `Hola MICAA, quiero reportar una falla o un precio incorrecto. ${baseCtx}`,
      },
    ];
  }

  if (path.startsWith("/materiales") || path.startsWith("/materials")) {
    return [
      {
        label: "Consultar materiales",
        text: `Hola MICAA, consulta sobre materiales. ${baseCtx}`,
      },
      {
        label: "Reportar falla o precio",
        text: `Hola MICAA, quiero reportar una falla o un precio incorrecto de un material. ${baseCtx}`,
      },
    ];
  }

  return [
    {
      label: "Escribir a MICAA",
      text: `${MICAA_WA_DEFAULT_MSG} (${baseCtx})`,
    },
    {
      label: "Reportar falla o precio",
      text: `Hola MICAA, quiero reportar una falla o un precio incorrecto. ${baseCtx}`,
    },
  ];
}

/** Botón flotante WhatsApp con mensaje según la página (presupuesto / material / ciudad). */
export function MicaaWhatsAppFab() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const options = useMemo(() => buildContextMessage(location), [location]);

  // En detalle de presupuesto: subir el FAB para no tapar el sticky TOTAL.
  const onBudgetDetail = /^\/budgets\/\d+/.test(location);
  const bottomClass = onBudgetDetail ? "bottom-24" : "bottom-5";

  return (
    <div className={`fixed ${bottomClass} right-5 z-40 flex flex-col items-end gap-2`}>
      {open && (
        <div
          className="mb-1 w-[min(92vw,18rem)] rounded-xl border bg-white p-2 shadow-xl"
          role="menu"
          data-testid="fab-micaa-whatsapp-menu"
        >
          <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">WhatsApp MICAA</p>
          {options.map((opt) => (
            <a
              key={opt.label}
              href={micaaWaUrl(opt.text)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="block rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
              onClick={() => {
                track("whatsapp_click", { source: "fab", label: opt.label, path: location });
                setOpen(false);
              }}
            >
              {opt.label}
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Cerrar menú WhatsApp" : "Escribir a MICAA por WhatsApp"}
        aria-expanded={open}
        data-testid="fab-micaa-whatsapp"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105 hover:bg-[#1ebe57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--micaa-accent)]"
      >
        {open ? <X className="h-7 w-7" strokeWidth={2.2} /> : <MessageCircle className="h-7 w-7" strokeWidth={2.2} />}
      </button>
    </div>
  );
}
