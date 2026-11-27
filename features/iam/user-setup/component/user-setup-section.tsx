"use client"

import { useMemo, useState } from "react"

import { KeyRound, MoreHorizontal, Pencil, Power, Users } from "lucide-react"
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

import { EMPTY_FILTERS, type PaginationMeta, type UserSetupFilterValues, type UserSetupRecord } from "../user-setup.types"

const ALL = "__all__"

type UserSetupSectionProps = {
  data: UserSetupRecord[]
  meta: PaginationMeta | null
  page: number
  limit: number
  loading: boolean
  filters: UserSetupFilterValues
  /** The signed-in user (never changed here) and whether they are a global admin (may change any login). */
  currentUserId: string
  isGlobalAdmin: boolean
  onFilterChange: (next: UserSetupFilterValues) => void
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onEdit: (user: UserSetupRecord) => void
  onIssuePassword: (user: UserSetupRecord) => void
  onToggleActive: (user: UserSetupRecord) => void
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

export function getUserSetupLabel(user: Pick<UserSetupRecord, "fullName" | "userName">) {
  return user.fullName?.trim() || user.userName
}

function PasswordBadge({ user, now }: { user: UserSetupRecord; now: number }) {
  if (!user.mustChangePassword) {
    return <Badge variant="outline" className="rounded-full px-2 py-0">Own password</Badge>
  }
  const expired = user.temporaryPasswordExpiresAt ? new Date(user.temporaryPasswordExpiresAt).getTime() < now : false
  return (
    <Badge
      variant="outline"
      className={expired
        ? "rounded-full border-red-300 px-2 py-0 text-red-700 dark:border-red-400/40 dark:text-red-300"
        : "rounded-full border-amber-300 px-2 py-0 text-amber-700 dark:border-amber-400/40 dark:text-amber-300"}
      title={user.temporaryPasswordExpiresAt ? `Expires ${formatDate(user.temporaryPasswordExpiresAt)}` : undefined}
    >
      {expired ? "One-time password expired" : "One-time password"}
    </Badge>
  )
}

function RowActions({
  user,
  currentUserId,
  isGlobalAdmin,
  onEdit,
  onIssuePassword,
  onToggleActive,
}: {
  user: UserSetupRecord
  currentUserId: string
  isGlobalAdmin: boolean
  onEdit: (user: UserSetupRecord) => void
  onIssuePassword: (user: UserSetupRecord) => void
  onToggleActive: (user: UserSetupRecord) => void
}) {
  const isSelf = user.userId === currentUserId
  // The login itself is this organization's to change only when the user belongs to it alone.
  const accountLocked = !isGlobalAdmin && (!user.isOnlyThisOrganization || user.isGlobalAdmin)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" className="size-7 rounded-full" disabled={isSelf} title={isSelf ? "You can't change yourself here" : undefined}>
          <MoreHorizontal className="size-3.5" />
          <span className="sr-only">Open actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={accountLocked} onSelect={() => onEdit(user)}>
          <Pencil className="size-3.5" />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem disabled={accountLocked} onSelect={() => onIssuePassword(user)}>
          <KeyRound className="size-3.5" />
          New one-time password
        </DropdownMenuItem>
        {accountLocked ? (
          <p className="px-2 pb-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            Belongs to other organizations too: only they (or a global admin) can change this login.
          </p>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant={user.isActive ? "destructive" : "default"} onSelect={() => onToggleActive(user)}>
          <Power className="size-3.5" />
          {user.isActive ? "Deactivate in this organization" : "Activate in this organization"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center shadow-[0_20px_80px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
        <Users className="size-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">No users found</h3>
      <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">Try clearing or relaxing the current filters.</p>
      <Button type="button" onClick={onReset} className="mt-6 rounded-xl">
        Reset
      </Button>
    </div>
  )
}

export function UserSetupSection({
  data,
  meta,
  page,
  limit,
  loading,
  filters,
  currentUserId,
  isGlobalAdmin,
  onFilterChange,
  onPageChange,
  onLimitChange,
  onEdit,
  onIssuePassword,
  onToggleActive,
}: UserSetupSectionProps) {
  // "Expired" is judged against when the list was opened (a refresh reloads it).
  const [now] = useState(() => Date.now())
  const pageSummary = useMemo(() => {
    if (!meta || meta.total === 0) return "No users found"
    const start = (meta.page - 1) * meta.limit + 1
    const end = Math.min(meta.page * meta.limit, meta.total)
    return `Showing ${start}-${end} of ${meta.total}`
  }, [meta])

  const columns = useMemo<ColumnDef<UserSetupRecord>[]>(() => [
    {
      id: "user",
      header: "User",
      cell: ({ row }) => (
        <div className="min-w-0 pl-4">
          <p className="truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{getUserSetupLabel(row.original)}</p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{row.original.userName}</p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Email / phone",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-xs text-slate-700 dark:text-slate-200">{row.original.email || "-"}</p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{row.original.phoneNumber || ""}</p>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.role === "admin" ? "default" : "secondary"} className="rounded-full px-2 py-0">
          {row.original.role === "admin" ? "Admin" : "User"}
        </Badge>
      ),
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
      id: "password",
      header: "Password",
      cell: ({ row }) => <PasswordBadge user={row.original} now={now} />,
    },
    {
      id: "lastSeen",
      header: "Last login",
      cell: ({ row }) => <p className="text-xs text-slate-700 dark:text-slate-200">{row.original.lastSeenAt ? formatDate(row.original.lastSeenAt) : "Never"}</p>,
    },
    {
      id: "actions",
      header: () => <span className="pr-4">Actions</span>,
      cell: ({ row }) => (
        <div className="pr-4 text-right">
          <RowActions
            user={row.original}
            currentUserId={currentUserId}
            isGlobalAdmin={isGlobalAdmin}
            onEdit={onEdit}
            onIssuePassword={onIssuePassword}
            onToggleActive={onToggleActive}
          />
        </div>
      ),
    },
  ], [currentUserId, isGlobalAdmin, now, onEdit, onIssuePassword, onToggleActive])

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
      onPageSizeChange={(next) => {
        onLimitChange(next)
        onPageChange(1)
      }}
      getRowId={(user) => user.userId}
      emptyState={<EmptyState onReset={clearFilters} />}
      columnClassNames={{
        user: "h-8 py-1",
        contact: "h-8 py-1",
        role: "h-8 py-1",
        status: "h-8 py-1",
        password: "h-8 py-1",
        lastSeen: "h-8 py-1",
        actions: "h-8 py-1",
      }}
      filters={
        <AppDataFilterForm
          fields={[
            {
              id: "filterUserSetupSearch",
              label: "User",
              kind: "text",
              value: filters.search,
              placeholder: "Name, user name, email or phone",
              onValueChange: (search) => onFilterChange({ ...filters, search }),
            },
            {
              id: "filterUserSetupRole",
              label: "Role",
              kind: "select",
              value: filters.role || ALL,
              placeholder: "All roles",
              options: [
                { value: ALL, label: "All roles" },
                { value: "admin", label: "Admin" },
                { value: "user", label: "User" },
              ],
              onValueChange: (value) => onFilterChange({ ...filters, role: value === ALL ? "" : value }),
            },
            {
              id: "filterUserSetupStatus",
              label: "Status",
              kind: "select",
              value: filters.isActive || ALL,
              placeholder: "All statuses",
              options: [
                { value: ALL, label: "All statuses" },
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
              onValueChange: (value) => onFilterChange({ ...filters, isActive: value === ALL ? "" : value }),
            },
            {
              id: "filterUserSetupPassword",
              label: "Password",
              kind: "select",
              value: filters.mustChangePassword || ALL,
              placeholder: "Any password",
              options: [
                { value: ALL, label: "Any password" },
                { value: "true", label: "One-time password" },
                { value: "false", label: "Own password" },
              ],
              onValueChange: (value) => onFilterChange({ ...filters, mustChangePassword: value === ALL ? "" : value }),
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
              <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{getUserSetupLabel(user)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.userName}{user.email ? ` · ${user.email}` : ""}</p>
            </div>
            <RowActions
              user={user}
              currentUserId={currentUserId}
              isGlobalAdmin={isGlobalAdmin}
              onEdit={onEdit}
              onIssuePassword={onIssuePassword}
              onToggleActive={onToggleActive}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={user.role === "admin" ? "default" : "secondary"} className="rounded-full px-2 py-0">{user.role === "admin" ? "Admin" : "User"}</Badge>
            <Badge variant={user.isActive ? "secondary" : "outline"} className="rounded-full px-2 py-0">{user.isActive ? "Active" : "Inactive"}</Badge>
            <PasswordBadge user={user} now={now} />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Last login: {user.lastSeenAt ? formatDate(user.lastSeenAt) : "Never"}</p>
        </article>
      )}
    />
  )
}
