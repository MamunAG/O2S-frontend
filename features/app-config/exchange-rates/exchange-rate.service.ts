import type {
  ApiResponse,
  ExchangeRateFilterValues,
  ExchangeRateFormValues,
  ExchangeRateMatrixPage,
  ExchangeRateRecord,
  ExchangeRateRerunResult,
} from "./exchange-rate.types"

const RESOURCE = "/api/v1/exchange-rate"

function buildApiUrl(apiUrl: string, path: string) {
  return new URL(path, apiUrl)
}

function buildRequestHeaders({
  accessToken,
  organizationId,
  contentType,
}: {
  accessToken: string
  organizationId?: string
  contentType?: string
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  }

  if (contentType) headers["Content-Type"] = contentType
  if (organizationId) headers["x-organization-id"] = organizationId

  return headers
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
    throw new Error(payload?.message || "You do not have permission to complete this exchange rate action.")
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Unable to complete the exchange rate request right now.")
  }

  return payload
}

function appendFilterParams(url: URL, filters: Partial<ExchangeRateFilterValues>) {
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value?.trim()
    if (trimmed) url.searchParams.set(key, trimmed)
  }
}

function parseRate(value: string) {
  const rate = Number(value.trim().replace(/,/g, ""))
  if (!value.trim() || !Number.isFinite(rate) || rate <= 0) throw new Error("Enter a rate greater than 0.")
  return rate
}

function buildExchangeRatePayload(values: ExchangeRateFormValues) {
  return {
    fromCurrencyCode: values.fromCurrencyCode.trim().toUpperCase(),
    toCurrencyCode: values.toCurrencyCode.trim().toUpperCase(),
    currencyDate: values.currencyDate,
    rate: parseRate(values.rate),
  }
}

/** The matrix: paged by date, a row per date + from currency, a cell per to currency. */
export async function fetchExchangeRateMatrix({
  apiUrl,
  accessToken,
  page,
  limit,
  filters,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  page: number
  limit: number
  filters: Partial<ExchangeRateFilterValues>
  organizationId?: string
}): Promise<ExchangeRateMatrixPage> {
  const url = buildApiUrl(apiUrl, `${RESOURCE}/matrix`)
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  appendFilterParams(url, filters)

  const response = await fetch(url, {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })

  const payload = await readJsonResponse<ExchangeRateMatrixPage>(response)

  if (!payload.data?.items || !payload.data?.meta || !payload.data?.currencies) {
    throw new Error("The exchange rate matrix was returned without pagination data.")
  }

  return payload.data
}

export async function createExchangeRate({
  apiUrl,
  accessToken,
  values,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  values: ExchangeRateFormValues
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, RESOURCE), {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify(buildExchangeRatePayload(values)),
  })

  const payload = await readJsonResponse<ExchangeRateRecord>(response)

  if (!payload.data) {
    throw new Error("The exchange rate was saved, but the created record was not returned.")
  }

  return payload.data
}

/** The cell edit: only the rate changes (the adapter merges it into the stored record); the server sets the reverse pair. */
export async function updateExchangeRateValue({
  apiUrl,
  accessToken,
  id,
  rate,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  id: string
  rate: string
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/${id}`), {
    method: "PATCH",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify({ rate: parseRate(rate) }),
  })

  const payload = await readJsonResponse<ExchangeRateRecord>(response)

  if (!payload.data) {
    throw new Error("The exchange rate was updated, but the updated record was not returned.")
  }

  return payload.data
}

/** Hard delete: a provider rate can always be fetched again with "Rerun latest". */
export async function deleteExchangeRates({
  apiUrl,
  accessToken,
  ids,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  ids: string[]
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/selected`), {
    method: "DELETE",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify({ ids }),
  })

  const payload = await readJsonResponse<{ deleted: number }>(response)
  return payload.data?.deleted ?? ids.length
}

/** Clears today's (Asia/Dhaka) rates and fetches the provider's latest; nothing is cleared when the fetch fails. */
export async function rerunExchangeRates({
  apiUrl,
  accessToken,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/rerun`), {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  const payload = await readJsonResponse<ExchangeRateRerunResult>(response)

  if (!payload.data) {
    throw new Error("The rates were fetched, but the result was not returned.")
  }

  return payload.data
}
