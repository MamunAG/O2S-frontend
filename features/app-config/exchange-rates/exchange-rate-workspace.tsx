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
import { createExchangeRate, deleteExchangeRates, fetchExchangeRateMatrix, rerunExchangeRates, updateExchangeRateValue } from "./exchange-rate.service"
import {
  EMPTY_FILTERS,
  emptyFormValues,
  type ExchangeRateCell,
  type ExchangeRateFilterValues,
  type ExchangeRateFormValues,
  type ExchangeRateMatrixRow,
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

function describeRows(rows: ExchangeRateMatrixRow[]) {
  const rates = rows.reduce((total, row) => total + row.cells.length, 0)
  return rows.length === 1
    ? `the ${rates} ${rows[0].fromCurrencyCode} rate${rates === 1 ? "" : "s"} of that day`
    : `${rates} rates in ${rows.length} rows`
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

  const [rows, setRows] = useState<ExchangeRateMatrixRow[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  // Days per page (each day has a row per currency).
  const [limit, setLimit] = useState(5)
  const [filters, setFilters] = useState<ExchangeRateFilterValues>(EMPTY_FILTERS)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorSubmitting, setEditorSubmitting] = useState(false)
  const [editorError, setEditorError] = useState("")
  const [editorValues, setEditorValues] = useState<ExchangeRateFormValues>(emptyFormValues)

  const [deleteTargets, setDeleteTargets] = useState<ExchangeRateMatrixRow[]>([])
  const [deleteWorking, setDeleteWorking] = useState(false)
  const [rerunOpen, setRerunOpen] = useState(false)
  const [rerunWorking, setRerunWorking] = useState(false)
  // Why the last rerun could not fetch the rates (nothing was cleared then); shown in the dialog.
  const [rerunError, setRerunError] = useState("")

  const organizationId = selectedOrganizationId || undefined

  // Everything the list depends on. `loaded` records which request last finished, so "loading" and "error" are
  // derived instead of set inside the effect (react-hooks/set-state-in-effect).
  const requestKey = JSON.stringify([page, limit, filters, organizationId, refreshVersion])
  const [loaded, setLoaded] = useState<{ key: string; error: string } | null>(null)
  const loading = loaded?.key !== requestKey
  const error = !loading && loaded ? loaded.error : ""

  // The ticked rows belong to the list they were ticked on: a new page, filter or reload clears them.
  const [selection, setSelection] = useState<{ key: string; keys: string[] }>({ key: "", keys: [] })
  const selectedKeys = selection.key === requestKey ? selection.keys : []

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

    fetchExchangeRateMatrix({ apiUrl, accessToken: token, page, limit, filters, organizationId })
      .then((result) => {
        if (cancelled) return
        setRows(result.items)
        setCurrencies(result.currencies)
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
      const from = values.fromCurrencyCode.trim().toUpperCase()
      const to = values.toCurrencyCode.trim().toUpperCase()
      if (!/^[A-Z]{3,10}$/.test(from) || !/^[A-Z]{3,10}$/.test(to)) {
        setEditorError("Currency codes are 3 to 10 letters, e.g. USD and BDT.")
        return
      }
      if (from === to) {
        setEditorError("From and to currency must differ (a currency to itself is always 1).")
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
        // A pair that already had a rate that day is updated rather than added (the server says so by stamping it).
        toast.success(
          saved.updated_by_id
            ? `The ${saved.fromCurrencyCode} → ${saved.toCurrencyCode} rate of that day was updated to ${saved.rate}, with its reverse.`
            : `${saved.fromCurrencyCode} → ${saved.toCurrencyCode} rate added, with its reverse.`,
        )
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

  // A cell edit: saved at once; the server sets the reverse pair (to -> from = 1 / rate) too, so the page reloads.
  // Resolves true when saved, so the cell leaves edit mode.
  const saveRate = useCallback(
    async (row: ExchangeRateMatrixRow, cell: ExchangeRateCell, rate: string) => {
      if (Number(rate.replace(/,/g, "")) === cell.rate) return true

      const token = readToken()
      if (!token) return false

      try {
        const saved = await updateExchangeRateValue({ apiUrl, accessToken: token, id: cell.id, rate, organizationId })
        toast.success(`1 ${saved.fromCurrencyCode} = ${saved.rate} ${saved.toCurrencyCode} saved. The reverse rate was updated too.`)
        triggerRefresh()
        return true
      } catch (caught) {
        const message = errorMessage(caught, `Unable to update the ${row.fromCurrencyCode} → ${cell.toCurrencyCode} rate right now.`)
        if (!handleAuthFailure(message)) toast.error(message)
        return false
      }
    },
    [apiUrl, handleAuthFailure, organizationId, readToken, triggerRefresh],
  )

  const confirmDelete = useCallback(async () => {
    if (deleteTargets.length === 0 || deleteWorking) return
    const token = readToken()
    if (!token) return

    setDeleteWorking(true)
    try {
      const ids = deleteTargets.flatMap((row) => row.cells.map((cell) => cell.id))
      const deleted = await deleteExchangeRates({ apiUrl, accessToken: token, ids, organizationId })
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
    setRerunError("")
    try {
      const result = await rerunExchangeRates({ apiUrl, accessToken: token, organizationId })
      const codes = [...new Set(result.rates.map((rate) => rate.fromCurrencyCode))].join(", ")
      toast.success(
        `Fetched the latest rates: ${result.rates.length} pairs of ${codes || "none"}.` +
          (result.cleared ? ` ${result.cleared} of today's rate${result.cleared === 1 ? " was" : "s were"} replaced.` : ""),
      )
      setRerunOpen(false)
      triggerRefresh()
    } catch (caught) {
      // The server fetches before it clears: a failure here means the saved rates are untouched.
      const message = errorMessage(caught, "The exchange rates could not be fetched, so nothing was cleared.")
      if (!handleAuthFailure(message)) {
        setRerunError(message)
        toast.error(message)
      }
    } finally {
      setRerunWorking(false)
    }
  }, [apiUrl, handleAuthFailure, organizationId, readToken, rerunWorking, triggerRefresh])

  const totalDays = meta?.total ?? 0
  const manualOnPage = rows.reduce((total, row) => total + row.cells.filter((cell) => cell.isManual).length, 0)

  // Nothing has finished loading yet (also while redirecting to sign-in).
  if (!loaded) {
    return <WorkspaceSkeleton />
  }

  const rerunButton = (
    <Button
      type="button"
      variant="outline"
      className="rounded-xl"
      onClick={() => {
        setRerunError("")
        setRerunOpen(true)
      }}
      disabled={rerunWorking}
    >
      {rerunWorking ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
      Rerun latest
    </Button>
  )

  const header = (
    <ModulePageHeader
      eyebrow="App configuration · Data"
      title="Exchange Rates"
      description="Daily rates between every two currencies, shared by every company: 1 row currency × rate = the column currency. Click a rate to edit it; Rerun latest fetches today's rates again."
      badges={
        error
          ? []
          : [
              { label: `Days ${totalDays}`, variant: "secondary" },
              { label: `Currencies ${currencies.length}` },
              { label: `Edited by hand on page ${manualOnPage}` },
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

          {/* Inline-size containment: the wide currency grid scrolls inside its card instead of widening the page
              (the ScrollArea content grows to its widest child). */}
          <div className="min-w-0 [contain:inline-size]">
            <ActiveExchangeRateSection
              data={rows}
              currencies={currencies}
              meta={meta}
              loading={loading}
              page={page}
              limit={limit}
              filters={filters}
              selectedKeys={selectedKeys}
              onSelectedKeysChange={(keys) => setSelection({ key: requestKey, keys })}
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
              This permanently deletes {describeRows(deleteTargets)}. Provider rates can be fetched again with Rerun latest; a rate
              added by hand has to be added again.
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
              The provider&apos;s latest rates are fetched first. Only when they arrive are today&apos;s rates (Dhaka date) cleared,
              manual edits included, and replaced with them. If they cannot be fetched, nothing is cleared and you are told why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rerunError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {rerunError}
            </div>
          ) : null}
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
              {rerunError ? "Try again" : "Rerun latest"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
