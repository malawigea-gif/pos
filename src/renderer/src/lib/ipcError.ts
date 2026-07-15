import { useTranslation } from 'react-i18next'
import { decodeIpcError } from '@shared/errors'

export function useDescribeError(): (error: unknown) => string {
  const { t } = useTranslation()
  return (error: unknown) => {
    const { code, message } = decodeIpcError(error)
    return t(`errors.${code}`, { defaultValue: message })
  }
}
