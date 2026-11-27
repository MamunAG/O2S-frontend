"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"
import { toast } from "sonner"

import { ModulePageHeader } from "@/components/module-page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { UserFactoryDialog } from "./component/user-factory-dialog"
import { getUserLabel, UserFactoryUsersSection } from "./component/user-factory-users-section"
import { fetchUserFactoryAccess, fetchUserFactorySummaries, saveUserFactoryAccess } from "./user-factory-permission.service"
import {
  EMPTY_FILTERS,
  type PaginationMeta,
  type UserFactoryAccessRecord,
  type UserFactoryFilterValues,
  type UserFactorySummaryRecord,
} from "./user-factory-permission.types"

const CARD_CLASS =
  "overflow-hidden border-white/60 bg-white/85 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75"

function isAuthFailure(message: string) {
  const lower = message.toLowerCase()
  return lower.includes("session expired") || lower.includes("unauthorized")
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-2 sm:p-3 lg:p-4">
          <Card className={CARD_CLASS}>
            <CardContent className="px-3 py-2 sm:px-4">
              <div className="space-y-2">
                <div className="h-6 w-56 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-full max-w-md rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
            </CardContent>
          </Card>
          <Card className={CARD_CLASS}>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                </div>
                <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-900" />
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}

export function UserFactoryPermissionWorkspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()

  const [refreshVersion, setRefreshVersion] = useState(0)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )

  const [users, setUsers] = useState<UserFactorySummaryRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [filters, setFilters] = useState<UserFactoryFilterValues>(EMPTY_FILTERS)

  const [dialogTarget, setDialogTarget] = useState<UserFactorySummaryRecord | null>(null)
  const [dialogKey, setDialogKey] = useState(0)
  const [dialogLoading, setDialogLoading] = useState(false)
  const [dialogSaving, setDialogSaving] = useState(false)
  const [dialogError, setDialogError] = useState("")
  const [dialogRecord, setDialogRecord] = useState<UserFactoryAccessRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const organizationId = selectedOrganizationId || undefined

  // `loaded` records which request last finished, so "loading" and "error" are derived, not set in the effect.
  const requestKey = JSON.stringify([page, limit, filters, organizationId, refreshVersion])
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
      setDialogTarget(null)
    }

    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
  }, [])

  const triggerRefresh = useCallback(() => setRefreshVersion((current) => current + 1), [])

  // A newer request cancels the older one's result.
  useEffect(() => {
    const token = readToken()
    if (!token) return

    let cancelled = false

    fetchUserFactorySummaries({ apiUrl, accessToken: token, organizationId, page, limit, filters })
      .then((result) => {
        if (cancelled) return
        setUsers(result.items)
        setMeta(result.meta)
        setLoaded({ key: requestKey, error: "" })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const message = errorMessage(caught, "Unable to load users right now.")
        if (handleAuthFailure(message)) return
        toast.error(message)
        setLoaded({ key: requestKey, error: message })
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, filters, handleAuthFailure, limit, organizationId, page, readToken, requestKey])

  const openDialog = useCallback(async (user: UserFactorySummaryRecord) => {
    setDialogTarget(user)
    setDialogKey((current) => current + 1)
    setDialogRecord(null)
    setSelectedIds([])
    setDialogError("")
    setDialogLoading(true)

    try {
      const token = readToken()
      if (!token) return

      const record = await fetchUserFactoryAccess({ apiUrl, accessToken: token, organizationId, userId: user.userId })
      setDialogRecord(record)
      setSelectedIds(record.factoryIds)
    } catch (caught) {
      const message = errorMessage(caught, "Unable to load this user's factories.")
      if (!handleAuthFailure(message)) {
        setDialogError(message)
        toast.error(message)
      }
    } finally {
      setDialogLoading(false)
    }
  }, [apiUrl, handleAuthFailure, organizationId, readToken])

  const saveDialog = useCallback(async () => {
    if (!dialogTarget || dialogSaving) return
    setDialogSaving(true)
    setDialogError("")

    try {
      const token = readToken()
      if (!token) return

      await saveUserFactoryAccess({
        apiUrl,
        accessToken: token,
        organizationId,
        userId: dialogTarget.userId,
        factoryIds: selectedIds,
      })
      toast.success(`Factory access saved for ${getUserLabel(dialogTarget)}.`)
      setDialogTarget(null)
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to save factory access right now.")
      if (!handleAuthFailure(message)) {
        setDialogError(message)
        toast.error(message)
      }
    } finally {
      setDialogSaving(false)
    }
  }, [apiUrl, dialogSaving, dialogTarget, handleAuthFailure, organizationId, readToken, selectedIds, triggerRefresh])

  // Nothing has finished loading yet (also while redirecting to sign-in).
  if (!loaded) {
    return <WorkspaceSkeleton />
  }

  const total = meta?.total ?? users.length
  const withoutFactories = users.filter((user) => !user.isUnrestricted && user.noOfFactories === 0).length

  const header = (
    <ModulePageHeader
      eyebrow="Identity & access"
      title="User Factory Permission"
      description="Choose which factories each user may work with in this organization."
      badges={
        error
          ? []
          : [
              { label: `Users ${total}`, variant: "secondary" },
              ...(withoutFactories > 0 ? [{ label: `No factories ${withoutFactories}`, variant: "outline" as const }] : []),
            ]
      }
      onRefresh={triggerRefresh}
    />
  )

  if (error) {
    return (
      <div className="space-y-4 p-2 sm:p-3 lg:p-4">
        {header}
        <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center dark:border-white/10 dark:bg-slate-950/60">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <Users className="size-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">Unable to load users</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">{error}</p>
          <Button type="button" onClick={triggerRefresh} className="mt-6 rounded-xl">
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-2 sm:p-3 lg:p-4">
          {header}

          <UserFactoryUsersSection
            data={users}
            meta={meta}
            loading={loading}
            page={page}
            limit={limit}
            filters={filters}
            onFilterChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
            onPageChange={setPage}
            onLimitChange={setLimit}
            onManage={openDialog}
          />
        </div>
      </ScrollArea>

      <UserFactoryDialog
        key={dialogKey}
        open={Boolean(dialogTarget)}
        userLabel={dialogTarget ? getUserLabel(dialogTarget) : ""}
        loading={dialogLoading}
        saving={dialogSaving}
        error={dialogError}
        record={dialogRecord}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onOpenChange={(open) => {
          if (!open && !dialogSaving) setDialogTarget(null)
        }}
        onSave={saveDialog}
      />
    </div>
  )
}
