"use client"

// GMT Booking list: one row per saved booking (GET gmt-booking/paginated-list). Ported from ClickERP's
// gmt-booking.index; the look is this app's, as GMT Costing and GMT Budget.

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, MoreHorizontal, Pencil, Plus, RefreshCcw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams } from "@/components/app-combobox"
import { AppConfirmDialog } from "@/components/app-confirm-dialog"
import { AppDataSection } from "@/components/app-data-section"
import { AppSelect } from "@/components/app-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchCurrentMenuPermission } from "@/features/iam/menu-permissions/menu-permission.service"
import { parseStoredAuthUser } from "@/lib/auth-session"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { FIELD_CLASS, FieldLabel, INPUT_CLASS, LookupCombobox, formatDate } from "../gmt-costing/component/gmt-ui"
import { loadBuyerOptions, type ApiContext } from "../gmt-costing/gmt-costing.api"
import type { AccessRules, Option, PageMeta } from "../gmt-costing/gmt-costing.types"
import { loadPoOptions } from "../gmt-budget/gmt-budget.api"
import { deleteBooking, fetchBookings } from "./gmt-booking.api"
import type { BookingListItem } from "./gmt-booking.types"
import { GmtBookingFormDialog, type GmtBookingDialogMode } from "./component/gmt-booking-form-dialog"

/** The API's menu name (GmtBookingEndpoints.menuName). */
export const GMT_BOOKING_MENU_NAME = "Create Fabric Booking"

const NO_ACCESS: AccessRules = { canView: false, canCreate: false, canUpdate: false, canDelete: false }
const ALL = "__all__"

type Filters = { bomNo: string; buyer: Option | null; po: Option | null; released: "" | "true" | "false"; from: string; to: string }
const DEFAULT_FILTERS: Filters = { bomNo: "", buyer: null, po: null, released: "", from: "", to: "" }

type Editor = { mode: GmtBookingDialogMode; id: string | null; key: number }

export function GmtBookingWorkspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState(() => (typeof window === "undefined" ? "" : readSelectedOrganizationId()))
  const [access, setAccess] = useState<AccessRules | null>(null)
  const [accessError, setAccessError] = useState("")
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [rows, setRows] = useState<BookingListItem[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [error, setError] = useState("")
  const [loadedKey, setLoadedKey] = useState("")
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const ctx: ApiContext = useMemo(() => ({ apiUrl, organizationId }), [apiUrl, organizationId])

  const handleAuthFailure = useCallback(
    (message: string) => {
      const lower = message.toLowerCase()
      if (!lower.includes("session expired") && !lower.includes("unauthorized")) return false
      window.localStorage.removeItem("access_token")
      window.localStorage.removeItem("refresh_token")
      window.localStorage.removeItem("auth_user")
      router.replace("/sign-in")
      return true
    },
    [router],
  )
  const reportError = useCallback(
    (caught: unknown, fallback: string) => {
      const message = caught instanceof Error ? caught.message : fallback
      if (!handleAuthFailure(message)) toast.error(message)
      return message
    },
    [handleAuthFailure],
  )

  useEffect(() => {
    function onChange(event: Event) {
      const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
      setOrganizationId(next || "")
      setPage(1)
    }
    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, onChange)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      const token = window.localStorage.getItem("access_token")
      if (!token) {
        handleAuthFailure("Your session expired. Please sign in again.")
        return
      }
      if (parseStoredAuthUser(window.localStorage.getItem("auth_user"))?.role === "admin") {
        setAccess({ canView: true, canCreate: true, canUpdate: true, canDelete: true })
        return
      }
      try {
        const permission = await fetchCurrentMenuPermission({ apiUrl, accessToken: token, organizationId: organizationId || undefined, menuName: GMT_BOOKING_MENU_NAME })
        if (active) setAccess(permission)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unable to load your booking access."
        if (!handleAuthFailure(message) && active) {
          setAccess(NO_ACCESS)
          setAccessError(message)
        }
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [apiUrl, handleAuthFailure, organizationId])

  const requestKey = JSON.stringify([organizationId, filters, page, limit, refreshVersion])
  const loading = Boolean(access?.canView && organizationId) && loadedKey !== requestKey

  useEffect(() => {
    if (!access?.canView || !organizationId) return
    let active = true
    fetchBookings(ctx, page, limit, {
      bomNo: filters.bomNo.trim(),
      buyerId: filters.buyer?.value,
      poId: filters.po?.value,
      isApproved: filters.released,
      fromBookingReleaseDate: filters.from,
      toBookingReleaseDate: filters.to,
    })
      .then((result) => {
        if (!active) return
        setRows(result?.items ?? [])
        setMeta(result?.meta ?? null)
        setError("")
      })
      .catch((caught) => active && setError(reportError(caught, "Unable to load the bookings.")))
      .finally(() => active && setLoadedKey(requestKey))
    return () => {
      active = false
    }
  }, [access?.canView, ctx, filters, limit, organizationId, page, reportError, requestKey])

  const refresh = useCallback(() => setRefreshVersion((v) => v + 1), [])
  const open = useCallback((mode: GmtBookingDialogMode, id: string | null) => setEditor({ mode, id, key: Date.now() }), [])
  const canCreate = Boolean(access?.canCreate)
  const canUpdate = Boolean(access?.canUpdate)
  const canDelete = Boolean(access?.canDelete)

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBooking(ctx, deleteTarget.id)
      toast.success(`The booking of ${deleteTarget.poNo} · ${deleteTarget.style} was deleted.`)
      setDeleteTarget(null)
      refresh()
    } catch (caught) {
      reportError(caught, "Unable to delete the booking.")
    } finally {
      setDeleting(false)
    }
  }

  const actions = useCallback(
    (row: BookingListItem) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
            <MoreHorizontal className="size-3.5" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => open("view", row.id)}>
            <Eye className="size-3.5" /> View
          </DropdownMenuItem>
          {canUpdate ? (
            <DropdownMenuItem onSelect={() => open("edit", row.id)}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(row)}>
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [canDelete, canUpdate, open],
  )

  const yesNo = (v: boolean) => (
    <Badge variant={v ? "secondary" : "outline"} className="rounded-full px-3 py-1">
      {v ? "Yes" : "No"}
    </Badge>
  )

  const columns = useMemo<ColumnDef<BookingListItem>[]>(
    () => [
      { id: "sl", header: "SL", size: 56, cell: ({ row }) => <span className="tabular-nums">{(page - 1) * limit + row.index + 1}</span> },
      {
        id: "po",
        header: "PO",
        size: 140,
        cell: ({ row }) => (
          <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => open(canUpdate ? "edit" : "view", row.original.id)}>
            {row.original.poNo}
          </button>
        ),
      },
      { id: "bomNo", header: "Booking No", size: 120, cell: ({ row }) => row.original.bomNo || "--" },
      { id: "buyer", header: "Buyer", size: 140, cell: ({ row }) => row.original.buyer || "--" },
      {
        id: "style",
        header: "Style",
        size: 170,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.style}</p>
            {row.original.styleName ? <p className="truncate text-[11px] text-slate-500">{row.original.styleName}</p> : null}
          </div>
        ),
      },
      { id: "budget", header: "Budget", size: 160, cell: ({ row }) => row.original.budgetName || "--" },
      { id: "source", header: "Fabric Source", size: 120, cell: ({ row }) => row.original.fabricSource || "--" },
      { id: "released", header: "Released", size: 90, cell: ({ row }) => yesNo(row.original.isApproved) },
      { id: "releaseDate", header: "Release Date", size: 120, cell: ({ row }) => formatDate(row.original.bookingReleaseDate) },
      { id: "openDia", header: "Open Dia", size: 90, cell: ({ row }) => yesNo(row.original.isOpenDia) },
      { id: "revised", header: "Revise No", size: 80, cell: ({ row }) => <span className="tabular-nums">{row.original.revisedNo}</span> },
      { id: "createdBy", header: "Created By", size: 120, cell: ({ row }) => row.original.createdByName || "--" },
      { id: "createdDate", header: "Created Date", size: 120, cell: ({ row }) => formatDate(row.original.createdDate) },
      { id: "updatedBy", header: "Updated By", size: 120, cell: ({ row }) => row.original.updatedByName || "--" },
      { id: "updatedDate", header: "Updated Date", size: 120, cell: ({ row }) => formatDate(row.original.updatedDate) },
      { id: "actions", header: () => <span className="pr-4">Actions</span>, size: 72, cell: ({ row }) => <div className="pr-4 text-right">{actions(row.original)}</div> },
    ],
    [actions, canUpdate, limit, open, page],
  )

  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No bookings found"
    const start = (meta.page - 1) * meta.limit + 1
    return `Showing ${start}-${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`
  }, [meta])

  const loadBuyers = useCallback((p: AppComboboxLoadParams) => loadBuyerOptions(ctx, p), [ctx])
  const loadPos = useCallback((p: AppComboboxLoadParams) => loadPoOptions(ctx, p, draft.buyer?.value, undefined, true), [ctx, draft.buyer?.value])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <Card className="overflow-hidden border-white/60 bg-white/85 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
            <CardContent className="p-4 sm:p-8 sm:py-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">Costing &amp; budget</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">Booking</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Book a PO and style&apos;s fabric, yarn and other items from its GMT budget. One booking per PO and style.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1">Total {meta?.total ?? rows.length}</Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" variant="outline" onClick={refresh} className="rounded-xl">
                    <RefreshCcw className="size-3.5" /> Refresh
                  </Button>
                  {canCreate ? (
                    <Button type="button" onClick={() => open("create", null)} className="rounded-xl">
                      <Plus className="size-3.5" /> New booking
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {accessError && !access?.canView ? <Card><CardContent className="p-6 text-sm text-destructive">{accessError}</CardContent></Card> : null}
          {access && !access.canView && !accessError ? <Card><CardContent className="p-6 text-sm text-destructive">You do not have permission to view bookings.</CardContent></Card> : null}
          {error ? <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card> : null}

          {access?.canView ? (
            <AppDataSection
              title="Bookings"
              description={pageSummary}
              data={rows}
              columns={columns}
              loading={loading}
              getRowId={(r) => String(r.id)}
              pageSummary={pageSummary}
              page={page}
              totalPages={meta?.totalPages ?? 1}
              pageSize={limit}
              pageSizeOptions={[10, 25, 50, 100]}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setLimit(size)
                setPage(1)
              }}
              leadingColumnIds={["sl", "po"]}
              trailingColumnIds={["actions"]}
              columnResizeStorageKey="gmt-booking-list"
              emptyState={<p className="p-8 text-center text-sm text-slate-500">No bookings match the filters.</p>}
              renderMobileItem={(r) => (
                <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.poNo} · {r.style}</p>
                      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{r.buyer}{r.bomNo ? ` · ${r.bomNo}` : ""}</p>
                    </div>
                    {actions(r)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={r.isApproved ? "secondary" : "outline"} className="rounded-full">{r.isApproved ? "Released" : "Not released"}</Badge>
                  </div>
                </article>
              )}
              filters={
                <form
                  className="grid gap-3 py-3 sm:grid-cols-2 xl:grid-cols-6"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setFilters(draft)
                    setPage(1)
                  }}
                >
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="bookingFilterNo">Booking No</FieldLabel>
                    <Input id="bookingFilterNo" value={draft.bomNo} onChange={(e) => setDraft({ ...draft, bomNo: e.target.value })} placeholder="Search booking no" className={INPUT_CLASS} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="bookingFilterBuyer">Buyer</FieldLabel>
                    <LookupCombobox id="bookingFilterBuyer" value={draft.buyer ? draft.buyer.value : null} label={draft.buyer?.label ?? ""} loadItems={loadBuyers} placeholder="All buyers" inputClassName={INPUT_CLASS} onChange={(o) => setDraft({ ...draft, buyer: o, po: null })} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="bookingFilterPo">PO</FieldLabel>
                    <LookupCombobox key={draft.buyer?.value ?? "any"} id="bookingFilterPo" value={draft.po ? draft.po.value : null} label={draft.po?.label ?? ""} loadItems={loadPos} placeholder="All POs" inputClassName={INPUT_CLASS} onChange={(o) => setDraft({ ...draft, po: o })} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="bookingFilterReleased">Released</FieldLabel>
                    <AppSelect
                      triggerId="bookingFilterReleased"
                      value={draft.released || ALL}
                      onValueChange={(v) => setDraft({ ...draft, released: v === ALL ? "" : (v as "true" | "false") })}
                      options={[
                        { value: ALL, label: "All" },
                        { value: "true", label: "Released" },
                        { value: "false", label: "Not released" },
                      ]}
                    />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="bookingFilterFrom">Release Date From</FieldLabel>
                    <Input id="bookingFilterFrom" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={INPUT_CLASS} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="bookingFilterTo">Release Date To</FieldLabel>
                    <Input id="bookingFilterTo" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={INPUT_CLASS} />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-6">
                    <Button type="submit" className="w-full rounded-xl sm:w-auto">
                      <Search className="size-3.5" /> Search
                    </Button>
                    <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => { setDraft(DEFAULT_FILTERS); setFilters(DEFAULT_FILTERS); setPage(1) }}>
                      Reset
                    </Button>
                  </div>
                </form>
              }
            />
          ) : null}
        </div>
      </ScrollArea>

      {editor ? (
        <GmtBookingFormDialog
          key={editor.key}
          mode={editor.mode}
          bookingId={editor.id}
          ctx={ctx}
          access={access ?? NO_ACCESS}
          onAuthFailure={handleAuthFailure}
          onOpenChange={(isOpen) => !isOpen && setEditor(null)}
          onSaved={() => refresh()}
          onOpenBooking={(id) => open(canUpdate ? "edit" : "view", id)}
        />
      ) : null}

      <AppConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete booking?"
        description={`The booking of ${deleteTarget?.poNo ?? ""} · ${deleteTarget?.style ?? ""} and all its rows will be deleted permanently. A booking with yarn allocated to the PO cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        working={deleting}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
