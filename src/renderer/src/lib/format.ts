import type { SupportedLanguage } from '../i18n'

// Sinhala Intl support (si-LK) is present in modern Chromium/Electron, which
// is all this app ever runs on, so no manual fallback formatting is needed.
const LOCALE_TAG: Record<SupportedLanguage, string> = {
  en: 'en-LK',
  si: 'si-LK'
}

export function formatCurrency(amount: number, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(LOCALE_TAG[lang], {
    style: 'currency',
    currency: 'LKR',
    currencyDisplay: 'symbol'
  }).format(amount)
}

export function formatDate(date: Date, lang: SupportedLanguage): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[lang], {
    dateStyle: 'medium'
  }).format(date)
}

export function formatDateTime(date: Date, lang: SupportedLanguage): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[lang], {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date)
}

export function formatNumber(value: number, lang: SupportedLanguage): string {
  return new Intl.NumberFormat(LOCALE_TAG[lang]).format(value)
}
