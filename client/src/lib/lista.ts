export type ListaSourceKind = "base" | "person" | "supplier";

export interface ListaItem {
  id: string;
  materialId: number;
  sourceKind: ListaSourceKind;
  sourceId?: number | null;
  qty: number;
  unitPriceSnapshot: number;
  nameSnapshot: string;
  unitSnapshot: string;
  sourceLabelSnapshot: string;
}

export interface ListaState {
  title: string;
  city?: string;
  items: ListaItem[];
  updatedAt: string;
}

const KEY = "micaa.lista.v1";

export function loadLista(): ListaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { title: "Mi lista", items: [], updatedAt: new Date().toISOString() };
    const parsed = JSON.parse(raw) as ListaState;
    if (!parsed || !Array.isArray(parsed.items)) {
      return { title: "Mi lista", items: [], updatedAt: new Date().toISOString() };
    }
    return parsed;
  } catch {
    return { title: "Mi lista", items: [], updatedAt: new Date().toISOString() };
  }
}

export function saveLista(state: ListaState) {
  const next = { ...state, updatedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function addListaItem(
  item: Omit<ListaItem, "id"> & { id?: string },
): ListaState {
  const lista = loadLista();
  const id =
    item.id ||
    `${item.materialId}-${item.sourceKind}-${item.sourceId ?? "x"}-${Date.now()}`;
  const existing = lista.items.findIndex(
    (x) =>
      x.materialId === item.materialId &&
      x.sourceKind === item.sourceKind &&
      (x.sourceId ?? null) === (item.sourceId ?? null),
  );
  if (existing >= 0) {
    lista.items[existing] = {
      ...lista.items[existing],
      qty: lista.items[existing].qty + (item.qty || 1),
      unitPriceSnapshot: item.unitPriceSnapshot,
      sourceLabelSnapshot: item.sourceLabelSnapshot,
    };
  } else {
    lista.items.push({
      id,
      materialId: item.materialId,
      sourceKind: item.sourceKind,
      sourceId: item.sourceId ?? null,
      qty: item.qty || 1,
      unitPriceSnapshot: item.unitPriceSnapshot,
      nameSnapshot: item.nameSnapshot,
      unitSnapshot: item.unitSnapshot,
      sourceLabelSnapshot: item.sourceLabelSnapshot,
    });
  }
  return saveLista(lista);
}

export function updateListaQty(id: string, qty: number): ListaState {
  const lista = loadLista();
  lista.items = lista.items
    .map((x) => (x.id === id ? { ...x, qty } : x))
    .filter((x) => x.qty > 0);
  return saveLista(lista);
}

export function removeListaItem(id: string): ListaState {
  const lista = loadLista();
  lista.items = lista.items.filter((x) => x.id !== id);
  return saveLista(lista);
}

export function listaTotal(items: ListaItem[]): number {
  return items.reduce((s, x) => s + x.qty * x.unitPriceSnapshot, 0);
}

export function titleCaseMaterial(name: string): string {
  if (!name) return "";
  const lower = name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
