import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formato Bs X,XX (sin "BOB", sin wrap). NaN → Bs 0,00. */
export function formatCurrency(amount: number | string | null | undefined): string {
  const raw = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  const n = Number.isFinite(raw) ? raw : 0;
  return `Bs ${n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Subtotal efectivo de un ítem: usa subtotal guardado; si está ~0 pero
 * cantidad×P.U. > 0, recalcula (cubre filas con unit_price ok y subtotal 0).
 */
export function itemEffectiveSubtotal(item: {
  quantity?: string | number | null;
  unitPrice?: string | number | null;
  subtotal?: string | number | null;
}): number {
  const st = Number(item?.subtotal);
  const q = Number(item?.quantity);
  const pu = Number(item?.unitPrice);
  const computed = (Number.isFinite(q) && Number.isFinite(pu)) ? Math.round(q * pu * 100) / 100 : 0;
  if (Number.isFinite(st) && Math.abs(st) > 0.0005) return Math.round(st * 100) / 100;
  if (computed > 0.0005) return computed;
  return Number.isFinite(st) ? Math.round(st * 100) / 100 : 0;
}

export function formatNumber(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-BO').format(num);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-BO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) {
    return `Hace ${days} día${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `Hace ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  } else {
    return 'Hace un momento';
  }
}

export function calculateSubtotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}
