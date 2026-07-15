import type { ColumnType, Generated } from 'kysely'

// SQLite has no native boolean/date types: boolean flags are stored as 0/1
// integers, timestamps as ISO-8601 strings.
type Flag = number
type Timestamp = ColumnType<string, string | undefined, string>

export type UserRole = 'admin' | 'manager' | 'cashier'
export type AppLanguage = 'en' | 'si'

export interface UsersTable {
  id: Generated<number>
  username: string
  password_hash: string
  full_name: string
  role: UserRole
  language: AppLanguage
  is_active: Flag
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SettingsTable {
  id: Generated<number>
  key: string
  value: string
  updated_by: number | null
  updated_at: Timestamp
}

export interface CategoriesTable {
  id: Generated<number>
  name: string
  default_reorder_level: number
  created_at: Timestamp
}

export interface TaxRatesTable {
  id: Generated<number>
  name: string
  rate_percent: number
  is_exempt: Flag
  is_default: Flag
  is_active: Flag
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SuppliersTable {
  id: Generated<number>
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  balance: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface BooksTable {
  id: Generated<number>
  isbn: string | null
  barcode: string | null
  title: string
  author: string | null
  publisher: string | null
  brand: string | null
  category_id: number | null
  language: string | null
  tax_rate_id: number | null
  cost_price: number
  selling_price: number
  stock_qty: number
  reorder_level: number
  shelf_location: string | null
  is_active: Flag
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CustomersTable {
  id: Generated<number>
  name: string
  phone: string | null
  email: string | null
  address: string | null
  loyalty_points: number
  is_credit_account: Flag
  credit_limit: number
  credit_balance: number
  created_at: Timestamp
  updated_at: Timestamp
}

export type SaleStatus = 'held' | 'completed' | 'voided' | 'returned' | 'partially_returned'

export interface SalesTable {
  id: Generated<number>
  invoice_no: string
  customer_id: number | null
  cashier_id: number
  status: SaleStatus
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  amount_paid: number
  notes: string | null
  sale_date: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface SaleItemsTable {
  id: Generated<number>
  sale_id: number
  book_id: number
  quantity: number
  unit_price: number
  discount_amount: number
  tax_amount: number
  line_total: number
}

export type PaymentMethod = 'cash' | 'card' | 'mobile_wallet' | 'credit' | 'other'

export interface SalePaymentsTable {
  id: Generated<number>
  sale_id: number
  method: PaymentMethod
  amount: number
  reference: string | null
  created_at: Timestamp
}

export type PurchaseOrderStatus =
  | 'draft'
  | 'sent'
  | 'partially_received'
  | 'received'
  | 'cancelled'

export interface PurchaseOrdersTable {
  id: Generated<number>
  po_no: string
  supplier_id: number
  status: PurchaseOrderStatus
  order_date: Timestamp
  expected_date: string | null
  notes: string | null
  created_by: number | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface PurchaseOrderItemsTable {
  id: Generated<number>
  purchase_order_id: number
  book_id: number
  quantity: number
  unit_cost: number
}

export interface GoodsReceivedNotesTable {
  id: Generated<number>
  grn_no: string
  purchase_order_id: number | null
  supplier_id: number
  received_date: Timestamp
  total: number
  received_by: number | null
  notes: string | null
  created_at: Timestamp
}

export interface GrnItemsTable {
  id: Generated<number>
  grn_id: number
  book_id: number
  quantity: number
  unit_cost: number
  line_total: number
}

export interface SupplierPaymentsTable {
  id: Generated<number>
  supplier_id: number
  amount: number
  method: string | null
  reference: string | null
  due_date: string | null
  paid_date: string | null
  created_by: number | null
  created_at: Timestamp
}

export type ReturnStatus = 'pending_approval' | 'approved' | 'rejected' | 'completed'

export interface ReturnsTable {
  id: Generated<number>
  return_no: string
  sale_id: number
  processed_by: number
  approved_by: number | null
  status: ReturnStatus
  reason: string | null
  refund_total: number
  refund_method: PaymentMethod | null
  created_at: Timestamp
}

export interface ReturnItemsTable {
  id: Generated<number>
  return_id: number
  sale_item_id: number
  book_id: number
  quantity: number
  refund_amount: number
}

export type StockMovementType = 'sale' | 'return' | 'grn' | 'adjustment' | 'write_off' | 'stock_take'

export interface StockMovementsTable {
  id: Generated<number>
  book_id: number
  change_qty: number
  movement_type: StockMovementType
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  created_by: number | null
  created_at: Timestamp
}

export type StockTakeStatus = 'in_progress' | 'completed' | 'cancelled'

export interface StockTakesTable {
  id: Generated<number>
  status: StockTakeStatus
  started_by: number | null
  completed_by: number | null
  started_at: Timestamp
  completed_at: string | null
  notes: string | null
}

export interface StockTakeItemsTable {
  id: Generated<number>
  stock_take_id: number
  book_id: number
  expected_qty: number
  counted_qty: number | null
  notes: string | null
}

export type DiscountType = 'percent' | 'fixed'
export type DiscountScope = 'item' | 'category' | 'all'

export interface DiscountsTable {
  id: Generated<number>
  name: string
  type: DiscountType
  value: number
  scope: DiscountScope
  book_id: number | null
  category_id: number | null
  starts_at: string | null
  ends_at: string | null
  is_active: Flag
  created_at: Timestamp
  updated_at: Timestamp
}

export type ComboScope = 'item' | 'category'

export interface ComboOffersTable {
  id: Generated<number>
  name: string
  buy_quantity: number
  free_quantity: number
  scope: ComboScope
  book_id: number | null
  category_id: number | null
  starts_at: string | null
  ends_at: string | null
  is_active: Flag
  created_at: Timestamp
  updated_at: Timestamp
}

export interface LoyaltyTransactionsTable {
  id: Generated<number>
  customer_id: number
  sale_id: number | null
  points_change: number
  reason: string
  created_at: Timestamp
}

export type PreorderStatus = 'pending' | 'notified' | 'fulfilled' | 'cancelled'

export interface PreordersTable {
  id: Generated<number>
  customer_id: number
  book_id: number | null
  title: string
  isbn: string | null
  quantity: number
  status: PreorderStatus
  notes: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export type AuditAction = 'create' | 'update' | 'delete'

export interface AuditLogTable {
  id: Generated<number>
  user_id: number | null
  action: AuditAction
  entity_type: string
  entity_id: number
  changes: string | null
  created_at: Timestamp
}

export type QuotationStatus = 'open' | 'converted' | 'expired' | 'cancelled'

export interface QuotationsTable {
  id: Generated<number>
  quote_no: string
  customer_id: number | null
  created_by: number
  status: QuotationStatus
  subtotal: number
  discount_total: number
  tax_total: number
  total: number
  valid_until: string | null
  notes: string | null
  quote_date: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface QuotationItemsTable {
  id: Generated<number>
  quotation_id: number
  book_id: number
  quantity: number
  unit_price: number
  discount_amount: number
  tax_amount: number
  line_total: number
}

export interface RegisterClosingsTable {
  id: Generated<number>
  business_date: string
  opening_float: number
  cash_sales_total: number
  non_cash_sales_total: number
  counted_cash: number
  variance: number
  closed_by: number | null
  notes: string | null
  created_at: Timestamp
}

export interface Database {
  users: UsersTable
  settings: SettingsTable
  categories: CategoriesTable
  tax_rates: TaxRatesTable
  suppliers: SuppliersTable
  books: BooksTable
  customers: CustomersTable
  sales: SalesTable
  sale_items: SaleItemsTable
  sale_payments: SalePaymentsTable
  purchase_orders: PurchaseOrdersTable
  purchase_order_items: PurchaseOrderItemsTable
  goods_received_notes: GoodsReceivedNotesTable
  grn_items: GrnItemsTable
  supplier_payments: SupplierPaymentsTable
  returns: ReturnsTable
  return_items: ReturnItemsTable
  stock_movements: StockMovementsTable
  stock_takes: StockTakesTable
  stock_take_items: StockTakeItemsTable
  discounts: DiscountsTable
  combo_offers: ComboOffersTable
  loyalty_transactions: LoyaltyTransactionsTable
  preorders: PreordersTable
  audit_log: AuditLogTable
  register_closings: RegisterClosingsTable
  quotations: QuotationsTable
  quotation_items: QuotationItemsTable
}
