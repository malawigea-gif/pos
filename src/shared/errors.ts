// IPC errors cross the main/renderer boundary as plain Error objects, and
// Electron only preserves `message` reliably — not custom classes or extra
// properties. To let the renderer show a *translated* message (never the
// raw English exception text — see the bilingual requirement) domain errors
// are encoded as a JSON string in the message and decoded back into a
// {code, message, details} shape on the other side.
export interface StructuredErrorPayload {
  code: string
  message: string
  details?: Record<string, unknown>
}

export function encodeIpcError(payload: StructuredErrorPayload): Error {
  return new Error(JSON.stringify(payload))
}

export function decodeIpcError(error: unknown): StructuredErrorPayload {
  if (error instanceof Error) {
    // `ipcRenderer.invoke()` wraps a rejected handler's error message with
    // an "Error invoking remote method '<channel>': Error: ..." prefix, so
    // by the time it reaches the renderer the JSON payload encoded by
    // encodeIpcError() is no longer at the start of the string. Locate the
    // first '{' and parse from there instead of assuming the message is
    // pure JSON — this also keeps decoding a raw, un-prefixed encoded
    // error (e.g. in a test calling decodeIpcError directly) working.
    const jsonStart = error.message.indexOf('{')
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(error.message.slice(jsonStart))
        if (parsed && typeof parsed.code === 'string' && typeof parsed.message === 'string') {
          return parsed as StructuredErrorPayload
        }
      } catch {
        // Not a structured error — fall through to the raw message.
      }
    }
    return { code: 'UNKNOWN', message: error.message }
  }
  return { code: 'UNKNOWN', message: String(error) }
}
