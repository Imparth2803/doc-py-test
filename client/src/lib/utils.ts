import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidMetadata(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string' && (val.trim() === '' || val.trim().toLowerCase() === 'null' || val.trim().toLowerCase() === 'none')) return false;
  return true;
}
