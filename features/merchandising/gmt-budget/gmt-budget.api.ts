// O2S calls of the GMT Budget screen (/api/v1/{companyId}/merchandising/gmt-budget and the lookups it
// needs). The request helpers are the GMT costing screen's.

import { request, selectOptions, type ApiContext, type LoadParams, type Page } from "../gmt-costing/gmt-costing.api"
import type { GmtBudget, PoStyleRow } from "./gmt-budget.types"

const MERCH = "/merchandising"
const BUDGET = `${MERCH}/gmt-budget`

export type PoStyleFilters = {
  buyerId?: string
  styleId?: string
  poId?: string
  isBudgetDone?: "" | "true" | "false"
  fromDeliveryDate?: string
  toDeliveryDate?: string
  fromBudgetDate?: string
  toBudgetDate?: string
}

/** Every PO + style of the company's jobs, with its budget when it has one. */
export const fetchPoStyleList = (ctx: ApiContext, page: number, limit: number, filters: PoStyleFilters) =>
  request<Page<PoStyleRow>>(ctx, `${BUDGET}/po-style-list`, {
    query: { pageNumber: page, pageSize: limit, ...filters },
    fallback: "Unable to load the PO / style list.",
  })

export const fetchGmtBudget = (ctx: ApiContext, id: number) =>
  request<GmtBudget>(ctx, `${BUDGET}/${id}`, { fallback: "Unable to load the GMT budget." })

export const createGmtBudget = (ctx: ApiContext, body: unknown) =>
  request<GmtBudget>(ctx, `${BUDGET}/`, { method: "POST", body, fallback: "Unable to save the GMT budget." })

export const updateGmtBudget = (ctx: ApiContext, id: number, body: unknown) =>
  request<unknown>(ctx, `${BUDGET}/${id}`, { method: "PUT", body, fallback: "Unable to update the GMT budget." })

export const deleteGmtBudget = (ctx: ApiContext, id: number) =>
  request<unknown>(ctx, `${BUDGET}/${id}`, { method: "DELETE", fallback: "Unable to delete the GMT budget." })

/** The POs of a buyer / style (from the PO / style list): the PO picker. */
export async function loadPoOptions(ctx: ApiContext, p: LoadParams, buyerId?: string, styleId?: string, isBudgetDone?: boolean) {
  const page = await fetchPoStyleList(ctx, p.page, p.limit, {
    buyerId,
    styleId,
    isBudgetDone: isBudgetDone === undefined ? "" : isBudgetDone ? "true" : "false",
  })
  const query = p.query.trim().toLowerCase()
  const seen = new Set<number>()
  const items = (page?.items ?? [])
    .filter((row) => !query || row.po.toLowerCase().includes(query))
    .filter((row) => (seen.has(row.poId) ? false : (seen.add(row.poId), true)))
    .map((row) => ({ value: String(row.poId), label: row.po }))
  return { items, hasNextPage: Boolean(page?.meta && page.meta.page < page.meta.totalPages) }
}

/** The PO + style's row of the PO / style list (its budget id, when it has one). */
export async function findPoStyle(ctx: ApiContext, poId: number, styleId: number) {
  const page = await fetchPoStyleList(ctx, 1, 5, { poId: String(poId), styleId: String(styleId) })
  return (page?.items ?? []).find((r) => r.poId === poId && r.styleId === styleId) ?? null
}

/**
 * The PO's job lines of the style: the jobs whose PO number matches, read one by one (the job list has no
 * lines), and their lines of this PO id + style. Needs Read on the Job menu.
 */
export async function fetchPoStyleLines(ctx: ApiContext, poNo: string, poId: number, styleId: number) {
  const jobs = await request<Page<{ id: number }>>(ctx, `${MERCH}/job/paginated-list`, {
    query: { poNo, pageNumber: 1, pageSize: 50 },
    fallback: "Unable to read the PO's job lines.",
  })
  const lines: Array<Record<string, unknown>> = []
  for (const job of jobs?.items ?? []) {
    const full = await request<{ details?: Array<Record<string, unknown>> }>(ctx, `${MERCH}/job/${job.id}`)
    for (const line of full?.details ?? []) {
      if (Number(line.poId) === poId && Number(line.styleId) === styleId) lines.push(line)
    }
  }
  return lines
}

/** The style's GMT costings (the costing picker). */
export async function loadCostingOptions(ctx: ApiContext, p: LoadParams, styleId?: string) {
  if (!styleId) return { items: [], hasNextPage: false }
  const page = await request<Page<{ id: number; costName: string }>>(ctx, `${MERCH}/gmt-costing/paginated-list`, {
    query: { styleId, costName: p.query, pageNumber: p.page, pageSize: p.limit },
  })
  return {
    items: (page?.items ?? []).map((c) => ({ value: String(c.id), label: c.costName })),
    hasNextPage: Boolean(page?.meta && page.meta.page < page.meta.totalPages),
  }
}

export const loadFabricSourceOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, `${MERCH}/fabric-source`, (r) => String(r.name ?? ""), { name: p.query, pageNumber: p.page, pageSize: p.limit })

export const loadFactoryOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, "/configuration/factory", (r) => String(r.displayName ?? ""), { displayName: p.query, pageNumber: p.page, pageSize: p.limit })

export const loadSpecialTreatmentOptions = (ctx: ApiContext, p: LoadParams) =>
  selectOptions(ctx, `${MERCH}/special-treatment`, (r) => String(r.treatment ?? ""), { treatment: p.query, pageNumber: p.page, pageSize: p.limit })
