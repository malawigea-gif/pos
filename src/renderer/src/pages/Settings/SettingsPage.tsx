import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../i18n'
import { TAB_ACCENT_COLORS } from '../../theme/tabColors'
import { useSession } from '../../session/SessionContext'
import { useDescribeError } from '../../lib/ipcError'
import { ServerConnectionForm } from '../../components/ServerConnectionForm/ServerConnectionForm'
import formStyles from '../../components/Form/formStyles.module.css'
import tableStyles from '../../components/DataTable/dataTable.module.css'
import styles from './SettingsPage.module.css'

export function SettingsPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const activeLanguage = i18n.language as SupportedLanguage
  const { session } = useSession()
  const describeError = useDescribeError()
  const canEditProfile = session?.role === 'admin' || session?.role === 'manager'

  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings.getProfile().then((profile) => {
      setBusinessName(profile.businessName)
      setPhone(profile.phone ?? '')
      setEmail(profile.email ?? '')
      setAddress(profile.address ?? '')
    })
  }, [])

  async function handleSaveProfile(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await window.api.settings.setProfile({
        businessName: businessName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null
      })
      setBusinessName(updated.businessName)
      setPhone(updated.phone ?? '')
      setEmail(updated.email ?? '')
      setAddress(updated.address ?? '')
      setSaved(true)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page} style={{ '--page-accent': TAB_ACCENT_COLORS.settings } as React.CSSProperties}>
      <h1 className={styles.title}>{t('settings.title')}</h1>

      <div className={styles.layout}>
        {/* Static legal notice, intentionally not run through i18next/t() —
            it's the copyright holder's notice verbatim, not UI chrome, so it
            stays in English regardless of the active language. This is a
            deliberate exception to the "no hard-coded strings" convention,
            not a missed translation — don't route it through t(). */}
        <aside className={styles.copyrightPanel} aria-label="Software copyright notice">
          <h2 className={styles.copyrightTitle}>SOFTWARE COPYRIGHT NOTICE</h2>
          <p>This software has been designed and developed by Asanga Malawige.</p>
          <p>© All Rights Reserved.</p>
          <p>
            This software and its contents are protected by copyright laws. No part of this software may be
            copied, modified, distributed, reproduced, reverse-engineered, or used for commercial or
            non-commercial purposes without the prior written permission of the copyright holder.
          </p>
          <p>
            Developer / Copyright Holder: Asanga Malawige
            <br />
            E-mail: <a href="mailto:malawigea@gmail.com" target="_blank" rel="noreferrer">malawigea@gmail.com</a>
            <br />
            Telephone: <a href="tel:+94768760090" target="_blank" rel="noreferrer">+94 76 876 0090</a>
          </p>
          <p>
            By using this software, the user acknowledges and agrees to comply with the above copyright and
            usage restrictions.
          </p>
        </aside>

        <div className={styles.main}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('settings.sections.profile')}</h2>

            {error && <div className={formStyles.error}>{error}</div>}
            {saved && <div className={tableStyles.statusNotice}>{t('settings.profile.saved')}</div>}

            <form onSubmit={handleSaveProfile}>
              <div className={formStyles.field}>
                <label className={formStyles.label}>{t('settings.profile.businessName')}</label>
                <input
                  className={formStyles.input}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={!canEditProfile}
                />
              </div>
              <div className={formStyles.row}>
                <div className={formStyles.field}>
                  <label className={formStyles.label}>{t('settings.profile.phone')}</label>
                  <input
                    className={formStyles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!canEditProfile}
                  />
                </div>
                <div className={formStyles.field}>
                  <label className={formStyles.label}>{t('settings.profile.email')}</label>
                  <input
                    className={formStyles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!canEditProfile}
                  />
                </div>
              </div>
              <div className={formStyles.field}>
                <label className={formStyles.label}>{t('settings.profile.address')}</label>
                <input
                  className={formStyles.input}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canEditProfile}
                />
              </div>
              {canEditProfile && (
                <button type="submit" className={formStyles.buttonPrimary} disabled={saving}>
                  {t('settings.profile.save')}
                </button>
              )}
            </form>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('settings.sections.language')}</h2>

            <label className={styles.fieldLabel}>{t('settings.language.label')}</label>
            <p className={styles.fieldDescription}>{t('settings.language.description')}</p>

            <div className={styles.languageOptions} role="radiogroup" aria-label={t('settings.language.label')}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={activeLanguage === lang}
                  className={activeLanguage === lang ? styles.optionActive : styles.option}
                  onClick={() => setLanguage(lang)}
                >
                  {t(`settings.language.${lang === 'en' ? 'english' : 'sinhala'}`)}
                </button>
              ))}
            </div>
          </section>

          {session?.role === 'admin' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{t('settings.sections.serverConnection')}</h2>
              <p className={styles.fieldDescription}>{t('settings.serverConnection.description')}</p>
              <ServerConnectionForm />
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
