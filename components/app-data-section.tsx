"use client"

import { type ReactNode, useState } from "react"
import { ChevronDown } from "lucide-react"
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { AppDataTable } from "@/components/app-data-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export type AppDataSectionProps<TData> = {
  /**
   * Leave out (with no `collapsible`) for a section without a header bar: the filters come first. Its badges and
   * actions then belong in the page header (`ModulePageHeader` badges / `actions`); `headerBadges`, `headerActions`
   * and `description` are not shown.
   */
  title?: ReactNode
  description?: ReactNode
  data: TData[]
  columns: ColumnDef<TData>[]
  loading?: boolean
  filters?: ReactNode
  headerActions?: ReactNode
  headerBadges?: ReactNode
  emptyState?: ReactNode
  mobileEmptyState?: ReactNode
  renderMobileItem?: (item: TData, index: number) => ReactNode
  getRowId?: (item: TData, index: number) => string
  pageSummary?: string
  page?: number
  totalPages?: number
  pageSize?: number
  pageSizeOptions?: number[]
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  controlsDisabled?: boolean
  loadingRows?: number
  mobileSkeletonClassName?: string
  leadingColumnIds?: string[]
  trailingColumnIds?: string[]
  columnClassNames?: Record<string, string>
  enableColumnResizing?: boolean
  columnResizeStorageKey?: string
  nonResizableColumnIds?: string[]
  minColumnWidth?: number
  maxColumnWidth?: number
  /** Clicking the header (or the chevron on its right) shows / hides the filters and the table. */
  collapsible?: boolean
  /** With `collapsible`: start collapsed. */
  defaultCollapsed?: boolean
}

export function AppDataSection<TData>({
  title,
  description,
  data,
  columns,
  loading = false,
  filters,
  headerActions,
  headerBadges,
  emptyState,
  mobileEmptyState,
  renderMobileItem,
  getRowId,
  pageSummary = "",
  page = 1,
  totalPages = 1,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  controlsDisabled = false,
  loadingRows = 5,
  mobileSkeletonClassName = "h-32 rounded-2xl",
  leadingColumnIds,
  trailingColumnIds,
  columnClassNames,
  enableColumnResizing = true,
  columnResizeStorageKey,
  nonResizableColumnIds,
  minColumnWidth,
  maxColumnWidth,
  collapsible = false,
  defaultCollapsed = false,
}: AppDataSectionProps<TData>) {
  const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed)
  const expanded = !collapsible || !collapsed
  const toggle = () => setCollapsed((value) => !value)
  const showHeader = title != null || collapsible

  // TanStack Table intentionally returns non-memoizable functions; the table stays local to this render boundary.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Card className="gap-0 overflow-hidden border-white/60 bg-white/80 py-0 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      {showHeader ? (
      <CardHeader
        className={`px-3 py-2 sm:px-4 ${expanded ? "border-b border-slate-200/70 dark:border-white/10 [.border-b]:pb-2" : ""} ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? toggle : undefined}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            {description ? (
              <CardDescription className="truncate">{description}</CardDescription>
            ) : null}
          </div>
          {headerBadges || headerActions || collapsible ? (
            <div className="flex flex-wrap items-center gap-2">
              {headerBadges}
              {headerActions ? (
                // An action button in the header must not also toggle the section.
                <div className="contents" onClick={(event) => event.stopPropagation()}>
                  {headerActions}
                </div>
              ) : null}
              {collapsible ? (
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={expanded ? "Collapse section" : "Expand section"}
                  className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation()
                    toggle()
                  }}
                >
                  <ChevronDown
                    className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      ) : null}

      {expanded ? (
      <>
      {filters ? (
        <CardContent className="px-3 py-2 sm:px-4">{filters}</CardContent>
      ) : null}

      <CardContent
        className={
          filters
            ? "border-t border-slate-200/70 p-0 dark:border-white/10"
            : "p-0"
        }
      >
        {renderMobileItem ? (
          <div className="lg:hidden">
            {loading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: loadingRows }).map((_, index) => (
                  <Skeleton key={index} className={mobileSkeletonClassName} />
                ))}
              </div>
            ) : data.length > 0 ? (
              <div className="space-y-3 p-4">
                {data.map((item, index) => (
                  <div key={getRowId?.(item, index) ?? index}>
                    {renderMobileItem(item, index)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4">{mobileEmptyState ?? emptyState}</div>
            )}

            <AppDataTable
              table={table}
              isLoading={false}
              controlsDisabled={controlsDisabled || loading}
              pageSummary={pageSummary}
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              pageSizeOptions={pageSizeOptions}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              loadingRows={0}
              hideTable
              enableColumnResizing={enableColumnResizing}
              columnResizeStorageKey={columnResizeStorageKey}
              nonResizableColumnIds={nonResizableColumnIds}
              minColumnWidth={minColumnWidth}
              maxColumnWidth={maxColumnWidth}
            />
          </div>
        ) : null}

        <div className={renderMobileItem ? "hidden lg:block" : undefined}>
          <AppDataTable
            table={table}
            isLoading={loading}
            controlsDisabled={controlsDisabled}
            emptyState={emptyState}
            pageSummary={pageSummary}
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            loadingRows={loadingRows}
            leadingColumnIds={leadingColumnIds}
            trailingColumnIds={trailingColumnIds}
            columnClassNames={columnClassNames}
            enableColumnResizing={enableColumnResizing}
            columnResizeStorageKey={columnResizeStorageKey}
            nonResizableColumnIds={nonResizableColumnIds}
            minColumnWidth={minColumnWidth}
            maxColumnWidth={maxColumnWidth}
          />
        </div>
      </CardContent>
      </>
      ) : null}
    </Card>
  )
}
