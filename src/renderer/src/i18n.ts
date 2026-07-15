import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import si from './locales/si.json'

export const SUPPORTED_LANGUAGES = ['en', 'si'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

const STORAGE_KEY = 'lankapos-bookshop:language'
const DEFAULT_LANGUAGE: SupportedLanguage = 'si'

// Before login (or if somehow no session exists), localStorage is the only
// thing to go on. Once signed in, App.tsx overrides this with the user's
// own saved `language` column — see setLanguageAndPersist below.
function getInitialLanguage(): SupportedLanguage {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'si') return stored
  return DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    si: { translation: si }
  },
  lng: getInitialLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

export function setLanguage(lang: SupportedLanguage): void {
  window.localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

/** Same as setLanguage, but also persists the choice to the signed-in
 *  user's own `language` column so it's remembered on their next login,
 *  not just on this machine's localStorage. */
export async function setLanguageAndPersist(lang: SupportedLanguage): Promise<void> {
  setLanguage(lang)
  await window.api.session.updateOwnLanguage(lang)
}

export default i18n
