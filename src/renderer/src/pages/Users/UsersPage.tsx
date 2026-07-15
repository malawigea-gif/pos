import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SafeUser } from '@shared/users'
import { useDescribeError } from '../../lib/ipcError'
import { useSession } from '../../session/SessionContext'
import { UserFormModal } from './UserFormModal'
import { ResetPasswordModal } from './ResetPasswordModal'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import formStyles from '../../components/Form/formStyles.module.css'
import styles from '../../components/DataTable/dataTable.module.css'
import pageStyles from '../../components/TabbedPage/tabbedPage.module.css'

export function UsersPage(): JSX.Element {
  const { t } = useTranslation()
  const describeError = useDescribeError()
  const { session } = useSession()

  const [users, setUsers] = useState<SafeUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null)
  const [resettingUser, setResettingUser] = useState<SafeUser | null>(null)

  async function load(): Promise<void> {
    try {
      setUsers(await window.api.users.list())
    } catch (err) {
      setError(describeError(err))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleActive(user: SafeUser): Promise<void> {
    try {
      await window.api.users.setActive(user.id, !user.is_active)
      await load()
    } catch (err) {
      setError(describeError(err))
    }
  }

  function afterSave(): void {
    setCreating(false)
    setEditingUser(null)
    setResettingUser(null)
    load()
  }

  return (
    <div className={pageStyles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.users } as React.CSSProperties}>
      <h1 className={pageStyles.title}>{t('users.title')}</h1>

      <div className={styles.toolbar}>
        <button type="button" className={formStyles.buttonPrimary} onClick={() => setCreating(true)}>
          {t('users.add')}
        </button>
      </div>

      {error && <div className={formStyles.error}>{error}</div>}

      {users.length === 0 ? (
        <p>{t('users.noResults')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('users.table.username')}</th>
              <th>{t('users.table.fullName')}</th>
              <th>{t('users.table.role')}</th>
              <th>{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = session?.userId === user.id
              return (
                <tr key={user.id} className={user.is_active ? undefined : styles.inactiveRow}>
                  <td>
                    {user.username}
                    {!user.is_active && <span> ({t('users.inactive')})</span>}
                  </td>
                  <td>{user.full_name}</td>
                  <td>{t(`users.roles.${user.role}`)}</td>
                  <td className={styles.actionsCell}>
                    <button type="button" onClick={() => setEditingUser(user)}>
                      {t('common.edit')}
                    </button>
                    <button type="button" onClick={() => setResettingUser(user)}>
                      {t('users.resetPassword')}
                    </button>
                    <button type="button" disabled={isSelf} onClick={() => toggleActive(user)}>
                      {user.is_active ? t('users.deactivate') : t('users.activate')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {creating && <UserFormModal mode="create" onClose={() => setCreating(false)} onSaved={afterSave} />}
      {editingUser && (
        <UserFormModal mode="edit" user={editingUser} onClose={() => setEditingUser(null)} onSaved={afterSave} />
      )}
      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSaved={afterSave}
        />
      )}
    </div>
  )
}
