import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { decodeIpcError } from '../shared/errors'
import type {
  AdjustStockRequest,
  Book,
  BookFormInput,
  Category,
  CreateBookFormInput,
  ListBooksFilter,
  StockMovement,
  StockTake,
  StockTakeItemView
} from '../shared/inventory'
import type {
  CheckoutRequest,
  CreateRegisterClosingRequest,
  HoldSaleRequest,
  ReceiptData,
  ReceiptPaperSize,
  RegisterCashSummary,
  RegisterClosing,
  Sale,
  SaleSearchFilter,
  SaleWithItems
} from '../shared/sales'
import type { ReceiptLanguage } from '../shared/receiptLabels'
import type {
  AdjustLoyaltyPointsRequest,
  Customer,
  CustomerFormInput,
  ListCustomersFilter,
  LoyaltyTransaction,
  RecordCreditPaymentRequest
} from '../shared/customers'
import type {
  CreateSupplierPaymentRequest,
  ListSuppliersFilter,
  ListSupplierPaymentsFilter,
  Supplier,
  SupplierFormInput,
  SupplierPayment
} from '../shared/suppliers'
import type {
  CreateGrnRequest,
  CreatePurchaseOrderRequest,
  Grn,
  GrnItemView,
  PurchaseOrder,
  PurchaseOrderItemView,
  PurchaseOrderStatus
} from '../shared/purchasing'
import type {
  CreatePreorderRequest,
  ListPreordersFilter,
  Preorder,
  PreorderStatus,
  PreorderView
} from '../shared/preorders'
import type {
  ComboOffer,
  ComboOfferFormInput,
  Discount,
  DiscountFormInput,
  TaxRate,
  TaxRateFormInput
} from '../shared/pricing'
import type {
  BookSalesRow,
  DateRange,
  GroupedSalesRow,
  ProfitLossResult,
  ReportTableSpec,
  SalesSummaryRow,
  SummaryGranularity
} from '../shared/reports'
import type {
  CreateReturnRequest,
  Return,
  ReturnableSaleInfo,
  ReturnItemView,
  ReturnStatus
} from '../shared/returns'
import type { LoginRequest, SessionInfo } from '../shared/session'
import type { CreateUserRequest, SafeUser, UpdateUserRequest } from '../shared/users'
import type { BackupFileInfo, BackupSettings, UpdateBackupSettingsRequest } from '../shared/backup'
import type { AuditLogFilter, AuditLogPage } from '../shared/audit'
import type { BusinessProfile } from '../shared/settings'
import type {
  ConvertQuotationRequest,
  CreateQuotationRequest,
  ListQuotationsFilter,
  Quotation,
  QuotationWithItems
} from '../shared/quotations'
import type { AppConfig, ConnectionTestResult, NetworkedDbConfig, StartupStatus } from '../shared/appConfig'
import type { MigrationRowCounts } from '../shared/migration'

type ConnectionStatusListener = (status: { lost: boolean }) => void
const connectionStatusListeners = new Set<ConnectionStatusListener>()
let lastKnownConnectionLost = false

function notifyConnectionStatus(lost: boolean): void {
  if (lost === lastKnownConnectionLost) return
  lastKnownConnectionLost = lost
  for (const listener of connectionStatusListeners) listener({ lost })
}

// Every window.api.* method goes through this instead of calling
// ipcRenderer.invoke() directly (see the renderer/main "Networked mode
// connection loss" handling — PROJECT_OVERVIEW.md §2): a successful call
// clears the global "connection lost" banner, and a CONNECTION_LOST-coded
// failure (from ipc/errors.ts's toIpcError() on the main side) raises it,
// regardless of which of the ~150 channels below happened to be the one
// that failed. Untyped (matches ipcRenderer.invoke's own `Promise<any>`)
// so every existing call site's own `(): Promise<X> =>` annotation keeps
// providing its return type, same as before this wrapper existed.
function invoke(channel: string, ...args: unknown[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args).then(
    (result) => {
      notifyConnectionStatus(false)
      return result
    },
    (error: unknown) => {
      if (decodeIpcError(error).code === 'CONNECTION_LOST') notifyConnectionStatus(true)
      throw error
    }
  )
}

const api = {
  app: {
    version: process.env['npm_package_version'] ?? 'dev'
  },
  inventory: {
    listBooks: (filter?: ListBooksFilter): Promise<Book[]> =>
      invoke('inventory:books:list', filter),
    getBook: (id: number): Promise<Book | undefined> => invoke('inventory:books:get', id),
    listLowStockBooks: (): Promise<Book[]> => invoke('inventory:books:lowStock'),
    createBook: (input: CreateBookFormInput): Promise<Book> =>
      invoke('inventory:books:create', input),
    updateBook: (id: number, input: BookFormInput): Promise<Book> =>
      invoke('inventory:books:update', id, input),
    setBookActive: (id: number, isActive: boolean): Promise<Book> =>
      invoke('inventory:books:setActive', id, isActive),
    listCategories: (): Promise<Category[]> => invoke('inventory:categories:list'),
    adjustStock: (input: AdjustStockRequest): Promise<void> =>
      invoke('inventory:stock:adjust', input),
    getStockHistory: (bookId: number): Promise<StockMovement[]> =>
      invoke('inventory:stock:history', bookId),
    startStockTake: (categoryId?: number): Promise<StockTake> =>
      invoke('inventory:stockTake:start', categoryId),
    getCurrentStockTake: (): Promise<StockTake | undefined> =>
      invoke('inventory:stockTake:current'),
    listStockTakeItems: (stockTakeId: number): Promise<StockTakeItemView[]> =>
      invoke('inventory:stockTake:listItems', stockTakeId),
    recordStockTakeCount: (itemId: number, countedQty: number): Promise<void> =>
      invoke('inventory:stockTake:recordCount', itemId, countedQty),
    completeStockTake: (stockTakeId: number): Promise<StockTake> =>
      invoke('inventory:stockTake:complete', stockTakeId)
  },
  sales: {
    hold: (input: HoldSaleRequest): Promise<Sale> => invoke('sales:hold', input),
    listHeld: (): Promise<Sale[]> => invoke('sales:listHeld'),
    getWithItems: (saleId: number): Promise<SaleWithItems | undefined> =>
      invoke('sales:getWithItems', saleId),
    search: (filter?: SaleSearchFilter): Promise<Sale[]> => invoke('sales:search', filter),
    checkout: (input: CheckoutRequest): Promise<ReceiptData> => invoke('sales:checkout', input),
    getReceiptData: (saleId: number, uiLanguage: ReceiptLanguage): Promise<ReceiptData | undefined> =>
      invoke('sales:getReceiptData', saleId, uiLanguage),
    exportReceiptPdf: (data: ReceiptData, paperSize?: ReceiptPaperSize): Promise<string | null> =>
      invoke('sales:exportReceiptPdf', data, paperSize),
    printReceiptThermal: (data: ReceiptData): Promise<void> =>
      invoke('sales:printReceiptThermal', data)
  },
  register: {
    summary: (businessDate: string): Promise<RegisterCashSummary> =>
      invoke('register:summary', businessDate),
    close: (input: CreateRegisterClosingRequest): Promise<RegisterClosing> =>
      invoke('register:close', input),
    list: (): Promise<RegisterClosing[]> => invoke('register:list')
  },
  customers: {
    list: (filter?: ListCustomersFilter): Promise<Customer[]> =>
      invoke('customers:list', filter),
    get: (id: number): Promise<Customer | undefined> => invoke('customers:get', id),
    create: (input: CustomerFormInput): Promise<Customer> => invoke('customers:create', input),
    update: (id: number, input: CustomerFormInput): Promise<Customer> =>
      invoke('customers:update', id, input),
    recordCreditPayment: (input: RecordCreditPaymentRequest): Promise<Customer> =>
      invoke('customers:recordCreditPayment', input),
    adjustLoyaltyPoints: (input: AdjustLoyaltyPointsRequest): Promise<number> =>
      invoke('customers:adjustLoyaltyPoints', input),
    listLoyaltyTransactions: (customerId: number): Promise<LoyaltyTransaction[]> =>
      invoke('customers:listLoyaltyTransactions', customerId)
  },
  suppliers: {
    list: (filter?: ListSuppliersFilter): Promise<Supplier[]> =>
      invoke('suppliers:list', filter),
    get: (id: number): Promise<Supplier | undefined> => invoke('suppliers:get', id),
    create: (input: SupplierFormInput): Promise<Supplier> => invoke('suppliers:create', input),
    update: (id: number, input: SupplierFormInput): Promise<Supplier> =>
      invoke('suppliers:update', id, input),
    createPayment: (input: CreateSupplierPaymentRequest): Promise<SupplierPayment> =>
      invoke('suppliers:payments:create', input),
    markPaymentPaid: (paymentId: number): Promise<SupplierPayment> =>
      invoke('suppliers:payments:markPaid', paymentId),
    listPayments: (filter?: ListSupplierPaymentsFilter): Promise<SupplierPayment[]> =>
      invoke('suppliers:payments:list', filter)
  },
  purchasing: {
    createPurchaseOrder: (input: CreatePurchaseOrderRequest): Promise<PurchaseOrder> =>
      invoke('purchaseOrders:create', input),
    listPurchaseOrders: (options?: {
      supplierId?: number
      status?: PurchaseOrderStatus
    }): Promise<PurchaseOrder[]> => invoke('purchaseOrders:list', options),
    getPurchaseOrderWithItems: (
      id: number
    ): Promise<{ po: PurchaseOrder; items: PurchaseOrderItemView[] } | undefined> =>
      invoke('purchaseOrders:getWithItems', id),
    updatePurchaseOrderStatus: (id: number, status: PurchaseOrderStatus): Promise<PurchaseOrder> =>
      invoke('purchaseOrders:updateStatus', id, status),
    createGrn: (input: CreateGrnRequest): Promise<Grn> => invoke('grn:create', input),
    listGrns: (supplierId?: number): Promise<Grn[]> => invoke('grn:list', supplierId),
    getGrnWithItems: (id: number): Promise<{ grn: Grn; items: GrnItemView[] } | undefined> =>
      invoke('grn:getWithItems', id)
  },
  preorders: {
    create: (input: CreatePreorderRequest): Promise<Preorder> =>
      invoke('preorders:create', input),
    list: (filter?: ListPreordersFilter): Promise<PreorderView[]> =>
      invoke('preorders:list', filter),
    updateStatus: (id: number, status: PreorderStatus): Promise<Preorder> =>
      invoke('preorders:updateStatus', id, status)
  },
  pricing: {
    listTaxRates: (): Promise<TaxRate[]> => invoke('pricing:taxRates:list'),
    createTaxRate: (input: TaxRateFormInput): Promise<TaxRate> =>
      invoke('pricing:taxRates:create', input),
    updateTaxRate: (id: number, input: TaxRateFormInput): Promise<TaxRate> =>
      invoke('pricing:taxRates:update', id, input),
    setTaxRateActive: (id: number, isActive: boolean): Promise<TaxRate> =>
      invoke('pricing:taxRates:setActive', id, isActive),
    listDiscounts: (): Promise<Discount[]> => invoke('pricing:discounts:list'),
    createDiscount: (input: DiscountFormInput): Promise<Discount> =>
      invoke('pricing:discounts:create', input),
    updateDiscount: (id: number, input: DiscountFormInput): Promise<Discount> =>
      invoke('pricing:discounts:update', id, input),
    setDiscountActive: (id: number, isActive: boolean): Promise<Discount> =>
      invoke('pricing:discounts:setActive', id, isActive),
    listComboOffers: (): Promise<ComboOffer[]> => invoke('pricing:comboOffers:list'),
    createComboOffer: (input: ComboOfferFormInput): Promise<ComboOffer> =>
      invoke('pricing:comboOffers:create', input),
    updateComboOffer: (id: number, input: ComboOfferFormInput): Promise<ComboOffer> =>
      invoke('pricing:comboOffers:update', id, input),
    setComboOfferActive: (id: number, isActive: boolean): Promise<ComboOffer> =>
      invoke('pricing:comboOffers:setActive', id, isActive)
  },
  reports: {
    salesSummary: (range: DateRange, granularity: SummaryGranularity): Promise<SalesSummaryRow[]> =>
      invoke('reports:salesSummary', range, granularity),
    bestSellers: (range: DateRange, limit?: number): Promise<BookSalesRow[]> =>
      invoke('reports:bestSellers', range, limit),
    slowMovers: (range: DateRange, limit?: number): Promise<BookSalesRow[]> =>
      invoke('reports:slowMovers', range, limit),
    profitLoss: (range: DateRange): Promise<ProfitLossResult> =>
      invoke('reports:profitLoss', range),
    byCategory: (range: DateRange): Promise<GroupedSalesRow[]> =>
      invoke('reports:byCategory', range),
    byAuthor: (range: DateRange): Promise<GroupedSalesRow[]> => invoke('reports:byAuthor', range),
    bySupplier: (range: DateRange): Promise<GroupedSalesRow[]> =>
      invoke('reports:bySupplier', range),
    byCashier: (range: DateRange): Promise<GroupedSalesRow[]> =>
      invoke('reports:byCashier', range),
    exportPdf: (spec: ReportTableSpec): Promise<string | null> => invoke('reports:exportPdf', spec),
    exportExcel: (spec: ReportTableSpec): Promise<string | null> =>
      invoke('reports:exportExcel', spec)
  },
  returns: {
    getReturnableSaleItems: (saleId: number): Promise<ReturnableSaleInfo | undefined> =>
      invoke('returns:getReturnableSaleItems', saleId),
    create: (input: CreateReturnRequest): Promise<Return> => invoke('returns:create', input),
    approve: (returnId: number): Promise<Return> => invoke('returns:approve', returnId),
    reject: (returnId: number, reason?: string): Promise<Return> =>
      invoke('returns:reject', returnId, reason),
    list: (options?: { saleId?: number; status?: ReturnStatus }): Promise<Return[]> =>
      invoke('returns:list', options),
    listPendingApprovals: (): Promise<Return[]> => invoke('returns:listPendingApprovals'),
    getWithItems: (returnId: number): Promise<{ return: Return; items: ReturnItemView[] } | undefined> =>
      invoke('returns:getWithItems', returnId),
    getApprovalThreshold: (): Promise<number> => invoke('returns:getApprovalThreshold'),
    setApprovalThreshold: (value: number): Promise<void> =>
      invoke('returns:setApprovalThreshold', value)
  },
  session: {
    login: (input: LoginRequest): Promise<SessionInfo> => invoke('session:login', input),
    logout: (): Promise<void> => invoke('session:logout'),
    getCurrent: (): Promise<SessionInfo | null> => invoke('session:getCurrent'),
    lock: (): Promise<void> => invoke('session:lock'),
    unlock: (password: string): Promise<void> => invoke('session:unlock', password),
    heartbeat: (): Promise<void> => invoke('session:heartbeat'),
    changeOwnPassword: (currentPassword: string, newPassword: string): Promise<void> =>
      invoke('session:changeOwnPassword', currentPassword, newPassword),
    updateOwnLanguage: (language: 'en' | 'si'): Promise<void> =>
      invoke('session:updateOwnLanguage', language),
    getIdleTimeoutMinutes: (): Promise<number> => invoke('session:getIdleTimeoutMinutes'),
    setIdleTimeoutMinutes: (minutes: number): Promise<void> =>
      invoke('session:setIdleTimeoutMinutes', minutes)
  },
  users: {
    list: (): Promise<SafeUser[]> => invoke('users:list'),
    get: (id: number): Promise<SafeUser | undefined> => invoke('users:get', id),
    create: (input: CreateUserRequest): Promise<SafeUser> => invoke('users:create', input),
    update: (id: number, input: UpdateUserRequest): Promise<SafeUser> =>
      invoke('users:update', id, input),
    setActive: (id: number, isActive: boolean): Promise<SafeUser> =>
      invoke('users:setActive', id, isActive),
    resetPassword: (id: number, newPassword: string): Promise<void> =>
      invoke('users:resetPassword', id, newPassword)
  },
  backup: {
    getSettings: (): Promise<BackupSettings> => invoke('backup:getSettings'),
    updateSettings: (input: UpdateBackupSettingsRequest): Promise<BackupSettings> =>
      invoke('backup:updateSettings', input),
    pickFolder: (): Promise<string | null> => invoke('backup:pickFolder'),
    list: (): Promise<BackupFileInfo[]> => invoke('backup:list'),
    runNow: (): Promise<BackupFileInfo> => invoke('backup:runNow'),
    pickRestoreFile: (): Promise<string | null> => invoke('backup:pickRestoreFile'),
    restore: (filePath: string): Promise<void> => invoke('backup:restore', filePath),
    openFolder: (): Promise<void> => invoke('backup:openFolder')
  },
  audit: {
    list: (filter?: AuditLogFilter): Promise<AuditLogPage> => invoke('audit:list', filter),
    listEntityTypes: (): Promise<string[]> => invoke('audit:listEntityTypes')
  },
  settings: {
    getProfile: (): Promise<BusinessProfile> => invoke('settings:profile:get'),
    setProfile: (input: BusinessProfile): Promise<BusinessProfile> =>
      invoke('settings:profile:set', input)
  },
  quotations: {
    create: (input: CreateQuotationRequest): Promise<Quotation> => invoke('quotations:create', input),
    list: (filter?: ListQuotationsFilter): Promise<Quotation[]> => invoke('quotations:list', filter),
    get: (quotationId: number): Promise<QuotationWithItems | undefined> =>
      invoke('quotations:get', quotationId),
    getReceiptData: (quotationId: number, uiLanguage: ReceiptLanguage): Promise<ReceiptData | undefined> =>
      invoke('quotations:getReceiptData', quotationId, uiLanguage),
    void: (quotationId: number, reason?: string): Promise<Quotation> =>
      invoke('quotations:void', quotationId, reason),
    convertToSale: (
      quotationId: number,
      input: ConvertQuotationRequest,
      uiLanguage: ReceiptLanguage
    ): Promise<ReceiptData> => invoke('quotations:convertToSale', quotationId, input, uiLanguage)
  },
  appConfig: {
    get: (): Promise<AppConfig> => invoke('appConfig:get'),
    set: (input: AppConfig): Promise<void> => invoke('appConfig:set', input),
    testConnection: (config: NetworkedDbConfig): Promise<ConnectionTestResult> =>
      invoke('appConfig:testConnection', config),
    relaunch: (): Promise<void> => invoke('appConfig:relaunch')
  },
  system: {
    getStartupStatus: (): Promise<StartupStatus> => invoke('system:getStartupStatus'),
    ping: (): Promise<void> => invoke('system:ping'),
    // Returns an unsubscribe function, matching the useEffect cleanup
    // convention already used throughout the renderer (see useIdleLock.ts).
    onConnectionStatusChange: (listener: ConnectionStatusListener): (() => void) => {
      connectionStatusListeners.add(listener)
      return () => connectionStatusListeners.delete(listener)
    }
  },
  migration: {
    pickSourceFile: (): Promise<string | null> => invoke('migration:pickSourceFile'),
    run: (sourceFilePath: string): Promise<MigrationRowCounts> => invoke('migration:run', sourceFilePath)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

export type Api = typeof api
