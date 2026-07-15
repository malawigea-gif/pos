import type { IpcMainInvokeEvent } from 'electron'
import { encodeIpcError } from '../../shared/errors'
import { InsufficientStockError } from '../db/repositories/stockRepository'
import { DuplicateBarcodeError, DuplicateIsbnError } from '../db/repositories/booksRepository'
import { QuotationNotFoundError, QuotationNotOpenError } from '../db/repositories/quotationsRepository'
import { IncompleteStockTakeError } from '../db/repositories/stockTakeRepository'
import {
  CreditNotAllowedError,
  EmptyCartError,
  InsufficientCreditError,
  PaymentMismatchError,
  SaleNotHeldError
} from '../db/repositories/salesRepository'
import { InsufficientLoyaltyPointsError } from '../db/repositories/customersRepository'
import {
  EmptyReturnError,
  ReturnNotPendingError,
  ReturnQuantityExceedsAvailableError,
  SaleNotReturnableError
} from '../db/repositories/returnsRepository'
import {
  InvalidCredentialsError,
  UserInactiveError,
  UsernameTakenError
} from '../db/repositories/usersRepository'
import { ForbiddenError, NotAuthenticatedError, SessionLockedError, requireRole } from '../auth/session'
import { InvalidBackupFileError, InvalidBackupSettingsError } from '../backup/backupService'
import type { UserRole } from '../db/types'

export function toIpcError(error: unknown): Error {
  if (error instanceof InsufficientStockError) {
    return encodeIpcError({
      code: 'INSUFFICIENT_STOCK',
      message: error.message,
      details: { bookId: error.bookId }
    })
  }
  if (error instanceof DuplicateBarcodeError) {
    return encodeIpcError({
      code: 'DUPLICATE_BARCODE',
      message: error.message,
      details: { barcode: error.barcode, existingBookId: error.existingBookId }
    })
  }
  if (error instanceof DuplicateIsbnError) {
    return encodeIpcError({
      code: 'DUPLICATE_ISBN',
      message: error.message,
      details: { isbn: error.isbn, existingBookId: error.existingBookId }
    })
  }
  if (error instanceof QuotationNotFoundError) {
    return encodeIpcError({
      code: 'QUOTATION_NOT_FOUND',
      message: error.message,
      details: { quotationId: error.quotationId }
    })
  }
  if (error instanceof QuotationNotOpenError) {
    return encodeIpcError({
      code: 'QUOTATION_NOT_OPEN',
      message: error.message,
      details: { quotationId: error.quotationId, status: error.status }
    })
  }
  if (error instanceof IncompleteStockTakeError) {
    return encodeIpcError({
      code: 'INCOMPLETE_STOCK_TAKE',
      message: error.message,
      details: { missingCount: error.missingCount }
    })
  }
  if (error instanceof EmptyCartError) {
    return encodeIpcError({ code: 'EMPTY_CART', message: error.message })
  }
  if (error instanceof SaleNotHeldError) {
    return encodeIpcError({ code: 'SALE_NOT_HELD', message: error.message, details: { saleId: error.saleId } })
  }
  if (error instanceof PaymentMismatchError) {
    return encodeIpcError({
      code: 'PAYMENT_MISMATCH',
      message: error.message,
      details: { total: error.total, paid: error.paid }
    })
  }
  if (error instanceof CreditNotAllowedError) {
    return encodeIpcError({
      code: 'CREDIT_NOT_ALLOWED',
      message: error.message,
      details: { customerId: error.customerId }
    })
  }
  if (error instanceof InsufficientCreditError) {
    return encodeIpcError({
      code: 'INSUFFICIENT_CREDIT',
      message: error.message,
      details: { customerId: error.customerId, available: error.available, requested: error.requested }
    })
  }
  if (error instanceof InsufficientLoyaltyPointsError) {
    return encodeIpcError({
      code: 'INSUFFICIENT_LOYALTY_POINTS',
      message: error.message,
      details: { customerId: error.customerId, available: error.available, requested: error.requested }
    })
  }
  if (error instanceof EmptyReturnError) {
    return encodeIpcError({ code: 'EMPTY_RETURN', message: error.message })
  }
  if (error instanceof SaleNotReturnableError) {
    return encodeIpcError({
      code: 'SALE_NOT_RETURNABLE',
      message: error.message,
      details: { saleId: error.saleId }
    })
  }
  if (error instanceof ReturnQuantityExceedsAvailableError) {
    return encodeIpcError({
      code: 'RETURN_QTY_EXCEEDS_AVAILABLE',
      message: error.message,
      details: { saleItemId: error.saleItemId, available: error.available, requested: error.requested }
    })
  }
  if (error instanceof ReturnNotPendingError) {
    return encodeIpcError({
      code: 'RETURN_NOT_PENDING',
      message: error.message,
      details: { returnId: error.returnId }
    })
  }
  if (error instanceof UsernameTakenError) {
    return encodeIpcError({ code: 'USERNAME_TAKEN', message: error.message, details: { username: error.username } })
  }
  if (error instanceof InvalidCredentialsError) {
    return encodeIpcError({ code: 'INVALID_CREDENTIALS', message: error.message })
  }
  if (error instanceof UserInactiveError) {
    return encodeIpcError({ code: 'USER_INACTIVE', message: error.message, details: { username: error.username } })
  }
  if (error instanceof NotAuthenticatedError) {
    return encodeIpcError({ code: 'NOT_AUTHENTICATED', message: error.message })
  }
  if (error instanceof SessionLockedError) {
    return encodeIpcError({ code: 'SESSION_LOCKED', message: error.message })
  }
  if (error instanceof ForbiddenError) {
    return encodeIpcError({
      code: 'FORBIDDEN',
      message: error.message,
      details: { role: error.role, allowedRoles: error.allowedRoles }
    })
  }
  if (error instanceof InvalidBackupSettingsError) {
    return encodeIpcError({ code: 'INVALID_BACKUP_SETTINGS', message: error.message })
  }
  if (error instanceof InvalidBackupFileError) {
    return encodeIpcError({ code: 'INVALID_BACKUP_FILE', message: error.message })
  }
  if (error instanceof Error) return error
  return new Error(String(error))
}

export function ipcHandler<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R> | R
): (event: IpcMainInvokeEvent, ...args: Args) => Promise<R> {
  return async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      throw toIpcError(error)
    }
  }
}

/** Composes with ipcHandler to gate a channel to specific roles, e.g.
 *  `ipcMain.handle('x', ipcHandler(withRole(['admin'], async (...) => {...})))`.
 *  Read-only/core cashier flows (billing, register, most lookups) are
 *  deliberately left unguarded — this is applied to the actions that map
 *  onto the spec's Admin/Manager-only responsibilities. */
export function withRole<Args extends unknown[], R>(
  roles: UserRole[],
  fn: (...args: Args) => Promise<R> | R
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    requireRole(roles)
    return fn(...args)
  }
}
