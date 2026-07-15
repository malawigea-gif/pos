import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuditAction, AuditLogEntryView } from '@shared/audit'
import type { SafeUser } from '@shared/users'
import type { SupportedLanguage } from '../../i18n'
import { formatDateTime } from '../../lib/format'
import { useDescribeError } from '../../lib/ipcError'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import formStyles from '../../components/Form/formStyles.module.css'
import tableStyles from '../../components/DataTable/dataTable.module.css'
import pageStyles from '../../components/TabbedPage/tabbedPage.module.css'
import styles from './AuditLogPage.module.css'

const PAGE_SIZE = 50
const ACTIONS: AuditAction[] = ['create', 'update', 'delete']

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatChangesLines(action: AuditAction, changes: unknown): string[] {
  if (!changes || typeof changes !== 'object') return []
  if (action === 'update') {
    return Object.entries(changes as Record<string, { old: unknown; new: unknown }>).map(
      ([field, diff]) => `${field}: ${formatValue(diff.old)} → ${formatValue(diff.new)}`
    )
  }
  return Object.entries(changes as Record<string, unknown>).map(([field, value]) => `${field}: ${formatValue(value)}`)
}

export function AuditLogPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as SupportedLanguage
  const describeError = useDescribeError()

  const [entityTypes, setEntityTypes] = useState<string[]>([])
  const [users, setUsers] = useState<SafeUser[]>([])
  const [entityType, setEntityType] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [userId, setUserId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const [entries, setEntries] = useState<AuditLogEntryView[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.audit.listEntityTypes().then(setEntityTypes)
    window.api.users.list().then(setUsers)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.api.audit
      .list({
        entityType: entityType || undefined,
        action: action || undefined,
        userId: userId ? Number(userId) : undefined,
        dateRange:
          dateFrom && dateTo ? { from: `${dateFrom}T00:00:00.000Z`, to: `${dateTo}T23:59:59.999Z` } : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE
      })
      .then((result) => {
        setEntries(result.entries)
        setTotal(result.total)
      })
      .catch((err) => setError(describeError(err)))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, action, userId, dateFrom, dateTo, page])

  function resetToFirstPage(): void {
    setPage(0)
  }

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min(total, (page + 1) * PAGE_SIZE)

  return (
    <div className={pageStyles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.auditLog } as React.CSSProperties}>
      <h1 className={pageStyles.title}>{t('auditLog.title')}</h1>

      <div className={styles.filtersRow}>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('auditLog.filters.entityType')}</label>
          <select
            className={formStyles.select}
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value)
              resetToFirstPage()
            }}
          >
            <option value="">{t('common.all')}</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {t(`auditLog.entityTypes.${type}`, { defaultValue: type })}
              </option>
            ))}
          </select>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('auditLog.filters.action')}</label>
          <select
            className={formStyles.select}
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditAction | '')
              resetToFirstPage()
            }}
          >
            <option value="">{t('common.all')}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`auditLog.actions.${a}`)}
              </option>
            ))}
          </select>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('auditLog.filters.user')}</label>
          <select
            className={formStyles.select}
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value)
              resetToFirstPage()
            }}
          >
            <option value="">{t('common.all')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('reports.dateRange.from')}</label>
          <input
            className={formStyles.input}
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              resetToFirstPage()
            }}
          />
        </div>
        <div className={formStyles.field}>
          <label className={formStyles.label}>{t('reports.dateRange.to')}</label>
          <input
            className={formStyles.input}
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              resetToFirstPage()
            }}
          />
        </div>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : entries.length === 0 ? (
        <p>{t('auditLog.noResults')}</p>
      ) : (
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>{t('auditLog.table.date')}</th>
              <th>{t('auditLog.table.user')}</th>
              <th>{t('auditLog.table.action')}</th>
              <th>{t('auditLog.table.entity')}</th>
              <th>{t('auditLog.table.changes')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const lines = formatChangesLines(entry.action, entry.changes)
              return (
                <tr key={entry.id}>
                  <td>{formatDateTime(new Date(entry.createdAt), lang)}</td>
                  <td>{entry.fullName ?? entry.username ?? t('auditLog.systemUser')}</td>
                  <td>{t(`auditLog.actions.${entry.action}`)}</td>
                  <td>
                    {t(`auditLog.entityTypes.${entry.entityType}`, { defaultValue: entry.entityType })} #
                    {entry.entityId}
                  </td>
                  <td>
                    {lines.length === 0 ? (
                      t('auditLog.noChanges')
                    ) : (
                      <ul className={styles.changesList}>
                        {lines.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className={styles.paginationRow}>
        <span className={styles.paginationText}>
          {t('auditLog.pagination.showing', { from, to, total })}
        </span>
        <div className={styles.paginationButtons}>
          <button
            type="button"
            className={formStyles.buttonSecondary}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            {t('auditLog.pagination.previous')}
          </button>
          <button
            type="button"
            className={formStyles.buttonSecondary}
            disabled={to >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('auditLog.pagination.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
