"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { Check, Loader2, Plus, Trash2, X } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { AppDataFilterForm, FILTER_DEBOUNCE_MS } from "@/components/app-data-filter-form"
import { AppDataSection } from "@/components/app-data-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
  EMPTY_FILTERS,
  matrixRowKey,
  type ExchangeRateCell,
  type ExchangeRateFilterValues,
  type ExchangeRateMatrixRow,
  type PaginationMeta,
} from "../exchange-rate.types"
import { AppDatePicker } from "@/components/app-date-picker"

type ActiveExchangeRateSectionProps = {
  data: ExchangeRateMatrixRow[]
  /** The to-currency columns, in order. */
  currencies: string[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: ExchangeRateFilterValues
  selectedKeys: string[]
  onSelectedKeysChange: (keys: string[]) => void
  onFilterChange: (nextValues: ExchangeRateFilterValues) => void
  onPageChange: (nextPage: number) => void
  onLimitChange: (nextPageSize: number) => void
  /** Saves a cell; resolves true when saved (the cell then leaves edit mode). */
  onSaveRate: (row: ExchangeRateMatrixRow, cell: ExchangeRateCell, rate: string) => Promise<boolean>
  onDelete: (rows: ExchangeRateMatrixRow[]) => void
}

// A column kept in view while the table scrolls sideways (left offsets: select 2.5rem, date 6rem).
const PINNED = "sticky z-10 bg-white dark:bg-slate-950"

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

/** "1-Jan-26" from the rate's date (its UTC date, sent without an offset). */
function formatDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${Number(match[3])}-${MONTHS[Number(match[2]) - 1]}-${match[1].slice(2)}`
}

/** 122.4567 / 0.008166 / 1.0869: up to 4 decimals from 1 up, 4 significant digits below. */
function formatRate(rate: number) {
  if (rate >= 1) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(rate)
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 }).format(rate)
}

function cellTitle(row: ExchangeRateMatrixRow, cell: ExchangeRateCell) {
  const who = cell.isManual ? `Manual${cell.updatedByName ? `, by ${cell.updatedByName}` : ""}` : "From the provider"
  return `1 ${row.fromCurrencyCode} = ${cell.rate} ${cell.toCurrencyCode} (${who}). Click to edit.`
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

/** A rate cell: click to edit in place; Enter (or ✓) saves, Esc (or ✕) cancels. */
function RateCell({
  row,
  cell,
  editing,
  draft,
  saving,
  onStart,
  onDraftChange,
  onSave,
  onCancel,
}: {
  row: ExchangeRateMatrixRow
  cell: ExchangeRateCell
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
      <div className="flex items-center justify-end gap-0.5">
        <Input
          autoFocus
          aria-label={`Rate from ${row.fromCurrencyCode} to ${cell.toCurrencyCode}`}
          value={draft}
          inputMode="decimal"
          disabled={saving}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-24 rounded-lg px-2 text-right text-xs tabular-nums"
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
      title={cellTitle(row, cell)}
      className={cn(
        "w-full rounded-md px-1.5 py-0.5 text-right text-xs font-semibold tabular-nums text-slate-950 hover:bg-slate-100 dark:text-slate-50 dark:hover:bg-white/10",
        cell.isManual && "bg-amber-50 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/30",
      )}
    >
      {formatRate(cell.rate)}
    </button>
  )
}

export function ActiveExchangeRateSection({
  data,
  currencies,
  meta,
  page,
  limit,
  loading,
  filters,
  selectedKeys,
  onSelectedKeysChange,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onSaveRate,
  onDelete,
}: ActiveExchangeRateSectionProps) {
  // The cell being edited: its row key + to currency.
  const [editing, setEditing] = useState<{ key: string; to: string; draft: string } | null>(null)
  const [savingCell, setSavingCell] = useState<string | null>(null)

  const filterCount = useMemo(() => Object.values(filters).filter((value) => value.trim()).length, [filters])
  const selected = useMemo(() => new Set(selectedKeys), [selectedKeys])
  const selectedRows = useMemo(() => data.filter((row) => selected.has(matrixRowKey(row))), [data, selected])
  const allOnPage = data.length > 0 && selectedRows.length === data.length

  // Gmail's "1–5 of 32" (days).
  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No exchange rates found"
    const start = (meta.page - 1) * meta.limit + 1
    return `${start}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total} day${meta.total === 1 ? "" : "s"}`
  }, [meta])

  const clearFilters = () => onFilterChange(EMPTY_FILTERS)

  const columns = useMemo<ColumnDef<ExchangeRateMatrixRow>[]>(() => {
    function toggle(key: string, checked: boolean) {
      onSelectedKeysChange(checked ? [...selectedKeys.filter((x) => x !== key), key] : selectedKeys.filter((x) => x !== key))
    }

    async function save(row: ExchangeRateMatrixRow, cell: ExchangeRateCell, draft: string) {
      const id = `${matrixRowKey(row)}|${cell.toCurrencyCode}`
      setSavingCell(id)
      try {
        if (await onSaveRate(row, cell, draft)) setEditing(null)
      } finally {
        setSavingCell(null)
      }
    }

    const currencyColumns: ColumnDef<ExchangeRateMatrixRow>[] = currencies.map((to) => ({
      id: `to-${to}`,
      header: () => <span className="block text-right">{to}</span>,
      cell: ({ row }) => {
        const key = matrixRowKey(row.original)
        if (row.original.fromCurrencyCode === to) {
          return <span className="block px-1.5 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">1</span>
        }
        const cell = row.original.cells.find((c) => c.toCurrencyCode === to)
        if (!cell) return <span className="block px-1.5 text-right text-xs text-slate-400">—</span>
        const isEditing = editing?.key === key && editing.to === to
        return (
          <RateCell
            row={row.original}
            cell={cell}
            editing={isEditing}
            draft={isEditing ? editing.draft : ""}
            saving={savingCell === `${key}|${to}`}
            onStart={() => setEditing({ key, to, draft: String(cell.rate) })}
            onDraftChange={(draft) => setEditing({ key, to, draft })}
            onSave={() => void save(row.original, cell, isEditing ? editing.draft : String(cell.rate))}
            onCancel={() => setEditing(null)}
          />
        )
      },
    }))

    return [
      {
        id: "select",
        header: () => (
          <Checkbox
            aria-label="Select every row on this page"
            // some rows ticked: a half-filled box, as in Gmail
            className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/30"
            checked={allOnPage ? true : selectedRows.length > 0 ? "indeterminate" : false}
            onCheckedChange={(checked) => onSelectedKeysChange(checked === true ? data.map(matrixRowKey) : [])}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.fromCurrencyCode} on ${formatDay(row.original.currencyDate)}`}
            checked={selected.has(matrixRowKey(row.original))}
            onCheckedChange={(checked) => toggle(matrixRowKey(row.original), checked === true)}
          />
        ),
      },
      {
        id: "date",
        header: "Date",
        cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{formatDay(row.original.currencyDate)}</span>,
      },
      {
        id: "currency",
        header: "Currency Code",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {row.original.fromCurrencyCode.slice(0, 2)}
            </span>
            <span className="text-xs font-semibold text-slate-950 dark:text-slate-50">{row.original.fromCurrencyCode}</span>
          </div>
        ),
      },
      ...currencyColumns,
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="invisible flex justify-end pr-2 [tr:hover_&]:visible">
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full text-rose-600 hover:text-rose-700" title="Delete this row's rates" onClick={() => onDelete([row.original])}>
              <Trash2 className="size-3.5" />
              <span className="sr-only">Delete this row&apos;s rates</span>
            </Button>
          </div>
        ),
      },
    ]
  }, [allOnPage, currencies, data, editing, onDelete, onSaveRate, onSelectedKeysChange, savingCell, selected, selectedKeys, selectedRows.length])

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
      description="1 row currency × rate = the column currency"
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
      getRowId={matrixRowKey}
      emptyState={emptyState}
      enableColumnResizing={false}
      leadingColumnIds={["select"]}
      trailingColumnIds={["actions"]}
      // Every currency column has a fixed width, so with many currencies the table scrolls sideways (the table is
      // table-fixed: its width grows to the columns' sum) instead of squeezing the rates; select, date and currency
      // stay pinned on the left while it scrolls.
      columnClassNames={{
        select: `${PINNED} left-0 h-8 w-10 py-1`,
        date: `${PINNED} left-10 h-8 w-24 py-1`,
        currency: `${PINNED} left-34 h-8 w-28 py-1 shadow-[1px_0_0_0_rgba(148,163,184,0.25)]`,
        actions: "h-8 w-12 py-1",
        ...Object.fromEntries(currencies.map((to) => [`to-${to}`, "h-8 w-24 py-1"])),
      }}
      headerBadges={
        <>
          <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
            Page {meta?.totalPages ? meta.page : 0} of {meta?.totalPages ?? 0}
          </Badge>
          <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
            {filterCount} active filter{filterCount === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="w-fit rounded-full border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
            Highlighted = edited by hand
          </Badge>
        </>
      }
      headerActions={
        selectedRows.length > 0 ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {selectedRows.length} selected
            </Badge>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onSelectedKeysChange([])}>
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
              id: "filterExchangeRateFrom",
              label: "Currency code",
              kind: "text",
              value: filters.fromCurrencyCode,
              placeholder: "e.g. USD",
              onValueChange: (fromCurrencyCode) => onFilterChange({ ...filters, fromCurrencyCode }),
            },
            {
              id: "filterExchangeRateFromDate",
              label: "From date",
              kind: "custom",
              control: (
                <AppDatePicker
                  id="filterExchangeRateFromDate"
                  value={filters.fromCurrencyDate}
                  max={filters.toCurrencyDate || undefined}
                  onValueChange={(value) => onFilterChange({ ...filters, fromCurrencyDate: value })}
                  className="h-7 rounded-xl"
                />
              ),
            },
            {
              id: "filterExchangeRateToDate",
              label: "To date",
              kind: "custom",
              control: (
                <AppDatePicker
                  id="filterExchangeRateToDate"
                  value={filters.toCurrencyDate}
                  min={filters.fromCurrencyDate || undefined}
                  onValueChange={(value) => onFilterChange({ ...filters, toCurrencyDate: value })}
                  className="h-7 rounded-xl"
                />
              ),
            },
          ]}
          debounceMs={FILTER_DEBOUNCE_MS}
          onReset={clearFilters}
        />
      }
      renderMobileItem={(row) => {
        const key = matrixRowKey(row)
        return (
          <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Checkbox
                  aria-label={`Select ${row.fromCurrencyCode} on ${formatDay(row.currencyDate)}`}
                  checked={selected.has(key)}
                  onCheckedChange={(checked) =>
                    onSelectedKeysChange(checked === true ? [...selectedKeys.filter((x) => x !== key), key] : selectedKeys.filter((x) => x !== key))
                  }
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">1 {row.fromCurrencyCode}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{formatDay(row.currencyDate)}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" className="rounded-full text-rose-600" onClick={() => onDelete([row])}>
                <Trash2 className="size-3.5" />
                <span className="sr-only">Delete this row&apos;s rates</span>
              </Button>
            </div>
            <div className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
              {row.cells.map((cell) => {
                const isEditing = editing?.key === key && editing.to === cell.toCurrencyCode
                return (
                  <div key={cell.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">= {cell.toCurrencyCode}</span>
                    <div className="min-w-24">
                      <RateCell
                        row={row}
                        cell={cell}
                        editing={isEditing}
                        draft={isEditing ? editing.draft : ""}
                        saving={savingCell === `${key}|${cell.toCurrencyCode}`}
                        onStart={() => setEditing({ key, to: cell.toCurrencyCode, draft: String(cell.rate) })}
                        onDraftChange={(draft) => setEditing({ key, to: cell.toCurrencyCode, draft })}
                        onSave={() => {
                          const draft = isEditing ? editing.draft : String(cell.rate)
                          setSavingCell(`${key}|${cell.toCurrencyCode}`)
                          void onSaveRate(row, cell, draft)
                            .then((saved) => {
                              if (saved) setEditing(null)
                            })
                            .finally(() => setSavingCell(null))
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </article>
        )
      }}
    />
  )
}
