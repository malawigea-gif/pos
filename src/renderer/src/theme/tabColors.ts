import type { AppPage } from '../App'

/** One accent color per top-level tab, consumed via the `--tab-accent` /
 *  `--page-accent` CSS custom properties (see TopBar and TabbedPage
 *  styles). Adding a new tab means adding one entry here — no other file
 *  should hard-code a tab color. Values are chosen to stay legible as text
 *  on the app's light background (`--color-bg` / `--color-surface`). */
export const TAB_ACCENT_COLORS: Record<AppPage, string> = {
  sales: '#1f6feb',
  quotations: '#0e7490',
  returns: '#cf222e',
  inventory: '#1a7f37',
  customers: '#8250df',
  suppliers: '#bc4c00',
  pricing: '#9a6700',
  reports: '#0b7285',
  users: '#bf3989',
  backup: '#7d4e24',
  auditLog: '#4d3dd1',
  settings: '#57606a'
}

export function getTabAccent(page: AppPage): string {
  return TAB_ACCENT_COLORS[page]
}
