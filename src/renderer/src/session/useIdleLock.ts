import { useEffect, useRef } from 'react'

const HEARTBEAT_THROTTLE_MS = 10_000

/** Client-side idle detection: resets a timer on any mouse/keyboard
 *  activity and fires onIdle() once the timeout elapses. Also pings
 *  main's session.touchActivity() (throttled) so the backend's own
 *  independent idle check — the real enforcement point — stays in sync
 *  even if this timer is ever suspended (e.g. a throttled background tab). */
export function useIdleLock(timeoutMinutes: number, onIdle: () => void, enabled: boolean): void {
  const lastHeartbeatRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let idleTimer: ReturnType<typeof setTimeout>

    function resetIdleTimer(): void {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(onIdle, timeoutMinutes * 60_000)

      const now = Date.now()
      if (now - lastHeartbeatRef.current > HEARTBEAT_THROTTLE_MS) {
        lastHeartbeatRef.current = now
        window.api.session.heartbeat()
      }
    }

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'wheel']
    events.forEach((event) => window.addEventListener(event, resetIdleTimer))
    resetIdleTimer()

    return () => {
      clearTimeout(idleTimer)
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer))
    }
  }, [timeoutMinutes, onIdle, enabled])
}
