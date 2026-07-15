import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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

const api = {
  app: {
    version: process.env['npm_package_version'] ?? 'dev'
  },
  inventory: {
    listBooks: (filter?: ListBooksFilter): Promise<Book[]> =>
      ipcRenderer.invoke('inventory:books:list', filter),
    getBook: (id: number): Promise<Book | undefined> => ipcRenderer.invoke('inventory:books:get', id),
    listLowStockBooks: (): Promise<Book[]> => ipcRenderer.invoke('inventory:books:lowStock'),
    createBook: (input: CreateBookFormInput): Promise<Book> =>
      ipcRenderer.invoke('inventory:books:create', input),
    updateBook: (id: number, input: BookFormInput): Promise<Book> =>
      ipcRenderer.invoke('inventory:books:update', id, input),
    setBookActive: (id: number, isActive: boolean): Promise<Book> =>
      ipcRenderer.invoke('inventory:books:setActive', id, isActive),
    listCategories: (): Promise<Category[]> => ipcRenderer.invoke('inventory:categories:list'),
    adjustStock: (input: AdjustStockRequest): Promise<void> =>
      ipcRenderer.invoke('inventory:stock:adjust', input),
    getStockHistory: (bookId: number): Promise<StockMovement[]> =>
      ipcRenderer.invoke('inventory:stock:history', bookId),
    startStockTake: (categoryId?: number): Promise<StockTake> =>
      ipcRenderer.invoke('inventory:stockTake:start', categoryId),
    getCurrentStockTake: (): Promise<StockTake | undefined> =>
      ipcRenderer.invoke('inventory:stockTake:current'),
    listStockTakeItems: (stockTakeId: number): Promise<StockTakeItemView[]> =>
      ipcRenderer.invoke('inventory:stockTake:listItems', stockTakeId),
    recordStockTakeCount: (itemId: number, countedQty: number): Promise<void> =>
      ipcRenderer.invoke('inventory:stockTake:recordCount', itemId, countedQty),
    completeStockTake: (stockTakeId: number): Promise<StockTake> =>
      ipcRenderer.invoke('inventory:stockTake:complete', stockTakeId)
  },
  sales: {
    hold: (input: HoldSaleRequest): Promise<Sale> => ipcRenderer.invoke('sales:hold', input),
    listHeld: (): Promise<Sale[]> => ipcRenderer.invoke('sales:listHeld'),
    getWithItems: (saleId: number): Promise<SaleWithItems | undefined> =>
      ipcRenderer.invoke('sales:getWithItems', saleId),
    search: (filter?: SaleSearchFilter): Promise<Sale[]> => ipcRenderer.invoke('sales:search', filter),
    checkout: (input: CheckoutRequest): Promise<ReceiptData> => ipcRenderer.invoke('sales:checkout', input),
    getReceiptData: (saleId: number, uiLanguage: ReceiptLanguage): Promise<ReceiptData | undefined> =>
      ipcRenderer.invoke('sales:getReceiptData', saleId, uiLanguage),
    exportReceiptPdf: (data: ReceiptData, paperSize?: ReceiptPaperSize): Promise<string | null> =>
      ipcRenderer.invoke('sales:exportReceiptPdf', data, paperSize),
    printReceiptThermal: (data: ReceiptData): Promise<void> =>
      ipcRenderer.invoke('sales:printReceiptThermal', data)
  },
  register: {
    summary: (businessDate: string): Promise<RegisterCashSummary> =>
      ipcRenderer.invoke('register:summary', businessDate),
    close: (input: CreateRegisterClosingRequest): Promise<RegisterClosing> =>
      ipcRenderer.invoke('register:close', input),
    list: (): Promise<RegisterClosing[]> => ipcRenderer.invoke('register:list')
  },
  customers: {
    list: (filter?: ListCustomersFilter): Promise<Customer[]> =>
      ipcRenderer.invoke('customers:list', filter),
    get: (id: number): Promise<Customer | undefined> => ipcRenderer.invoke('customers:get', id),
    create: (input: CustomerFormInput): Promise<Customer> => ipcRenderer.invoke('customers:create', input),
    update: (id: number, input: CustomerFormInput): Promise<Customer> =>
      ipcRenderer.invoke('customers:update', id, input),
    recordCreditPayment: (input: RecordCreditPaymentRequest): Promise<Customer> =>
      ipcRenderer.invoke('customers:recordCreditPayment', input),
    adjustLoyaltyPoints: (input: AdjustLoyaltyPointsRequest): Promise<number> =>
      ipcRenderer.invoke('customers:adjustLoyaltyPoints', input),
    listLoyaltyTransactions: (customerId: number): Promise<LoyaltyTransaction[]> =>
      ipcRenderer.invoke('customers:listLoyaltyTransactions', customerId)
  },
  suppliers: {
    list: (filter?: ListSuppliersFilter): Promise<Supplier[]> =>
      ipcRenderer.invoke('suppliers:list', filter),
    get: (id: number): Promise<Supplier | undefined> => ipcRenderer.invoke('suppliers:get', id),
    create: (input: SupplierFormInput): Promise<Supplier> => ipcRenderer.invoke('suppliers:create', input),
    update: (id: number, input: SupplierFormInput): Promise<Supplier> =>
      ipcRenderer.invoke('suppliers:update', id, input),
    createPayment: (input: CreateSupplierPaymentRequest): Promise<SupplierPayment> =>
      ipcRenderer.invoke('suppliers:payments:create', input),
    markPaymentPaid: (paymentId: number): Promise<SupplierPayment> =>
      ipcRenderer.invoke('suppliers:payments:markPaid', paymentId),
    listPayments: (filter?: ListSupplierPaymentsFilter): Promise<SupplierPayment[]> =>
      ipcRenderer.invoke('suppliers:payments:list', filter)
  },
  purchasing: {
    createPurchaseOrder: (input: CreatePurchaseOrderRequest): Promise<PurchaseOrder> =>
      ipcRenderer.invoke('purchaseOrders:create', input),
    listPurchaseOrders: (options?: {
      supplierId?: number
      status?: PurchaseOrderStatus
    }): Promise<PurchaseOrder[]> => ipcRenderer.invoke('purchaseOrders:list', options),
    getPurchaseOrderWithItems: (
      id: number
    ): Promise<{ po: PurchaseOrder; items: PurchaseOrderItemView[] } | undefined> =>
      ipcRenderer.invoke('purchaseOrders:getWithItems', id),
    updatePurchaseOrderStatus: (id: number, status: PurchaseOrderStatus): Promise<PurchaseOrder> =>
      ipcRenderer.invoke('purchaseOrders:updateStatus', id, status),
    createGrn: (input: CreateGrnRequest): Promise<Grn> => ipcRenderer.invoke('grn:create', input),
    listGrns: (supplierId?: number): Promise<Grn[]> => ipcRenderer.invoke('grn:list', supplierId),
    getGrnWithItems: (id: number): Promise<{ grn: Grn; items: GrnItemView[] } | undefined> =>
      ipcRenderer.invoke('grn:getWithItems', id)
  },
  preorders: {
    create: (input: CreatePreorderRequest): Promise<Preorder> =>
      ipcRenderer.invoke('preorders:create', input),
    list: (filter?: ListPreordersFilter): Promise<PreorderView[]> =>
      ipcRenderer.invoke('preorders:list', filter),
    updateStatus: (id: number, status: PreorderStatus): Promise<Preorder> =>
      ipcRenderer.invoke('preorders:updateStatus', id, status)
  },
  pricing: {
    listTaxRates: (): Promise<TaxRate[]> => ipcRenderer.invoke('pricing:taxRates:list'),
    createTaxRate: (input: TaxRateFormInput): Promise<TaxRate> =>
      ipcRenderer.invoke('pricing:taxRates:create', input),
    updateTaxRate: (id: number, input: TaxRateFormInput): Promise<TaxRate> =>
      ipcRenderer.invoke('pricing:taxRates:update', id, input),
    setTaxRateActive: (id: number, isActive: boolean): Promise<TaxRate> =>
      ipcRenderer.invoke('pricing:taxRates:setActive', id, isActive),
    listDiscounts: (): Promise<Discount[]> => ipcRenderer.invoke('pricing:discounts:list'),
    createDiscount: (input: DiscountFormInput): Promise<Discount> =>
      ipcRenderer.invoke('pricing:discounts:create', input),
    updateDiscount: (id: number, input: DiscountFormInput): Promise<Discount> =>
      ipcRenderer.invoke('pricing:discounts:update', id, input),
    setDiscountActive: (id: number, isActive: boolean): Promise<Discount> =>
      ipcRenderer.invoke('pricing:discounts:setActive', id, isActive),
    listComboOffers: (): Promise<ComboOffer[]> => ipcRenderer.invoke('pricing:comboOffers:list'),
    createComboOffer: (input: ComboOfferFormInput): Promise<ComboOffer> =>
      ipcRenderer.invoke('pricing:comboOffers:create', input),
    updateComboOffer: (id: number, input: ComboOfferFormInput): Promise<ComboOffer> =>
      ipcRenderer.invoke('pricing:comboOffers:update', id, input),
    setComboOfferActive: (id: number, isActive: boolean): Promise<ComboOffer> =>
      ipcRenderer.invoke('pricing:comboOffers:setActive', id, isActive)
  },
  reports: {
    salesSummary: (range: DateRange, granularity: SummaryGranularity): Promise<SalesSummaryRow[]> =>
      ipcRenderer.invoke('reports:salesSummary', range, granularity),
    bestSellers: (range: DateRange, limit?: number): Promise<BookSalesRow[]> =>
      ipcRenderer.invoke('reports:bestSellers', range, limit),
    slowMovers: (range: DateRange, limit?: number): Promise<BookSalesRow[]> =>
      ipcRenderer.invoke('reports:slowMovers', range, limit),
    profitLoss: (range: DateRange): Promise<ProfitLossResult> =>
      ipcRenderer.invoke('reports:profitLoss', range),
    byCategory: (range: DateRange): Promise<GroupedSalesRow[]> =>
      ipcRenderer.invoke('reports:byCategory', range),
    byAuthor: (range: DateRange): Promise<GroupedSalesRow[]> => ipcRenderer.invoke('reports:byAuthor', range),
    bySupplier: (range: DateRange): Promise<GroupedSalesRow[]> =>
      ipcRenderer.invoke('reports:bySupplier', range),
    byCashier: (range: DateRange): Promise<GroupedSalesRow[]> =>
      ipcRenderer.invoke('reports:byCashier', range),
    exportPdf: (spec: ReportTableSpec): Promise<string | null> => ipcRenderer.invoke('reports:exportPdf', spec),
    exportExcel: (spec: ReportTableSpec): Promise<string | null> =>
      ipcRenderer.invoke('reports:exportExcel', spec)
  },
  returns: {
    getReturnableSaleItems: (saleId: number): Promise<ReturnableSaleInfo | undefined> =>
      ipcRenderer.invoke('returns:getReturnableSaleItems', saleId),
    create: (input: CreateReturnRequest): Promise<Return> => ipcRenderer.invoke('returns:create', input),
    approve: (returnId: number): Promise<Return> => ipcRenderer.invoke('returns:approve', returnId),
    reject: (returnId: number, reason?: string): Promise<Return> =>
      ipcRenderer.invoke('returns:reject', returnId, reason),
    list: (options?: { saleId?: number; status?: ReturnStatus }): Promise<Return[]> =>
      ipcRenderer.invoke('returns:list', options),
    listPendingApprovals: (): Promise<Return[]> => ipcRenderer.invoke('returns:listPendingApprovals'),
    getWithItems: (returnId: number): Promise<{ return: Return; items: ReturnItemView[] } | undefined> =>
      ipcRenderer.invoke('returns:getWithItems', returnId),
    getApprovalThreshold: (): Promise<number> => ipcRenderer.invoke('returns:getApprovalThreshold'),
    setApprovalThreshold: (value: number): Promise<void> =>
      ipcRenderer.invoke('returns:setApprovalThreshold', value)
  },
  session: {
    login: (input: LoginRequest): Promise<SessionInfo> => ipcRenderer.invoke('session:login', input),
    logout: (): Promise<void> => ipcRenderer.invoke('session:logout'),
    getCurrent: (): Promise<SessionInfo | null> => ipcRenderer.invoke('session:getCurrent'),
    lock: (): Promise<void> => ipcRenderer.invoke('session:lock'),
    unlock: (password: string): Promise<void> => ipcRenderer.invoke('session:unlock', password),
    heartbeat: (): Promise<void> => ipcRenderer.invoke('session:heartbeat'),
    changeOwnPassword: (currentPassword: string, newPassword: string): Promise<void> =>
      ipcRenderer.invoke('session:changeOwnPassword', currentPassword, newPassword),
    updateOwnLanguage: (language: 'en' | 'si'): Promise<void> =>
      ipcRenderer.invoke('session:updateOwnLanguage', language),
    getIdleTimeoutMinutes: (): Promise<number> => ipcRenderer.invoke('session:getIdleTimeoutMinutes'),
    setIdleTimeoutMinutes: (minutes: number): Promise<void> =>
      ipcRenderer.invoke('session:setIdleTimeoutMinutes', minutes)
  },
  users: {
    list: (): Promise<SafeUser[]> => ipcRenderer.invoke('users:list'),
    get: (id: number): Promise<SafeUser | undefined> => ipcRenderer.invoke('users:get', id),
    create: (input: CreateUserRequest): Promise<SafeUser> => ipcRenderer.invoke('users:create', input),
    update: (id: number, input: UpdateUserRequest): Promise<SafeUser> =>
      ipcRenderer.invoke('users:update', id, input),
    setActive: (id: number, isActive: boolean): Promise<SafeUser> =>
      ipcRenderer.invoke('users:setActive', id, isActive),
    resetPassword: (id: number, newPassword: string): Promise<void> =>
      ipcRenderer.invoke('users:resetPassword', id, newPassword)
  },
  backup: {
    getSettings: (): Promise<BackupSettings> => ipcRenderer.invoke('backup:getSettings'),
    updateSettings: (input: UpdateBackupSettingsRequest): Promise<BackupSettings> =>
      ipcRenderer.invoke('backup:updateSettings', input),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('backup:pickFolder'),
    list: (): Promise<BackupFileInfo[]> => ipcRenderer.invoke('backup:list'),
    runNow: (): Promise<BackupFileInfo> => ipcRenderer.invoke('backup:runNow'),
    pickRestoreFile: (): Promise<string | null> => ipcRenderer.invoke('backup:pickRestoreFile'),
    restore: (filePath: string): Promise<void> => ipcRenderer.invoke('backup:restore', filePath),
    openFolder: (): Promise<void> => ipcRenderer.invoke('backup:openFolder')
  },
  audit: {
    list: (filter?: AuditLogFilter): Promise<AuditLogPage> => ipcRenderer.invoke('audit:list', filter),
    listEntityTypes: (): Promise<string[]> => ipcRenderer.invoke('audit:listEntityTypes')
  },
  settings: {
    getProfile: (): Promise<BusinessProfile> => ipcRenderer.invoke('settings:profile:get'),
    setProfile: (input: BusinessProfile): Promise<BusinessProfile> =>
      ipcRenderer.invoke('settings:profile:set', input)
  },
  quotations: {
    create: (input: CreateQuotationRequest): Promise<Quotation> => ipcRenderer.invoke('quotations:create', input),
    list: (filter?: ListQuotationsFilter): Promise<Quotation[]> => ipcRenderer.invoke('quotations:list', filter),
    get: (quotationId: number): Promise<QuotationWithItems | undefined> =>
      ipcRenderer.invoke('quotations:get', quotationId),
    getReceiptData: (quotationId: number, uiLanguage: ReceiptLanguage): Promise<ReceiptData | undefined> =>
      ipcRenderer.invoke('quotations:getReceiptData', quotationId, uiLanguage),
    void: (quotationId: number, reason?: string): Promise<Quotation> =>
      ipcRenderer.invoke('quotations:void', quotationId, reason),
    convertToSale: (
      quotationId: number,
      input: ConvertQuotationRequest,
      uiLanguage: ReceiptLanguage
    ): Promise<ReceiptData> => ipcRenderer.invoke('quotations:convertToSale', quotationId, input, uiLanguage)
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
