// O2S calls of the GMT Booking screen (/api/v1/{companyId}/merchandising/gmt-booking). The request helpers
// are the GMT costing screen's.

import { request, type ApiContext, type Page } from "../gmt-costing/gmt-costing.api"
import { fabricRowFromDto, wastageFromDto, yarnRowFromDto } from "./gmt-booking.calc"
import type { BookingListItem, BudgetedPoStyle, GmtBooking } from "./gmt-booking.types"

const BOOKING = "/merchandising/gmt-booking"

export type BookingFilters = {
  bomNo?: string
  buyerId?: string
  poId?: string
  styleId?: string
  isApproved?: "" | "true" | "false"
  fromBookingReleaseDate?: string
  toBookingReleaseDate?: string
}

export const fetchBookings = (ctx: ApiContext, page: number, limit: number, filters: BookingFilters) =>
  request<Page<BookingListItem>>(ctx, `${BOOKING}/paginated-list`, {
    query: { pageNumber: page, pageSize: limit, ...filters },
    fallback: "Unable to load the bookings.",
  })

export const fetchBooking = (ctx: ApiContext, id: number) => request<GmtBooking>(ctx, `${BOOKING}/${id}`, { fallback: "Unable to load the booking." })

/** The saved booking of a PO + style, or null. */
export const fetchBookingByPoStyle = (ctx: ApiContext, poId: number, styleId: number) =>
  request<GmtBooking | null>(ctx, `${BOOKING}/po-style`, { query: { poId, styleId }, fallback: "Unable to load the saved booking." })

export const createBooking = (ctx: ApiContext, body: unknown) =>
  request<GmtBooking>(ctx, `${BOOKING}/`, { method: "POST", body, fallback: "Unable to save the booking." })

export const updateBooking = (ctx: ApiContext, id: number, body: unknown) =>
  request<unknown>(ctx, `${BOOKING}/${id}`, { method: "PUT", body, fallback: "Unable to update the booking." })

export const deleteBooking = (ctx: ApiContext, id: number) =>
  request<unknown>(ctx, `${BOOKING}/${id}`, { method: "DELETE", fallback: "Unable to delete the booking." })

/** The PO + styles with a GMT budget (only these can be booked), with their booking if any. */
export async function fetchBudgetedPoStyles(ctx: ApiContext, buyerId?: number) {
  const rows = await request<BudgetedPoStyle[]>(ctx, `${BOOKING}/budgeted-po-styles`, { query: { buyerId: buyerId || undefined } })
  return Array.isArray(rows) ? rows : []
}

/** desktop "Refresh New Data": the rows the PO + style's budget gives now. Nothing is saved. */
export async function refreshFromBudget(ctx: ApiContext, poId: number, styleId: number) {
  const r = await request<Record<string, unknown>>(ctx, `${BOOKING}/refresh-from-budget`, {
    query: { poId, styleId },
    fallback: "Unable to work the booking out from the budget.",
  })
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : [])
  return {
    budgetId: Number(r?.budgetId) || null,
    fabricSourceId: Number(r?.fabricSourceId) > 0 ? Number(r?.fabricSourceId) : null,
    fabricDetails: list(r?.fabricDetails).map(fabricRowFromDto),
    details: list(r?.details).map(yarnRowFromDto),
    wastages: list(r?.wastages).map(wastageFromDto),
  }
}
