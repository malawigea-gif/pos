import { describe, expect, it } from 'vitest'
import { toIpcError } from '../../../src/main/ipc/errors'
import { decodeIpcError } from '../../../src/shared/errors'
import { InsufficientStockError } from '../../../src/main/db/repositories/stockRepository'

function errnoError(code: string): Error {
  const err = new Error(`simulated ${code}`) as NodeJS.ErrnoException
  err.code = code
  return err
}

describe('toIpcError', () => {
  it('classifies a dropped Postgres connection as CONNECTION_LOST, ahead of any domain error check', () => {
    const decoded = decodeIpcError(toIpcError(errnoError('ECONNREFUSED')))
    expect(decoded.code).toBe('CONNECTION_LOST')
  })

  it('still classifies existing domain errors normally', () => {
    const decoded = decodeIpcError(toIpcError(new InsufficientStockError(7)))
    expect(decoded.code).toBe('INSUFFICIENT_STOCK')
  })

  it('falls back to the raw error for anything unrecognized', () => {
    const err = toIpcError(new Error('a genuinely unexpected failure'))
    expect(err.message).toBe('a genuinely unexpected failure')
  })
})
