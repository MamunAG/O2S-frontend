"use client"

import { useMemo } from "react"

import { MoreHorizontal, Trash2 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { AppDataFilterForm, FILTER_DEBOUNCE_MS } from "@/components/app-data-filter-form"
import { AppDataSection } from "@/components/app-data-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { EMPTY_FILTERS, type FactoryFilterValues, type FactoryRecord, type PaginationMeta } from "../factory.types"

const ALL_STATUS_VALUE = "__all_deleted_statuses__"

export type DeletedFactoryActionMode = "restore" | "permanent"

type DeletedFactorySectionProps = {
  data: FactoryRecord[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: FactoryFilterValues
  onFilterChange: (nextValues: FactoryFilterValues) => void
  onPageChange: (nextPage: number | ((current: number) => number)) => void
  onLimitChange: (nextPageSize: number) => void
  onOpenAction: (factory: FactoryRecord, mode: DeletedFactoryActionMode) => void
}

function formatDate(value?: string | null) {
  if (!value) return "Not available"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function getStatusLabel(factory: FactoryRecord) {
  return factory.deleted_at ? "Deleted" : factory.isActive === false ? "Inactive" : "Active"
}

function getStatusTone(factory: FactoryRecord) {
  if (factory.deleted_at) return "destructive" as const
  return factory.isActive === false ? "outline" as const : "secondary" as const
}

function RowActions({
  factory,
  onOpenAction,
}: {
  factory: FactoryRecord
  onOpenAction: (factory: FactoryRecord, mode: DeletedFactoryActionMode) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Open deleted item actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onOpenAction(factory, "restore")}>Restore factory</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onOpenAction(factory, "permanent")}>
          Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Trash2 className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  )
}

export function DeletedFactorySection({
  data,
  meta,
  page,
  limit,
  loading,
  filters,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onOpenAction,
}: DeletedFactorySectionProps) {
  const deletedFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value.trim()).length,
    [filters],
  )

  const deletedPageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No deleted factories found"
    const start = (meta.page - 1) * meta.limit + 1
    const end = Math.min(meta.page * meta.limit, meta.total)
    return `Showing ${start}-${end} of ${meta.total}`
  }, [meta])

  const columns = useMemo<ColumnDef<FactoryRecord>[]>(() => [
    {
      id: "factory",
      header: "Factory",
      cell: ({ row }) => (
        <div className="pl-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {(row.original.name?.trim() || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{row.original.name}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{row.original.displayName}</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "code",
      header: "Code",
      cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.original.code || "-"}</span>,
    },
    {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.original.contact || "-"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={getStatusTone(row.original)} className="rounded-full px-3 py-1">{getStatusLabel(row.original)}</Badge>,
    },
    {
      id: "deleted",
      header: "Deleted",
      cell: ({ row }) => <p className="text-xs text-slate-700 dark:text-slate-200">{formatDate(row.original.deleted_at)}</p>,
    },
    {
      id: "actions",
      header: () => <span className="pr-4">Actions</span>,
      cell: ({ row }) => (
        <div className="pr-4 text-right">
          <RowActions factory={row.original} onOpenAction={onOpenAction} />
        </div>
      ),
    },
  ], [onOpenAction])

  const clearFilters = () => {
    onFilterChange(EMPTY_FILTERS)
    onPageChange(1)
  }

  const emptyState = (
    <EmptyState
      title="No deleted factories found"
      description="Try clearing or relaxing the current filters."
    />
  )

  return (
    <AppDataSection
      title="Deleted factories"
      data={data}
      columns={columns}
      loading={loading}
      pageSummary={deletedPageSummary}
      page={page}
      totalPages={meta?.totalPages ?? 1}
      pageSize={limit}
      pageSizeOptions={[5, 10, 25, 50]}
      onPageChange={(nextPage) => onPageChange(nextPage)}
      onPageSizeChange={(nextPageSize) => {
        onLimitChange(nextPageSize)
        onPageChange(1)
      }}
      getRowId={(factory) => factory.id}
      emptyState={emptyState}
      mobileSkeletonClassName="h-28 rounded-2xl"
      headerBadges={
        <>
          <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
            {meta?.total ?? data.length} deleted
          </Badge>
          <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
            {deletedFilterCount} active filter{deletedFilterCount === 1 ? "" : "s"}
          </Badge>
        </>
      }
      filters={
        <AppDataFilterForm
          fields={[
            {
              id: "deletedFactoryName",
              label: "Factory name",
              kind: "text",
              value: filters.name,
              placeholder: "Input factory name",
              onValueChange: (name) => onFilterChange({ ...filters, name }),
            },
            {
              id: "deletedFactoryDisplayName",
              label: "Display name",
              kind: "text",
              value: filters.displayName,
              placeholder: "Input display name",
              onValueChange: (displayName) => onFilterChange({ ...filters, displayName }),
            },
            {
              id: "deletedFactoryCode",
              label: "Code",
              kind: "text",
              value: filters.code,
              placeholder: "Input code",
              onValueChange: (code) => onFilterChange({ ...filters, code }),
            },
            {
              id: "deletedFactoryStatus",
              label: "Status",
              kind: "select",
              value: filters.isActive || ALL_STATUS_VALUE,
              placeholder: "All statuses",
              options: [
                { value: ALL_STATUS_VALUE, label: "All statuses" },
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
              onValueChange: (value) => onFilterChange({ ...filters, isActive: value === ALL_STATUS_VALUE ? "" : value }),
            },
          ]}
          debounceMs={FILTER_DEBOUNCE_MS}
          onReset={clearFilters}
        />
      }
      renderMobileItem={(factory) => (
        <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{factory.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{factory.displayName}</p>
            </div>
            <RowActions factory={factory} onOpenAction={onOpenAction} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={getStatusTone(factory)} className="rounded-full px-3 py-1">{getStatusLabel(factory)}</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{factory.code || "No code"}</Badge>
          </div>

          <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p>Deleted: {formatDate(factory.deleted_at)}</p>
            <p>Email: {factory.email || "-"}</p>
          </div>
        </article>
      )}
    />
  )
}
