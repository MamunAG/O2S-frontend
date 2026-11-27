// The organization the user works in is the access token's `organization_id` claim: the backend chooses it (the
// one last switched to, else the default, else the first) and refuses any route of another organization. The
// browser only reads it; changing it is POST /account/switch-organization, which answers a new access token.

export const SELECTED_ORGANIZATION_CHANGED_EVENT = "organization-selection-change"
const ACCESS_TOKEN_KEY = "access_token"
const ORGANIZATION_CLAIM = "organization_id"
// Where the organization was kept before it moved into the token; removed when seen.
const LEGACY_STORAGE_KEY = "selected_organization_id"

let decoded: { token: string; organizationId: string } | null = null

/** The `organization_id` claim of a JWT ("" when absent or unreadable). */
export function organizationIdOfToken(token: string | null | undefined) {
  if (!token) return ""
  try {
    const payload = token.split(".")[1] ?? ""
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=")
    const claims = JSON.parse(atob(base64)) as Record<string, unknown>
    const value = claims[ORGANIZATION_CLAIM]
    return typeof value === "string" ? value.trim() : ""
  } catch {
    return ""
  }
}

/** The organization of the stored access token. */
export function readSelectedOrganizationId() {
  if (typeof window === "undefined") {
    return ""
  }

  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? ""
  if (decoded?.token !== token) {
    decoded = { token, organizationId: organizationIdOfToken(token) }
    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  }
  return decoded.organizationId
}

export function requireSelectedOrganizationId(requestedOrganizationId?: string) {
  const selectedOrganizationId = readSelectedOrganizationId()
  if (!selectedOrganizationId) {
    throw new Error("Select an organization before continuing.")
  }

  const requested = requestedOrganizationId?.trim()
  if (requested && requested !== selectedOrganizationId) {
    throw new Error(
      "The selected organization changed. Close this form and try again.",
    )
  }

  return selectedOrganizationId
}

function dispatchOrganizationChange(organizationId: string) {
  const dispatch = () => {
    window.dispatchEvent(
      new CustomEvent(SELECTED_ORGANIZATION_CHANGED_EVENT, {
        detail: { organizationId },
      }),
    )
  }

  if (typeof queueMicrotask === "function") {
    queueMicrotask(dispatch)
    return
  }

  window.setTimeout(dispatch, 0)
}

/**
 * Asks the backend to work in another organization: it checks the user may, remembers the choice on the account
 * (the next sign-in and every refresh keep it) and answers a new access token for it, stored here.
 */
export async function switchOrganization(organizationId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? ""
  const response = await fetch(new URL("/api/v1/auth/switch-organization", apiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ organizationId }),
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    message?: string
    data?: { access_token?: string; organization_id?: string }
  } | null
  const token = payload?.data?.access_token
  if (!response.ok || !payload?.success || typeof token !== "string") {
    throw new Error(payload?.message || "Unable to switch organization right now.")
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
  const switched = readSelectedOrganizationId()
  dispatchOrganizationChange(switched)
  return switched
}
