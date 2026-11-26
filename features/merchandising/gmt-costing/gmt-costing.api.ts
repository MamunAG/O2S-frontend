// O2S calls of the GMT Costing screen. These are O2S routes (/api/v1/{companyId}/merchandising/...), not
// code-crafter paths, so lib/o2s passes them through unchanged; it still turns the answer into
// { success, message, data }, a page into { items, meta } and every id into a string. `numberIds` undoes
// the last one, so the screen works with the API's numbers.

import { requireSelectedOrganizationId } from "@/lib/organization-selection"

import { fabricCostFromDto } from "./gmt-costing.calc"

import type {
  CostScope,
  FabricCostSearchItem,
  GmtCosting,
  GmtCostingListItem,
  GmtCostingSheet,
  MaterialInfo,
  Option,
  PageMeta,
  StyleInfo,
} from "./gmt-costing.types"

export type ApiContext = { apiUrl: string; organizationId: string }

type Envelope<T> = { success?: boolean; message?: string | string[]; data?: T }
type Query = Record<string, string | number | boolean | null | undefined>
type Page<T> = { items: T[]; meta: PageMeta & { hasNextPage?: boolean } }

const ID_KEY = /^(id|.*Id)$/

/** The bridge's string ids back to numbers (deep). Only keys named `id` / `...Id` holding a numeric text. */
export function numberIds<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => numberIds(item)) as T
  if (!value || typeof value !== "object") return value as T
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    out[key] = typeof v === "string" && ID_KEY.test(key) && /^-?\d+$/.test(v) ? Number(v) : numberIds(v)
  }
  return out as T
}

function token() {
  const value = typeof window === "undefined" ? null : window.localStorage.getItem("access_token")
  if (!value) throw new Error("Your session expired. Please sign in again.")
  return value
}

function companyRoute(ctx: ApiContext, path: string) {
  const companyId = requireSelectedOrganizationId(ctx.organizationId)
  return `/api/v1/${encodeURIComponent(companyId)}${path}`
}

function buildUrl(ctx: ApiContext, path: string, query?: Query) {
  const url = new URL(companyRoute(ctx, path), ctx.apiUrl)
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value))
  })
  return url
}

function messageOf(payload: Envelope<unknown> | null, fallback: string) {
  const message = payload?.message
  if (Array.isArray(message)) return message.join(" ") || fallback
  return typeof message === "string" && message.trim() && message !== "OK" ? message : fallback
}

async function request<T>(
  ctx: ApiContext,
  path: string,
  options: { method?: string; body?: unknown; query?: Query; fallback?: string } = {},
): Promise<T> {
  const headers = new Headers({ Authorization: `Bearer ${token()}`, Accept: "application/json" })
  let body: BodyInit | undefined
  if (options.body instanceof FormData) body = options.body
  else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.body)
  }
  const response = await fetch(buildUrl(ctx, path, options.query), {
    method: options.method ?? "GET",
    headers,
    body,
    cache: "no-store",
  })
  let payload: Envelope<T> | null = null
  try {
    payload = (await response.json()) as Envelope<T>
  } catch {
    payload = null
  }
  if (response.status === 401) throw new Error("Your session expired. Please sign in again.")
  if (response.status === 403) throw new Error(messageOf(payload, "You do not have permission for this action."))
  if (!response.ok || payload?.success === false) {
    throw new Error(messageOf(payload, options.fallback ?? "The request could not be completed."))
  }
  return numberIds<T>(payload?.data)
}

export async function downloadFile(ctx: ApiContext, path: string) {
  const response = await fetch(buildUrl(ctx, path), { headers: { Authorization: `Bearer ${token()}` } })
  if (response.status === 401) throw new Error("Your session expired. Please sign in again.")
  if (!response.ok) throw new Error("The file could not be downloaded.")
  return response.blob()
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const MERCH = "/merchandising"
const COSTING = `${MERCH}/gmt-costing`

// ---------- GMT costing ----------

export async function fetchGmtCostings(
  ctx: ApiContext,
  params: {
    page: number
    limit: number
    costName?: string
    buyerId?: string
    styleId?: string
    isActive?: string
    fromCostDate?: string
    toCostDate?: string
  },
) {
  const { page, limit, ...filters } = params
  return request<Page<GmtCostingListItem>>(ctx, `${COSTING}/paginated-list`, {
    query: { pageNumber: page, pageSize: limit, ...filters },
    fallback: "Unable to load GMT costings.",
  })
}

export const fetchGmtCosting = (ctx: ApiContext, id: number) =>
  request<GmtCosting>(ctx, `${COSTING}/${id}`, { fallback: "Unable to load the GMT costing." })

export const createGmtCosting = (ctx: ApiContext, body: unknown) =>
  request<GmtCosting>(ctx, `${COSTING}/`, { method: "POST", body, fallback: "Unable to save the GMT costing." })

export const updateGmtCosting = (ctx: ApiContext, id: number, body: unknown) =>
  request<unknown>(ctx, `${COSTING}/${id}`, { method: "PUT", body, fallback: "Unable to update the GMT costing." })

export const deleteGmtCosting = (ctx: ApiContext, id: number) =>
  request<unknown>(ctx, `${COSTING}/${id}`, { method: "DELETE", fallback: "Unable to delete the GMT costing." })

export const fetchGmtCostingSheet = (ctx: ApiContext, id: number) =>
  request<GmtCostingSheet>(ctx, `${COSTING}/${id}/costing-sheet`, { fallback: "Unable to load the costing sheet." })

export async function searchFabricCosts(ctx: ApiContext, searchText: string, page: number, limit = 20) {
  const result = await request<{ hasMore: boolean; data: FabricCostSearchItem[] }>(ctx, `${COSTING}/fabric-costs`, {
    query: { searchText, pageNumber: page, pageSize: limit },
    fallback: "Unable to search fabric costings.",
  })
  return {
    hasMore: Boolean(result?.hasMore),
    items: (result?.data ?? []).map((item) => ({ ...item, fabricCost: fabricCostFromDto(item.fabricCost) })),
  }
}

// ---------- lookups ----------

type Loaded = { items: Option[]; hasNextPage: boolean }

async function selectOptions(
  ctx: ApiContext,
  path: string,
  label: (row: Record<string, unknown>) => string,
  query: Query,
): Promise<Loaded> {
  const page = await request<Page<Record<string, unknown>>>(ctx, `${path}/select-options`, { query })
  return {
    items: (page?.items ?? []).map((row) => ({ value: String(row.id), label: label(row) })),
    hasNextPage: Boolean(page?.meta?.hasNextPage ?? (page?.meta ? page.meta.page < page.meta.totalPages : false)),
  }
}

type LoadParams = { query: string; page: number; limit: number }

export const loadBuyerOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, `${MERCH}/buyer`, (r) => String(r.displayName ?? ""), {
    displayName: p.query, isActive: true, pageNumber: p.page, pageSize: p.limit,
  })

export const loadStyleOptions = (ctx: ApiContext, p: LoadParams, buyerId?: string) =>
  selectOptions(ctx, `${MERCH}/style`, (r) => String(r.styleNo ?? ""), {
    styleNo: p.query, buyerId, pageNumber: p.page, pageSize: p.limit,
  })

export const loadTechSheetOptions = (ctx: ApiContext, p: LoadParams, styleId?: string) =>
  selectOptions(ctx, `${MERCH}/technical-sheet`, (r) => String(r.technicalSheetNo ?? ""), {
    technicalSheetNo: p.query, styleId, pageNumber: p.page, pageSize: p.limit,
  })

export const loadPartOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, `${MERCH}/gmt-part`, (r) => String(r.partName ?? ""), {
    partName: p.query, isActive: true, pageNumber: p.page, pageSize: p.limit,
  })

export const loadColorOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, `${MERCH}/color`, (r) => String(r.colorName ?? ""), {
    colorName: p.query, isActive: true, pageNumber: p.page, pageSize: p.limit,
  })

export const loadSupplierOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, "/configuration/supplier", (r) => String(r.name ?? ""), {
    name: p.query, isActive: true, pageNumber: p.page, pageSize: p.limit,
  })

export const loadMaterialOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, "/configuration/material", (r) => String(r.name ?? ""), {
    name: p.query, isActive: true, pageNumber: p.page, pageSize: p.limit,
  })

/** A material's unit and group (the group decides Is Color Wise). Null when it cannot be read. */
export async function fetchMaterialInfo(ctx: ApiContext, id: number): Promise<MaterialInfo | null> {
  try {
    const row = await request<Record<string, unknown>>(ctx, `/configuration/material/${id}`)
    const unit = (row.units ?? row.unit) as Record<string, unknown> | null | undefined
    const group = (row.materialGroups ?? row.materialGroup) as Record<string, unknown> | null | undefined
    return {
      id,
      name: String(row.name ?? ""),
      unitId: typeof row.unitId === "number" ? row.unitId : null,
      unitName: String(unit?.name ?? ""),
      materialGroupName: String(group?.name ?? ""),
    }
  } catch {
    return null
  }
}

/** Every active cost scope of the company with its role flags (one call, filtered on the screen). */
export async function fetchCostScopes(ctx: ApiContext): Promise<CostScope[]> {
  const page = await request<Page<Record<string, unknown>>>(ctx, `${MERCH}/gmt-cost-scope/paginated-list`, {
    query: { isActive: true, pageNumber: 1, pageSize: 1000 },
    fallback: "Unable to load the GMT cost scopes.",
  })
  return (page?.items ?? []).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? ""),
    isProcessCost: Boolean(r.isProcessCost),
    isGmtProcess: Boolean(r.isGmtProcess),
    isOtherTypeCost: Boolean(r.isOtherTypeCost),
    isCommission: Boolean(r.isCommission),
    isCommissionPercentage: Boolean(r.isCommissionPercentage),
    isActive: r.isActive !== false,
  }))
}

/** The style with its colors and sizes (the group dialogs offer these). */
export async function fetchStyleInfo(ctx: ApiContext, id: number): Promise<StyleInfo> {
  const row = await request<Record<string, unknown>>(ctx, `${MERCH}/style/${id}`, { fallback: "Unable to load the style." })
  const maps = (value: unknown) => (Array.isArray(value) ? (value as Record<string, unknown>[]) : [])
  return {
    id,
    styleNo: String(row.styleNo ?? ""),
    styleName: String(row.styleName ?? ""),
    buyerId: Number(row.buyerId ?? 0),
    colors: maps(row.colorMaps).map((m) => {
      const color = (m.colors ?? m.color) as Record<string, unknown> | undefined
      return { id: Number(m.colorId), name: String(color?.colorName ?? m.colorId) }
    }),
    sizes: maps(row.sizeMaps).map((m) => {
      const size = (m.sizes ?? m.size) as Record<string, unknown> | undefined
      return { id: Number(m.sizeId), name: String(size?.sizeName ?? m.sizeId) }
    }),
  }
}

export async function uploadFile(ctx: ApiContext, file: File) {
  const form = new FormData()
  form.append("file", file)
  return request<{ id: number; fileName: string }>(ctx, "/support/file/", {
    method: "POST",
    body: form,
    fallback: "Unable to upload the file.",
  })
}

export const downloadAttachment = (ctx: ApiContext, id: number) => downloadFile(ctx, `/support/file/${id}/download`)
