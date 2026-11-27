"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, RotateCw } from "lucide-react"
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
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

import { ActiveExchangeRateSection } from "./component/active-exchange-rate-section"
import { ExchangeRateFormDialog } from "./component/exchange-rate-form-dialog"
import { createExchangeRate, deleteExchangeRates, fetchExchangeRates, rerunExchangeRates, updateExchangeRateValue } from "./exchange-rate.service"
import {
  EMPTY_FILTERS,
  emptyFormValues,
  type ExchangeRateFilterValues,
  type ExchangeRateFormValues,
  type ExchangeRateRecord,
  type PaginationMeta,
} from "./exchange-rate.types"

const CARD_CLASS =
  "overflow-hidden border-white/60 bg-white/85 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75"

function isAuthFailure(message: string) {
  const lower = message.toLowerCase()
  return lower.includes("session expired") || lower.includes("unauthorized")
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}

function describeRows(rows: ExchangeRateRecord[]) {
  return rows.length === 1 ? `the ${rows[0].currencyCode} rate` : `${rows.length} exchange rates`
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

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-2 sm:p-3 lg:p-4">
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
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  <div className="h-9 rounded-xl bg-slate-200 dark:bg-slate-800" />
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

export function ExchangeRateWorkspace({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()

  const [refreshVersion, setRefreshVersion] = useState(0)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )

  const [rates, setRates] = useState<ExchangeRateRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [filters, setFilters] = useState<ExchangeRateFilterValues>(EMPTY_FILTERS)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSubmitting, setEditorSubmitting] = useState(false)
  const [editorError, setEditorError] = useState("")
  const [editorValues, setEditorValues] = useState<ExchangeRateFormValues>(emptyFormValues)

  const [deleteTargets, setDeleteTargets] = useState<ExchangeRateRecord[]>([])
  const [deleteWorking, setDeleteWorking] = useState(false)
  const [rerunOpen, setRerunOpen] = useState(false)
  const [rerunWorking, setRerunWorking] = useState(false)

  const organizationId = selectedOrganizationId || undefined

  // Everything the list depends on. `loaded` records which request last finished, so "loading" and "error" are
  // derived instead of set inside the effect (react-hooks/set-state-in-effect).
  const requestKey = JSON.stringify([page, limit, filters, organizationId, refreshVersion])
  const [loaded, setLoaded] = useState<{ key: string; error: string } | null>(null)
  const loading = loaded?.key !== requestKey
  const error = !loading && loaded ? loaded.error : ""

  // The ticked rows belong to the list they were ticked on: a new page, filter or reload clears them.
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] })
  const selectedIds = selection.key === requestKey ? selection.ids : []

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

  // Loads the page; a newer request cancels the older one's result.
  useEffect(() => {
    const token = readToken()
    if (!token) return

    let cancelled = false

    fetchExchangeRates({ apiUrl, accessToken: token, page, limit, filters, organizationId })
      .then((result) => {
        if (cancelled) return
        setRates(result.items)
        setMeta(result.meta)
        setLoaded({ key: requestKey, error: "" })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const message = errorMessage(caught, "Unable to load exchange rates right now.")
        if (handleAuthFailure(message)) return
        toast.error(message)
        setLoaded({ key: requestKey, error: message })
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, filters, handleAuthFailure, limit, organizationId, page, readToken, requestKey])

  function openCreateDialog() {
    setEditorValues(emptyFormValues())
    setEditorError("")
    setEditorOpen(true)
  }

  const submitEditor = useCallback(
    async (values: ExchangeRateFormValues) => {
      if (!/^[A-Za-z]{3,10}$/.test(values.currencyCode.trim())) {
        setEditorError("Currency code is 3 to 10 letters, e.g. USD.")
        return
      }
      if (!values.currencyDate) {
        setEditorError("Date is required.")
        return
      }

      const token = readToken()
      if (!token) return

      setEditorSubmitting(true)
      setEditorError("")
      try {
        const saved = await createExchangeRate({ apiUrl, accessToken: token, values, organizationId })
        toast.success(`${saved.currencyCode} rate added.`)
        setEditorOpen(false)
        triggerRefresh()
      } catch (caught) {
        const message = errorMessage(caught, "Unable to save the exchange rate right now.")
        if (!handleAuthFailure(message)) {
          setEditorError(message)
          toast.error(message)
        }
      } finally {
        setEditorSubmitting(false)
      }
    },
    [apiUrl, handleAuthFailure, organizationId, readToken, triggerRefresh],
  )

  // The inline edit. Resolves true when saved, so the row leaves edit mode.
  const saveRate = useCallback(
    async (row: ExchangeRateRecord, rateInBdt: string) => {
      if (Number(rateInBdt) === row.rateInBdt) return true

      const token = readToken()
      if (!token) return false

      try {
        const saved = await updateExchangeRateValue({ apiUrl, accessToken: token, id: row.id, rateInBdt, organizationId })
        setRates((current) => current.map((r) => (r.id === saved.id ? saved : r)))
        toast.success(`${saved.currencyCode} rate updated. It is now marked Manual.`)
        return true
      } catch (caught) {
        const message = errorMessage(caught, "Unable to update the exchange rate right now.")
        if (!handleAuthFailure(message)) toast.error(message)
        return false
      }
    },
    [apiUrl, handleAuthFailure, organizationId, readToken],
  )

  const confirmDelete = useCallback(async () => {
    if (deleteTargets.length === 0 || deleteWorking) return
    const token = readToken()
    if (!token) return

    setDeleteWorking(true)
    try {
      const deleted = await deleteExchangeRates({ apiUrl, accessToken: token, ids: deleteTargets.map((row) => row.id), organizationId })
      toast.success(deleted === 1 ? "Exchange rate deleted." : `${deleted} exchange rates deleted.`)
      setDeleteTargets([])
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to delete the exchange rates right now.")
      if (!handleAuthFailure(message)) toast.error(message)
    } finally {
      setDeleteWorking(false)
    }
  }, [apiUrl, deleteTargets, deleteWorking, handleAuthFailure, organizationId, readToken, triggerRefresh])

  const confirmRerun = useCallback(async () => {
    if (rerunWorking) return
    const token = readToken()
    if (!token) return

    setRerunWorking(true)
    try {
      const result = await rerunExchangeRates({ apiUrl, accessToken: token, organizationId })
      const codes = result.rates.map((rate) => rate.currencyCode).join(", ")
      toast.success(
        `Fetched the latest rates (${codes || "none"}).` +
          (result.cleared ? ` ${result.cleared} of today's rate${result.cleared === 1 ? " was" : "s were"} replaced.` : ""),
      )
      setRerunOpen(false)
      triggerRefresh()
    } catch (caught) {
      const message = errorMessage(caught, "Unable to fetch the latest exchange rates right now.")
      if (!handleAuthFailure(message)) toast.error(message)
    } finally {
      setRerunWorking(false)
    }
  }, [apiUrl, handleAuthFailure, organizationId, readToken, rerunWorking, triggerRefresh])

  const total = meta?.total ?? rates.length
  const manualOnPage = rates.filter((row) => row.isManual).length

  // Nothing has finished loading yet (also while redirecting to sign-in).
  if (!loaded) {
    return <WorkspaceSkeleton />
  }

  const rerunButton = (
    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setRerunOpen(true)} disabled={rerunWorking}>
      {rerunWorking ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
      Rerun latest
    </Button>
  )

  const header = (
    <ModulePageHeader
      eyebrow="App configuration · Data"
      title="Exchange Rates"
      description="Daily currency rates in BDT, shared by every company. Click a rate to edit it; Rerun latest fetches today's rates again."
      badges={
        error
          ? []
          : [
              { label: `Total ${total}`, variant: "secondary" },
              { label: `Manual on page ${manualOnPage}` },
            ]
      }
      onRefresh={triggerRefresh}
      onCreate={error ? undefined : openCreateDialog}
      createLabel="New rate"
      actions={error ? undefined : rerunButton}
    />
  )

  if (error) {
    return (
      <div className="space-y-4 p-2 sm:p-3 lg:p-4">
        {header}
        <EmptyState title="Unable to load exchange rates" description={error} actionLabel="Try again" onAction={triggerRefresh} />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-2 sm:p-3 lg:p-4">
          {header}

          <ActiveExchangeRateSection
            data={rates}
            meta={meta}
            loading={loading}
            page={page}
            limit={limit}
            filters={filters}
            selectedIds={selectedIds}
            onSelectedIdsChange={(ids) => setSelection({ key: requestKey, ids })}
            onFilterChange={(next) => {
              setFilters(next)
              setPage(1)
            }}
            onPageChange={setPage}
            onLimitChange={setLimit}
            onSaveRate={saveRate}
            onDelete={setDeleteTargets}
          />
        </div>
      </ScrollArea>

      <ExchangeRateFormDialog
        open={editorOpen}
        submitting={editorSubmitting}
        error={editorError}
        values={editorValues}
        onValuesChange={setEditorValues}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) {
            setEditorError("")
            setEditorSubmitting(false)
          }
        }}
        onSubmit={submitEditor}
      />

      <AlertDialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setDeleteTargets([])
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? "exchange rate" : "exchange rates"}</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {describeRows(deleteTargets)}. A provider rate can be fetched again with Rerun latest; a manual
              rate has to be added again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()} disabled={deleteWorking}>
              {deleteWorking ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rerunOpen} onOpenChange={(open) => !rerunWorking && setRerunOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rerun the latest exchange rates?</AlertDialogTitle>
            <AlertDialogDescription>
              Today&apos;s rates (Dhaka date) are cleared, manual edits included, and the provider&apos;s latest rates are fetched and
              saved. If the provider cannot be reached, nothing is cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rerunWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmRerun()
              }}
              disabled={rerunWorking}
            >
              {rerunWorking ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
              Rerun latest
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
