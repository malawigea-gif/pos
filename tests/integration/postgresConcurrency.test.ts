import { Kysely, PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from '../../src/main/db/migrator'
import { createBook } from '../../src/main/db/repositories/booksRepository'
import { adjustStock, InsufficientStockError } from '../../src/main/db/repositories/stockRepository'
import type { Database } from '../../src/main/db/types'

// Opt-in only, same convention as postgresMigrations.test.ts — set
// TEST_POSTGRES_URL to run this against a real server. This is the one
// class of bug from Task 5 (multi-till concurrency) that genuinely cannot
// be proven against SQLite: a single better-sqlite3 connection is
// synchronous, so two "concurrent" JS calls against it always execute one
// fully before the other starts — there's no way to interleave a read and a
// write from two different transactions the way two separate tills
// actually would against a shared Postgres server. Only a real Postgres
// connection pool can actually exercise the race this test defends against.
const connectionString = process.env.TEST_POSTGRES_URL

if (!connectionString) {
  console.warn(
    '[test] Skipping tests/integration/postgresConcurrency.test.ts — set TEST_POSTGRES_URL to prove the ' +
      'atomic stock-guard fix (Task 5) actually prevents overselling under real concurrent connections.'
  )
}

describe.skipIf(!connectionString)('multi-till concurrency: stock deduction', () => {
  let pool: Pool
  let db: Kysely<Database>

  beforeAll(async () => {
    pool = new Pool({ connectionString })
    db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) })
    await sql`DROP SCHEMA public CASCADE`.execute(db)
    await sql`CREATE SCHEMA public`.execute(db)
    await runMigrations(db)
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('never oversells: N concurrent decrements against stock of N-1 leave exactly one loser and stock at zero', async () => {
    const book = await createBook(db, {
      title: 'Concurrency Test Book',
      costPrice: 100,
      sellingPrice: 200,
      initialStockQty: 5,
      userId: null
    })

    const attempts = 10 // 5 units of stock, 10 tills racing for it
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        adjustStock(db, { bookId: book.id, changeQty: -1, movementType: 'sale', userId: null })
      )
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled')
    const failed = results.filter((r) => r.status === 'rejected')

    expect(succeeded).toHaveLength(5)
    expect(failed).toHaveLength(5)
    for (const failure of failed) {
      if (failure.status === 'rejected') {
        expect(failure.reason).toBeInstanceOf(InsufficientStockError)
      }
    }

    const finalBook = await db
      .selectFrom('books')
      .select('stock_qty')
      .where('id', '=', book.id)
      .executeTakeFirstOrThrow()
    // The bug this guards against: a read-then-write race would let more
    // than 5 of the 10 concurrent decrements succeed, driving this negative.
    expect(finalBook.stock_qty).toBe(0)
  })
})
