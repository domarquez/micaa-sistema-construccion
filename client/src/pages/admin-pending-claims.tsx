import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type Row = {
  id: number;
  companyName: string;
  city?: string;
  phoneNormalized?: string;
  claimStatus?: string;
  pendingOwnerPhone?: string | null;
  pendingOwnerPhoneFrom?: string | null;
  priceCount?: number;
};

export default function AdminPendingClaims() {
  const { toast } = useToast();
  const [phones, setPhones] = useState<Record<number, string>>({});
  const { data = [], isLoading } = useQuery<Row[]>({
    queryKey: ["/api/admin/suppliers/pending-claims"],
  });

  const setOwner = useMutation({
    mutationFn: async ({ id, phone, approve }: { id: number; phone: string; approve: boolean }) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/suppliers/${id}/owner-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, approve }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Error");
      return j;
    },
    onSuccess: (j) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers/pending-claims"] });
      toast({ title: j.approved ? "Responsable aprobado" : "Número pendiente", description: j.message });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async (id: number) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/suppliers/${id}/approve-owner-phone`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || "Error");
      return j;
    },
    onSuccess: (j) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/suppliers/pending-claims"] });
      toast({ title: "Aprobado", description: j.message });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-xl font-semibold">Empresas pending claim / responsable</h1>
      <p className="mt-1 text-sm text-[var(--micaa-muted)]">
        Números propuestos por WhatsApp quedan pendientes hasta que apruebes. También podés cargar el responsable acá.
      </p>
      {isLoading ? (
        <p className="mt-6 text-sm">Cargando…</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {data.map((r) => (
            <li key={r.id} className="rounded-xl border border-[var(--micaa-line)] bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">{r.companyName}</h2>
                <span className="text-xs text-[var(--micaa-muted)]">
                  #{r.id} · {r.city} · {r.priceCount ?? 0} precios · {r.claimStatus}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--micaa-muted)]">
                Vendedor: {r.phoneNormalized || "—"}
                {r.pendingOwnerPhone && (
                  <> · Pendiente responsable: <strong>{r.pendingOwnerPhone}</strong> ({r.pendingOwnerPhoneFrom})</>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.pendingOwnerPhone && (
                  <button
                    type="button"
                    className="h-9 rounded-lg bg-[var(--micaa-accent)] px-3 text-sm text-white"
                    onClick={() => approve.mutate(r.id)}
                  >
                    Aprobar responsable
                  </button>
                )}
                <input
                  className="h-9 rounded-lg border border-[var(--micaa-line)] px-2 text-sm"
                  placeholder="70012345"
                  value={phones[r.id] || ""}
                  onChange={(e) => setPhones((p) => ({ ...p, [r.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="h-9 rounded-lg border border-[var(--micaa-line)] px-3 text-sm"
                  onClick={() => setOwner.mutate({ id: r.id, phone: phones[r.id] || "", approve: false })}
                >
                  Guardar pendiente
                </button>
                <button
                  type="button"
                  className="h-9 rounded-lg border border-[var(--micaa-line)] px-3 text-sm"
                  onClick={() => setOwner.mutate({ id: r.id, phone: phones[r.id] || "", approve: true })}
                >
                  Guardar y aprobar
                </button>
              </div>
            </li>
          ))}
          {!data.length && <p className="text-sm text-[var(--micaa-muted)]">Nada pendiente.</p>}
        </ul>
      )}
    </div>
  );
}
