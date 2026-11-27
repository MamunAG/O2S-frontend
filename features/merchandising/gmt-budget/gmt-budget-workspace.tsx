"use client"

// GMT Budget list: one row per PO + style of the company's jobs (GET gmt-budget/po-style-list), DONE when it
// has a budget, NOT DONE when it has none. Ported from ClickERP's gmt-budget.index; the look is this app's.

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
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchCurrentMenuPermission } from "@/features/iam/menu-permissions/menu-permission.service"
import { parseStoredAuthUser } from "@/lib/auth-session"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { FIELD_CLASS, FieldLabel, INPUT_CLASS, LookupCombobox, formatDate, formatNumber } from "../gmt-costing/component/gmt-ui"
import { loadBuyerOptions, loadStyleOptions, type ApiContext } from "../gmt-costing/gmt-costing.api"
import type { AccessRules, Option, PageMeta } from "../gmt-costing/gmt-costing.types"
import { deleteGmtBudget, fetchPoStyleList, loadPoOptions, type PoStyleFilters } from "./gmt-budget.api"
import type { PoStyleRow } from "./gmt-budget.types"
import { GmtBudgetFormDialog, type BudgetSeed, type GmtBudgetDialogMode } from "./component/gmt-budget-form-dialog"
import { AppDatePicker } from "@/components/app-date-picker"

/** The API's menu name (GmtBudgetEndpoints.menuName). */
export const GMT_BUDGET_MENU_NAME = "Create Budget"

const NO_ACCESS: AccessRules = { canView: false, canCreate: false, canUpdate: false, canDelete: false }

type Filters = {
  buyer: Option | null
  style: Option | null
  po: Option | null
  status: "" | "true" | "false"
  fromDeliveryDate: string
  toDeliveryDate: string
  fromBudgetDate: string
  toBudgetDate: string
}

// the list opens on Budget Done, as ClickERP's (DEFAULT_STATUS)
const DEFAULT_FILTERS: Filters = { buyer: null, style: null, po: null, status: "true", fromDeliveryDate: "", toDeliveryDate: "", fromBudgetDate: "", toBudgetDate: "" }
const ALL = "__all__"

/** desktop search rules: delivery dates only with no style / PO picked; budget dates only for Done without a style. */
function toQuery(f: Filters): PoStyleFilters {
  const noStyleOrPo = !f.style && !f.po
  return {
    buyerId: f.buyer?.value,
    styleId: f.style?.value,
    poId: f.po?.value,
    isBudgetDone: f.status,
    fromDeliveryDate: noStyleOrPo ? f.fromDeliveryDate : "",
    toDeliveryDate: noStyleOrPo ? f.toDeliveryDate : "",
    fromBudgetDate: f.status === "true" && !f.style ? f.fromBudgetDate : "",
    toBudgetDate: f.status === "true" && !f.style ? f.toBudgetDate : "",
  }
}

type Editor = { mode: GmtBudgetDialogMode; id: string | null; seed: BudgetSeed | null; key: number }

export function GmtBudgetWorkspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState(() => (typeof window === "undefined" ? "" : readSelectedOrganizationId()))
  const [access, setAccess] = useState<AccessRules | null>(null)
  const [accessError, setAccessError] = useState("")
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS)
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [rows, setRows] = useState<PoStyleRow[]>([])
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [error, setError] = useState("")
  const [loadedKey, setLoadedKey] = useState("")
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PoStyleRow | null>(null)
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
        const permission = await fetchCurrentMenuPermission({ apiUrl, accessToken: token, organizationId: organizationId || undefined, menuName: GMT_BUDGET_MENU_NAME })
        if (active) setAccess(permission)
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unable to load your GMT budget access."
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
    fetchPoStyleList(ctx, page, limit, toQuery(filters))
      .then((result) => {
        if (!active) return
        setRows(result?.items ?? [])
        setMeta(result?.meta ?? null)
        setError("")
      })
      .catch((caught) => active && setError(reportError(caught, "Unable to load the PO / style list.")))
      .finally(() => active && setLoadedKey(requestKey))
    return () => {
      active = false
    }
  }, [access?.canView, ctx, filters, limit, organizationId, page, reportError, requestKey])

  const refresh = useCallback(() => setRefreshVersion((v) => v + 1), [])
  const open = useCallback((mode: GmtBudgetDialogMode, id: string | null, seed: BudgetSeed | null = null) => setEditor({ mode, id, seed, key: Date.now() }), [])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGmtBudget(ctx, deleteTarget.budgetId)
      toast.success(`The budget of ${deleteTarget.po} · ${deleteTarget.style} was deleted.`)
      setDeleteTarget(null)
      refresh()
    } catch (caught) {
      reportError(caught, "Unable to delete the GMT budget.")
    } finally {
      setDeleting(false)
    }
  }

  const canCreate = Boolean(access?.canCreate)
  const canUpdate = Boolean(access?.canUpdate)
  const canDelete = Boolean(access?.canDelete)

  const actions = useCallback(
    (row: PoStyleRow) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
            <MoreHorizontal className="size-3.5" />
            <span className="sr-only">Open actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {row.budgetId ? (
            <>
              <DropdownMenuItem onSelect={() => open("view", row.budgetId)}>
                <Eye className="size-3.5" /> View
              </DropdownMenuItem>
              {canUpdate ? (
                <DropdownMenuItem onSelect={() => open("edit", row.budgetId)}>
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
            </>
          ) : canCreate ? (
            <DropdownMenuItem
              onSelect={() => open("create", null, { buyerId: row.buyerId, buyer: row.buyer, styleId: row.styleId, style: row.style, poId: row.poId, po: row.po })}
            >
              <Plus className="size-3.5" /> Create budget
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>No budget yet</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    [canCreate, canDelete, canUpdate, open],
  )

  const columns = useMemo<ColumnDef<PoStyleRow>[]>(
    () => [
      { id: "sl", header: "SL", size: 56, cell: ({ row }) => <span className="tabular-nums">{(page - 1) * limit + row.index + 1}</span> },
      {
        id: "status",
        header: "Status",
        size: 100,
        cell: ({ row }) => (
          <Badge variant={row.original.budgetId ? "secondary" : "outline"} className="rounded-full px-3 py-1">
            {row.original.status || (row.original.budgetId ? "DONE" : "NOT DONE")}
          </Badge>
        ),
      },
      { id: "buyer", header: "Buyer", size: 150, cell: ({ row }) => row.original.buyer || "--" },
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
      {
        id: "po",
        header: "PO",
        size: 150,
        cell: ({ row }) =>
          row.original.budgetId ? (
            <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => open(canUpdate ? "edit" : "view", row.original.budgetId)}>
              {row.original.po}
            </button>
          ) : (
            row.original.po
          ),
      },
      { id: "delivery", header: "First Delivery", size: 120, cell: ({ row }) => formatDate(row.original.firstDeliveryDate) },
      { id: "budgetName", header: "Budget", size: 180, cell: ({ row }) => row.original.budgetName || "--" },
      { id: "budgetDate", header: "Budget Date", size: 120, cell: ({ row }) => formatDate(row.original.budgetDate) },
      { id: "costing", header: "GMT Costing", size: 160, cell: ({ row }) => row.original.costingNo || "--" },
      { id: "fob", header: "Total FOB ($)", size: 110, cell: ({ row }) => <span className="tabular-nums">{row.original.budgetId ? formatNumber(row.original.totalFob, 2) : "--"}</span> },
      { id: "commission", header: "Buying Comm. %", size: 110, cell: ({ row }) => <span className="tabular-nums">{row.original.budgetId ? formatNumber(row.original.buyingCommission, 2) : "--"}</span> },
      { id: "balance", header: "Balance ($)", size: 110, cell: ({ row }) => <span className="tabular-nums">{row.original.budgetId ? formatNumber(row.original.balanceValue, 2) : "--"}</span> },
      { id: "createdBy", header: "Created By", size: 120, cell: ({ row }) => row.original.createdBy || "--" },
      { id: "updatedBy", header: "Updated By", size: 120, cell: ({ row }) => row.original.updatedBy || "--" },
      { id: "actions", header: () => <span className="pr-4">Actions</span>, size: 72, cell: ({ row }) => <div className="pr-4 text-right">{actions(row.original)}</div> },
    ],
    [actions, canUpdate, limit, open, page],
  )

  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No PO / style found"
    const start = (meta.page - 1) * meta.limit + 1
    return `Showing ${start}-${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`
  }, [meta])

  const loadBuyers = useCallback((p: AppComboboxLoadParams) => loadBuyerOptions(ctx, p), [ctx])
  const loadStyles = useCallback((p: AppComboboxLoadParams) => loadStyleOptions(ctx, p, draft.buyer?.value), [ctx, draft.buyer?.value])
  const loadPos = useCallback((p: AppComboboxLoadParams) => loadPoOptions(ctx, p, draft.buyer?.value, draft.style?.value), [ctx, draft.buyer?.value, draft.style?.value])

  const dateField = (id: string, label: string, key: keyof Filters, disabled: boolean) => (
    <div className={FIELD_CLASS}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <AppDatePicker id={id} disabled={disabled} value={draft[key] as string} onValueChange={(value) => setDraft({ ...draft, [key]: value })} className={INPUT_CLASS} />
    </div>
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
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white">GMT Budget</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Map a style&apos;s GMT costing onto a PO: the costing split by the PO&apos;s colours, every total worked out from its
                    quantities. One budget per PO and style.
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
                      <Plus className="size-3.5" /> New GMT budget
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {accessError && !access?.canView ? <Card><CardContent className="p-6 text-sm text-destructive">{accessError}</CardContent></Card> : null}
          {access && !access.canView && !accessError ? <Card><CardContent className="p-6 text-sm text-destructive">You do not have permission to view GMT budgets.</CardContent></Card> : null}
          {error ? <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card> : null}

          {access?.canView ? (
            <AppDataSection
              title="PO and style"
              description={pageSummary}
              data={rows}
              columns={columns}
              loading={loading}
              getRowId={(r) => `${r.poId}-${r.styleId}`}
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
              leadingColumnIds={["sl", "status"]}
              trailingColumnIds={["actions"]}
              columnResizeStorageKey="gmt-budget-list"
              emptyState={<p className="p-8 text-center text-sm text-slate-500">No PO and style match the filters.</p>}
              renderMobileItem={(r) => (
                <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{r.po} · {r.style}</p>
                      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">{r.buyer}{r.budgetName ? ` · ${r.budgetName}` : ""}</p>
                    </div>
                    {actions(r)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={r.budgetId ? "secondary" : "outline"} className="rounded-full">{r.status}</Badge>
                    {r.budgetId ? <Badge variant="outline" className="rounded-full">FOB {formatNumber(r.totalFob, 2)}</Badge> : null}
                  </div>
                </article>
              )}
              filters={
                <form
                  className="grid gap-3 py-3 sm:grid-cols-2 xl:grid-cols-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setFilters(draft)
                    setPage(1)
                  }}
                >
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="budgetFilterBuyer">Buyer</FieldLabel>
                    <LookupCombobox id="budgetFilterBuyer" value={draft.buyer ? draft.buyer.value : null} label={draft.buyer?.label ?? ""} loadItems={loadBuyers} placeholder="All buyers" inputClassName={INPUT_CLASS} onChange={(o) => setDraft({ ...draft, buyer: o, style: null, po: null })} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="budgetFilterStyle">Style</FieldLabel>
                    <LookupCombobox key={draft.buyer?.value ?? "any"} id="budgetFilterStyle" value={draft.style ? draft.style.value : null} label={draft.style?.label ?? ""} loadItems={loadStyles} placeholder="All styles" inputClassName={INPUT_CLASS} onChange={(o) => setDraft({ ...draft, style: o, po: null })} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="budgetFilterPo">PO</FieldLabel>
                    <LookupCombobox key={`${draft.buyer?.value}-${draft.style?.value}`} id="budgetFilterPo" value={draft.po ? draft.po.value : null} label={draft.po?.label ?? ""} loadItems={loadPos} placeholder="All POs" inputClassName={INPUT_CLASS} onChange={(o) => setDraft({ ...draft, po: o })} />
                  </div>
                  <div className={FIELD_CLASS}>
                    <FieldLabel htmlFor="budgetFilterStatus">Status</FieldLabel>
                    <AppSelect
                      triggerId="budgetFilterStatus"
                      value={draft.status || ALL}
                      onValueChange={(v) => setDraft({ ...draft, status: v === ALL ? "" : (v as "true" | "false") })}
                      options={[
                        { value: "true", label: "Budget done" },
                        { value: "false", label: "Budget not done" },
                        { value: ALL, label: "All" },
                      ]}
                    />
                  </div>
                  {dateField("budgetFilterDelFrom", "Delivery From", "fromDeliveryDate", Boolean(draft.style || draft.po))}
                  {dateField("budgetFilterDelTo", "Delivery To", "toDeliveryDate", Boolean(draft.style || draft.po))}
                  {dateField("budgetFilterFrom", "Budget Date From", "fromBudgetDate", draft.status !== "true" || Boolean(draft.style))}
                  {dateField("budgetFilterTo", "Budget Date To", "toBudgetDate", draft.status !== "true" || Boolean(draft.style))}
                  <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-4">
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

      {editor ? (
        <GmtBudgetFormDialog
          key={editor.key}
          mode={editor.mode}
          budgetId={editor.id}
          seed={editor.seed}
          ctx={ctx}
          access={access ?? NO_ACCESS}
          onAuthFailure={handleAuthFailure}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditor(null)
          }}
          onSaved={() => refresh()}
          onOpenBudget={(id) => open(canUpdate ? "edit" : "view", id)}
        />
      ) : null}

      <AppConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete GMT budget?"
        description={`The budget of ${deleteTarget?.po ?? ""} · ${deleteTarget?.style ?? ""} and all its rows will be deleted permanently. A budget a booking was made from cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        working={deleting}
        onOpenChange={(isOpen) => !isOpen && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
