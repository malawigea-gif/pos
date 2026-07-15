import { describe, expect, it } from 'vitest'
import { decodeIpcError, encodeIpcError } from '../../../src/shared/errors'

describe('decodeIpcError', () => {
  it('decodes a raw encoded error (no IPC wrapping)', () => {
    const encoded = encodeIpcError({ code: 'DUPLICATE_BARCODE', message: 'Barcode "X" is taken', details: { barcode: 'X' } })
    expect(decodeIpcError(encoded)).toEqual({
      code: 'DUPLICATE_BARCODE',
      message: 'Barcode "X" is taken',
      details: { barcode: 'X' }
    })
  })

  it('decodes an encoded error after Electron ipcRenderer.invoke() wraps it', () => {
    // This is the exact shape `ipcRenderer.invoke()` rejects with in real
    // Electron: it prefixes the thrown error's own `Error: <message>` string
    // with "Error invoking remote method '<channel>': ". Without stripping
    // this prefix, JSON.parse(error.message) fails and every domain error
    // silently degrades to the generic UNKNOWN/"Something went wrong" message.
    const encoded = encodeIpcError({ code: 'DUPLICATE_BARCODE', message: 'Barcode "X" is taken' })
    const wrapped = new Error(`Error invoking remote method 'inventory:books:create': ${encoded.toString()}`)

    expect(decodeIpcError(wrapped)).toEqual({
      code: 'DUPLICATE_BARCODE',
      message: 'Barcode "X" is taken'
    })
  })

  it('falls back to UNKNOWN for a genuinely unstructured error', () => {
    expect(decodeIpcError(new Error('some plain JS exception'))).toEqual({
      code: 'UNKNOWN',
      message: 'some plain JS exception'
    })
  })

  it('falls back to UNKNOWN for a non-Error thrown value', () => {
    expect(decodeIpcError('a string was thrown')).toEqual({
      code: 'UNKNOWN',
      message: 'a string was thrown'
    })
  })
})
