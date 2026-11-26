"use client"

import { useMemo } from "react"

import { Download, MoreHorizontal, Plus, Upload } from "lucide-react"
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

import type { FactoryFilterValues, FactoryRecord, PaginationMeta } from "../factory.types"

const ALL_STATUS_VALUE = "__all_statuses__"

const EMPTY_FILTERS: FactoryFilterValues = {
  name: "",
  displayName: "",
  code: "",
  contact: "",
  email: "",
  address: "",
  isActive: "",
}

type FactoryTableSectionProps = {
  data: FactoryRecord[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: FactoryFilterValues
  onFilterChange: (nextValues: FactoryFilterValues) => void
  onPageChange: (nextPage: number | ((current: number) => number)) => void
  onLimitChange: (nextPageSize: number) => void
  onEdit: (factoryId: string) => void
  onDelete: (factory: FactoryRecord) => void
  onDownloadTemplate?: () => void
  onUploadTemplate?: () => void
  downloadingTemplate?: boolean
  uploadingTemplate?: boolean
}

function formatDate(value?: string | null) {
  if (!value) return "Not available"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function getStatusLabel(factory: FactoryRecord) {
  if (factory.deleted_at) return "Deleted"
  return factory.isActive === false ? "Inactive" : "Active"
}

function getStatusTone(factory: FactoryRecord) {
  if (factory.deleted_at) return "destructive" as const
  return factory.isActive === false ? "outline" as const : "secondary" as const
}

function getFactoryImageUrl(factory: FactoryRecord) {
  return (
    factory.image?.thumbnail_url?.trim() ||
    factory.image?.public_url?.trim() ||
    factory.image?.file_url?.trim() ||
    factory.image?.file_path?.trim() ||
    ""
  )
}

function FactoryAvatar({ factory, className, textClassName }: { factory: FactoryRecord; className: string; textClassName: string }) {
  const imageUrl = getFactoryImageUrl(factory)

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/3 ${className}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- O2S file URLs are not configured for next/image
        <img src={imageUrl} alt={factory.name || "Factory image"} className="h-full w-full object-cover" />
      ) : (
        <span className={`font-semibold text-slate-700 dark:text-slate-200 ${textClassName}`}>
          {(factory.name?.trim() || "?").charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

function RowActions({
  factory,
  onEdit,
  onDelete,
}: {
  factory: FactoryRecord
  onEdit: (factoryId: string) => void
  onDelete: (factory: FactoryRecord) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full">
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => onEdit(factory.id)}>Edit factory</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(factory)}>
          Delete factory
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
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

export function ActiveFactorySection({
  data,
  meta,
  page,
  limit,
  loading,
  filters,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onEdit,
  onDelete,
  onDownloadTemplate,
  onUploadTemplate,
  downloadingTemplate = false,
  uploadingTemplate = false,
}: FactoryTableSectionProps) {
  const filterCount = useMemo(
    () => Object.values(filters).filter((value) => value.trim()).length,
    [filters],
  )

  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No factories found"
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
          <div className="flex items-center gap-2">
            <FactoryAvatar factory={row.original} className="size-7" textClassName="text-[11px]" />
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
      id: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.original.email || "-"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={getStatusTone(row.original)} className="rounded-full px-2 py-0">{getStatusLabel(row.original)}</Badge>,
    },
    {
      id: "created",
      header: "Created",
      cell: ({ row }) => <p className="text-xs text-slate-700 dark:text-slate-200">{formatDate(row.original.created_at)}</p>,
    },
    {
      id: "updated",
      header: "Updated",
      cell: ({ row }) =>
        row.original.updated_by_id || row.original.updated_by_user ? (
          <p className="text-xs text-slate-700 dark:text-slate-200">{formatDate(row.original.updated_at)}</p>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">Not edited yet</p>
        ),
    },
    {
      id: "actions",
      header: () => <span className="pr-4">Actions</span>,
      cell: ({ row }) => (
        <div className="pr-4 text-right">
          <RowActions factory={row.original} onEdit={onEdit} onDelete={onDelete} />
        </div>
      ),
    },
  ], [onDelete, onEdit])

  const clearFilters = () => {
    onFilterChange(EMPTY_FILTERS)
    onPageChange(1)
  }

  const emptyState = (
    <EmptyState
      title="No factories found"
      description="Try clearing or relaxing the current filters."
      actionLabel="Reset"
      onAction={clearFilters}
    />
  )

  return (
    <AppDataSection
      title="Factories table"
      description={pageSummary}
      data={data}
      columns={columns}
      loading={loading}
      pageSummary={pageSummary}
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
      columnClassNames={{
        factory: "h-8 py-1",
        code: "h-8 py-1",
        contact: "h-8 py-1",
        email: "h-8 py-1",
        status: "h-8 py-1",
        created: "h-8 py-1",
        updated: "h-8 py-1",
        actions: "h-8 py-1",
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="rounded-full">
              <MoreHorizontal className="size-2.5" />
              <span className="sr-only">Bulk actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onDownloadTemplate} disabled={downloadingTemplate}>
              <Download className="mr-2 size-3.5" />
              {downloadingTemplate ? "Downloading template..." : "Download template"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onUploadTemplate} disabled={uploadingTemplate}>
              <Upload className="mr-2 size-3.5" />
              {uploadingTemplate ? "Uploading factories..." : "Upload factories"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      filters={
        <AppDataFilterForm
          fields={[
            {
              id: "filterFactoryName",
              label: "Factory name",
              kind: "text",
              value: filters.name,
              placeholder: "Input factory name",
              onValueChange: (name) => onFilterChange({ ...filters, name }),
            },
            {
              id: "filterFactoryDisplayName",
              label: "Display name",
              kind: "text",
              value: filters.displayName,
              placeholder: "Input display name",
              onValueChange: (displayName) => onFilterChange({ ...filters, displayName }),
            },
            {
              id: "filterFactoryCode",
              label: "Code",
              kind: "text",
              value: filters.code,
              placeholder: "Input code",
              onValueChange: (code) => onFilterChange({ ...filters, code }),
            },
            {
              id: "filterFactoryContact",
              label: "Contact",
              kind: "text",
              value: filters.contact,
              placeholder: "Input contact",
              onValueChange: (contact) => onFilterChange({ ...filters, contact }),
            },
            {
              id: "filterFactoryEmail",
              label: "Email",
              kind: "text",
              value: filters.email,
              placeholder: "Input email",
              onValueChange: (email) => onFilterChange({ ...filters, email }),
            },
            {
              id: "filterFactoryStatus",
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <FactoryAvatar factory={factory} className="size-10" textClassName="text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{factory.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{factory.displayName}</p>
              </div>
            </div>
            <RowActions factory={factory} onEdit={onEdit} onDelete={onDelete} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={getStatusTone(factory)} className="rounded-full px-3 py-1">{getStatusLabel(factory)}</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{factory.code || "No code"}</Badge>
          </div>

          <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <p>Contact: {factory.contact || "-"}</p>
            <p>Email: {factory.email || "-"}</p>
            <p>Created: {formatDate(factory.created_at)}</p>
          </div>
        </article>
      )}
    />
  )
}
