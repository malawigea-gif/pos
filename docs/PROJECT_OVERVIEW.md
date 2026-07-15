# LankaPOS — Project Overview

Written for someone picking this project up cold. If you're new here, read this
before touching code.

## 1. What this project is

LankaPOS (formerly "LankaPOS-bookshop") is an offline-first, bilingual (English / Sinhala) Point of
Sale system for a single school stationery/equipment shop. (The product name
retains "bookshop" for historical/branding reasons — the app itself, and its
internal `books` table/catalog terminology, are general-purpose and not
specific to books; see §5's Inventory notes for the "Item" relabel in the
UI.) It's an Electron desktop app: React + TypeScript in the renderer, a
Node.js main process, and a local SQLite database (via Kysely as the query
builder). There is no server and no network dependency for core operation —
everything runs on one Windows PC. The bilingual requirement is
architectural, not cosmetic: every piece of UI chrome and system-generated
text goes through i18next, while user-entered data (item titles, customer
names, etc.) is never translated or transliterated.

## 2. Architecture

**Process split** (standard Electron three-process model, scaffolded via
`electron-vite`):

- **`src/main`** — the Node.js main process. Owns the SQLite connection,
  all business logic (repositories), and all IPC handlers. Nothing in here
  ever runs in a browser context.
- **`src/preload`** — a single `contextBridge` script
  (`src/preload/index.ts`) that exposes a typed `window.api.*` surface to
  the renderer. This is the *only* way the renderer talks to the main
  process — there's no direct `ipcRenderer` usage in renderer code.
- **`src/renderer`** — the React app. Pure UI + local state; all
  persistence/business logic goes through `window.api`.
- **`src/shared`** — TypeScript types shared between main and renderer
  (request/response shapes, enums), so a change to a repository's return
  type is caught at compile time on both sides.

**IPC structure.** Every domain has one file in `src/main/ipc/<domain>.ts`
exporting a `registerXIpc(db)` function, called once from `src/main/index.ts`
at startup. Channel names follow `<domain>:<action>`, or
`<domain>:<subresource>:<action>` for nested resources — e.g.
`suppliers:payments:create`, `pricing:taxRates:setActive`,
`backup:pickRestoreFile`. Every handler is wrapped in `ipcHandler()`
(`src/main/ipc/errors.ts`), which catches domain errors and re-encodes them
as a `{code, message, details}` JSON payload (`src/shared/errors.ts`) so the
renderer can show a *translated* message instead of a raw exception string.
`decodeIpcError()` on the renderer side has to locate that JSON payload
inside `error.message` rather than assume the message *is* the JSON —
Electron's `ipcRenderer.invoke()` prefixes a rejected handler's error with
`"Error invoking remote method '<channel>': "` before it reaches the
renderer, which silently broke every structured error code (falling back to
`UNKNOWN`/"Something went wrong") until this was caught and fixed. No
existing test exercised the real IPC boundary, so this had been broken
undetected; `tests/unit/shared/errors.test.ts` now covers both the raw and
Electron-wrapped shapes to prevent a silent regression.

**RBAC.** Three roles: `admin`, `manager`, `cashier` (see
`src/main/auth/session.ts`). The signed-in user's session is a single
module-level singleton in that file — appropriate for a single-till desktop
app, not a multi-tenant server. Sensitive channels are wrapped with
`withRole(['admin', ...], handler)` (`src/main/ipc/errors.ts`), which calls
`requireRole()` before invoking the handler and throws `ForbiddenError` /
`NotAuthenticatedError` / `SessionLockedError` otherwise. Read-only lookups
and the core cashier flow (billing, register, most list/search calls) are
deliberately left unguarded — the role matrix only gates actions that map
onto genuinely Admin/Manager-only responsibilities (user management,
pricing/tax config, return approval, reports, backup/recovery, audit log).
The idle-lock is enforced lazily inside `getCurrentUserId()`/`requireRole()`
(so even if the renderer's own idle timer never fires, the next privileged
call still gets caught), plus a renderer-side timer
(`src/renderer/src/session/useIdleLock.ts`) that shows the lock screen and
sends a heartbeat.

**i18n.** All UI strings live in `src/renderer/src/locales/en.json` and
`si.json` — flat, namespaced keys (`common.*`, `topbar.*`, one namespace per
module, e.g. `pricing.*`, `backup.*`). The two files must always have
identical key sets (nothing enforces this automatically — check by hand or
diff the key lists when adding strings). To add a new key: add it to both
files under the same path. To add a third language: copy `en.json` to
`<code>.json` and translate every value, then in `src/renderer/src/i18n.ts`
import it, add `'<code>'` to `SUPPORTED_LANGUAGES`, and add it to the
`resources` object; also add a matching `Intl` locale tag to `LOCALE_TAG` in
`src/renderer/src/lib/format.ts` for currency/date formatting. If the
language needs a font not reliably present on Windows, add a
`@fontsource/<font>` package and import it in `global.css` (see how Noto
Sans Sinhala is wired in). No component code should ever contain a
hard-coded UI string — always go through `useTranslation()`/`t()`. The one
deliberate exception is the static copyright-notice panel on
`SettingsPage.tsx` — it's the copyright holder's legal notice verbatim, not
UI chrome, so it's hard-coded in English regardless of the active language
(commented in place as intentional, so it isn't "fixed" into `t()` later by
someone assuming it's a missed translation).

**Per-tab accent color.** Each top-level tab (`AppPage`, defined in
`App.tsx`) has a distinct accent color, defined once in
`src/renderer/src/theme/tabColors.ts` (`TAB_ACCENT_COLORS: Record<AppPage,
string>`). It's applied via CSS custom properties rather than hard-coded
colors scattered across components: `TopBar.tsx` sets `--tab-accent` inline
per nav button (consumed by `TopBar.module.css`'s `.navButtonActive`), and
every page component sets `--page-accent` inline on its own root element
using its own known `AppPage` key (consumed by
`TabbedPage/tabbedPage.module.css`'s `.title`/`.tabActive`, or by
`SettingsPage.module.css`'s own `.title` for the one page that doesn't use
the shared `TabbedPage` styles). To add a new tab: add one entry to
`TAB_ACCENT_COLORS` — no other file needs a color added.

**Per-tab icon.** Each top-level tab also has an icon shown next to its
label in `TopBar.tsx`'s nav buttons, defined once in
`src/renderer/src/theme/tabIcons.ts` (`TAB_ICONS: Record<AppPage,
LucideIcon>`), using [lucide-react](https://lucide.dev). Icons render with
their default `stroke="currentColor"`, so they automatically follow the same
`--tab-accent`-driven color as the button's text/border — no separate icon
color wiring needed. To add a new tab: add one entry to `TAB_ICONS`
alongside the `TAB_ACCENT_COLORS` entry.

**Multi-row nav layout.** `TopBar.module.css`'s `.nav` is `display: flex;
flex-wrap: wrap; flex: 1 1 auto; min-width: 0`, so it wraps based on
whatever width is actually left over between `.appName` and `.rightGroup`
— two rows for cashier/manager (5/9 visible tabs, see `ROLE_PAGES` in
`TopBar.tsx`) at the app's default 1280px window width, three for admin's
full 12-tab set (fitting all 12 of the now-larger buttons into exactly two
rows isn't possible at that width without shrinking them back down). A
fixed-row CSS grid (`grid-auto-flow: column` with two
`grid-template-rows`) was tried first and looked cleaner in principle, but
it sizes columns to content (`max-content`) regardless of available width,
so for the admin role it pushed the last two tabs (Audit Log, Settings)
off the right edge of the screen entirely — invisible and unclickable, not
just visually cramped. `flex-wrap` wraps to however many rows the
available width actually needs, which trades an exact row-count guarantee
for the actually-required one: no tab is ever unreachable, regardless of
role or window width (down to the documented 1024px `minWidth`). `.bar` no
longer has a fixed `height` (it did when nav was always a single row) — it
now sizes to its tallest child via padding, so a taller multi-row nav
doesn't get clipped.

## 3. Folder structure

```
src/
  main/
    db/
      migrations/       One file per schema migration (0001_*.ts, 0002_*.ts, ...)
      repositories/      One file per domain — all business logic + SQL lives here
      client.ts          better-sqlite3 + Kysely connection setup (WAL mode, FKs on)
      index.ts           initDatabase()/getDb()/getDbPath() — the app's one DB connection
      migrator.ts        Static in-code map of migrations (see §4)
      seed.ts            Default admin + default tax rate seeding
      types.ts           Kysely `Database` interface — the schema's source of truth
      audit.ts           recordAudit() — every repository write calls this
    auth/
      session.ts         Session singleton, login/lock/unlock, requireRole()
    ipc/                 One file per domain — registerXIpc(db), channel handlers
    backup/
      backupService.ts   Backup/restore file operations (Electron-free, unit-testable)
    receipts/            Receipt rendering: HTML, PDF, ESC/POS text buffer, thermal print
    reports/             PDF/Excel export rendering for the Reports module
    pricing/
      computeSalePricing.ts   Discount/combo/tax pricing engine used at checkout
  preload/
    index.ts             contextBridge — the only IPC bridge; exposes window.api
  renderer/src/
    locales/             en.json, si.json — all UI strings
    i18n.ts              i18next setup, language persistence
    lib/
      format.ts          Intl-based currency/date/number formatting per locale
      ipcError.ts         useDescribeError() — decodes structured IPC errors for display
    components/          Shared UI (TopBar, Modal, DataTable, Form styles, TabbedPage,
                         ItemSearchCart — barcode-scan/qty-modal cart UI shared by
                         Sales + Quotations, CustomerSelect)
    theme/
      tabColors.ts        TAB_ACCENT_COLORS — one accent color per AppPage tab
      tabIcons.ts          TAB_ICONS — one lucide-react icon per AppPage tab
    session/             LoginScreen, LockScreen, SessionContext, useIdleLock
    pages/               One folder per module/screen (Inventory, Sales, Customers, ...)
  shared/                Types shared between main and renderer (one file per domain)
tests/
  unit/
    db/                  Repository tests (one file per repository, + migrations.test.ts)
    auth/                Session/login/lock/RBAC tests
    backup/               backupService tests
    ipc/                  withRole guard tests
    pricing/              computeSalePricing tests
    receipts/             ESC/POS text buffer tests
docs/
  PROJECT_OVERVIEW.md   This file
  USER_GUIDE.md         End-user guide (cashier/manager/admin) — keep in sync
                        with §5 module status whenever user-facing behavior changes
  USER_GUIDE.si.md       Sinhala translation of USER_GUIDE.md — keep both in sync
```

## 4. Database

SQLite via `better-sqlite3`, opened in WAL mode with `foreign_keys` enforced
(`src/main/db/client.ts`), at `<userData>/lankapos-bookshop.db`
(`app.getPath('userData')`, i.e. `%APPDATA%\LankaPOS\` once packaged — see §6
for the one-time migration that moves this folder for upgraders coming from
the pre-rename `%APPDATA%\LankaPOS-bookshop\` location). The `.db` filename
itself keeps its pre-rename `lankapos-bookshop` spelling, same as the
internal `books` table — it's not user-facing.
Queries go through [Kysely](https://kysely.dev) rather than raw SQL — chosen
specifically because it also has a PostgreSQL dialect, so a future
multi-branch/server deployment could reuse the same query code and just
swap the dialect.

**Migrations**: `src/main/db/migrations/0001_*.ts` … `0014_*.ts`, each
exporting `up()`/`down()`, applied in order via Kysely's `Migrator` on every
app start (`initDatabase()` in `src/main/db/index.ts`). They're registered
as a static in-code map in `src/main/db/migrator.ts` — **not** discovered
from disk at runtime — because the main process is bundled by Rollup for
packaging, and a packaged app can't glob its own source tree the way
Kysely's `FileMigrationProvider` expects. **To add a migration**: create the
next-numbered file (`0013_whatever.ts`) and add it to the map in
`migrator.ts`. Keep `src/main/db/types.ts` (the Kysely `Database` interface)
in sync by hand — Kysely doesn't generate one from the other.

**Seeding** (`src/main/db/seed.ts`): on first run, `seedDefaultAdmin()`
creates one admin user (`admin` / `admin123` — **see §6, this must be
changed in real use**) and `seedDefaultTaxRate()` creates one editable
"no tax" default rate (books are VAT-exempt under current Sri Lankan tax
law, but that's a policy fact, not something to hard-code).

**Current tables** (28, across the 14 migrations):

| Table | Purpose |
|---|---|
| `users`, `settings` | Accounts/roles/auth; app-wide key-value settings (idle timeout, backup config, return approval threshold, business profile, etc.) |
| `categories`, `books` | Catalog (labeled "Items" in the UI — see §5; `books` itself has an optional `brand` column added in migration 0013, `booksRepository.ts`, and other internal names are unchanged) |
| `tax_rates` | Configurable tax rates, one flagged default |
| `customers`, `loyalty_transactions` | Customer accounts, credit balance, loyalty point ledger |
| `suppliers`, `supplier_payments` | Supplier records and what's owed to them |
| `purchase_orders`, `purchase_order_items` | Orders placed with suppliers |
| `goods_received_notes`, `grn_items` | Stock actually received against (or without) a PO |
| `sales`, `sale_items`, `sale_payments` | Completed/held sales, line items, split payments |
| `quotations`, `quotation_items` | Price estimates for a customer — no payment, no stock movement, until explicitly converted to a real sale (see §5 Quotations) |
| `returns`, `return_items` | Returns/exchanges against a sale, with approval workflow |
| `stock_movements` | Append-only stock adjustment/audit trail |
| `stock_takes`, `stock_take_items` | Physical stock-count sessions |
| `discounts`, `combo_offers` | Pricing rules (item/category/store-wide; buy-N-get-M) |
| `preorders` | Customer preorders for out-of-stock books (manual status tracking — see §6) |
| `register_closings` | End-of-day cash register reconciliation records |
| `audit_log` | Every create/update across every repository, via `recordAudit()` |

## 5. Module status

Everything below is built, tested, and manually verified working end-to-end
(including through a packaged Windows installer) unless a column says
otherwise.

| Module | Status | Notes |
|---|---|---|
| Database schema/migrations | Done | 14 migrations, see §4 |
| Inventory | Done | Items (`books` table internally), categories, stock adjustments, stock take sessions. UI labels read "Item(s)" rather than "Book(s)" (values only — internal `books` table/repository/IPC names are unchanged); items have an optional `brand` text field, form-only (not shown in the items table). Duplicate barcode/ISBN on create or update is caught before the write (`assertNoDuplicateCodes()` in `booksRepository.ts`) and surfaced as `DUPLICATE_BARCODE`/`DUPLICATE_ISBN` in the form's error banner, instead of a raw SQLite UNIQUE-constraint error falling through to the generic "Something went wrong" message |
| Sales/Billing | Done | Cart, hold/resume, split payments (cash/card/mobile wallet/credit/other), receipts (screen, PDF export, thermal print). Scanning/searching a barcode opens a Qty modal (auto-focused, pre-selected, defaults to 1) instead of adding directly; confirming adds the entered quantity to the cart, incrementing an existing line for that item rather than creating a duplicate — this applies to both barcode-scan/Enter and manually clicking a search result. The barcode-scan → qty-modal cart UI is shared with Quotations via `src/renderer/src/components/ItemSearchCart/ItemSearchCart.tsx` (and customer lookup via `components/CustomerSelect/`), not duplicated per page. Receipts print the shop's business-profile header (name/address/phone/email, from Settings — see below) and can be exported as A4, A5, or the original 80mm-thermal-shaped PDF, chosen per export in `ReceiptModal.tsx` (`buildReceiptHtml`/`renderReceiptPdf` both take a `paperSize` — no persisted default setting exists for this yet, it's a per-print choice defaulting to 80mm) |
| Quotations | Done | A separate top-level module for issuing price estimates (`quote_no` format `QUO-YYYY-NNNNNN`) that take no payment and never touch stock at creation — `createQuotation()` stores a plain-sum estimate (no discounts/tax computed), matching how `holdSale()` already behaves. Converting a quotation to a real sale (`convertQuotationToSale()`) is the only place stock moves: it composes with `checkoutSaleWithTrx()` (the transaction-accepting core of `salesRepository.ts`'s checkout, split out from the public `checkoutSale()` specifically to support this) inside one transaction, so the quotation's status flip to `'converted'` and the resulting sale/stock-deduction commit or roll back together — real pricing (discounts/combos/tax) is computed fresh at conversion, not trusted from the quotation's estimate. A voided or already-converted quotation can't be converted or voided again. Printing reuses the same receipt pipeline as Sales (`documentType: 'invoice' \| 'quotation'` on `ReceiptData`), labeled "Quotation" with a "not a tax invoice" disclaimer and the valid-until date instead of an invoice heading. `quotations:convertToSale`/`quotations:void` are intentionally unguarded (no `withRole`), matching `sales:checkout`'s own precedent as a core cashier action |
| Customers/Suppliers | Done | Credit accounts, loyalty points, preorders, supplier POs/GRNs/payments |
| Discounts/Tax | Done | Item/category/store-wide discounts, buy-N-get-M combos, configurable tax rates — precedence: item > category > store-wide |
| Returns | Done | Approval-threshold gating, atomic stock-back-in + credit clawback for credit-paid sales |
| Reports | Done | Sales summary, best/slow sellers, profit & loss, grouped by category/author/supplier/cashier; PDF + Excel export. Supplier attribution is a documented heuristic ("most recent GRN per book"), not a guaranteed per-sale record — labelled as such in the UI |
| User Management / RBAC / Login | Done | 3 roles, bcrypt-hashed passwords, idle auto-lock, per-user language preference |
| Backup & Recovery | Done | Manual + scheduled backups (retention-pruned), restore-from-file with validation, relaunches the app after restore |
| Audit Log | Done | Filterable/paginated viewer over `audit_log`, joined with the acting user |
| Settings | Done | Per-user language switcher (`src/renderer/src/pages/Settings/SettingsPage.tsx`; the persisted-language feature itself is covered under User Management above); a Profile Data section (business name/phone/email/address) viewable by every role but editable only by admin/manager (`withRole(['admin','manager'])` on `settings:profile:set`), stored via the same generic `settings` key-value table as backup/idle-timeout config (`profile.*` keys, `getBusinessProfile()`/`setBusinessProfile()` in `settingsRepository.ts`) and threaded into every printed receipt/quotation header; a static copyright-notice panel (visible to every role, not just admin/manager) sits to the left of these sections in a `.layout`/`.main`/side-panel split matching Sales' `SaleTab.module.css` convention — see the i18n note below for why its text is hard-coded rather than translated |

**Deferred / not implemented** (no code exists for these — not partially
built, just not started):

- **Email or SMS receipts/notifications.** Nothing in this codebase sends
  email or SMS. Preorder "Notified" status (`preorders.status`) is a manual
  flag the cashier sets after contacting the customer themselves by phone —
  there's no automated delivery.
- **Multi-branch/multi-store support.** Out of scope by design — this is a
  single-shop, single-till app. The Kysely-over-Postgres-dialect choice
  (§4) is what would make a future server-backed multi-branch version
  practical without a full data-layer rewrite, but that work hasn't started.

**Manual testing still worth doing periodically:**

- Thermal printing against real hardware (see §6 — this is explicitly not
  unit-tested since no physical printer exists in the dev environment).
- A full backup → restore cycle against a real installed copy, not just the
  dev database.

## 6. Known issues & constraints

- **Sinhala receipts can't print as ESC/POS text.** Thermal printers have
  no Sinhala glyphs in any built-in code page. `src/main/receipts/printReceipt.ts`
  handles this by rendering the receipt to a bitmap (via a hidden
  `BrowserWindow.capturePage()`) and printing that as an image when
  `data.language === 'si'`; English receipts print as plain ESC/POS text
  via `src/main/receipts/receiptBuffer.ts`. The Sinhala image path is
  slower and looks different on paper (image vs. native text) — this is
  expected, not a bug.
- **Thermal printing is not unit-tested.** `printReceipt.ts` is explicitly
  marked best-effort in its own doc comment — there's no physical thermal
  printer in the dev environment. Verify manually against real hardware
  before relying on it in production, and expect real-world failures (no
  printer configured, device offline, missing driver) to need handling as
  they come up.
- **The optional `printer` npm package** (used only for the
  `printer:AUTO`-style local OS print-queue interface in
  `node-thermal-printer`) is a native addon and may fail to build on a
  machine without a native build toolchain (Visual Studio Build Tools /
  windows-build-tools). This is fine — it's listed under
  `optionalDependencies`, so `npm install` tolerates its absence, and
  network-based thermal printers (`tcp://<ip>:9100` interfaces) are
  unaffected either way. Only the local-OS-printer interface option would
  be unavailable if it fails to build.
- **Building the Windows installer does *not* require Developer Mode**,
  despite what you might read in older electron-builder troubleshooting
  threads. Earlier in this project's history, `electron-builder --win` hit
  a Windows symlink-privilege error while downloading a bundled macOS
  code-signing tool archive it didn't actually need (`winCodeSign`) — see
  git history around the "Build the Windows installer" work. The fix,
  already in place, is `win.signAndEditExecutable: false` in `package.json`
  (this project has no code-signing certificate, being an internal
  single-shop tool). If you ever add a real signing certificate or remove
  that setting, this symlink issue may resurface, and Developer Mode /
  running elevated is the workaround for *that* specific scenario.
- **Default seeded admin credentials are `admin` / `admin123`**
  (`src/main/db/seed.ts`, `seedDefaultAdmin()`) — created automatically on
  every fresh database. **This must be changed before real use.** There's
  no forced-change-on-first-login flow; it's a manual step documented in
  the main `README.md`'s install instructions.
- **The `LankaPOS-bookshop` → `LankaPOS` product rename moved the userData
  folder.** Electron derives `app.getPath('userData')` from `productName`, so
  changing `productName` in `package.json` from `LankaPOS-bookshop` to
  `LankaPOS` moves that folder from `%APPDATA%\LankaPOS-bookshop\` to
  `%APPDATA%\LankaPOS\` on next launch. Without handling this, an existing
  install's database and backups would still be sitting on disk under the
  old folder but no longer be looked at — silently appearing "lost" to the
  user. `migrateLegacyUserData()` (`src/main/db/index.ts`), called from
  `initDatabase()` before anything else opens the database, copies the `.db`
  file (plus `-wal`/`-shm` sidecars) and the `backups` folder from the old
  location to the new one, but only if the new location has no database yet
  and the old location does — a no-op on both a fresh install and every
  subsequent launch after the first. The old folder is left in place, not
  deleted. Covered by `tests/unit/db/userDataMigration.test.ts`; also
  manually verify by installing a pre-rename build, creating some data, then
  installing this version over it and confirming the data is still there.
  The `.db` filename itself (`lankapos-bookshop.db`) was deliberately left
  unrenamed — see §4.
- **No outstanding `TODO`/`FIXME` comments exist in the codebase** as of
  this writing — anything deferred is listed explicitly above instead of
  left as an inline marker. If you add a `TODO`, please also add a line
  here (or resolve it before it lands).

## 7. How to run things

```
npm install          # first time only; also rebuilds better-sqlite3 for Electron's ABI
npm run dev           # Vite dev server + Electron, with hot reload
npm test              # vitest, run through the Electron binary (see note below)
npm run typecheck      # tsc, main+renderer configs, no emit
npm run build          # production build to out/ (no installer)
npm run build:win       # production build + electron-builder → dist\LankaPOS Setup <version>.exe
```

**Why tests run through Electron**: `better-sqlite3` is a native addon
compiled against a specific Node ABI. The packaged app uses Electron's
bundled Node (handled by the `postinstall` script,
`electron-builder install-app-deps`), but vitest normally runs under your
system Node — a different ABI. Rather than rebuilding back and forth,
`npm test` runs vitest *through* the Electron binary itself
(`ELECTRON_RUN_AS_NODE=1 electron ...`), reusing the exact same
Electron-built native module the real app uses.

**One-time machine setup before `npm run build:win` works elsewhere:**

1. `npm install` (triggers `postinstall` → `electron-builder install-app-deps`,
   which rebuilds `better-sqlite3` for Electron's Node ABI). Requires a
   native build toolchain (Visual Studio Build Tools with the "Desktop
   development with C++" workload, or `windows-build-tools`) if a prebuilt
   binary isn't available for your Node/Electron/arch combination.
2. Nothing else. Developer Mode is **not** required (see §6) — this used
   to be a workaround for an unrelated code-signing-tool download issue
   that's since been eliminated from the config.

## 8. How to extend safely

Adding a new IPC-backed feature end-to-end, following the pattern the rest
of the app already uses:

1. **Shared types** — add request/response interfaces to
   `src/shared/<domain>.ts` (create the file if the domain is new).
2. **Repository** — add the DB logic to
   `src/main/db/repositories/<domain>Repository.ts`. Wrap multi-step writes
   in `db.transaction().execute(trx => ...)`. Call `recordAudit()`
   (`src/main/db/audit.ts`) after every create/update, matching the
   `{userId, action, entityType, entityId, before?, after?}` shape used
   elsewhere.
3. **IPC handler** — add a channel in `src/main/ipc/<domain>.ts` (or create
   the file + a `registerXIpc(db)` export, then wire it into
   `src/main/index.ts`). Name the channel `<domain>:<action>`. Wrap it in
   `ipcHandler(...)`, and in `withRole([...], ...)` if it's Admin/Manager-only
   per the existing role matrix (§2). If it throws a new domain-specific
   error class, add a case for it in `toIpcError()`
   (`src/main/ipc/errors.ts`) so the renderer gets a structured
   `{code, message}` instead of a raw exception.
4. **Preload** — add the typed method to the relevant namespace in
   `src/preload/index.ts` (`window.api.<domain>.<method>`).
5. **Renderer** — call `window.api.<domain>.<method>()` from a page
   component under `src/renderer/src/pages/<Module>/`. Use
   `useDescribeError()` (`src/renderer/src/lib/ipcError.ts`) to render any
   caught error.
6. **i18n** — add every new UI string to *both*
   `src/renderer/src/locales/en.json` and `si.json`, under the module's
   namespace. Never hard-code a string in a component.
7. **Tests** — add a repository test in `tests/unit/db/` covering the new
   logic (including the audit trail it produces), following the existing
   `createTestDb()`-per-test pattern (`tests/unit/db/testDb.ts`). If you
   added a role guard, add a case to `tests/unit/ipc/withRole.test.ts`'s
   pattern or a dedicated test alongside the new IPC file.
8. Run `npm run typecheck`, `npm test`, and `npm run build` before calling
   it done.

Keep this document updated when any of the above changes — a new library,
a new architectural convention, or a workaround like the Sinhala-receipt
bitmap rendering (§6) — right after making the change, while it's still
fresh.
