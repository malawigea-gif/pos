import { describe, expect, it } from 'vitest'
import { isConnectionError } from '../../../src/main/db/client-postgres'

function errnoError(code: string): Error {
  const err = new Error(`simulated ${code}`) as NodeJS.ErrnoException
  err.code = code
  return err
}

describe('isConnectionError', () => {
  it('recognizes Node/net-level connection failures', () => {
    expect(isConnectionError(errnoError('ECONNREFUSED'))).toBe(true)
    expect(isConnectionError(errnoError('ETIMEDOUT'))).toBe(true)
    expect(isConnectionError(errnoError('ENOTFOUND'))).toBe(true)
  })

  it('recognizes Postgres SQLSTATE class 08 (connection exception) codes', () => {
    expect(isConnectionError(errnoError('08006'))).toBe(true)
    expect(isConnectionError(errnoError('08P01'))).toBe(true)
  })

  it('recognizes Postgres server-shutdown codes', () => {
    expect(isConnectionError(errnoError('57P01'))).toBe(true)
  })

  it('recognizes pg\'s codeless "Connection terminated" client-side error', () => {
    expect(isConnectionError(new Error('Connection terminated unexpectedly'))).toBe(true)
  })

  it('does not misclassify an unrelated Postgres error code', () => {
    expect(isConnectionError(errnoError('23505'))).toBe(false) // unique_violation
  })

  it('does not misclassify a SQLite error code', () => {
    expect(isConnectionError(errnoError('SQLITE_CONSTRAINT_UNIQUE'))).toBe(false)
  })

  it('does not misclassify a plain domain error', () => {
    expect(isConnectionError(new Error('Insufficient stock'))).toBe(false)
  })

  it('returns false for a non-Error thrown value', () => {
    expect(isConnectionError('a string was thrown')).toBe(false)
  })
})
