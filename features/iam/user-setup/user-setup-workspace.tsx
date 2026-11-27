"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Users } from "lucide-react"
import { toast } from "sonner"

import { ModulePageHeader } from "@/components/module-page-header"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isGlobalAdmin, parseStoredAuthUser } from "@/lib/auth-session"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { OneTimePasswordDialog } from "./component/one-time-password-dialog"
import { UserSetupFormDialog } from "./component/user-setup-form-dialog"
import { getUserSetupLabel, UserSetupSection } from "./component/user-setup-section"
import {
  createUserSetup,
  fetchUserSetupList,
  issueOneTimePassword,
  setUserSetupStatus,
  updateUserSetup,
} from "./user-setup.service"
import {
  EMPTY_FILTERS,
  EMPTY_FORM_VALUES,
  type OneTimePasswordResult,
  type PaginationMeta,
  type UserSetupFilterValues,
  type UserSetupFormValues,
  type UserSetupRecord,
} from "./user-setup.types"

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
              <div className="h-72 rounded-2xl bg-slate-100 dark:bg-slate-900" />
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}

export function UserSetupWorkspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()

  const [refreshVersion, setRefreshVersion] = useState(0)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  const [currentUser] = useState(() =>
    typeof window === "undefined" ? null : parseStoredAuthUser(window.localStorage.getItem("auth_user")),
  )

  const [users, setUsers] = useState<UserSetupRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [filters, setFilters] = useState<UserSetupFilterValues>(EMPTY_FILTERS)

  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorValues, setEditorValues] = useState<UserSetupFormValues>(EMPTY_FORM_VALUES)
  const [editorSubmitting, setEditorSubmitting] = useState(false)
  const [editorError, setEditorError] = useState("")

  const [passwordTarget, setPasswordTarget] = useState<UserSetupRecord | null>(null)
  const [passwordResult, setPasswordResult] = useState<OneTimePasswordResult | null>(null)
  const [passwordKey, setPasswordKey] = useState(0)
  const [passwordWorking, setPasswordWorking] = useState(false)

  const [statusTarget, setStatusTarget] = useState<UserSetupRecord | null>(null)
  const [statusWorking, setStatusWorking] = useState(false)

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

    fetchUserSetupList({ apiUrl, accessToken: token, organizationId, page, limit, filters })
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

  function openCreate() {
    setEditorMode("create")
    setEditorKey((current) => current + 1)
    setEditingId(null)
    setEditorValues(EMPTY_FORM_VALUES)
    setEditorError("")
  }

  const openEdit = useCallback((user: UserSetupRecord) => {
    setEditorMode("edit")
    setEditorKey((current) => current + 1)
    setEditingId(user.userId)
    setEditorValues({
      ...EMPTY_FORM_VALUES,
      userName: user.userName,
      firstName: user.firstName ?? "",
      lastName: user.lastName ?? "",
      email: user.email ?? "",
      phoneNumber: user.phoneNumber ?? "",
      role: user.role,
    })
    setEditorError("")
  }, [])

  async function submitEditor() {
    if (!editorValues.userName.trim()) {
      setEditorError("A user name is required.")
      return
    }
    const token = readToken()
    if (!token) return
    setEditorSubmitting(true)
    setEditorError("")
    try {
      if (editorMode === "create") {
        const result = await createUserSetup({ apiUrl, accessToken: token, organizationId, values: editorValues })
        toast.success(`${getUserSetupLabel(result.user)} can now sign in with the one-time password.`)
        setEditorMode(null)
        setPasswordKey((current) => current + 1)
        setPasswordResult(result)
      } else if (editingId) {
        await updateUserSetup({ apiUrl, accessToken: token, organizationId, userId: editingId, values: editorValues })
        toast.success("User updated.")
        setEditorMode(null)
      }
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to save the user right now.")
      if (!handleAuthFailure(message)) {
        setEditorError(message)
        toast.error(message)
      }
    } finally {
      setEditorSubmitting(false)
    }
  }

  const openIssuePassword = useCallback((user: UserSetupRecord) => {
    setPasswordKey((current) => current + 1)
    setPasswordResult(null)
    setPasswordTarget(user)
  }, [])

  async function issuePassword(sendEmail: boolean) {
    if (!passwordTarget) return
    const token = readToken()
    if (!token) return
    setPasswordWorking(true)
    try {
      const result = await issueOneTimePassword({ apiUrl, accessToken: token, organizationId, userId: passwordTarget.userId, sendEmail })
      setPasswordTarget(null)
      setPasswordResult(result)
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to issue a one-time password right now.")
      if (!handleAuthFailure(message)) toast.error(message)
    } finally {
      setPasswordWorking(false)
    }
  }

  async function confirmStatus() {
    if (!statusTarget) return
    const token = readToken()
    if (!token) return
    setStatusWorking(true)
    try {
      const next = !statusTarget.isActive
      await setUserSetupStatus({ apiUrl, accessToken: token, organizationId, userId: statusTarget.userId, isActive: next })
      toast.success(`${getUserSetupLabel(statusTarget)} is ${next ? "active" : "inactive"} in this organization.`)
      setStatusTarget(null)
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to change the user's status right now.")
      if (!handleAuthFailure(message)) toast.error(message)
    } finally {
      setStatusWorking(false)
    }
  }

  // Nothing has finished loading yet (also while redirecting to sign-in).
  if (!loaded) return <WorkspaceSkeleton />

  const total = meta?.total ?? users.length
  const pendingOnPage = users.filter((user) => user.mustChangePassword).length

  const header = (
    <ModulePageHeader
      eyebrow="Identity & access"
      title="User Setup"
      description="Create logins with a one-time password and manage this organization's users."
      badges={
        error
          ? []
          : [
              { label: `Users ${total}`, variant: "secondary" },
              ...(pendingOnPage > 0 ? [{ label: `Awaiting first sign-in ${pendingOnPage}`, variant: "outline" as const }] : []),
            ]
      }
      onRefresh={triggerRefresh}
      onCreate={error ? undefined : openCreate}
      createLabel="New user"
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
          <UserSetupSection
            data={users}
            meta={meta}
            page={page}
            limit={limit}
            loading={loading}
            filters={filters}
            currentUserId={currentUser?.id ?? ""}
            isGlobalAdmin={isGlobalAdmin(currentUser)}
            onFilterChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
            onPageChange={setPage}
            onLimitChange={setLimit}
            onEdit={openEdit}
            onIssuePassword={openIssuePassword}
            onToggleActive={setStatusTarget}
          />
        </div>
      </ScrollArea>

      <UserSetupFormDialog
        key={`editor-${editorKey}`}
        open={editorMode !== null}
        mode={editorMode ?? "create"}
        values={editorValues}
        submitting={editorSubmitting}
        error={editorError}
        onValuesChange={setEditorValues}
        onOpenChange={(open) => {
          if (!open) setEditorMode(null)
        }}
        onSubmit={() => void submitEditor()}
      />

      <OneTimePasswordDialog
        key={`password-${passwordKey}`}
        target={passwordTarget}
        result={passwordResult}
        working={passwordWorking}
        onIssue={(sendEmail) => void issuePassword(sendEmail)}
        onClose={() => {
          setPasswordTarget(null)
          setPasswordResult(null)
        }}
      />

      <AlertDialog open={Boolean(statusTarget)} onOpenChange={(open) => (!open && !statusWorking ? setStatusTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusTarget?.isActive ? "Deactivate in this organization" : "Activate in this organization"}</AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.isActive
                ? `${statusTarget ? getUserSetupLabel(statusTarget) : "This user"} loses access to this organization at once. Their login and other organizations are not touched.`
                : `${statusTarget ? getUserSetupLabel(statusTarget) : "This user"} gets access to this organization again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={statusTarget?.isActive ? "destructive" : "default"}
              disabled={statusWorking}
              onClick={(event) => {
                event.preventDefault()
                void confirmStatus()
              }}
            >
              {statusWorking ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {statusTarget?.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
