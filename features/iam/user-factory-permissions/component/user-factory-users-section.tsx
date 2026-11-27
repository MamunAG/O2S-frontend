"use client"

import { useMemo } from "react"

import { Building2, Users } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { AppDataFilterForm, FILTER_DEBOUNCE_MS } from "@/components/app-data-filter-form"
import { AppDataSection } from "@/components/app-data-section"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import {
  EMPTY_FILTERS,
  type PaginationMeta,
  type UserFactoryFilterValues,
  type UserFactorySummaryRecord,
} from "../user-factory-permission.types"

const ALL_STATUS_VALUE = "__all_statuses__"

type UserFactoryUsersSectionProps = {
  data: UserFactorySummaryRecord[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: UserFactoryFilterValues
  onFilterChange: (nextValues: UserFactoryFilterValues) => void
  onPageChange: (nextPage: number) => void
  onLimitChange: (nextPageSize: number) => void
  onManage: (user: UserFactorySummaryRecord) => void
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

export function getUserLabel(user: { fullName?: string | null; userName?: string | null }) {
  return user.fullName?.trim() || user.userName?.trim() || "Unnamed user"
}

function AccessBadge({ user }: { user: UserFactorySummaryRecord }) {
  if (user.isUnrestricted) {
    return <Badge variant="secondary" className="rounded-full px-2 py-0">All factories (admin)</Badge>
  }
  if (user.noOfFactories === 0) {
    return <Badge variant="outline" className="rounded-full border-amber-300 px-2 py-0 text-amber-700 dark:border-amber-400/40 dark:text-amber-300">No factories</Badge>
  }
  return (
    <Badge variant="outline" className="rounded-full px-2 py-0">
      {user.noOfFactories} {user.noOfFactories === 1 ? "factory" : "factories"}
    </Badge>
  )
}

function ManageButton({ user, onManage }: { user: UserFactorySummaryRecord; onManage: (user: UserFactorySummaryRecord) => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-7 rounded-xl px-2.5 text-xs" onClick={() => onManage(user)}>
      <Building2 className="size-3.5" />
      Factories
    </Button>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Users className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">No users found</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
        Try clearing or relaxing the current filters. Users are added to the organization on Company Users.
      </p>
      <Button type="button" onClick={onReset} className="mt-6 rounded-xl">
        Reset
      </Button>
    </div>
  )
}

export function UserFactoryUsersSection({
  data,
  meta,
  page,
  limit,
  loading,
  filters,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onManage,
}: UserFactoryUsersSectionProps) {
  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No users found"
    const start = (meta.page - 1) * meta.limit + 1
    const end = Math.min(meta.page * meta.limit, meta.total)
    return `Showing ${start}-${end} of ${meta.total}`
  }, [meta])

  const columns = useMemo<ColumnDef<UserFactorySummaryRecord>[]>(() => [
    {
      id: "user",
      header: "User",
      cell: ({ row }) => (
        <div className="min-w-0 pl-4">
          <p className="truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{getUserLabel(row.original)}</p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{row.original.userName || "-"}</p>
        </div>
      ),
    },
    {
      id: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.original.email || "-"}</span>,
    },
    {
      id: "access",
      header: "Factory access",
      cell: ({ row }) => <AccessBadge user={row.original} />,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "secondary" : "outline"} className="rounded-full px-2 py-0">
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "changed",
      header: "Last changed",
      cell: ({ row }) => <p className="text-xs text-slate-700 dark:text-slate-200">{formatDate(row.original.lastChangedDate)}</p>,
    },
    {
      id: "actions",
      header: () => <span className="pr-4">Actions</span>,
      cell: ({ row }) => (
        <div className="pr-4 text-right">
          <ManageButton user={row.original} onManage={onManage} />
        </div>
      ),
    },
  ], [onManage])

  const clearFilters = () => onFilterChange(EMPTY_FILTERS)

  return (
    <AppDataSection
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
      getRowId={(user) => user.userId}
      emptyState={<EmptyState onReset={clearFilters} />}
      columnClassNames={{
        user: "h-8 py-1",
        email: "h-8 py-1",
        access: "h-8 py-1",
        status: "h-8 py-1",
        changed: "h-8 py-1",
        actions: "h-8 py-1",
      }}
      filters={
        <AppDataFilterForm
          fields={[
            {
              id: "filterUserFactorySearch",
              label: "User",
              kind: "text",
              value: filters.search,
              placeholder: "Name, user name or email",
              onValueChange: (search) => onFilterChange({ ...filters, search }),
            },
            {
              id: "filterUserFactoryStatus",
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
      renderMobileItem={(user) => (
        <article className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{getUserLabel(user)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email || user.userName || "-"}</p>
            </div>
            <ManageButton user={user} onManage={onManage} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <AccessBadge user={user} />
            <Badge variant={user.isActive ? "secondary" : "outline"} className="rounded-full px-2 py-0">
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Last changed: {formatDate(user.lastChangedDate)}</p>
        </article>
      )}
    />
  )
}
