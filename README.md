# LankaPOS

Offline-first Point of Sale system for a school stationery/equipment shop. Electron + React (renderer) +
Node.js (main process) + SQLite. Bilingual UI (English / Sinhala) from the ground up.

> **Picking this project up cold?** Start with
> [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) — architecture, IPC/RBAC
> conventions, database/migrations, module status, known issues, and a recipe
> for adding new features safely. This README covers day-to-day dev commands
> and installer/build instructions only.
>
> **Running the shop day to day, not developing?** See
> [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) (or the Sinhala translation,
> [`docs/USER_GUIDE.si.md`](docs/USER_GUIDE.si.md)) instead — how to use
> each screen, aimed at cashiers, managers, and the admin, not developers.

## Development

```
npm install
npm run dev
```

This starts the Vite dev server for the renderer and launches the Electron app
pointed at it. `npm run build` produces a production build in `out/`;
`npm run build:win` additionally packages a Windows installer via electron-builder.

## Building the Windows installer

```
npm run build:win
```

This runs the production build and then electron-builder, producing a single
installer at:

```
dist\LankaPOS Setup <version>.exe
```

(e.g. `dist\LankaPOS Setup 0.1.0.exe`). Also produced alongside it:
`dist\win-unpacked\` (an unpacked copy of the app — handy for a quick manual
smoke test without installing) and a `.blockmap` file (used for delta
updates; not needed for a plain manual install).

Notes on the packaging config (`"build"` key in `package.json`):

- **No code-signing certificate is configured** (`win.signAndEditExecutable:
  false`), since this is an internal tool for a single shop, not something
  distributed publicly. This means Windows SmartScreen will show an "Windows
  protected your PC" warning the first time the installer runs — click
  **More info → Run anyway** to proceed. This is expected for any unsigned
  installer and is not a sign of a broken build.
- **`better-sqlite3`'s native binary is unpacked from the asar archive**
  (`asarUnpack`) since native `.node` addons can't be loaded from inside an
  asar archive — this is handled automatically by the config, no manual step
  needed.
- **Per-user install, not per-machine** (`nsis.perMachine: false`), so
  installing doesn't require Administrator rights or trigger a UAC prompt.
- If you see a build failure with `ERROR: Cannot create symbolic link`
  while electron-builder is downloading its own bundled tools, it's
  unrelated to this project's code — it means an older electron-builder
  version (or a modified config) is trying to fetch macOS signing tools it
  doesn't actually need for an unsigned Windows build. The current config
  avoids this entirely; if it recurs after a dependency upgrade, check that
  `win.signAndEditExecutable` is still `false`.

## Installing

1. Run `LankaPOS Setup <version>.exe`.
2. If SmartScreen warns that the app is unrecognized, click **More info →
   Run anyway** (see note above — this is expected for an unsigned installer).
3. Follow the installer wizard — you can choose the install location, and
   whether to create Desktop/Start Menu shortcuts (both on by default).
4. Launch **LankaPOS** from the Start Menu or Desktop shortcut.
5. **First sign-in**: username `admin`, password `admin123`. **Change this
   password immediately** (Settings, or Users → reset your own password via
   an admin account) — this default is seeded on every fresh install and is
   not a secret.

The app stores its database at `%APPDATA%\LankaPOS\lankapos-bookshop.db` — a
per-Windows-user location managed by Electron, separate from the install
directory. Back this file up regularly (see the in-app **Backup & Recovery**
module, which automates this). **Upgrading from a pre-rename install?** See
the userData migration note in `docs/PROJECT_OVERVIEW.md` §6 — the app
folder moved from `LankaPOS-bookshop` to `LankaPOS` and the first launch
after upgrading copies your existing database and backups across
automatically.

To uninstall, use **Settings → Apps** (or the generated uninstaller in the
install directory) like any other Windows application.

## Project structure

```
src/
  main/       Electron main process
    db/       SQLite (via better-sqlite3 + Kysely) — schema types, migrations, client
  preload/    contextBridge API exposed to the renderer
  renderer/   React app
    src/
      locales/        en.json, si.json — all UI strings, no hard-coded text in components
      i18n.ts         i18next setup, language persistence
      lib/format.ts   Intl-based currency/date/number formatting per locale
      components/     Shared UI (TopBar, etc.)
      pages/          One folder per screen/module
tests/
  unit/       Business-logic and data-layer unit tests (vitest)
```

## Database

SQLite (via `better-sqlite3`), opened in WAL mode with `foreign_keys` enforced,
at `<userData>/lankapos-bookshop.db` (a per-user, per-machine path managed by
Electron — see `app.getPath('userData')`). The `lankapos-bookshop.db`
filename itself is unchanged from before the LankaPOS-bookshop → LankaPOS
product rename — only the containing `userData` folder moved (see §6 of
`docs/PROJECT_OVERVIEW.md` for the migration that handles this). Queries go through
[Kysely](https://kysely.dev), a typed query builder — chosen (over talking to
`better-sqlite3` directly) specifically because it also has a PostgreSQL
dialect, so a future multi-branch/server deployment can reuse the same
query code and swap the dialect rather than rewriting the data-access layer.

Schema changes are migrations, not hand edits: `src/main/db/migrations/*.ts`,
each with `up()`/`down()`, applied in order via Kysely's `Migrator` on every
app start (`initDatabase()` in `src/main/db/index.ts`). They're registered as
a static in-code map (`src/main/db/migrator.ts`) rather than discovered from
disk at runtime, because the migration files still need to exist as real
files for Kysely's `FileMigrationProvider` — but this app's main process is
bundled by Rollup for packaging, and a packaged app can't glob its own
source tree at runtime the way `FileMigrationProvider` expects. Add a new
migration by creating the next-numbered file and adding it to that map.

`src/main/db/types.ts` is the source of truth for what the schema *should*
look like — keep it in sync with the migrations by hand (Kysely doesn't
generate one from the other).

### Native module note (better-sqlite3)

`better-sqlite3` is a native addon, so it's compiled against a specific
Node.js ABI. Two different ABIs are in play in this project:

- **Running the app** (`npm run dev` / the packaged installer) uses
  **Electron's** bundled Node — handled automatically by the `postinstall`
  script (`electron-builder install-app-deps`), which runs after every
  `npm install`.
- **Running tests** (`npm test`) needs the addon built for the ABI of
  whatever runs vitest. Rather than rebuilding back and forth between the
  two ABIs on every install/test cycle, `npm test` runs vitest *through the
  Electron binary itself* (`ELECTRON_RUN_AS_NODE=1 electron ...`), so it
  uses the exact same Electron-built native module as the real app — no
  second rebuild needed.

## Adding a third language

The locale files use a flat, namespaced key structure (`common.*`, `topbar.*`,
`settings.*`, one namespace per module) so a new language is just a new
resource file plus one registration:

1. Copy `src/renderer/src/locales/en.json` to `src/renderer/src/locales/<code>.json`
   (e.g. `ta.json` for Tamil) and translate every value — keep all keys identical.
2. In `src/renderer/src/i18n.ts`:
   - import the new file
   - add `'<code>'` to `SUPPORTED_LANGUAGES`
   - add it to the `resources` object passed to `i18n.init(...)`
   - add a matching entry to `LOCALE_TAG` in `src/renderer/src/lib/format.ts`
     (an `Intl`-compatible locale tag, e.g. `'ta-LK'`) so currency/date
     formatting follows the new language too.
3. If the language needs a bundled web font (i.e. it isn't reliably present on
   Windows), add the `@fontsource/<font>` package and import its CSS in
   `global.css` the same way Noto Sans Sinhala is imported, then extend the
   `font-family` fallback chain.

No component code changes are needed — every screen reads strings through
`useTranslation()`/`t()`, never hard-coded text.

## Bilingual data vs. UI text

Only UI chrome and system-generated text (labels, buttons, messages, report
titles) are localized. Data the user enters — book titles, author names,
customer names, etc. — is stored and displayed exactly as entered, never
translated or transliterated.
