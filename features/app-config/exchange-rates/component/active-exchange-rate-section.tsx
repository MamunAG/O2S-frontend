"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { AppDataFilterForm, FILTER_DEBOUNCE_MS } from "@/components/app-data-filter-form"
import { AppDataSection } from "@/components/app-data-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

import {
  EMPTY_FILTERS,
  type ExchangeRateFilterValues,
  type ExchangeRateRecord,
  type PaginationMeta,
} from "../exchange-rate.types"

const ALL_SOURCES_VALUE = "__all_sources__"

type ActiveExchangeRateSectionProps = {
  data: ExchangeRateRecord[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: ExchangeRateFilterValues
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  onFilterChange: (nextValues: ExchangeRateFilterValues) => void
  onPageChange: (nextPage: number) => void
  onLimitChange: (nextPageSize: number) => void
  /** Saves an inline edit; resolves true when saved (the row then leaves edit mode). */
  onSaveRate: (row: ExchangeRateRecord, rateInBdt: string) => Promise<boolean>
  onDelete: (rows: ExchangeRateRecord[]) => void
}

const rateFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })

/** The rates' dates are UTC sent without an offset. */
function parseUtc(value: string) {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`)
}

/** Gmail-style: the time for today, "Nov 26" this year, "11/26/24" before. A manual rate shows its day. */
function formatListDate(row: ExchangeRateRecord) {
  const date = row.isManual ? new Date(`${row.currencyDate.slice(0, 10)}T00:00:00`) : parseUtc(row.currencyDate)
  if (Number.isNaN(date.getTime())) return row.currencyDate
  const now = new Date()
  if (!row.isManual && date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(date)
  }
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date)
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short" }).format(date)
}

function formatFullDate(row: ExchangeRateRecord) {
  const date = row.isManual ? new Date(`${row.currencyDate.slice(0, 10)}T00:00:00`) : parseUtc(row.currencyDate)
  if (Number.isNaN(date.getTime())) return row.currencyDate
  return new Intl.DateTimeFormat("en-US", row.isManual ? { dateStyle: "full" } : { dateStyle: "full", timeStyle: "short" }).format(date)
}

function sourceLabel(row: ExchangeRateRecord) {
  return row.isManual ? "Manual" : "Provider"
}

function changedBy(row: ExchangeRateRecord) {
  return row.updated_by_user?.name || row.created_by_user?.name || "Daily job"
}

function EmptyState({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Plus className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      <Button type="button" onClick={onAction} className="mt-6 rounded-xl">
        {actionLabel}
      </Button>
    </div>
  )
}

/** The rate cell: click (or the pencil) to edit in place; Enter saves, Esc cancels. */
function RateCell({
  row,
  editing,
  draft,
  saving,
  onStart,
  onDraftChange,
  onSave,
  onCancel,
}: {
  row: ExchangeRateRecord
  editing: boolean
  draft: string
  saving: boolean
  onStart: () => void
  onDraftChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      onSave()
    } else if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">৳</span>
        <Input
          autoFocus
          aria-label={`Rate in BDT for ${row.currencyCode}`}
          value={draft}
          inputMode="decimal"
          disabled={saving}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-28 rounded-lg px-2 text-right text-xs tabular-nums"
        />
        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" disabled={saving} onClick={onSave} aria-label="Save rate">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-emerald-600" />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" disabled={saving} onClick={onCancel} aria-label="Cancel edit">
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onStart}
      title="Click to edit the rate"
      className="rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-slate-950 underline-offset-4 hover:bg-slate-100 hover:underline dark:text-slate-50 dark:hover:bg-white/10"
    >
      ৳ {rateFormat.format(row.rateInBdt)}
    </button>
  )
}

function SourceBadge({ row }: { row: ExchangeRateRecord }) {
  return row.isManual ? (
    <Badge variant="outline" className="rounded-md border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
      {sourceLabel(row)}
    </Badge>
  ) : (
    <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
      {sourceLabel(row)}
    </Badge>
  )
}

export function ActiveExchangeRateSection({
  data,
  meta,
  page,
  limit,
  loading,
  filters,
  selectedIds,
  onSelectedIdsChange,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onSaveRate,
  onDelete,
}: ActiveExchangeRateSectionProps) {
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const filterCount = useMemo(() => Object.values(filters).filter((value) => value.trim()).length, [filters])
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedRows = useMemo(() => data.filter((row) => selected.has(row.id)), [data, selected])
  const allOnPage = data.length > 0 && selectedRows.length === data.length

  // Gmail's "1–10 of 132".
  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No exchange rates found"
    const start = (meta.page - 1) * meta.limit + 1
    return `${start}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`
  }, [meta])

  const clearFilters = () => onFilterChange(EMPTY_FILTERS)

  const columns = useMemo<ColumnDef<ExchangeRateRecord>[]>(() => {
    function toggle(id: string, checked: boolean) {
      onSelectedIdsChange(checked ? [...selectedIds.filter((x) => x !== id), id] : selectedIds.filter((x) => x !== id))
    }

    async function save(row: ExchangeRateRecord, draft: string) {
      setSavingId(row.id)
      try {
        if (await onSaveRate(row, draft)) setEditing(null)
      } finally {
        setSavingId(null)
      }
    }

    return [
      {
        id: "select",
        header: () => (
          <Checkbox
            aria-label="Select every rate on this page"
            // some rows ticked: a half-filled box, as in Gmail
            className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/30"
            checked={allOnPage ? true : selectedRows.length > 0 ? "indeterminate" : false}
            onCheckedChange={(checked) => onSelectedIdsChange(checked === true ? data.map((row) => row.id) : [])}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.currencyCode}`}
            checked={selected.has(row.original.id)}
            onCheckedChange={(checked) => toggle(row.original.id, checked === true)}
          />
        ),
      },
      {
        id: "currency",
        header: "Currency",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {row.original.currencyCode.slice(0, 2)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{row.original.currencyCode}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">1 {row.original.currencyCode} in BDT</p>
            </div>
          </div>
        ),
      },
      {
        id: "rate",
        header: "Rate (BDT)",
        cell: ({ row }) => (
          <RateCell
            row={row.original}
            editing={editing?.id === row.original.id}
            draft={editing?.id === row.original.id ? editing.draft : ""}
            saving={savingId === row.original.id}
            onStart={() => setEditing({ id: row.original.id, draft: String(row.original.rateInBdt) })}
            onDraftChange={(draft) => setEditing({ id: row.original.id, draft })}
            onSave={() => void save(row.original, editing?.id === row.original.id ? editing.draft : String(row.original.rateInBdt))}
            onCancel={() => setEditing(null)}
          />
        ),
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <SourceBadge row={row.original} />
            <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">{changedBy(row.original)}</span>
          </div>
        ),
      },
      {
        id: "date",
        header: () => <span className="pr-4">Date</span>,
        // Gmail-style: the date, and on hover the row's actions in its place.
        cell: ({ row }) => (
          <div className="relative flex h-7 items-center justify-end pr-4">
            <span title={formatFullDate(row.original)} className="text-xs font-medium text-slate-700 [tr:hover_&]:invisible dark:text-slate-200">
              {formatListDate(row.original)}
            </span>
            <div className="invisible absolute inset-y-0 right-3 flex items-center gap-0.5 [tr:hover_&]:visible">
              <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" title="Edit rate" onClick={() => setEditing({ id: row.original.id, draft: String(row.original.rateInBdt) })}>
                <Pencil className="size-3.5" />
                <span className="sr-only">Edit rate</span>
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" className="rounded-full text-rose-600 hover:text-rose-700" title="Delete rate" onClick={() => onDelete([row.original])}>
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete rate</span>
              </Button>
            </div>
          </div>
        ),
      },
    ]
  }, [allOnPage, data, editing, onDelete, onSaveRate, onSelectedIdsChange, savingId, selected, selectedIds, selectedRows.length])

  const emptyState = (
    <EmptyState
      title="No exchange rates found"
      description="Clear the filters, or use Rerun latest to fetch today's rates from the provider."
      actionLabel="Reset filters"
      onAction={clearFilters}
    />
  )

  return (
    <AppDataSection
      title="Saved rates"
      description={pageSummary}
      data={data}
      columns={columns}
      loading={loading}
      pageSummary={pageSummary}
      page={page}
      totalPages={meta?.totalPages ?? 1}
      pageSize={limit}
      pageSizeOptions={[5, 10, 25, 50]}
      onPageChange={onPageChange}
      onPageSizeChange={(nextPageSize) => {
        onLimitChange(nextPageSize)
        onPageChange(1)
      }}
      getRowId={(row) => row.id}
      emptyState={emptyState}
      enableColumnResizing={false}
      leadingColumnIds={["select"]}
      trailingColumnIds={["date"]}
      columnClassNames={{
        select: "h-8 w-10 py-1",
        currency: "h-8 py-1",
        rate: "h-8 py-1",
        source: "h-8 py-1",
        date: "h-8 w-36 py-1",
      }}
      headerBadges={
        <>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            Page {meta?.totalPages ? meta.page : 0} of {meta?.totalPages ?? 0}
          </Badge>
          <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
            {filterCount} active filter{filterCount === 1 ? "" : "s"}
          </Badge>
        </>
      }
      headerActions={
        selectedRows.length > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {selectedRows.length} selected
            </Badge>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onSelectedIdsChange([])}>
              Clear
            </Button>
            <Button type="button" variant="destructive" size="sm" className="rounded-xl" onClick={() => onDelete(selectedRows)}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        ) : null
      }
      filters={
        <AppDataFilterForm
          fields={[
            {
              id: "filterExchangeRateCode",
              label: "Currency code",
              kind: "text",
              value: filters.currencyCode,
              placeholder: "e.g. USD",
              onValueChange: (currencyCode) => onFilterChange({ ...filters, currencyCode }),
            },
            {
              id: "filterExchangeRateSource",
              label: "Source",
              kind: "select",
              value: filters.isManual || ALL_SOURCES_VALUE,
              placeholder: "All sources",
              options: [
                { value: ALL_SOURCES_VALUE, label: "All sources" },
                { value: "false", label: "Provider" },
                { value: "true", label: "Manual" },
              ],
              onValueChange: (value) => onFilterChange({ ...filters, isManual: value === ALL_SOURCES_VALUE ? "" : value }),
            },
            {
              id: "filterExchangeRateFrom",
              label: "From date",
              kind: "custom",
              control: (
                <Input
                  id="filterExchangeRateFrom"
                  type="date"
                  value={filters.fromCurrencyDate}
                  max={filters.toCurrencyDate || undefined}
                  onChange={(event) => onFilterChange({ ...filters, fromCurrencyDate: event.target.value })}
                  className="h-9 rounded-xl"
                />
              ),
            },
            {
              id: "filterExchangeRateTo",
              label: "To date",
              kind: "custom",
              control: (
                <Input
                  id="filterExchangeRateTo"
                  type="date"
                  value={filters.toCurrencyDate}
                  min={filters.fromCurrencyDate || undefined}
                  onChange={(event) => onFilterChange({ ...filters, toCurrencyDate: event.target.value })}
                  className="h-9 rounded-xl"
                />
              ),
            },
          ]}
          debounceMs={FILTER_DEBOUNCE_MS}
          onReset={clearFilters}
        />
      }
      renderMobileItem={(row) => (
        <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Checkbox
                aria-label={`Select ${row.currencyCode}`}
                checked={selected.has(row.id)}
                onCheckedChange={(checked) =>
                  onSelectedIdsChange(checked === true ? [...selectedIds.filter((x) => x !== row.id), row.id] : selectedIds.filter((x) => x !== row.id))
                }
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{row.currencyCode}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatListDate(row)}</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full text-rose-600" onClick={() => onDelete([row])}>
              <Trash2 className="size-3.5" />
              <span className="sr-only">Delete rate</span>
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <RateCell
              row={row}
              editing={editing?.id === row.id}
              draft={editing?.id === row.id ? editing.draft : ""}
              saving={savingId === row.id}
              onStart={() => setEditing({ id: row.id, draft: String(row.rateInBdt) })}
              onDraftChange={(draft) => setEditing({ id: row.id, draft })}
              onSave={() => {
                const draft = editing?.id === row.id ? editing.draft : String(row.rateInBdt)
                setSavingId(row.id)
                void onSaveRate(row, draft)
                  .then((saved) => {
                    if (saved) setEditing(null)
                  })
                  .finally(() => setSavingId(null))
              }}
              onCancel={() => setEditing(null)}
            />
            <SourceBadge row={row} />
          </div>
        </article>
      )}
    />
  )
}
