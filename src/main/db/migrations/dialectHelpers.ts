import { PostgresAdapter, sql, type CreateTableBuilder, type Kysely, type RawBuilder } from 'kysely'

// The migrator (migrator.ts) runs this exact same set of files against
// either dialect — there's no per-dialect migration list. Two constructs in
// this schema genuinely can't be written in a single dialect-agnostic form,
// so those two spots detect the dialect and branch, gated through the
// helpers below. `PostgresAdapter` is part of Kysely's public
// dialect-building API (used by anyone authoring a custom dialect), not an
// internal, so this stays stable across Kysely versions — see
// db.getExecutor().adapter's doc comment in Kysely's own Kysely class.
export function isPostgres(db: Kysely<unknown>): boolean {
  return db.getExecutor().adapter instanceof PostgresAdapter
}

/** Every table in this schema starts with the same auto-incrementing `id`
 *  primary key. SQLite gets it via the `AUTOINCREMENT` keyword on an
 *  `INTEGER PRIMARY KEY` column; Postgres has no such keyword; a bare
 *  `.primaryKey().autoIncrement()` compiles to MySQL-style
 *  `... primary key auto_increment`, which is a syntax error in Postgres.
 *  Postgres's equivalent is the `serial` pseudo-type (a sequence-backed
 *  integer default) — `serial`'s int4 range (~2.1 billion) is far beyond
 *  what a single-shop, multi-till POS will ever generate. Both give this
 *  schema's actual requirement: an id is never reused, even after a delete
 *  or a rolled-back insert. */
export function addIdColumn<TB extends string, C extends string>(
  builder: CreateTableBuilder<TB, C>,
  db: Kysely<unknown>
): CreateTableBuilder<TB, C | 'id'> {
  return isPostgres(db)
    ? builder.addColumn('id', 'serial', (c) => c.primaryKey())
    : builder.addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
}

/** SQLite's `CURRENT_TIMESTAMP` keyword default already produces a plain
 *  text value with no cast needed. Postgres's `CURRENT_TIMESTAMP` is
 *  `timestamptz` — defaulting a `text` column to it is a type error there
 *  ("column is of type text but default expression is of type timestamp
 *  with time zone"), since `text` has no assignment cast from a
 *  timestamptz. The Postgres branch formats explicitly to the same UTC,
 *  millisecond-precision `YYYY-MM-DDTHH:MM:SS.sssZ` shape every repository
 *  already writes via `new Date().toISOString()` on insert, so on the rare
 *  path where a row is ever created without an explicit timestamp, the
 *  fallback value still sorts/string-compares correctly (see
 *  reportsRepository.ts's `sale_date >= / <=` range filters) against
 *  explicitly-supplied ones. */
export function currentTimestampDefault(db: Kysely<unknown>): RawBuilder<unknown> {
  return isPostgres(db)
    ? sql`to_char(current_timestamp at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
    : sql`CURRENT_TIMESTAMP`
}
