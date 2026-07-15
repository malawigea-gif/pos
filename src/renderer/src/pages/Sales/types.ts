export interface CartLine {
  bookId: number
  title: string
  isbn: string | null
  unitPrice: number
  quantity: number
}
