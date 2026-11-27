export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  timestamp?: string
}

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type PaginatedResponse<T> = {
  items: T[]
  meta: PaginationMeta
}

export type UserSummary = {
  id?: string | null
  name?: string | null
  user_name?: string | null
  display_name?: string | null
}

/** A currency pair's rate (O2S CurrencyExchangeRateDto): amount in fromCurrencyCode x rate = amount in toCurrencyCode. */
export type ExchangeRateRecord = {
  id: string
  fromCurrencyCode: string
  toCurrencyCode: string
  /** The provider's update time (UTC, sent without an offset); a manual rate's date at midnight. */
  currencyDate: string
  rate: number
  /** Added or edited on this screen; the daily job leaves it alone, "Rerun latest" replaces it. */
  isManual: boolean

  // Audit names added by crudRules (lib/o2s/crud.ts withAuditNames)
  created_by_id?: string | null
  updated_by_id?: string | null
  created_by_user?: UserSummary | null
  updated_by_user?: UserSummary | null
  created_at?: string | null
  updated_at?: string | null
}

/** One cell of the matrix: the rate from the row's currency to this column's. */
export type ExchangeRateCell = {
  id: string
  toCurrencyCode: string
  rate: number
  isManual: boolean
  updatedByName?: string | null
  updatedDate?: string | null
}

/** One matrix row: a date and a from currency, with a cell per to currency. */
export type ExchangeRateMatrixRow = {
  currencyDate: string
  fromCurrencyCode: string
  cells: ExchangeRateCell[]
}

export type ExchangeRateMatrixPage = PaginatedResponse<ExchangeRateMatrixRow> & {
  /** The column order: the configured currencies, BDT, then any other code on the page. */
  currencies: string[]
}

/** Only properties of the backend's CurrencyExchangeRateParams the matrix uses. */
export type ExchangeRateFilterValues = {
  fromCurrencyCode: string
  fromCurrencyDate: string
  toCurrencyDate: string
}

export type ExchangeRateFormValues = {
  fromCurrencyCode: string
  toCurrencyCode: string
  /** yyyy-MM-dd */
  currencyDate: string
  rate: string
}

/** POST /exchange-rate/rerun */
export type ExchangeRateRerunResult = {
  cleared: number
  providerDate: string
  rates: ExchangeRateRecord[]
}

export const EMPTY_FILTERS: ExchangeRateFilterValues = {
  fromCurrencyCode: "",
  fromCurrencyDate: "",
  toCurrencyDate: "",
}

/** The key of a matrix row (its date + from currency), for selection. */
export function matrixRowKey(row: ExchangeRateMatrixRow) {
  return `${row.currencyDate}|${row.fromCurrencyCode}`
}

export function emptyFormValues(): ExchangeRateFormValues {
  const today = new Date()
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  return { fromCurrencyCode: "", toCurrencyCode: "BDT", currencyDate: date, rate: "" }
}
