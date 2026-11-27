// The bridge between this app (written for the code-crafter NestJS API) and the O2S .NET backend.
//
// Every service in features/ calls `fetch(`${NEXT_PUBLIC_API_URL}/api/v1/<code-crafter path>`)` and reads
// code-crafter's envelope `{ success, message, data }`. Instead of rewriting each service, this module wraps
// window.fetch once (lib/o2s/index.ts, mounted by components/o2s-api-bridge.tsx) and, for requests to the API:
//   - finds the rule for the code-crafter path (lib/o2s/rules/*) and calls the O2S route instead, with the
//     organization selected now as the route's {companyId} (O2S has no x-organization-id header; a page that
//     sends a different one, i.e. stale state from before a switch, is refused with a 409);
//   - maps request bodies and query strings (page/limit -> pageNumber/pageSize, "" ids -> null);
//   - turns O2S's `{ IsError, ErrorMessage, Data }` (or a bare 201 body) into `{ success, message, data }`,
//     O2S pages `{ pageNumber, pageSize, totalItems, totalPages, data }` into `{ items, meta }`, and numeric
//     ids into strings (code-crafter used uuids, the screens compare ids as strings);
//   - refreshes the access token once on a 401 with the stored refresh token; when that fails (or a signed-in request
//     is refused again) the session is over: endSession() clears it and goes to /sign-in.
// A path with no rule is sent unchanged (its envelope is still translated).

import { endSession } from "@/lib/auth-session"
import { readSelectedOrganizationId } from "@/lib/organization-selection"

/** A page sent an organization other than the selected one (its state is from before a switch). */
export const ORGANIZATION_CHANGED_MESSAGE = "The selected organization changed. Close this form and try again."

export type O2sContext = {
  /** The selected organization (O2S company id), "" when none is selected. */
  companyId: string
  method: string
  /** The code-crafter URL the app asked for. */
  url: URL
  query: URLSearchParams
  /** The parsed JSON body (or the FormData) the app sent. */
  body: unknown
  /** Calls an O2S route (path relative to the API base, e.g. "/api/v1/account/profile") and returns its Data. */
  call: (path: string, init?: { method?: string; body?: unknown }) => Promise<unknown>
  /** The signed-in user stored at login (localStorage "auth_user"). */
  userId: string
}

export type O2sResult = { status?: number; data: unknown; message?: string }

export type O2sRule = {
  /** HTTP methods the rule applies to (default: any). */
  methods?: string[]
  /** Matched against the code-crafter pathname, e.g. /^\/api\/v1\/buyer\/([^/]+)$/. */
  match: RegExp
  /** The O2S path (with its own query string, if any). */
  to?: (m: RegExpMatchArray, ctx: O2sContext) => string
  /** The O2S method, when it differs (PATCH -> PUT, ...). */
  method?: string | ((ctx: O2sContext) => string)
  /** Maps the query string the app sent (after the default page/limit mapping). */
  query?: (q: URLSearchParams, ctx: O2sContext) => void
  /** Maps the request body. May call other routes through ctx.call. */
  request?: (body: unknown, ctx: O2sContext) => unknown | Promise<unknown>
  /** Maps the O2S Data back to what the screen expects (after the default page mapping). */
  response?: (data: unknown, ctx: O2sContext) => unknown
  /** Handles the request entirely (several calls, or nothing to call). */
  handle?: (m: RegExpMatchArray, ctx: O2sContext) => Promise<O2sResult>
  /** The response is a file (pdf / xlsx / csv): passed through untouched. */
  file?: boolean
}

type FetchFn = typeof window.fetch

export class O2sError extends Error {
  constructor(message: string, readonly status: number, readonly data: unknown = null) {
    super(message)
  }
}

export function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "")
}

/** The same-origin path next.config.mjs rewrites to the API (see sendBase). */
export const API_PROXY_PATH = "/o2s-api"

/**
 * Where requests are actually sent. A page served over https may not call an http API (mixed content), so
 * then the request goes to this site's own /o2s-api, which next.config.mjs forwards to the API server-side.
 */
export function sendBase() {
  const base = apiBase()
  if (typeof window !== "undefined" && window.location.protocol === "https:" && base.startsWith("http:")) {
    return `${window.location.origin}${API_PROXY_PATH}`
  }
  return base
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// ---------- response shapes ----------

type O2sPage = { pageNumber?: number | null; pageSize?: number | null; totalItems: number; totalPages: number; data: unknown[] }

export function isO2sPage(value: unknown): value is O2sPage {
  return isRecord(value) && Array.isArray(value.data) && typeof value.totalItems === "number"
}

/** O2S page -> code-crafter `{ items, meta }` (extra fields, e.g. unreadCount, are kept). */
export function toCodeCrafterPage(page: O2sPage, query?: URLSearchParams) {
  const limit = page.pageSize ?? (Number(query?.get("limit") ?? query?.get("pageSize") ?? 0) || page.data.length)
  const current = page.pageNumber ?? (Number(query?.get("page") ?? query?.get("pageNumber") ?? 1) || 1)
  const totalPages = page.totalPages || (limit ? Math.ceil(page.totalItems / limit) : 1)
  const { data, totalItems, pageNumber, pageSize, totalPages: _t, metaData: _m, ...rest } = page as O2sPage & Record<string, unknown>
  void pageNumber
  void pageSize
  void _t
  void _m
  return {
    ...rest,
    items: data,
    meta: {
      total: totalItems,
      page: current,
      limit,
      totalPages,
      hasNextPage: current < totalPages,
      hasPreviousPage: current > 1,
    },
  }
}

const ID_KEY = /^(id|.*Id)$/

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})T00:00:00$/

/**
 * Deep, on every answer: numeric ids -> strings (code-crafter ids were uuids; the screens compare them as
 * strings) and O2S's date-only values ("2026-01-31T00:00:00", no zone) -> "2026-01-31" for date inputs.
 */
export function stringifyIds(value: unknown): unknown {
  if (typeof value === "string") return value.replace(DATE_ONLY, "$1")
  if (Array.isArray(value)) return value.map(stringifyIds)
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    out[key] = typeof v === "number" && ID_KEY.test(key) ? String(v) : stringifyIds(v)
  }
  return out
}

const IDS_KEY = /^(ids|.*Ids)$/

/** One id for O2S: a GUID string; "" / null / 0 -> null (a new row, or no selection), a number -> its text. */
function normalizeId(v: unknown): unknown {
  if (v === "" || v === null || v === undefined || v === 0) return null
  return typeof v === "number" ? String(v) : v
}

/**
 * Before a body reaches O2S, whose ids are GUID strings: an empty `id` / `<thing>Id` ("" / null / 0, a new
 * row or a cleared picker) -> null, so the server makes the row's id; a number left in one -> its text;
 * `<thing>Ids` lists the same way.
 */
export function normalizeRequestBody(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeRequestBody)
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    if (ID_KEY.test(key) && (v === null || v === undefined || typeof v !== "object")) out[key] = normalizeId(v)
    else if (IDS_KEY.test(key) && Array.isArray(v)) out[key] = v.map(normalizeId).filter((id) => id !== null)
    else out[key] = normalizeRequestBody(v)
  }
  return out
}

// O2S names a record's navigation by the table (plural: buyers, currencies); code-crafter by the relation
// (singular: buyer, currency). Only object values are renamed, so lists named the same stay as they are.
const SINGULAR_NAVS: Record<string, string> = {
  buyers: "buyer", currencies: "currency", factories: "factory", countries: "country", units: "unit",
  materialGroups: "materialGroup", sizes: "size", colors: "color", fabrics: "fabric", yarns: "yarn",
  processes: "process", gmtCostScopes: "gmtCostScope", embellishments: "embellishment", tasks: "task",
  jobs: "job", styles: "style", companies: "organization", designations: "designation", departments: "department",
  employmentTypes: "employmentType", grades: "grade", payGroups: "payGroup", workLocations: "workLocation",
  employees: "employee", leaveTypes: "leaveType", shifts: "shift",
}

export function singularNavs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(singularNavs)
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    const name = isRecord(v) && SINGULAR_NAVS[key] ? SINGULAR_NAVS[key] : key
    out[name] = singularNavs(v)
  }
  return out
}

export const UPDATING_MESSAGE = "O2S is being updated. Please try again in a minute."
export const UNAVAILABLE_MESSAGE = "The server is not available right now. Please try again in a few minutes."
export const OFFLINE_MESSAGE = "Cannot reach the server. Check your internet connection and try again."

/**
 * A user-facing message for an answer that is not JSON. While the API deploys, IIS answers every request
 * with app_offline.htm (503); when the app cannot start it sends its own HTML error page (500.30, 502.5, ...).
 * Neither is shown as is: HTML never reaches a toast.
 */
export function messageForNonJson(status: number, text: string): string {
  const isHtml = /<\s*(!doctype|html|head|body|h1|p|div)\b/i.test(text)
  if (/being updated|app_offline|is updating/i.test(text) || (status === 503 && isHtml)) return UPDATING_MESSAGE
  if (status === 502 || status === 503 || status === 504 || /HTTP Error 50\d|failed to start/i.test(text)) {
    return UNAVAILABLE_MESSAGE
  }
  if (isHtml) {
    return status >= 500
      ? "The server had a problem. Please try again in a few minutes."
      : `The server sent an unexpected answer (${status}). Please try again.`
  }
  // plain text: keep a short one, it is usually the reason
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain && plain.length <= 300) return plain
  if (status === 404) return "Not found. It may have been deleted, or the server is being updated."
  return status >= 500 ? "The server had a problem. Please try again in a few minutes." : "The request failed. Please try again."
}

/** Reads an O2S answer: the envelope, a bare (201) object, nothing (204) or ProblemDetails. */
async function readO2s(response: Response): Promise<{ ok: boolean; message: string; data: unknown }> {
  if (response.status === 204) return { ok: response.ok, message: "OK", data: null }
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    if (response.ok) return { ok: true, message: "OK", data: null }
    return { ok: false, message: messageForNonJson(response.status, text), data: null }
  }
  if (isRecord(payload) && "IsError" in payload) {
    return {
      ok: response.ok && payload.IsError !== true,
      message: (payload.ErrorMessage as string | null) || (response.ok ? "OK" : response.statusText),
      data: payload.Data ?? null,
    }
  }
  if (isRecord(payload) && !response.ok) {
    const message = (payload.detail as string) || (payload.title as string) || response.statusText
    return { ok: false, message, data: payload }
  }
  return { ok: response.ok, message: response.ok ? "OK" : response.statusText, data: payload }
}

function codeCrafterResponse(status: number, ok: boolean, message: string, data: unknown) {
  const body = {
    success: ok,
    message,
    // A NestJS error carried the status too; some screens read it.
    ...(ok ? {} : { statusCode: status, error: message }),
    data,
    timestamp: new Date().toISOString(),
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// ---------- the fetch wrapper ----------

function readUserId() {
  try {
    const user = JSON.parse(window.localStorage.getItem("auth_user") ?? "null") as { id?: string } | null
    return user?.id ?? ""
  } catch {
    return ""
  }
}

let refreshing: Promise<boolean> | null = null

async function refreshAccessToken(original: FetchFn): Promise<boolean> {
  const refreshToken = window.localStorage.getItem("refresh_token")
  if (!refreshToken) return false
  refreshing ??= (async () => {
    try {
      const response = await original(`${sendBase()}/api/v1/account/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      const { ok, data } = await readO2s(response)
      if (!ok || !isRecord(data) || typeof data.token !== "string") return false
      window.localStorage.setItem("access_token", data.token)
      if (typeof data.refreshToken === "string") window.localStorage.setItem("refresh_token", data.refreshToken)
      return true
    } catch {
      return false
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

/** Sends one request to O2S with the caller's headers; retries once after a token refresh on 401. */
async function sendToO2s(original: FetchFn, path: string, init: RequestInit, allowRefresh = true): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.delete("x-organization-id")
  const token = window.localStorage.getItem("access_token")
  if (headers.has("Authorization") && token) headers.set("Authorization", `Bearer ${token}`)
  let response: Response
  try {
    response = await original(`${sendBase()}${path}`, { ...init, headers })
  } catch (error) {
    // No answer at all (offline, DNS, or IIS's own error page without CORS headers): fetch throws a TypeError.
    if (error instanceof TypeError) throw new O2sError(OFFLINE_MESSAGE, 503)
    throw error
  }
  if (response.status === 401 && headers.has("Authorization")) {
    if (allowRefresh && (await refreshAccessToken(original))) return sendToO2s(original, path, init, false)
    // A signed-in request still refused: the session expired or was ended (password changed, user deactivated).
    // Requests without a token (sign-in with a wrong password, …) never get here.
    endSession()
  }
  return response
}

function serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined) return undefined
  if (body instanceof FormData || body instanceof Blob || typeof body === "string") return body as BodyInit
  headers.set("Content-Type", "application/json")
  return JSON.stringify(body)
}

function defaultQuery(q: URLSearchParams) {
  const mapped = new URLSearchParams()
  q.forEach((value, key) => {
    if (key === "organizationId") return // the route carries the company
    if (key === "page") mapped.set("pageNumber", value)
    else if (key === "limit") mapped.set("pageSize", value)
    else mapped.append(key, value)
  })
  return mapped
}

export function createO2sFetch(original: FetchFn, rules: O2sRule[]): FetchFn {
  return async (input, init) => {
    const base = apiBase()
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (!base || !rawUrl.startsWith(base)) return original(input, init)
    const url = new URL(rawUrl)
    if (!url.pathname.startsWith("/api/v1/")) return original(input, init)
    if (input instanceof Request) {
      // Not used by this app's services; send as is.
      return original(input, init)
    }

    const method = (init?.method ?? "GET").toUpperCase()
    const headers = new Headers(init?.headers)
    let body: unknown = init?.body
    if (typeof body === "string") {
      try {
        body = JSON.parse(body)
      } catch {
        // keep the text
      }
    }

    // Every call goes to the organization selected now (the switcher in the top bar), never to the one a page
    // remembers: a page that still sends an older id (x-organization-id, from state kept since before a switch) is
    // refused, so a save cannot land in another company. Screens that act on a company the user picks (Company
    // Menus, User Menu Permission, memberships) name it in the path / body / query of their own rule instead.
    const companyId = readSelectedOrganizationId()
    const requested = (headers.get("x-organization-id") ?? "").trim()
    if (requested && requested !== "null" && requested !== "undefined" && companyId && requested !== companyId) {
      return codeCrafterResponse(409, false, ORGANIZATION_CHANGED_MESSAGE, null)
    }
    const ctx: O2sContext = {
      companyId,
      method,
      url,
      query: url.searchParams,
      body,
      userId: readUserId(),
      call: async (path, callInit) => {
        const callHeaders = new Headers({ Accept: "application/json" })
        const auth = headers.get("Authorization")
        if (auth) callHeaders.set("Authorization", auth)
        const response = await sendToO2s(original, path, {
          method: callInit?.method ?? "GET",
          headers: callHeaders,
          body: serializeBody(callInit?.body, callHeaders),
          cache: "no-store",
        })
        const read = await readO2s(response)
        if (!read.ok) throw new O2sError(read.message, response.status, read.data)
        return read.data
      },
    }

    const rule = rules.find((r) => (!r.methods || r.methods.includes(method)) && r.match.test(url.pathname))
    const match = rule ? url.pathname.match(rule.match)! : null

    try {
      if (rule?.handle) {
        const result = await rule.handle(match!, ctx)
        return codeCrafterResponse(result.status ?? 200, true, result.message ?? "OK", stringifyIds(result.data ?? {}))
      }

      let path = rule?.to ? rule.to(match!, ctx) : url.pathname
      const query = defaultQuery(url.searchParams)
      rule?.query?.(query, ctx)
      const [pathOnly, ownQuery] = path.split("?")
      new URLSearchParams(ownQuery ?? "").forEach((v, k) => query.set(k, v))
      path = pathOnly + (query.toString() ? `?${query}` : "")

      const o2sMethod = typeof rule?.method === "function" ? rule.method(ctx) : (rule?.method ?? method)
      let o2sBody = body
      if (o2sBody !== undefined && !(o2sBody instanceof FormData)) {
        o2sBody = normalizeRequestBody(rule?.request ? await rule.request(o2sBody, ctx) : o2sBody)
      } else if (o2sBody instanceof FormData && rule?.request) {
        o2sBody = await rule.request(o2sBody, ctx)
      }
      const outHeaders = new Headers(headers)
      outHeaders.delete("Content-Type")
      const response = await sendToO2s(original, path, {
        ...init,
        method: o2sMethod,
        headers: outHeaders,
        body: serializeBody(o2sBody, outHeaders),
      })

      const contentType = response.headers.get("Content-Type") ?? ""
      if (rule?.file && response.ok && !contentType.includes("json")) return response

      const read = await readO2s(response)
      if (!read.ok) {
        return codeCrafterResponse(response.status, false, read.message, stringifyIds(read.data))
      }
      let data = read.data
      if (isO2sPage(data)) data = toCodeCrafterPage(data, url.searchParams)
      if (rule?.response) data = rule.response(data, ctx)
      // code-crafter always answered with data; some screens refuse a success without it (a 204 delete).
      return codeCrafterResponse(response.status === 204 ? 200 : response.status, true, read.message, stringifyIds(data ?? {}))
    } catch (error) {
      if (error instanceof O2sError) {
        return codeCrafterResponse(error.status || 400, false, error.message, stringifyIds(error.data))
      }
      return codeCrafterResponse(400, false, error instanceof Error ? error.message : "The request failed.", null)
    }
  }
}

// ---------- helpers for the rules ----------

/** The route prefix for the selected company: /api/v1/{companyId}. */
export function companyPath(ctx: O2sContext, rest: string) {
  if (!ctx.companyId) throw new O2sError("Select an organization before continuing.", 400)
  return `/api/v1/${encodeURIComponent(ctx.companyId)}${rest}`
}

/** Copies `from` -> `to` keys of a record (others unchanged); missing keys are skipped. */
export function renameKeys(value: unknown, names: Record<string, string>): unknown {
  if (Array.isArray(value)) return value.map((v) => renameKeys(v, names))
  if (!isRecord(value)) return value
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) out[names[key] ?? key] = v
  return out
}

/** Maps a list (or a code-crafter page's items) with fn. */
export function mapItems(data: unknown, fn: (item: Record<string, unknown>) => unknown): unknown {
  if (Array.isArray(data)) return data.map((item) => (isRecord(item) ? fn(item) : item))
  if (isRecord(data) && Array.isArray(data.items)) return { ...data, items: mapItems(data.items, fn) }
  return isRecord(data) ? fn(data) : data
}
