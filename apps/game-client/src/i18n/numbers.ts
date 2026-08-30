import type { Locale } from './config';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

export function localizeDigits(value: string | number, locale: Locale): string {
  const text = String(value);
  return locale === 'fa' ? text.replace(/[0-9]/gu, (digit) => PERSIAN_DIGITS[Number(digit)]) : text;
}

export function parseLocalizedInteger(value: string): number | null {
  const normalized = value
    .replace(/[۰-۹]/gu, (digit) => String(PERSIAN_DIGITS.indexOf(digit as typeof PERSIAN_DIGITS[number])))
    .replace(/[٠-٩]/gu, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  if (!/^\d+$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
