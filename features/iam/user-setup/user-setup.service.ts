import type {
  ApiResponse,
  OneTimePasswordResult,
  PaginatedResponse,
  UserSetupFilterValues,
  UserSetupFormValues,
  UserSetupRecord,
} from "./user-setup.types"

type RequestContext = {
  apiUrl: string
  accessToken: string
  organizationId?: string
}

function buildHeaders({ accessToken, organizationId, json }: { accessToken: string; organizationId?: string; json?: boolean }) {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }
  if (json) headers["Content-Type"] = "application/json"
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

  if (response.status === 401) throw new Error("Your session expired. Please sign in again.")
  if (response.status === 403) throw new Error(payload?.message || "You do not have permission to manage users here.")
  if (!response.ok || !payload?.success) throw new Error(payload?.message || "Unable to complete the user request right now.")
  return payload
}

// null, not undefined: JSON.stringify drops undefined, and an emptied field must be cleared.
function optional(value: string) {
  return value.trim() || null
}

export async function fetchUserSetupList({
  apiUrl,
  accessToken,
  organizationId,
  page,
  limit,
  filters,
}: RequestContext & { page: number; limit: number; filters: UserSetupFilterValues }): Promise<PaginatedResponse<UserSetupRecord>> {
  const url = new URL("/api/v1/user-setup", apiUrl)
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) url.searchParams.set(key, value.trim())
  }
  const response = await fetch(url, { method: "GET", headers: buildHeaders({ accessToken, organizationId }), cache: "no-store" })
  const payload = await readJsonResponse<PaginatedResponse<UserSetupRecord>>(response)
  if (!payload.data || !Array.isArray(payload.data.items)) throw new Error("The user list was returned without data.")
  return payload.data
}

export async function fetchUserSetup({ apiUrl, accessToken, organizationId, userId }: RequestContext & { userId: string }) {
  const response = await fetch(new URL(`/api/v1/user-setup/${encodeURIComponent(userId)}`, apiUrl), {
    method: "GET",
    headers: buildHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })
  const payload = await readJsonResponse<UserSetupRecord>(response)
  if (!payload.data) throw new Error("The user was returned without data.")
  return payload.data
}

/** A new login with a one-time password (empty = generated). */
export async function createUserSetup({ apiUrl, accessToken, organizationId, values }: RequestContext & { values: UserSetupFormValues }) {
  const response = await fetch(new URL("/api/v1/user-setup", apiUrl), {
    method: "POST",
    headers: buildHeaders({ accessToken, organizationId, json: true }),
    body: JSON.stringify({
      userName: values.userName.trim(),
      firstName: optional(values.firstName),
      lastName: optional(values.lastName),
      email: optional(values.email),
      phoneNumber: optional(values.phoneNumber),
      role: values.role,
      oneTimePassword: optional(values.oneTimePassword),
      sendEmail: values.sendEmail,
    }),
  })
  const payload = await readJsonResponse<OneTimePasswordResult>(response)
  if (!payload.data?.oneTimePassword) throw new Error("The user was created, but the one-time password was not returned.")
  return payload.data
}

export async function updateUserSetup({
  apiUrl,
  accessToken,
  organizationId,
  userId,
  values,
}: RequestContext & { userId: string; values: UserSetupFormValues }) {
  const response = await fetch(new URL(`/api/v1/user-setup/${encodeURIComponent(userId)}`, apiUrl), {
    method: "PUT",
    headers: buildHeaders({ accessToken, organizationId, json: true }),
    body: JSON.stringify({
      firstName: optional(values.firstName),
      lastName: optional(values.lastName),
      email: optional(values.email),
      phoneNumber: optional(values.phoneNumber),
    }),
  })
  const payload = await readJsonResponse<UserSetupRecord>(response)
  return payload.data
}

/** A new one-time password: the user's sessions end and their next login must set a new password. */
export async function issueOneTimePassword({
  apiUrl,
  accessToken,
  organizationId,
  userId,
  sendEmail,
}: RequestContext & { userId: string; sendEmail: boolean }) {
  const response = await fetch(new URL(`/api/v1/user-setup/${encodeURIComponent(userId)}/one-time-password`, apiUrl), {
    method: "PUT",
    headers: buildHeaders({ accessToken, organizationId, json: true }),
    body: JSON.stringify({ sendEmail }),
  })
  const payload = await readJsonResponse<OneTimePasswordResult>(response)
  if (!payload.data?.oneTimePassword) throw new Error("The one-time password was not returned.")
  return payload.data
}

/** Activates or deactivates the membership (the login stays). */
export async function setUserSetupStatus({
  apiUrl,
  accessToken,
  organizationId,
  userId,
  isActive,
}: RequestContext & { userId: string; isActive: boolean }) {
  const response = await fetch(new URL(`/api/v1/user-setup/${encodeURIComponent(userId)}/status`, apiUrl), {
    method: "PUT",
    headers: buildHeaders({ accessToken, organizationId, json: true }),
    body: JSON.stringify({ isActive }),
  })
  const payload = await readJsonResponse<UserSetupRecord>(response)
  return payload.data
}
