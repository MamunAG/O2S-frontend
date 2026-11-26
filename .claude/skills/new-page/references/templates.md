# Templates

Generalized from `features/app-config/factory/` (image upload and Excel upload removed — see `add-ons.md`).

## Tokens

| Token | Meaning | Factory example |
|---|---|---|
| `__Thing__` / `__Things__` | PascalCase singular / plural | `Factory` / `Factories` |
| `__thing__` / `__things__` | camelCase singular / plural | `factory` / `factories` |
| `__file__` | kebab-case singular, for file names and ids | `factory` |
| `__resource__` | code-crafter API segment (`/api/v1/__resource__`) | `factory` |
| `__label__` / `__labels__` | lowercase human singular / plural | `factory` / `factories` |
| `__Label__` / `__Labels__` | Sentence-case human singular / plural | `Factory` / `Factories` |
| `__TITLE__` | page title and sidebar label | `Factory Setup` |
| `__EYEBROW__` | small caps line above the title (the module) | `App configuration` |
| `__module__` | features / app folder of the module | `app-config` |

The example fields in every template are **`name`** (required text), **`code`** (optional text),
**`remarks`** (long text) and **`isActive`** (active flag). Lines marked `// FIELDS:` are where the real
fields go — replace the example fields there using the field-kind table in `SKILL.md`, and delete the
`// FIELDS:` comments when done.

---

## 1. `features/__module__/__file__/__file__.types.ts`

```ts
export type ApiResponse<T = unknown> = {
  success: boolean
  message: string
  data?: T
  timestamp?: string
}

export type PaginationMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export type PaginatedResponse<T> = {
  items: T[]
  meta: PaginationMeta
}

export type UserSummary = {
  id?: string | null
  name?: string | null
  user_name?: string | null
  display_name?: string | null
}

export type __Thing__Record = {
  id: string
  // FIELDS: one property per DTO field ("Record" column)
  name: string
  code?: string | null
  remarks?: string | null
  isActive?: boolean

  // Audit names added by crudRules (lib/o2s/crud.ts withAuditNames)
  organizationId?: string | null
  created_by_id?: string | null
  updated_by_id?: string | null
  deleted_by_id?: string | null
  created_by_user?: UserSummary | null
  updated_by_user?: UserSummary | null
  deleted_by_user?: UserSummary | null
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

/** Only properties of the backend's <Thing>Params. isActive is "" (all) | "true" | "false". */
export type __Thing__FilterValues = {
  // FIELDS: one string per filter
  name: string
  code: string
  isActive: string
}

export type __Thing__FormValues = {
  // FIELDS: one property per editable field ("FormValues" column)
  name: string
  code: string
  remarks: string
  isActive: boolean
}

export const EMPTY_FILTERS: __Thing__FilterValues = {
  // FIELDS: "" for every filter
  name: "",
  code: "",
  isActive: "",
}

export const EMPTY_FORM_VALUES: __Thing__FormValues = {
  // FIELDS: the default of every form field
  name: "",
  code: "",
  remarks: "",
  isActive: true,
}
```

---

## 2. `features/__module__/__file__/__file__.service.ts`

```ts
import type {
  ApiResponse,
  PaginatedResponse,
  __Thing__FilterValues,
  __Thing__FormValues,
  __Thing__Record,
} from "./__file__.types"

const RESOURCE = "/api/v1/__resource__"

function buildApiUrl(apiUrl: string, path: string) {
  return new URL(path, apiUrl)
}

function buildRequestHeaders({
  accessToken,
  organizationId,
  contentType,
}: {
  accessToken: string
  organizationId?: string
  contentType?: string
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  }

  if (contentType) headers["Content-Type"] = contentType
  if (organizationId) headers["x-organization-id"] = organizationId

  return headers
}

async function readJsonResponse<T>(response: Response) {
  let payload: ApiResponse<T> | null = null

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    payload = null
  }

  if (response.status === 401) {
    throw new Error("Your session expired. Please sign in again.")
  }

  if (response.status === 403) {
    throw new Error(payload?.message || "You do not have permission to complete this __label__ action.")
  }

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Unable to complete the __label__ request right now.")
  }

  return payload
}

function appendFilterParams(url: URL, filters: Partial<__Thing__FilterValues>) {
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value?.trim()
    if (trimmed) url.searchParams.set(key, trimmed)
  }
}

function optionalString(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue || undefined
}

// Keep when the form has a number field; delete otherwise (eslint flags unused functions).
// function optionalNumber(value: string) {
//   const trimmedValue = value.trim()
//   return trimmedValue ? Number(trimmedValue) : undefined
// }

function build__Thing__Payload(values: __Thing__FormValues) {
  return {
    // FIELDS: one line per field ("Payload" column)
    name: values.name.trim(),
    code: optionalString(values.code),
    remarks: optionalString(values.remarks),
    isActive: values.isActive,
  }
}

export async function fetch__Things__({
  apiUrl,
  accessToken,
  page,
  limit,
  filters,
  deletedOnly = false,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  page: number
  limit: number
  filters: Partial<__Thing__FilterValues>
  deletedOnly?: boolean
  organizationId?: string
}): Promise<PaginatedResponse<__Thing__Record>> {
  const url = buildApiUrl(apiUrl, RESOURCE)
  url.searchParams.set("page", String(page))
  url.searchParams.set("limit", String(limit))

  if (deletedOnly) url.searchParams.set("deletedOnly", "true")
  appendFilterParams(url, filters)

  const response = await fetch(url, {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })

  const payload = await readJsonResponse<PaginatedResponse<__Thing__Record>>(response)

  if (!payload.data?.items || !payload.data?.meta) {
    throw new Error("The __label__ list was returned without pagination data.")
  }

  return payload.data
}

export async function fetch__Thing__({
  apiUrl,
  accessToken,
  id,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  id: string
  organizationId?: string
}): Promise<__Thing__Record> {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/${id}`), {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    cache: "no-store",
  })

  const payload = await readJsonResponse<__Thing__Record>(response)

  if (!payload.data) throw new Error("The __label__ record was returned without data.")

  return payload.data
}

export async function create__Thing__({
  apiUrl,
  accessToken,
  values,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  values: __Thing__FormValues
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, RESOURCE), {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify(build__Thing__Payload(values)),
  })

  const payload = await readJsonResponse<__Thing__Record>(response)

  if (!payload.data) {
    throw new Error("The __label__ was saved, but the created record was not returned.")
  }

  return payload.data
}

export async function update__Thing__({
  apiUrl,
  accessToken,
  id,
  values,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  id: string
  values: __Thing__FormValues
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/${id}`), {
    method: "PATCH",
    headers: buildRequestHeaders({ accessToken, organizationId, contentType: "application/json" }),
    body: JSON.stringify(build__Thing__Payload(values)),
  })

  const payload = await readJsonResponse<__Thing__Record>(response)

  if (!payload.data) {
    throw new Error("The __label__ was updated, but the updated record was not returned.")
  }

  return payload.data
}

export async function softDelete__Thing__({
  apiUrl,
  accessToken,
  id,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  id: string
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/${id}`), {
    method: "DELETE",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  await readJsonResponse(response)
}

export async function restore__Thing__({
  apiUrl,
  accessToken,
  id,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  id: string
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/${id}/restore`), {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  await readJsonResponse(response)
}

export async function permanentlyDelete__Thing__({
  apiUrl,
  accessToken,
  id,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  id: string
  organizationId?: string
}) {
  const response = await fetch(buildApiUrl(apiUrl, `${RESOURCE}/${id}/permanent`), {
    method: "DELETE",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  await readJsonResponse(response)
}
```

---

## 3. `features/__module__/__file__/component/active-__file__-section.tsx`

```tsx
"use client"

import { useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"

import { AppDataTable } from "@/components/app-data-table"
import { AppSelect } from "@/components/app-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

import {
  EMPTY_FILTERS,
  type PaginationMeta,
  type __Thing__FilterValues,
  type __Thing__Record,
} from "../__file__.types"

const ALL_STATUS_VALUE = "__all_statuses__"
const MOBILE_SKELETONS = Array.from({ length: 5 })

type Active__Thing__SectionProps = {
  data: __Thing__Record[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: __Thing__FilterValues
  onFilterChange: (nextValues: __Thing__FilterValues) => void
  onPageChange: (nextPage: number) => void
  onLimitChange: (nextPageSize: number) => void
  onCreate: () => void
  onEdit: (id: string) => void
  onDelete: (__thing__: __Thing__Record) => void
}

function formatDate(value?: string | null) {
  if (!value) return "Not available"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function getStatusLabel(__thing__: __Thing__Record) {
  if (__thing__.deleted_at) return "Deleted"
  return __thing__.isActive === false ? "Inactive" : "Active"
}

function getStatusTone(__thing__: __Thing__Record) {
  if (__thing__.deleted_at) return "destructive" as const
  return __thing__.isActive === false ? ("outline" as const) : ("secondary" as const)
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

export function Active__Thing__Section({
  data,
  meta,
  page,
  limit,
  loading,
  filters,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onCreate,
  onEdit,
  onDelete,
}: Active__Thing__SectionProps) {
  const filterCount = useMemo(
    () => Object.values(filters).filter((value) => value.trim()).length,
    [filters],
  )

  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No __labels__ found"
    const start = (meta.page - 1) * meta.limit + 1
    const end = Math.min(meta.page * meta.limit, meta.total)
    return `Showing ${start}-${end} of ${meta.total}`
  }, [meta])

  const columns = useMemo<ColumnDef<__Thing__Record>[]>(() => [
    // FIELDS: the identity column shows the main name with an initial; the second line is a secondary field.
    {
      id: "__thing__",
      header: "__Label__",
      cell: ({ row }) => (
        <div className="pl-4">
          <div className="flex items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/3">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {(row.original.name?.trim() || "?").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{row.original.name}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{row.original.code || "-"}</p>
            </div>
          </div>
        </div>
      ),
    },
    // FIELDS: one column per short field the table shows
    {
      id: "code",
      header: "Code",
      cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.original.code || "-"}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusTone(row.original)} className="rounded-full px-2 py-0">
          {getStatusLabel(row.original)}
        </Badge>
      ),
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full">
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => onEdit(row.original.id)}>Edit __label__</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row.original)}>
                Delete __label__
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [onDelete, onEdit])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  const clearFilters = () => {
    onFilterChange(EMPTY_FILTERS)
    onPageChange(1)
  }

  const totalPages = meta?.totalPages ?? 1

  return (
    <Card className="overflow-hidden border-white/60 bg-white/80 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      <CardHeader className="border-b border-slate-200/70 py-0 dark:border-white/10">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">__Labels__ table</CardTitle>
            <CardDescription>{pageSummary}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              Page {meta?.totalPages ? meta.page : 0} of {meta?.totalPages ?? 0}
            </Badge>
            <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
              {filterCount} active filter{filterCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-0 sm:px-2">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onPageChange(1)
          }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
        >
          {/* FIELDS: one block per text filter */}
          <div className="min-w-0 space-y-1">
            <label htmlFor="filter__Thing__Name" className="text-xs font-medium text-slate-700 dark:text-slate-300">Name</label>
            <Input
              id="filter__Thing__Name"
              value={filters.name}
              className="h-7 rounded-md px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filters, name: event.target.value })}
              placeholder="Input __label__ name"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label htmlFor="filter__Thing__Code" className="text-xs font-medium text-slate-700 dark:text-slate-300">Code</label>
            <Input
              id="filter__Thing__Code"
              value={filters.code}
              className="h-7 rounded-md px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filters, code: event.target.value })}
              placeholder="Input code"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label htmlFor="filter__Thing__Status" className="text-xs font-medium text-slate-700 dark:text-slate-300">Status</label>
            <AppSelect
              triggerId="filter__Thing__Status"
              value={filters.isActive || ALL_STATUS_VALUE}
              onValueChange={(value) => onFilterChange({ ...filters, isActive: value === ALL_STATUS_VALUE ? "" : value })}
              placeholder="All statuses"
              options={[
                { value: ALL_STATUS_VALUE, label: "All statuses" },
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end xl:col-span-6">
            <Button type="submit" className="w-full rounded-xl sm:w-auto">
              <Search className="size-3.5" />
              Search
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={clearFilters}>
              Reset
            </Button>
            <Button type="button" onClick={onCreate} className="w-full rounded-xl sm:w-auto">
              <Plus className="size-3.5" />
              New __label__
            </Button>
          </div>
        </form>
      </CardContent>

      <CardContent className="border-t border-slate-200/70 p-0 dark:border-white/10">
        <div className="lg:hidden">
          {loading ? (
            <div className="space-y-3 p-4">
              {MOBILE_SKELETONS.map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : data.length > 0 ? (
            <div className="space-y-3 p-4">
              {data.map((__thing__) => (
                <article
                  key={__thing__.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{__thing__.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{__thing__.code || "-"}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
                          <MoreHorizontal className="size-3.5" />
                          <span className="sr-only">Open actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => onEdit(__thing__.id)}>Edit __label__</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(__thing__)}>
                          Delete __label__
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={getStatusTone(__thing__)} className="rounded-full px-3 py-1">{getStatusLabel(__thing__)}</Badge>
                  </div>

                  {/* FIELDS: a few secondary fields as "Label: value" lines */}
                  <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p>Created: {formatDate(__thing__.created_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState
                title="No __labels__ found"
                description="Try clearing or relaxing the current filters."
                actionLabel="Reset"
                onAction={clearFilters}
              />
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200/70 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">{pageSummary}</p>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(1)} disabled={loading || page <= 1}>
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={loading || page <= 1}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={loading || page >= totalPages}>
                <ChevronRight className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(totalPages)} disabled={loading || page >= totalPages}>
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <AppDataTable
            table={table}
            pageSummary={pageSummary}
            page={page}
            totalPages={totalPages}
            pageSize={limit}
            isLoading={loading}
            pageSizeOptions={[5, 10, 25, 50]}
            // FIELDS: one entry per column id
            columnClassNames={{
              __thing__: "h-8 py-1",
              code: "h-8 py-1",
              status: "h-8 py-1",
              created: "h-8 py-1",
              updated: "h-8 py-1",
              actions: "h-8 py-1",
            }}
            onPageChange={(nextPage) => onPageChange(nextPage)}
            onPageSizeChange={(nextPageSize) => {
              onLimitChange(nextPageSize)
              onPageChange(1)
            }}
            emptyState={
              <EmptyState
                title="No __labels__ found"
                description="Try clearing or relaxing the current filters."
                actionLabel="Reset"
                onAction={clearFilters}
              />
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 4. `features/__module__/__file__/component/deleted-__file__-section.tsx`

Same shape as the active section, with these differences: no "New" button, no Created/Updated columns but a
**Deleted** column (`deleted_at`), the identity avatar is a dark circle, the row actions are
**Restore** / **Delete permanently** (`onOpenAction(row, "restore" | "permanent")`), the header badge
shows `{meta?.total ?? data.length} deleted`, ids are prefixed `deleted…` instead of `filter…`, and the
empty state has a trash icon and no button.

```tsx
"use client"

import { useMemo } from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"

import { AppDataTable } from "@/components/app-data-table"
import { AppSelect } from "@/components/app-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

import {
  EMPTY_FILTERS,
  type PaginationMeta,
  type __Thing__FilterValues,
  type __Thing__Record,
} from "../__file__.types"

const ALL_STATUS_VALUE = "__all_deleted_statuses__"
const MOBILE_SKELETONS = Array.from({ length: 5 })

export type Deleted__Thing__ActionMode = "restore" | "permanent"

type Deleted__Thing__SectionProps = {
  data: __Thing__Record[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: __Thing__FilterValues
  onFilterChange: (nextValues: __Thing__FilterValues) => void
  onPageChange: (nextPage: number) => void
  onLimitChange: (nextPageSize: number) => void
  onOpenAction: (__thing__: __Thing__Record, mode: Deleted__Thing__ActionMode) => void
}

function formatDate(value?: string | null) {
  if (!value) return "Not available"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

function EmptyState({ title, description }: { title: string; description: string }) {
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

export function Deleted__Thing__Section({
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
}: Deleted__Thing__SectionProps) {
  const filterCount = useMemo(
    () => Object.values(filters).filter((value) => value.trim()).length,
    [filters],
  )

  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No deleted __labels__ found"
    const start = (meta.page - 1) * meta.limit + 1
    const end = Math.min(meta.page * meta.limit, meta.total)
    return `Showing ${start}-${end} of ${meta.total}`
  }, [meta])

  const columns = useMemo<ColumnDef<__Thing__Record>[]>(() => [
    {
      id: "__thing__",
      header: "__Label__",
      cell: ({ row }) => (
        <div className="pl-4">
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-900">
              {(row.original.name?.trim() || "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{row.original.name}</p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{row.original.code || "-"}</p>
            </div>
          </div>
        </div>
      ),
    },
    // FIELDS: the same short columns as the active table (fewer is fine)
    {
      id: "code",
      header: "Code",
      cell: ({ row }) => <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.original.code || "-"}</span>,
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
                <MoreHorizontal className="size-3.5" />
                <span className="sr-only">Open actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => onOpenAction(row.original, "restore")}>Restore __label__</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onOpenAction(row.original, "permanent")}>
                Delete permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [onOpenAction])

  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })

  const clearFilters = () => {
    onFilterChange(EMPTY_FILTERS)
    onPageChange(1)
  }

  const totalPages = meta?.totalPages ?? 1

  return (
    <Card className="overflow-hidden border-white/60 bg-white/80 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      <CardHeader className="border-b border-slate-200/70 py-0 dark:border-white/10">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Deleted __labels__</CardTitle>
            <CardDescription>{pageSummary}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
              {meta?.total ?? data.length} deleted
            </Badge>
            <Badge variant="outline" className="w-fit rounded-full px-2.5 py-0.5 text-[11px]">
              {filterCount} active filter{filterCount === 1 ? "" : "s"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-0 sm:px-2">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onPageChange(1)
          }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
        >
          {/* FIELDS: the same filters as the active section, ids prefixed "deleted" */}
          <div className="min-w-0 space-y-1">
            <label htmlFor="deleted__Thing__Name" className="text-xs font-medium text-slate-700 dark:text-slate-300">Name</label>
            <Input
              id="deleted__Thing__Name"
              value={filters.name}
              className="h-7 rounded-md px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filters, name: event.target.value })}
              placeholder="Input __label__ name"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label htmlFor="deleted__Thing__Code" className="text-xs font-medium text-slate-700 dark:text-slate-300">Code</label>
            <Input
              id="deleted__Thing__Code"
              value={filters.code}
              className="h-7 rounded-md px-2 text-xs"
              onChange={(event) => onFilterChange({ ...filters, code: event.target.value })}
              placeholder="Input code"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <label htmlFor="deleted__Thing__Status" className="text-xs font-medium text-slate-700 dark:text-slate-300">Status</label>
            <AppSelect
              triggerId="deleted__Thing__Status"
              value={filters.isActive || ALL_STATUS_VALUE}
              onValueChange={(value) => onFilterChange({ ...filters, isActive: value === ALL_STATUS_VALUE ? "" : value })}
              placeholder="All statuses"
              options={[
                { value: ALL_STATUS_VALUE, label: "All statuses" },
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-end xl:col-span-6">
            <Button type="submit" className="w-full rounded-xl sm:w-auto">
              <Search className="size-3.5" />
              Search
            </Button>
            <Button type="button" variant="outline" className="w-full rounded-xl sm:w-auto" onClick={clearFilters}>
              Reset
            </Button>
          </div>
        </form>
      </CardContent>

      <CardContent className="border-t border-slate-200/70 p-0 dark:border-white/10">
        <div className="lg:hidden">
          {loading ? (
            <div className="space-y-3 p-4">
              {MOBILE_SKELETONS.map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : data.length > 0 ? (
            <div className="space-y-3 p-4">
              {data.map((__thing__) => (
                <article
                  key={__thing__.id}
                  className="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-white/3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{__thing__.name}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{__thing__.code || "-"}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" className="rounded-full">
                          <MoreHorizontal className="size-3.5" />
                          <span className="sr-only">Open deleted item actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => onOpenAction(__thing__, "restore")}>Restore __label__</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onOpenAction(__thing__, "permanent")}>
                          Delete permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <p>Deleted: {formatDate(__thing__.deleted_at)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState title="No deleted __labels__ found" description="Try clearing or relaxing the current filters." />
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-200/70 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">{pageSummary}</p>
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(1)} disabled={loading || page <= 1}>
                <ChevronsLeft className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={loading || page <= 1}>
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={loading || page >= totalPages}>
                <ChevronRight className="size-3.5" />
              </Button>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-xl" onClick={() => onPageChange(totalPages)} disabled={loading || page >= totalPages}>
                <ChevronsRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <AppDataTable
            table={table}
            pageSummary={pageSummary}
            page={page}
            totalPages={totalPages}
            pageSize={limit}
            isLoading={loading}
            pageSizeOptions={[5, 10, 25, 50]}
            onPageChange={(nextPage) => onPageChange(nextPage)}
            onPageSizeChange={(nextPageSize) => {
              onLimitChange(nextPageSize)
              onPageChange(1)
            }}
            emptyState={<EmptyState title="No deleted __labels__ found" description="Try clearing or relaxing the current filters." />}
          />
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 5. `features/__module__/__file__/component/__file__-form-dialog.tsx`

Group fields as Factory does: required identity fields full-width first, short optional fields two per row
(`grid gap-4 md:grid-cols-2`), long text full-width, the Active switch last in a bordered row.

The dialog is **controlled**: the workspace owns the values (`values` / `onValuesChange`). Factory instead
copies `initialValues` into a local draft in a `useEffect`, which fails the `react-hooks/set-state-in-effect`
lint rule — don't copy that.

```tsx
"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

import type { __Thing__FormValues } from "../__file__.types"

type __Thing__FormDialogProps = {
  open: boolean
  loading: boolean
  submitting: boolean
  error: string
  mode: "create" | "edit"
  values: __Thing__FormValues
  onValuesChange: (values: __Thing__FormValues) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (values: __Thing__FormValues) => void
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="text-sm font-medium">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  )
}

export function __Thing__FormDialog({
  open,
  loading,
  submitting,
  error,
  mode,
  values: draft,
  onValuesChange,
  onOpenChange,
  onSubmit,
}: __Thing__FormDialogProps) {
  const disabled = loading || submitting
  const title = mode === "create" ? "Create __label__" : "Edit __label__"
  const description = mode === "create" ? "Add a __label__ record." : "Update the selected __label__ record."

  function update<K extends keyof __Thing__FormValues>(key: K, value: __Thing__FormValues[K]) {
    onValuesChange({ ...draft, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <form
          className="flex max-h-[calc(100vh-2rem)] flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(draft)
          }}
        >
          <div className="border-b border-slate-200/70 px-6 pb-4 pt-6 dark:border-white/10">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>

            {!loading && error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            ) : null}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-4 px-6 py-5">
              {/* FIELDS: one block per field ("Form control" column) */}
              <div className="space-y-2">
                <FieldLabel required>Name</FieldLabel>
                <Input
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Input __label__ name"
                  disabled={disabled}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>Code</FieldLabel>
                  <Input
                    value={draft.code}
                    onChange={(event) => update("code", event.target.value)}
                    placeholder="Input code"
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel>Remarks</FieldLabel>
                <Textarea
                  value={draft.remarks}
                  onChange={(event) => update("remarks", event.target.value)}
                  placeholder="Optional remarks"
                  rows={4}
                  disabled={disabled}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <FieldLabel>Active</FieldLabel>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Active __labels__ can be selected in application records.
                    </p>
                  </div>
                  <Switch
                    checked={draft.isActive}
                    onCheckedChange={(checked) => update("isActive", checked)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="border-t border-slate-200/70 px-6 py-4 dark:border-white/10">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={disabled} className="rounded-xl">
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {mode === "create" ? "Save __label__" : "Save changes"}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 6. `features/__module__/__file__/__file__-workspace.tsx`

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, RefreshCcw, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { Active__Thing__Section } from "./component/active-__file__-section"
import { Deleted__Thing__Section, type Deleted__Thing__ActionMode } from "./component/deleted-__file__-section"
import { __Thing__FormDialog } from "./component/__file__-form-dialog"
import {
  create__Thing__,
  fetch__Thing__,
  fetch__Things__,
  permanentlyDelete__Thing__,
  restore__Thing__,
  softDelete__Thing__,
  update__Thing__,
} from "./__file__.service"
import {
  EMPTY_FILTERS,
  EMPTY_FORM_VALUES,
  type PaginationMeta,
  type __Thing__FilterValues,
  type __Thing__FormValues,
  type __Thing__Record,
} from "./__file__.types"

type EditorMode = "create" | "edit"

const CARD_CLASS =
  "overflow-hidden border-white/60 bg-white/85 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75"

/** The name shown in dialogs and the recently-deleted banner. */
function get__Thing__Label(__thing__: __Thing__Record) {
  return __thing__.name
}

function isAuthFailure(message: string) {
  const lower = message.toLowerCase()
  return lower.includes("session expired") || lower.includes("unauthorized")
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
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

function DeleteConfirmDialog({
  open,
  __thing__,
  working,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  __thing__: __Thing__Record | null
  working: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete __label__</AlertDialogTitle>
          <AlertDialogDescription>
            This will soft delete{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {__thing__ ? get__Thing__Label(__thing__) : "this __label__"}
            </span>
            . You can restore it from the deleted list before removing it permanently.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={working}>
            {working ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeletedActionDialog({
  open,
  action,
  __thing__,
  working,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  action: Deleted__Thing__ActionMode
  __thing__: __Thing__Record | null
  working: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const title = action === "restore" ? "Restore __label__" : "Delete __label__ permanently"
  const description =
    action === "restore"
      ? "Bring this __label__ back into the active list."
      : "This will permanently remove the __label__ record and cannot be undone."

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {__thing__ ? get__Thing__Label(__thing__) : "this __label__"}
            </span>
            .
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={action === "restore" ? "default" : "destructive"} onClick={onConfirm} disabled={working}>
            {working ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {action === "restore" ? "Restore" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <Card className={CARD_CLASS}>
            <CardContent className="p-6 sm:p-8">
              <div className="space-y-3">
                <div className="h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-10 w-72 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-full max-w-2xl rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-5 w-40 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-900" />
              </div>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-5 w-44 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-900" />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}

export function __Thing__Workspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()

  const [refreshVersion, setRefreshVersion] = useState(0)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )

  const [__things__, set__Things__] = useState<__Thing__Record[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [activeFilters, setActiveFilters] = useState<__Thing__FilterValues>(EMPTY_FILTERS)

  const [deleted__Things__, setDeleted__Things__] = useState<__Thing__Record[]>([])
  const [deletedMeta, setDeletedMeta] = useState<PaginationMeta | null>(null)
  const [deletedPage, setDeletedPage] = useState(1)
  const [deletedLimit, setDeletedLimit] = useState(5)
  const [deletedFilters, setDeletedFilters] = useState<__Thing__FilterValues>(EMPTY_FILTERS)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>("create")
  const [editorLoading, setEditorLoading] = useState(false)
  const [editorSubmitting, setEditorSubmitting] = useState(false)
  const [editorError, setEditorError] = useState("")
  const [editorValues, setEditorValues] = useState<__Thing__FormValues>(EMPTY_FORM_VALUES)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<__Thing__Record | null>(null)
  const [deleteWorking, setDeleteWorking] = useState(false)
  const [recentlyDeleted, setRecentlyDeleted] = useState<__Thing__Record | null>(null)
  const [pendingTarget, setPendingTarget] = useState<__Thing__Record | null>(null)
  const [pendingMode, setPendingMode] = useState<Deleted__Thing__ActionMode | null>(null)
  const [pendingWorking, setPendingWorking] = useState(false)

  const organizationId = selectedOrganizationId || undefined

  // Everything the two lists depend on. `loaded` records which request last finished, so "loading" and
  // "error" are derived instead of set inside the effect (react-hooks/set-state-in-effect).
  const requestKey = JSON.stringify([
    page, limit, activeFilters, deletedPage, deletedLimit, deletedFilters, organizationId, refreshVersion,
  ])
  const [loaded, setLoaded] = useState<{ key: string; error: string } | null>(null)
  const loading = loaded?.key !== requestKey
  const error = !loading && loaded ? loaded.error : ""

  const handleAuthFailure = useCallback(
    (message: string) => {
      if (!isAuthFailure(message)) return false

      window.localStorage.removeItem("access_token")
      window.localStorage.removeItem("refresh_token")
      window.localStorage.removeItem("auth_user")
      router.replace("/sign-in")
      return true
    },
    [router],
  )

  /** The stored token, or null after sending the user to sign in. */
  const readToken = useCallback(() => {
    const token = window.localStorage.getItem("access_token")
    if (!token) handleAuthFailure("Your session expired. Please sign in again.")
    return token
  }, [handleAuthFailure])

  useEffect(() => {
    function handleOrganizationChange(event: Event) {
      const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
      setSelectedOrganizationId(next || "")
    }

    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
  }, [])

  const triggerRefresh = useCallback(() => setRefreshVersion((current) => current + 1), [])

  // Loads the active and the deleted page together; a newer request cancels the older one's result.
  useEffect(() => {
    const token = readToken()
    if (!token) return

    let cancelled = false

    Promise.all([
      fetch__Things__({ apiUrl, accessToken: token, page, limit, filters: activeFilters, organizationId }),
      fetch__Things__({
        apiUrl,
        accessToken: token,
        page: deletedPage,
        limit: deletedLimit,
        filters: deletedFilters,
        deletedOnly: true,
        organizationId,
      }),
    ])
      .then(([active, deleted]) => {
        if (cancelled) return
        set__Things__(active.items)
        setMeta(active.meta)
        setDeleted__Things__(deleted.items)
        setDeletedMeta(deleted.meta)
        setLoaded({ key: requestKey, error: "" })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const message = errorMessage(caught, "Unable to load __label__ data right now.")
        if (handleAuthFailure(message)) return
        toast.error(message)
        setLoaded({ key: requestKey, error: message })
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, activeFilters, deletedFilters, deletedLimit, deletedPage, handleAuthFailure, limit, organizationId, page, readToken, requestKey])

  function openCreateDialog() {
    setEditorMode("create")
    setEditorError("")
    setEditingId(null)
    setEditorValues(EMPTY_FORM_VALUES)
    setEditorOpen(true)
  }

  const openEditDialog = useCallback(async (id: string) => {
    setEditorMode("edit")
    setEditingId(id)
    setEditorValues(EMPTY_FORM_VALUES)
    setEditorOpen(true)
    setEditorLoading(true)
    setEditorError("")

    try {
      const token = readToken()
      if (!token) return

      const rec = await fetch__Thing__({ apiUrl, accessToken: token, id, organizationId })
      setEditorValues({
        // FIELDS: one line per form field ("Edit-load" column)
        name: rec.name ?? "",
        code: rec.code ?? "",
        remarks: rec.remarks ?? "",
        isActive: rec.isActive !== false,
      })
    } catch (caught) {
      const message = errorMessage(caught, "Unable to load the selected __label__.")
      if (!handleAuthFailure(message)) {
        setEditorError(message)
        toast.error(message)
      }
    } finally {
      setEditorLoading(false)
    }
  }, [apiUrl, handleAuthFailure, organizationId, readToken])

  const submitEditor = useCallback(async (values: __Thing__FormValues) => {
    // FIELDS: one check per required field (match the backend validator's messages where sensible)
    if (!values.name.trim()) {
      setEditorError("__Label__ name is required.")
      return
    }

    setEditorSubmitting(true)
    setEditorError("")

    try {
      const token = readToken()
      if (!token) return

      if (editorMode === "create") {
        await create__Thing__({ apiUrl, accessToken: token, values, organizationId })
        toast.success("__Label__ created successfully.")
      } else if (editingId != null) {
        await update__Thing__({ apiUrl, accessToken: token, id: editingId, values, organizationId })
        toast.success("__Label__ updated successfully.")
      }

      setEditorOpen(false)
      setEditorValues(EMPTY_FORM_VALUES)
      setEditingId(null)
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to save the __label__ right now.")
      if (!handleAuthFailure(message)) {
        setEditorError(message)
        toast.error(message)
      }
    } finally {
      setEditorSubmitting(false)
    }
  }, [apiUrl, editingId, editorMode, handleAuthFailure, organizationId, readToken, triggerRefresh])

  const confirmSoftDelete = useCallback(async () => {
    if (!deleteTarget || deleteWorking) return
    setDeleteWorking(true)

    try {
      const token = readToken()
      if (!token) return

      await softDelete__Thing__({ apiUrl, accessToken: token, id: deleteTarget.id, organizationId })
      setRecentlyDeleted(deleteTarget)
      setDeleteTarget(null)
      toast.success("__Label__ moved to deleted.")
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to delete the __label__ right now.")
      if (!handleAuthFailure(message)) toast.error(message)
    } finally {
      setDeleteWorking(false)
    }
  }, [apiUrl, deleteTarget, deleteWorking, handleAuthFailure, organizationId, readToken, triggerRefresh])

  function openPendingAction(__thing__: __Thing__Record, mode: Deleted__Thing__ActionMode) {
    setPendingTarget(__thing__)
    setPendingMode(mode)
  }

  const confirmPendingAction = useCallback(async () => {
    if (!pendingTarget || !pendingMode || pendingWorking) return
    setPendingWorking(true)

    try {
      const token = readToken()
      if (!token) return

      if (pendingMode === "restore") {
        await restore__Thing__({ apiUrl, accessToken: token, id: pendingTarget.id, organizationId })
        toast.success("__Label__ restored successfully.")
      } else {
        await permanentlyDelete__Thing__({ apiUrl, accessToken: token, id: pendingTarget.id, organizationId })
        toast.success("__Label__ deleted permanently.")
      }

      if (recentlyDeleted?.id === pendingTarget.id) setRecentlyDeleted(null)
      setPendingTarget(null)
      setPendingMode(null)
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to complete the action right now.")
      if (!handleAuthFailure(message)) toast.error(message)
    } finally {
      setPendingWorking(false)
    }
  }, [apiUrl, handleAuthFailure, organizationId, pendingMode, pendingTarget, pendingWorking, readToken, recentlyDeleted, triggerRefresh])

  const activeTotal = meta?.total ?? __things__.length
  const deletedTotal = deletedMeta?.total ?? deleted__Things__.length
  const activeOnPage = __things__.filter((row) => row.isActive !== false).length

  // Nothing has finished loading yet (also while redirecting to sign-in).
  if (!loaded) {
    return <WorkspaceSkeleton />
  }

  const header = (
    <Card className={CARD_CLASS}>
      <CardContent className="p-4 sm:p-8 sm:py-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              __EYEBROW__
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              __TITLE__
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Create, review, and maintain __label__ records.
            </p>

            {!error ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1">Total {activeTotal}</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">Active {activeOnPage}</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">Deleted {deletedTotal}</Badge>
                {recentlyDeleted ? (
                  <Badge variant="destructive" className="rounded-full px-3 py-1">Recently deleted</Badge>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={triggerRefresh} className="rounded-xl">
              <RefreshCcw className="size-3.5" />
              {error ? "Retry" : "Refresh"}
            </Button>
            {!error ? (
              <Button type="button" onClick={openCreateDialog} className="rounded-xl">
                <Plus className="size-3.5" />
                New __label__
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (error) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {header}
        <EmptyState title="Unable to load __labels__" description={error} actionLabel="Try again" onAction={triggerRefresh} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          {header}

          {recentlyDeleted ? (
            <Card className="border-amber-200 bg-amber-50/80 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">Recently deleted __label__</p>
                    <p className="text-sm text-amber-900/80 dark:text-amber-100/85">
                      {get__Thing__Label(recentlyDeleted)} was soft deleted and can still be restored.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-amber-300 bg-white/70 text-amber-950 hover:bg-white dark:border-amber-400/40 dark:bg-transparent dark:text-amber-50"
                      onClick={() => openPendingAction(recentlyDeleted, "restore")}
                    >
                      <Undo2 className="size-3.5" />
                      Restore
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => openPendingAction(recentlyDeleted, "permanent")}
                    >
                      <Trash2 className="size-3.5" />
                      Delete permanently
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Active__Thing__Section
            data={__things__}
            meta={meta}
            loading={loading}
            page={page}
            limit={limit}
            filters={activeFilters}
            onFilterChange={setActiveFilters}
            onPageChange={setPage}
            onLimitChange={setLimit}
            onCreate={openCreateDialog}
            onEdit={openEditDialog}
            onDelete={setDeleteTarget}
          />

          <Deleted__Thing__Section
            data={deleted__Things__}
            meta={deletedMeta}
            loading={loading}
            page={deletedPage}
            limit={deletedLimit}
            filters={deletedFilters}
            onFilterChange={setDeletedFilters}
            onPageChange={setDeletedPage}
            onLimitChange={setDeletedLimit}
            onOpenAction={openPendingAction}
          />
        </div>
      </ScrollArea>

      <__Thing__FormDialog
        open={editorOpen}
        loading={editorLoading}
        submitting={editorSubmitting}
        error={editorError}
        mode={editorMode}
        values={editorValues}
        onValuesChange={setEditorValues}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setEditorValues(EMPTY_FORM_VALUES)
            setEditorError("")
            setEditorLoading(false)
            setEditorSubmitting(false)
            setEditingId(null)
          }
        }}
        onSubmit={submitEditor}
      />

      <DeleteConfirmDialog
        open={Boolean(deleteTarget)}
        __thing__={deleteTarget}
        working={deleteWorking}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={confirmSoftDelete}
      />

      <DeletedActionDialog
        open={Boolean(pendingTarget && pendingMode)}
        action={pendingMode ?? "restore"}
        __thing__={pendingTarget}
        working={pendingWorking}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTarget(null)
            setPendingMode(null)
          }
        }}
        onConfirm={confirmPendingAction}
      />
    </div>
  )
}
```

> **Filters apply as you type.** The filters are part of `requestKey`, so each keystroke reloads (the
> previous request's result is discarded) — that is how Factory behaves; the Search button only resets to
> page 1. Keep it unless the user asks for search-on-submit (then hold a draft in the section and call
> `onFilterChange` on submit).
>
> **Don't bring back `setLoading(true)` / `void loadAll()` in an effect** (Factory's shape): it fails
> `react-hooks/set-state-in-effect`. Anything new the lists depend on goes into `requestKey` and the effect's deps.

---

## 7. `app/<route>/page.tsx`

```tsx
import { __Thing__Workspace } from "@/features/__module__/__file__/__file__-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <__Thing__Workspace apiUrl={apiUrl} />
}
```

The module's `layout.tsx` (e.g. `app/app-config/layout.tsx`) already supplies the shell, sidebar and
background — the page renders only the workspace. Do not add a layout per page.

---

## 8–10. Shared edits

```ts
// lib/o2s/rules/<module>.ts — next to the module's other crudRules lines
...crudRules("__resource__", "/<o2s-module-segment>/<o2s-thing-segment>", { label: "This __label__" }),

// lib/module-navigation.ts — in the right group's items
{
  label: "__TITLE__",
  href: "<route>",
  permissionMenuName: "__TITLE__",
},

// lib/o2s/menus.ts — MENU_NAME_TO_O2S, only when __TITLE__ !== the O2S menuName
"__TITLE__": "<O2S menuName>",
```
