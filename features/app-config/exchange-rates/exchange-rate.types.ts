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

/** One currency's rate in BDT (O2S CurrencyExchangeRateDto). Shared by every company. */
export type ExchangeRateRecord = {
  id: string
  currencyCode: string
  /** The provider's update time (UTC, sent without an offset); a manual rate's date at midnight. */
  currencyDate: string
  rateInBdt: number
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

/** Only properties of the backend's CurrencyExchangeRateParams. isManual is "" (all) | "true" | "false". */
export type ExchangeRateFilterValues = {
  currencyCode: string
  isManual: string
  fromCurrencyDate: string
  toCurrencyDate: string
}

export type ExchangeRateFormValues = {
  currencyCode: string
  /** yyyy-MM-dd */
  currencyDate: string
  rateInBdt: string
}

/** POST /exchange-rate/rerun */
export type ExchangeRateRerunResult = {
  cleared: number
  providerDate: string
  rates: ExchangeRateRecord[]
}

export const EMPTY_FILTERS: ExchangeRateFilterValues = {
  currencyCode: "",
  isManual: "",
  fromCurrencyDate: "",
  toCurrencyDate: "",
}

export function emptyFormValues(): ExchangeRateFormValues {
  const today = new Date()
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  return { currencyCode: "", currencyDate: date, rateInBdt: "" }
}
