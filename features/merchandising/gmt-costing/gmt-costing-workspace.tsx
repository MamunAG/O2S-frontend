"use client"

// GMT Costing list page: filters, the costings of the selected company, and the entry dialog. Ported from
// ClickERP's gmt-costing-index.tsx; the look is this app's (Job Entry, Fabric Costing).

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Copy, Eye, FileSpreadsheet, MoreHorizontal, Pencil, Plus, RefreshCcw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { AppConfirmDialog } from "@/components/app-confirm-dialog"
import { AppDataSection } from "@/components/app-data-section"
import { AppSelect } from "@/components/app-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchCurrentMenuPermission } from "@/features/iam/menu-permissions/menu-permission.service"
import { parseStoredAuthUser } from "@/lib/auth-session"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { FIELD_CLASS, FieldLabel, formatDate, formatNumber, INPUT_CLASS, LookupCombobox } from "./component/gmt-ui"
import { GmtCostingFormDialog, type GmtCostingDialogMode } from "./component/gmt-costing-form-dialog"
import { GmtCostingSheetDialog } from "./component/gmt-costing-sheet-dialog"
import { deleteGmtCosting, fetchGmtCostings, loadBuyerOptions, loadStyleOptions, type ApiContext } from "./gmt-costing.api"
import type { AccessRules, GmtCostingFilters, GmtCostingListItem, PageMeta } from "./gmt-costing.types"
import { AppDatePicker } from "@/components/app-date-picker"

/** The API's menu name (GmtCostingEndpoints.menuName). */
export const GMT_COSTING_MENU_NAME = "Gmt Costing"

const NO_ACCESS: AccessRules = { canView: false, canCreate: false, canUpdate: false, canDelete: false }
const DEFAULT_FILTERS: GmtCostingFilters = { costName: "", buyer: null, style: null, isActive: "", fromCostDate: "", toCostDate: "" }
const ALL = "__all__"

type EditorState = { open: boolean; mode: GmtCostingDialogMode; id: string | null }

export function GmtCostingWorkspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState(() => (typeof window === "undefined" ? "" : readSelectedOrganizationId()))
  const [access, setAccess] = useState<AccessRules | null>(null)
  const [accessError, setAccessError] = useState("")
  const [draft, setDraft] = useState<GmtCostingFilters>(DEFAULT_FILTERS)
  const [filters, setFilters] = useState<GmtCostingFilters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [rows, setRows] = useState<GmtCostingListItem[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [loadedKey, setLoadedKey] = useState("")
  const [error, setError] = useState("")
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editor, setEditor] = useState<EditorState>({ open: false, mode: "create", id: null })
  const [sheetFor, setSheetFor] = useState<GmtCostingListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GmtCostingListItem | null>(null)
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
      setAccessError("")
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
        const permission = await fetchCurrentMenuPermission({
          apiUrl,
          accessToken: token,
          organizationId: organizationId || undefined,
          menuName: GMT_COSTING_MENU_NAME,
        })
        if (active) setAccess(permission)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unable to load your GMT costing access."
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
    fetchGmtCostings(ctx, {
      page,
      limit,
      costName: filters.costName.trim(),
      buyerId: filters.buyer?.value,
      styleId: filters.style?.value,
      isActive: filters.isActive,
      fromCostDate: filters.fromCostDate,
      toCostDate: filters.toCostDate,
    })
      .then((result) => {
        if (!active) return
        setRows(result?.items ?? [])
        setMeta(result?.meta ?? null)
        setError("")
      })
      .catch((caught) => {
        if (active) setError(reportError(caught, "Unable to load GMT costings."))
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey)
      })
    return () => {
      active = false
    }
  }, [access?.canView, ctx, filters, limit, organizationId, page, requestKey, reportError])

  const refresh = useCallback(() => setRefreshVersion((v) => v + 1), [])
  const openEditor = useCallback((mode: GmtCostingDialogMode, id: string | null) => setEditor({ open: true, mode, id }), [])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGmtCosting(ctx, deleteTarget.id)
      toast.success(`${deleteTarget.costName} deleted.`)
      setDeleteTarget(null)
      refresh()
    } catch (caught) {
      reportError(caught, "Unable to delete the GMT costing.")
    } finally {
      setDeleting(false)
    }
  }

  const canUpdate = Boolean(access?.canUpdate)
  const canDelete = Boolean(access?.canDelete)
  const canCreate = Boolean(access?.canCreate)

  const columns = useMemo<ColumnDef<GmtCostingListItem>[]>(
    () => [
      {
        id: "sl",
        header: "SL",
        size: 56,
        cell: ({ row }) => <span className="tabular-nums">{(page - 1) * limit + row.index + 1}</span>,
      },
      {
        id: "costName",
        header: "Cost Name",
        size: 220,
        cell: ({ row }) => (
          <button
            type="button"
            className="truncate text-left font-medium text-slate-950 hover:underline dark:text-white"
            onClick={() => openEditor(canUpdate ? "edit" : "view", row.original.id)}
          >
            {row.original.costName}
          </button>
        ),
      },
      { id: "buyer", header: "Buyer", size: 160, cell: ({ row }) => row.original.buyerName || "--" },
      {
        id: "style",
        header: "Style",
        size: 180,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate">{row.original.styleNo || "--"}</p>
            {row.original.styleName ? <p className="truncate text-[11px] text-slate-500">{row.original.styleName}</p> : null}
          </div>
        ),
      },
      { id: "techSheet", header: "Tech Sheet", size: 130, cell: ({ row }) => row.original.technicalSheetNo || "--" },
      { id: "costDate", header: "Cost Date", size: 120, cell: ({ row }) => formatDate(row.original.costDate) },
      { id: "shipDate", header: "Ship Date", size: 120, cell: ({ row }) => formatDate(row.original.shipDate) },
      {
        id: "fob",
        header: "FOB ($)",
        size: 100,
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(Number(row.original.gmtTotalCostFob) || 0)}</span>,
      },
      {
        id: "qty",
        header: "Expected Qty",
        size: 110,
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(Number(row.original.expectedOrderQty) || 0, 0)}</span>,
      },
      {
        id: "status",
        header: "Status",
        size: 90,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? "secondary" : "outline"} className="rounded-full px-3 py-1">
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
        ),
      },
      { id: "createdBy", header: "Created By", size: 120, cell: ({ row }) => row.original.createdByName || "--" },
      { id: "createdDate", header: "Created Date", size: 120, cell: ({ row }) => formatDate(row.original.createdDate) },
      { id: "updatedBy", header: "Updated By", size: 120, cell: ({ row }) => row.original.updatedByName || "--" },
      { id: "updatedDate", header: "Updated Date", size: 120, cell: ({ row }) => formatDate(row.original.updatedDate) },
      {
        id: "actions",
        header: () => <span className="pr-4">Actions</span>,
        size: 72,
        cell: ({ row }) => (
          <div className="pr-4 text-right">
            <RowActions
              item={row.original}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onOpen={openEditor}
              onSheet={setSheetFor}
              onDelete={setDeleteTarget}
            />
          </div>
        ),
      },
    ],
    [canCreate, canDelete, canUpdate, limit, openEditor, page],
  )

  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No GMT costings found"
    const start = (meta.page - 1) * meta.limit + 1
    return `Showing ${start}-${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`
  }, [meta])

  const loadBuyers = useCallback((p: { query: string; page: number; limit: number }) => loadBuyerOptions(ctx, p), [ctx])
  const loadStyles = useCallback(
    (p: { query: string; page: number; limit: number }) => loadStyleOptions(ctx, p, draft.buyer?.value),
    [ctx, draft.buyer?.value],
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <Card className="overflow-hidden border-white/60 bg-white/85 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75">
            <CardContent className="p-4 sm:p-8 sm:py-2">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <p className="text-sm font-medium tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">Costing &amp; budget</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">GMT Costing</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Cost a style before the order: fabric and item consumption, fabric costing, other costs, commission and the
                    price per color and size group.
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
                    <Button type="button" onClick={() => openEditor("create", null)} className="rounded-xl">
                      <Plus className="size-3.5" /> New GMT costing
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {accessError && !access?.canView ? (
            <Card><CardContent className="p-6 text-sm text-destructive">{accessError}</CardContent></Card>
          ) : null}
          {access && !access.canView && !accessError ? (
            <Card><CardContent className="p-6 text-sm text-destructive">You do not have permission to view GMT costings.</CardContent></Card>
          ) : null}
          {error ? <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card> : null}

          {access?.canView ? (
            <AppDataSection
              title="GMT costings"
              description={pageSummary}
              data={rows}
              columns={columns}
              loading={loading}
              getRowId={(item) => String(item.id)}
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
              leadingColumnIds={["sl", "costName"]}
              trailingColumnIds={["actions"]}
              columnResizeStorageKey="gmt-costing-list"
              emptyState={<p className="p-8 text-center text-sm text-slate-500">No GMT costings match the filters.</p>}
              renderMobileItem={(item) => (
                <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{item.costName}</p>
                      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
                        {item.buyerName} · {item.styleNo}
                      </p>
                    </div>
                    <RowActions
                      item={item}
                      canCreate={canCreate}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onOpen={openEditor}
                      onSheet={setSheetFor}
                      onDelete={setDeleteTarget}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <Badge variant="outline" className="rounded-full">Cost {formatDate(item.costDate)}</Badge>
                    <Badge variant="outline" className="rounded-full">FOB {formatNumber(Number(item.gmtTotalCostFob) || 0)}</Badge>
                    <Badge variant={item.isActive ? "secondary" : "outline"} className="rounded-full">
                      {item.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </article>
              )}
              filters={
                <form
                  className="grid gap-3 py-3 sm:grid-cols-2 xl:grid-cols-6"
                  onSubmit={(event) => {
                    event.preventDefault()
                    setFilters(draft)
                    setPage(1)
                  }}
                >
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="gmtFilterCostName">Cost Name</FieldLabel>
                    <Input
                      id="gmtFilterCostName"
                      value={draft.costName}
                      onChange={(event) => setDraft({ ...draft, costName: event.target.value })}
                      placeholder="Search cost name"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="gmtFilterBuyer">Buyer</FieldLabel>
                    <LookupCombobox
                      id="gmtFilterBuyer"
                      value={draft.buyer ? draft.buyer.value : null}
                      label={draft.buyer?.label ?? ""}
                      loadItems={loadBuyers}
                      placeholder="All buyers"
                      inputClassName={INPUT_CLASS}
                      onChange={(option) => setDraft({ ...draft, buyer: option, style: null })}
                    />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="gmtFilterStyle">Style</FieldLabel>
                    <LookupCombobox
                      key={draft.buyer?.value ?? "any"}
                      id="gmtFilterStyle"
                      value={draft.style ? draft.style.value : null}
                      label={draft.style?.label ?? ""}
                      loadItems={loadStyles}
                      placeholder="All styles"
                      inputClassName={INPUT_CLASS}
                      onChange={(option) => setDraft({ ...draft, style: option })}
                    />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="gmtFilterFrom">Cost Date From</FieldLabel>
                    <AppDatePicker
                      id="gmtFilterFrom"
                      value={draft.fromCostDate}
                      onValueChange={(value) => setDraft({ ...draft, fromCostDate: value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="gmtFilterTo">Cost Date To</FieldLabel>
                    <AppDatePicker
                      id="gmtFilterTo"
                      value={draft.toCostDate}
                      onValueChange={(value) => setDraft({ ...draft, toCostDate: value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="gmtFilterStatus">Status</FieldLabel>
                    <AppSelect
                      triggerId="gmtFilterStatus"
                      value={draft.isActive || ALL}
                      onValueChange={(value) => setDraft({ ...draft, isActive: value === ALL ? "" : (value as "true" | "false") })}
                      options={[
                        { value: ALL, label: "All statuses" },
                        { value: "true", label: "Active" },
                        { value: "false", label: "Inactive" },
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-6">
                    <Button type="submit" className="w-full rounded-xl sm:w-auto">
                      <Search className="size-3.5" /> Search
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl sm:w-auto"
                      onClick={() => {
                        setDraft(DEFAULT_FILTERS)
                        setFilters(DEFAULT_FILTERS)
                        setPage(1)
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </form>
              }
            />
          ) : null}
        </div>
      </ScrollArea>

      {editor.open ? (
        <GmtCostingFormDialog
          key={`${editor.mode}-${editor.id ?? "new"}`}
          open={editor.open}
          mode={editor.mode}
          costingId={editor.id}
          ctx={ctx}
          access={access ?? NO_ACCESS}
          onAuthFailure={handleAuthFailure}
          onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
          onSaved={(id) => {
            refresh()
            setEditor({ open: true, mode: "edit", id })
          }}
        />
      ) : null}

      {sheetFor ? (
        <GmtCostingSheetDialog
          ctx={ctx}
          costing={sheetFor}
          onOpenChange={(open) => {
            if (!open) setSheetFor(null)
          }}
        />
      ) : null}

      <AppConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete GMT costing?"
        description={`${deleteTarget?.costName ?? "This costing"} and all its rows will be deleted permanently. A costing a budget was made from cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        working={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}

function RowActions({
  item,
  canCreate,
  canUpdate,
  canDelete,
  onOpen,
  onSheet,
  onDelete,
}: {
  item: GmtCostingListItem
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  onOpen: (mode: GmtCostingDialogMode, id: string) => void
  onSheet: (item: GmtCostingListItem) => void
  onDelete: (item: GmtCostingListItem) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => onOpen("view", item.id)}>
          <Eye className="size-3.5" /> View
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSheet(item)}>
          <FileSpreadsheet className="size-3.5" /> Costing sheet
        </DropdownMenuItem>
        {canUpdate ? (
          <DropdownMenuItem onSelect={() => onOpen("edit", item.id)}>
            <Pencil className="size-3.5" /> Edit
          </DropdownMenuItem>
        ) : null}
        {canCreate ? (
          <DropdownMenuItem onSelect={() => onOpen("copy", item.id)}>
            <Copy className="size-3.5" /> Copy as new
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
