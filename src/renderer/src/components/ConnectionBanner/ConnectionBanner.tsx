import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './ConnectionBanner.module.css'

const RECONNECT_POLL_MS = 5000

/** Mounted once, unconditionally, at the top of App.tsx — not per-page.
 *  Every window.api.* call already goes through preload's invoke() wrapper
 *  (see preload/index.ts), which flips this on/off based on whether the
 *  most recent call succeeded or failed with CONNECTION_LOST, regardless of
 *  which of the ~150 channels it happened to be. This only actively polls
 *  (system:ping) while it's actually showing — a healthy connection never
 *  pays any extra round trips beyond whatever the user is already doing. */
export function ConnectionBanner(): JSX.Element | null {
  const { t } = useTranslation()
  const [lost, setLost] = useState(false)

  useEffect(() => window.api.system.onConnectionStatusChange(({ lost }) => setLost(lost)), [])

  useEffect(() => {
    if (!lost) return
    const id = setInterval(() => {
      window.api.system.ping().catch(() => {})
    }, RECONNECT_POLL_MS)
    return () => clearInterval(id)
  }, [lost])

  if (!lost) return null

  return (
    <div className={styles.banner} role="alert">
      {t('common.connectionLost')}
    </div>
  )
}
