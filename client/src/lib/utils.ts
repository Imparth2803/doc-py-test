import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isValidMetadata = (val: unknown): val is string | number | boolean =>
  val !== null && val !== undefined && typeof val !== 'object';

export function formatMetadataValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}
