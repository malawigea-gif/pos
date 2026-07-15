import {
  BarChart3,
  DatabaseBackup,
  FileText,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Undo2,
  UserCog,
  Users,
  type LucideIcon
} from 'lucide-react'
import type { AppPage } from '../App'

/** One icon per top-level tab, shown alongside its label in TopBar. Adding a
 *  new tab means adding one entry here, same convention as TAB_ACCENT_COLORS
 *  in tabColors.ts. */
export const TAB_ICONS: Record<AppPage, LucideIcon> = {
  sales: ShoppingCart,
  quotations: FileText,
  inventory: Package,
  customers: Users,
  suppliers: Truck,
  pricing: Tag,
  reports: BarChart3,
  returns: Undo2,
  users: UserCog,
  backup: DatabaseBackup,
  auditLog: ScrollText,
  settings: Settings
}
