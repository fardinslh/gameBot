import { en } from './messages/en';
import { fa } from './messages/fa';

export const locales = ['en', 'fa'] as const;
export type Locale = (typeof locales)[number];
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, fa };

export function normalizeLocale(locale?: string): Locale {
  return locale === 'fa' ? 'fa' : 'en';
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
