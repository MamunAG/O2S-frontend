import type {
  ApiResponse,
  PaginatedResponse,
  SizeFilterValues,
  SizeFormValues,
  SizeRecord,
} from "./size.types"

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

  if (contentType) {
    headers["Content-Type"] = contentType
  }

  if (organizationId) {
    headers["x-organization-id"] = organizationId
  }

  return headers
}

async function readJsonResponse<T>(response: Response) {
  let payload: ApiResponse<T> | null = null

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    payload = null
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("Your session expired. Please sign in again.")
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Unable to complete the size request right now.")
  }

  return payload
}

function appendFilterParams(url: URL, filters: Partial<SizeFilterValues>) {
  const sizeName = filters.sizeName?.trim() ?? ""

  if (sizeName) {
    url.searchParams.set("sizeName", sizeName)
  }
}

export async function fetchSizes({
  apiUrl,
  accessToken,
  organizationId,
  page,
  limit,
  filters,
  deletedOnly = false,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  page: number
  limit: number
  filters: Partial<SizeFilterValues>
  deletedOnly?: boolean
}): Promise<PaginatedResponse<SizeRecord>> {
  const url = buildApiUrl(apiUrl, "/api/v1/size")
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  if (deletedOnly) {
    url.searchParams.set("deletedOnly", "true")
  }
  appendFilterParams(url, filters)

  const response = await fetch(url, {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })

  const payload = await readJsonResponse<PaginatedResponse<SizeRecord>>(response)

  if (!payload.data?.items || !payload.data?.meta) {
    throw new Error("The size list was returned without pagination data.")
  }

  return payload.data
}

export async function fetchSize({
  apiUrl,
  accessToken,
  organizationId,
  id,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  id: string
}): Promise<SizeRecord> {
  const response = await fetch(buildApiUrl(apiUrl, `/api/v1/size/${id}`), {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })

  const payload = await readJsonResponse<SizeRecord>(response)

  if (!payload.data) {
    throw new Error("The size record was returned without data.")
  }

  return payload.data
}

export async function createSize({
  apiUrl,
  accessToken,
  organizationId,
  payload,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  payload: SizeFormValues
}) {
  const response = await fetch(buildApiUrl(apiUrl, "/api/v1/size"), {
    method: "POST",
    headers: buildRequestHeaders({
      accessToken,
      organizationId,
      contentType: "application/json",
    }),
    body: JSON.stringify({
      sizeName: payload.sizeName.trim(),
      isActive: payload.isActive,
    }),
  })

  const payloadData = await readJsonResponse<SizeRecord>(response)

  if (!payloadData.data) {
    throw new Error("The size was saved, but the created record was not returned.")
  }

  return payloadData.data
}

export async function updateSize({
  apiUrl,
  accessToken,
  organizationId,
  id,
  payload,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  id: string
  payload: SizeFormValues
}) {
  const response = await fetch(buildApiUrl(apiUrl, `/api/v1/size/${id}`), {
    method: "PATCH",
    headers: buildRequestHeaders({
      accessToken,
      organizationId,
      contentType: "application/json",
    }),
    body: JSON.stringify({
      sizeName: payload.sizeName.trim(),
      isActive: payload.isActive,
    }),
  })

  const payloadData = await readJsonResponse<SizeRecord>(response)

  if (!payloadData.data) {
    throw new Error("The size was updated, but the updated record was not returned.")
  }

  return payloadData.data
}

export async function softDeleteSize({
  apiUrl,
  accessToken,
  organizationId,
  id,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  id: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `/api/v1/size/${id}`), {
    method: "DELETE",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  await readJsonResponse(response)
}

export async function restoreSize({
  apiUrl,
  accessToken,
  organizationId,
  id,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  id: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `/api/v1/size/${id}/restore`), {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  await readJsonResponse(response)
}

export async function permanentlyDeleteSize({
  apiUrl,
  accessToken,
  organizationId,
  id,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
  id: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `/api/v1/size/${id}/permanent`), {
    method: "DELETE",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  await readJsonResponse(response)
}
