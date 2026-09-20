import { differenceInMonths, differenceInYears, format, formatDistanceToNow, isValid } from "date-fns";
import { es, enUS } from "date-fns/locale";

const dateLocales = { es, en: enUS } as const;

export type AgeDescriptor = { years: number; months: number };

export function ageFromBirthDate(dateOfBirth: Date, now = new Date()): AgeDescriptor {
  const years = differenceInYears(now, dateOfBirth);
  const months = differenceInMonths(now, dateOfBirth) - years * 12;
  return { years, months };
}

export function formatDate(date: Date | string | null | undefined, locale: string, pattern = "PPP"): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "";
  return format(d, pattern, { locale: dateLocales[locale as keyof typeof dateLocales] ?? es });
}

export function formatDateTime(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, "PPP p");
}

export function formatTime(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, "HH:mm");
}

export function formatRelative(date: Date | string | null | undefined, locale: string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!isValid(d)) return "";
  return formatDistanceToNow(d, { addSuffix: true, locale: dateLocales[locale as keyof typeof dateLocales] ?? es });
}

/** Formats a Date as the value expected by <input type="datetime-local"> (local time). */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
