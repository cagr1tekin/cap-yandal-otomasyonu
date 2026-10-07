import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

const TZ = 'Europe/Istanbul';

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric' }) : '—';

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d
    ? new Date(d).toLocaleString('tr-TR', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const fmtGpa = (n: number | null | undefined) => (n == null ? '—' : n.toFixed(2).replace('.', ','));

export const termLabel = (t: { year: string; season: string }) => `${t.year} ${t.season === 'GUZ' ? 'Güz' : 'Bahar'}`;

/** datetime-local girdisi için İstanbul saatine göre değer. */
export const toLocalInput = (d: string | Date) => {
  const date = new Date(d);
  const local = new Date(date.toLocaleString('en-US', { timeZone: TZ }));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
};

/** datetime-local değerini İstanbul saatinde ISO'ya çevirir. */
export const fromLocalInput = (v: string) => new Date(`${v}:00+03:00`).toISOString();
