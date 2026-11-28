// Counts for the App Config overview. Every call is a plain code-crafter list request
// (`/api/v1/<resource>?page=1&limit=1…`) that lib/o2s/adapter.ts rewrites to the resource's O2S
// paginated-list, so the dashboard needs no endpoint of its own: `meta.total` is the count.

type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

type ListPage<T = unknown> = {
  items: T[]
  meta: { total: number }
}

type CurrencyItem = {
  currencyCode?: string | null
  currencyName?: string | null
}

type ExchangeRateMatrix = ListPage<{ currencyDate: string }> & {
  currencies: string[]
}

export type AreaCounts = {
  total: number
  active: number | null
  deleted: number | null
}

export type CurrencyPulse = {
  defaultCurrencyCode: string | null
  defaultCurrencyName: string | null
  latestRateDate: string | null
  rateDays: number
  quotedCurrencies: number
}

type RequestArgs = {
  apiUrl: string
  accessToken: string
  organizationId?: string
}

async function readJsonResponse<T>(response: Response) {
  let payload: ApiResponse<T> | null = null

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    payload = null
  }

  if (response.status === 401) {
    throw new Error("Your session expired. Please sign in again.")
  }

  if (response.status === 403) {
    throw new Error(payload?.message || "You do not have permission to view this data.")
  }

  if (!response.ok || !payload?.success || !payload.data) {
    throw new Error(payload?.message || "Unable to load the configuration overview right now.")
  }

  return payload.data
}

async function fetchListPage<T>(
  { apiUrl, accessToken, organizationId }: RequestArgs,
  path: string,
  query: Record<string, string>,
) {
  const url = new URL(path, apiUrl)
  url.searchParams.set("page", "1")
  url.searchParams.set("limit", query.limit ?? "1")
  for (const [key, value] of Object.entries(query)) if (key !== "limit") url.searchParams.set(key, value)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  }
  if (organizationId) headers["x-organization-id"] = organizationId

  const response = await fetch(url, { method: "GET", headers, cache: "no-store" })
  return readJsonResponse<T>(response)
}

async function countRecords(args: RequestArgs, resource: string, query: Record<string, string> = {}) {
  const page = await fetchListPage<ListPage>(args, `/api/v1/${resource}`, query)
  return page.meta?.total ?? 0
}

/** Total (not deleted), active and recently deleted counts of one resource. */
export async function fetchAreaCounts(
  args: RequestArgs & { resource: string; softDelete: boolean },
): Promise<AreaCounts> {
  const { resource, softDelete } = args

  const [total, active, deleted] = await Promise.all([
    countRecords(args, resource),
    softDelete ? countRecords(args, resource, { isActive: "true" }) : Promise.resolve(null),
    softDelete ? countRecords(args, resource, { deletedOnly: "true" }) : Promise.resolve(null),
  ])

  return { total, active, deleted }
}

/** The default currency and the newest exchange-rate day. Either half is null when it can't be read. */
export async function fetchCurrencyPulse(
  args: RequestArgs & { includeCurrency: boolean; includeRates: boolean },
): Promise<CurrencyPulse> {
  const [currencyResult, matrixResult] = await Promise.allSettled([
    args.includeCurrency
      ? fetchListPage<ListPage<CurrencyItem>>(args, "/api/v1/currency", { isDefault: "true", isActive: "true" })
      : Promise.reject(new Error("skipped")),
    args.includeRates
      ? fetchListPage<ExchangeRateMatrix>(args, "/api/v1/exchange-rate/matrix", {})
      : Promise.reject(new Error("skipped")),
  ])

  const defaultCurrency = currencyResult.status === "fulfilled" ? currencyResult.value.items[0] : undefined
  const matrix = matrixResult.status === "fulfilled" ? matrixResult.value : undefined

  return {
    defaultCurrencyCode: defaultCurrency?.currencyCode?.trim() || null,
    defaultCurrencyName: defaultCurrency?.currencyName?.trim() || null,
    latestRateDate: matrix?.items[0]?.currencyDate ?? null,
    rateDays: matrix?.meta.total ?? 0,
    quotedCurrencies: matrix?.currencies.length ?? 0,
  }
}

export type LatestMaterial = {
  id: string
  name: string
  code?: string | null
  isActive?: boolean
  unit?: { name?: string | null } | null
  materialGroup?: { name?: string | null } | null
  created_at?: string | null
  created_by_user?: { name?: string | null; display_name?: string | null; user_name?: string | null } | null
}

/** The most recently added materials (needs MaterialParams.newestFirst on the backend). */
export async function fetchLatestMaterials(args: RequestArgs & { limit?: number }) {
  const page = await fetchListPage<ListPage<LatestMaterial>>(args, "/api/v1/material", {
    newestFirst: "true",
    limit: String(args.limit ?? 5),
  })
  return page.items
}
