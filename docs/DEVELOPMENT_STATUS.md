# LankaPOS — Development Status

A working reference for picking this project up cold: what exists, what's actually been verified,
what environment landmines to avoid, and what's still open. Complements `PROJECT_OVERVIEW.md`
(architecture/conventions reference) rather than duplicating it — read that one for how the code
is built; read this one for where things currently stand and what to watch out for.

## 1. Architecture summary

Electron desktop app: React + TypeScript renderer, Node.js main process, [Kysely](https://kysely.dev)
as the query builder over one of two interchangeable database backends:

- **Standalone** — local SQLite (`better-sqlite3`), no server/network. Original mode, still default.
- **Networked** — multiple tills on one LAN share one PostgreSQL server (`pg`). Added this session.

Mode + connection details live in a plain-fs `app-config.json` in the userData folder
(`src/main/config/appConfig.ts`), read before `initDatabase()` decides which dialect to construct.

Where things live:

| Concern | Path |
|---|---|
| DB connection setup (both dialects) | `src/main/db/client.ts`, `client-postgres.ts`, `index.ts` |
| Schema migrations (dialect-portable) | `src/main/db/migrations/*.ts` + `dialectHelpers.ts` |
| Business logic / SQL | `src/main/db/repositories/*.ts` (one file per domain) |
| IPC handlers | `src/main/ipc/*.ts` (one file per domain, `registerXIpc(db)`) |
| Renderer → main bridge | `src/preload/index.ts` (single `invoke()` wrapper, not raw `ipcRenderer.invoke()`) |
| React UI | `src/renderer/src/pages/*`, `components/*` |
| Types shared main/renderer | `src/shared/*.ts` |
| Opt-in real-Postgres tests | `tests/integration/*.test.ts` |

Full detail (RBAC, i18n conventions, IPC error encoding, folder tree, "how to add a feature"
checklist): `docs/PROJECT_OVERVIEW.md`.

## 2. What changed this session

In order. Items without a commit hash were already in place at the start of this session (part of
the codebase this session inherited, described here for completeness since they're referenced
elsewhere in this doc); everything from Task 1 onward has its own commit.

- **Product rename**, `LankaPOS-bookshop` → `LankaPOS`. Moved the userData folder; handled by
  `migrateLegacyUserData()` in `src/main/db/index.ts` (copies an existing install's `.db` + backups
  across on first launch under the new name). The `.db` filename itself and the internal `books`
  table were deliberately left unrenamed — see `PROJECT_OVERVIEW.md` §4/§6.
- **Icon-based, two-row, larger nav tabs** — `src/renderer/src/theme/tabIcons.ts` /
  `tabColors.ts`, `TopBar.tsx`, `TopBar.module.css`'s flex-wrap nav layout.
- **Copyright notice panel** on Settings — static, intentionally not translated
  (`SettingsPage.tsx`, see the i18n note there for why).
- **The networked/multi-till Postgres migration** (this session's main body of work, 8 tasks +
  1 verification pass, `0be48cb`..`e5c73a3`):

  | Task | Commit | Key files |
  |---|---|---|
  | 1. Postgres dialect + mode config | `f7a3a80` | `src/main/config/appConfig.ts`, `src/main/db/client-postgres.ts`, `src/main/db/index.ts` |
  | 2. Migration Postgres-compatibility | `d7fd893` | `src/main/db/migrations/dialectHelpers.ts` + all 14 migration files |
  | 3. Server Connection UI + startup-failure recovery | `9210b73` | `src/main/ipc/appConfig.ts`, `ServerConnectionForm.tsx`, `ServerUnreachableScreen.tsx` |
  | 4. Live connection-loss handling | `af17023` | `src/main/db/client-postgres.ts` (`isConnectionError`), `preload/index.ts` (`invoke()` wrapper), `ConnectionBanner.tsx` |
  | 5. Multi-till concurrency audit | `94ee55f` | `stockRepository.ts`, `customersRepository.ts`, `salesRepository.ts`, `returnsRepository.ts`, `supplierPaymentsRepository.ts`, `grnRepository.ts` |
  | 6. pg_dump/pg_restore backup | `f53c74a` | `src/main/backup/postgresBackupService.ts` |
  | 7. SQLite → Postgres data-import tool | `245ca1f` | `src/main/migration/sqliteToPostgresMigration.ts`, `DataMigrationSection.tsx` |
  | 8. Documentation | `5509e9f` | `docs/PROJECT_OVERVIEW.md`, `docs/USER_GUIDE.md`, `docs/USER_GUIDE.si.md` |
  | Real-Postgres verification + test-isolation fixes | `1ef2677`, `89fb0a1` | `tests/integration/pgTestDatabase.ts` (new) |
  | README update | `e5c73a3` | `README.md` |

- **Internet-independence audit**: confirmed (by design and by code review) that Networked mode
  only ever talks to the configured LAN Postgres server — no external/cloud dependency was
  introduced anywhere in this migration. Standalone mode remains fully offline as before.

## 3. What's verified vs. not yet verified

**Verified against a real local PostgreSQL 15 instance** (`tests/integration/*.test.ts`, run with
`TEST_POSTGRES_URL` set — see §6):
- Full 14-migration chain produces a correct schema (`postgresMigrations.test.ts`).
- Multi-till concurrency: 10 concurrent stock deductions against 5 units of stock leave exactly
  5 winners, 5 `InsufficientStockError` losers, final stock at 0 — not negative
  (`postgresConcurrency.test.ts`).
- SQLite → Postgres data import preserves ids/relationships, correctly advances sequences, and
  refuses a second run against already-migrated data (`postgresDataMigration.test.ts`).
- All 164 tests (156 SQLite unit + 8 Postgres integration) pass together in one run.

**Verified by direct behavioral testing** (Playwright driving the actual packaged Electron app,
screenshots taken — see git history of this conversation for the full walkthrough; no test files
were added for this, it was manual/exploratory):
- Server Connection form: mode toggle, and a real Test Connection round-trip against local
  Postgres — both the success case ("Connected successfully") and failure case (real
  `password authentication failed` message surfaced).
- Startup-failure recovery screen (`ServerUnreachableScreen`): appears correctly with a real
  `ETIMEDOUT` error, in both English and Sinhala, with a working "Fix Connection Settings" form
  reachable with no login.
- Data Migration section's mode-gating (shows "switch to Networked first" correctly in Standalone).
- Live connection-loss banner: using a small TCP relay in front of local Postgres (killed to
  simulate a drop, without touching the shared Postgres service), confirmed the `pg` pool survives
  a dropped connection without crashing the main process, IPC calls get classified as
  `CONNECTION_LOST`, and **both** the global fixed banner ("Connection to server lost —
  reconnecting...") and the per-screen inline error render correctly, simultaneously.

**Explicitly NOT yet verified:**
- **Real two-PC LAN testing.** Everything above was one till (or one Electron instance) talking to
  Postgres on the same physical machine (`127.0.0.1`, or a same-machine TCP relay). No test has
  used an actual separate server PC and a separate till PC talking over a real network — firewall
  rules, real network latency, and genuinely concurrent *processes on different machines* are all
  still unverified in practice, even though the code path is identical to the same-machine case.
- A real `pg_dump`/`pg_restore` backup-and-restore round-trip (the tool-not-found error path was
  tested for real; a successful dump/restore was not, since this dev machine's Postgres client
  tools aren't on this shell's PATH — see §4).
- Sinhala translations reviewed by a native speaker (see §5).

## 4. Known environment gotchas

Specific to the Windows dev machine this session used — save yourself the rediscovery:

- **Docker Desktop's engine could not be gotten to a reachable state all session**, even after
  multiple full quit/relaunch cycles, confirmed from both the assistant's shell and the user's own
  interactive session (so it wasn't a session/pipe-scoping artifact). If you hit
  `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`, check
  **WSL is actually installed** (`wsl --install` + restart) before troubleshooting Docker Desktop
  itself — a missing WSL2 backend is the most likely root cause, and reinstalling/relaunching
  Docker Desktop alone does not fix it. This session gave up on Docker and used a native Windows
  PostgreSQL install instead (`winget install -e --id PostgreSQL.PostgreSQL.16`, resolved to v15).
- **An orphaned Postgres process can squat on port 5432 indefinitely**, surviving
  `Stop-Service`/`Restart-Service`/`Stop-Process -Force` by name, even across many restart
  attempts. Every `pg_hba.conf` trust-auth password-reset attempt against it silently failed
  because it wasn't actually the service-managed instance. Diagnose by checking what's *actually*
  listening — `netstat -ano | findstr :5432` — and compare that PID against the Windows service's
  own reported PID (`sc queryex postgresql-x64-15`); don't assume they're the same process. Fix:
  `taskkill /F /PID <the exact PID from netstat>`, confirm the port is free
  (`netstat -ano | findstr :5432` returns nothing), *then* start the real service — a genuinely new
  PID should appear.
- **Verify PowerShell elevation directly, don't trust the window title.** A window titled
  "Administrator" isn't proof a command actually ran elevated if something is failing silently —
  confirm with:
  ```powershell
  ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  ```
  should print `True`.
- **This shell's PATH doesn't include PostgreSQL's bin folder by default** —
  `C:\Program Files\PostgreSQL\15\bin` needs to be prepended per-session to use `psql`/`pg_dump`/
  `pg_restore` directly.
- **When debugging by relaying terminal output through chat, ask for the literal pasted output once
  and verify independently wherever possible** (e.g. `netstat`, a direct `psql` connection attempt)
  rather than trusting a relayed "done"/"it worked" — several rounds this session were spent
  because a relayed confirmation didn't reflect what actually happened.
- **Electron's `APPDATA` override on Windows doesn't work via the `env` option.** Electron resolves
  `app.getPath('appData')`/`userData` through the native Windows Known Folder API, not the
  `APPDATA` environment variable, so passing a custom `env: { APPDATA: ... }` to a spawned Electron
  process has no effect. `--user-data-dir=<path>` (a real Electron/Chromium switch) *does* work for
  isolating `userData` specifically.
- **A pre-rename `%APPDATA%\LankaPOS-bookshop\` folder exists on this dev machine** from earlier
  testing of the rename-migration feature, with sample data ("Liyana Bookshop"). It's fictional
  test data, not real — but a naive "fresh install" test can pick it up via
  `migrateLegacyUserData()`'s own (correctly-working) legacy-folder migration logic, since that
  logic reads from `appData`, not the overridable `userData` path. Worth knowing before treating an
  unexpectedly-populated test profile as a bug.
- **Playwright's `_electron` driver works fine in this sandboxed shell** despite it having no
  visibly attached interactive desktop — Windows doesn't need an X11-style virtual display the way
  Linux/xvfb does, so GUI verification via screenshots is genuinely possible here (see §3's
  behavioral-testing bullet). Install with `npm install --no-save playwright` (don't commit it as a
  real dependency) for one-off verification passes.

## 5. Outstanding punch list before production go-live

- **Real multi-PC LAN verification** (§3) — a genuine separate server machine and till machine,
  including the firewall-port-5432 setup steps documented in `USER_GUIDE.md` §14.
- **Sinhala translations need a native-speaker review**, particularly the new
  `settings.serverConnection.*` / `session.serverUnreachable.*` / `settings.dataMigration.*` keys
  and the new `USER_GUIDE.si.md` §14 — these were a good-faith pass, not reviewed by a native
  speaker.
- **`app-config.json` stores the Postgres password in plain text**, alongside (not inside) the
  database, in the userData folder. This was a deliberate choice matching what was asked for and
  is consistent with a trusted, single-shop internal tool — but it's a decision point, not
  something to silently harden. If this ever needs to change (e.g. encrypting it at rest), that's
  a real design conversation, not a quick patch.
- **`register_closings` has no unique constraint on `business_date`** — two tills closing the
  register the same day create two rows rather than one being rejected. May be intentional
  (per-till reconciliation) or may not be; worth a decision if it comes up. (From the Task 5
  concurrency audit — not fixed, out of decided scope.)
- **No `till_id` (or equivalent) column anywhere** records which physical till a sale/action came
  from. Not something anyone asked for, but it means per-till reporting isn't possible today if
  that's ever wanted. (Also from the Task 5 audit.)
- **A real `pg_dump`/`pg_restore` round-trip hasn't been run** (§3) — only the tool-not-found error
  path was exercised for real.
- **No forced password change on first login** — `admin`/`admin123` is seeded on every fresh
  install (Standalone or the first Networked connection); changing it is a manual step, documented
  but not enforced. Pre-existing, not introduced this session, but worth keeping on a go-live
  checklist.

## 6. How to extend this safely going forward

**Adding a new migration** (dual-dialect requirement): use Kysely's schema builder
(`db.schema.createTable(...)`) wherever possible — it's already dialect-portable. The two spots
that need explicit branching, both handled via `src/main/db/migrations/dialectHelpers.ts`:
- **Auto-incrementing `id` columns** — use `addIdColumn()`, not a bare
  `.addColumn('id', 'integer', c => c.primaryKey().autoIncrement())` (Postgres has no
  `AUTOINCREMENT` keyword; that compiles to an invalid `auto_increment`).
- **`CURRENT_TIMESTAMP` defaults on `text` columns** — use `currentTimestampDefault()`, not a bare
  `sql\`CURRENT_TIMESTAMP\`` (Postgres's `CURRENT_TIMESTAMP` is `timestamptz`, which is a type
  error defaulting into a `text` column; SQLite has no such type-checking).
- Also use `'double precision'` for any new money/quantity column, never generic `'real'`
  (SQLite's `REAL` is already an 8-byte double; Postgres's native `real` is 4-byte and would
  silently lose precision).
- If the write touches a shared numeric column (balance, quantity, running total), use a single
  atomic guarded `UPDATE` (`.set((eb) => ({col: eb('col', '+', delta)}))` with the validation guard
  in the same statement's `WHERE`), not a read-then-compute-then-write — see
  `stockRepository.ts`'s `adjustStockWithTrx()` for the reference implementation. This class of bug
  is invisible under Standalone/SQLite (SQLite serializes all writers) and only bites under
  Networked/Postgres with genuinely concurrent tills.

**Testing against real Postgres locally**: set `TEST_POSTGRES_URL` to a connection string with
permission to create databases, then run `npm test` as normal — this activates
`tests/integration/*.test.ts` (self-skipped otherwise), each of which creates and drops its own
dedicated database (`tests/integration/pgTestDatabase.ts`), so they're safe to run repeatedly and
in parallel against the same server.
```
TEST_POSTGRES_URL=postgres://postgres:postgres@localhost:5432/lankapos_test npm test
```
Getting a local Postgres running on Windows: prefer a native install
(`winget install -e --id PostgreSQL.PostgreSQL.16`) over Docker Desktop — see §4 for why Docker was
abandoned this session, and the PID/port-5432 and elevation gotchas if the password ever needs
resetting.

**RBAC / gating a new tab or feature**: role checks are `withRole([...roles], handler)`
(`src/main/ipc/errors.ts`), applied per IPC channel — not per-page in the renderer. Add the role
list at the point you register the channel (`src/main/ipc/<domain>.ts`), following the existing
role matrix (admin/manager/cashier) described in `PROJECT_OVERVIEW.md` §2. The `appConfig`/`system`
channels are the one deliberate exception (unguarded) — see the comment in
`src/main/ipc/appConfig.ts` for why, before assuming that's an oversight to fix.

**Before considering a change done**: `npm run typecheck`, `npm test`, `npm run build` — and if the
change touches anything Postgres-path-specific, also run with `TEST_POSTGRES_URL` set. See
`PROJECT_OVERVIEW.md` §8 for the full "adding a feature end-to-end" checklist (shared types →
repository → IPC handler → preload → renderer → i18n → tests).
