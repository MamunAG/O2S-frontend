import type {
  ApiResponse,
  MyFactoriesRecord,
  PaginatedResponse,
  UserFactoryAccessRecord,
  UserFactoryFilterValues,
  UserFactorySummaryRecord,
} from "./user-factory-permission.types"

type RequestContext = {
  apiUrl: string
  accessToken: string
  organizationId?: string
}

function buildApiUrl(apiUrl: string, path: string) {
  return new URL(path, apiUrl)
}

function buildRequestHeaders({ accessToken, organizationId, contentType }: { accessToken: string; organizationId?: string; contentType?: string }) {
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
    throw new Error(payload?.message || "You do not have permission to manage factory access.")
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Unable to complete the factory access request right now.")
  }

  return payload
}

export async function fetchUserFactorySummaries({
  apiUrl,
  accessToken,
  organizationId,
  page,
  limit,
  filters,
}: RequestContext & { page: number; limit: number; filters: UserFactoryFilterValues }): Promise<PaginatedResponse<UserFactorySummaryRecord>> {
  const url = buildApiUrl(apiUrl, "/api/v1/user-factory-permission")
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  if (filters.search.trim()) url.searchParams.set("search", filters.search.trim())
  if (filters.isActive.trim()) url.searchParams.set("isActive", filters.isActive.trim())

  const response = await fetch(url, {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })
  const payload = await readJsonResponse<PaginatedResponse<UserFactorySummaryRecord>>(response)

  if (!payload.data || !Array.isArray(payload.data.items)) {
    throw new Error("The user list was returned without data.")
  }

  return payload.data
}

export async function fetchUserFactoryAccess({
  apiUrl,
  accessToken,
  organizationId,
  userId,
}: RequestContext & { userId: string }): Promise<UserFactoryAccessRecord> {
  const url = buildApiUrl(apiUrl, `/api/v1/user-factory-permission/${encodeURIComponent(userId)}`)
  const response = await fetch(url, {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })
  const payload = await readJsonResponse<UserFactoryAccessRecord>(response)

  if (!payload.data || !Array.isArray(payload.data.factories)) {
    throw new Error("The factory list was returned without data.")
  }

  return payload.data
}

/** Saves the user's full list of factories (empty = no factory). */
export async function saveUserFactoryAccess({
  apiUrl,
  accessToken,
  organizationId,
  userId,
  factoryIds,
}: RequestContext & { userId: string; factoryIds: string[] }): Promise<UserFactoryAccessRecord> {
  const url = buildApiUrl(apiUrl, `/api/v1/user-factory-permission/${encodeURIComponent(userId)}`)
  const response = await fetch(url, {
    method: "PUT",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify({ factoryIds }),
  })
  const payload = await readJsonResponse<UserFactoryAccessRecord>(response)

  if (!payload.data) {
    throw new Error("The saved factory access was returned without data.")
  }

  return payload.data
}

/** The caller's own factories in the selected organization (no menu permission needed). */
export async function fetchMyFactories({ apiUrl, accessToken, organizationId }: RequestContext): Promise<MyFactoriesRecord> {
  const url = buildApiUrl(apiUrl, "/api/v1/user-factory-permission/mine")
  const response = await fetch(url, {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })
  const payload = await readJsonResponse<MyFactoriesRecord>(response)

  if (!payload.data || !Array.isArray(payload.data.factories)) {
    throw new Error("Your factories were returned without data.")
  }

  return payload.data
}

/** Asks the organization's admins for factories: they get a notification and an email. Returns how many were told. */
export async function requestFactoryPermission({
  apiUrl,
  accessToken,
  organizationId,
  message,
}: RequestContext & { message: string }): Promise<number> {
  const url = buildApiUrl(apiUrl, "/api/v1/user-factory-permission/request")
  const response = await fetch(url, {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify({ message: message.trim() || null }),
  })
  const payload = await readJsonResponse<{ sentTo: number }>(response)
  return payload.data?.sentTo ?? 0
}
