"use client"

// The GMT Booking entry dialog: one booking per PO + style, made from its GMT budget. Refresh New Data
// works every row out from the budget now (refresh-from-budget); Load Saved Data puts the saved rows back.
// The grids are read-only, as on the desktop. Ported from ClickERP's gmt-booking-form; the look is this
// app's entry dialog.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Boxes, Calculator, Database, FileText, History, Info, Layers, Loader2, MessageSquare, RefreshCcw, Scissors, Spool } from "lucide-react"
import { toast } from "sonner"

import { AppCombobox, type AppComboboxLoadParams } from "@/components/app-combobox"
import { AppConfirmDialog } from "@/components/app-confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { COMBO_CONTENT_CLASS, FIELD_CLASS, FieldLabel, INPUT_CLASS, LookupCombobox, SECTION_CARD_CLASS, TD_CLASS, TH_CLASS, formatDate, formatNumber } from "../../gmt-costing/component/gmt-ui"
import { loadBuyerOptions, type ApiContext } from "../../gmt-costing/gmt-costing.api"
import { readSettings } from "../../gmt-costing/gmt-costing.calc"
import type { AccessRules } from "../../gmt-costing/gmt-costing.types"
import { loadFabricSourceOptions, loadSpecialTreatmentOptions } from "../../gmt-budget/gmt-budget.api"
import { CommentsSection, RevisionSection, SpecialTreatmentSection } from "../../gmt-budget/component/gmt-budget-sections"
import { createBooking, fetchBooking, fetchBookingByPoStyle, fetchBudgetedPoStyles, refreshFromBudget, updateBooking } from "../gmt-booking.api"
import {
  bookingFromDto,
  bookingToDto,
  consumptionOf,
  emptyBooking,
  fabricSummaryOf,
  isFabricRow,
  isYarnOfFabric,
  otherSummaryOf,
  poQtyOf,
  totalsByUom,
  yarnGridRows,
  yarnSummaryOf,
  type YarnGridRow,
} from "../gmt-booking.calc"
import type { BookingFabricRow, BudgetedPoStyle, GmtBooking } from "../gmt-booking.types"

export type GmtBookingDialogMode = "create" | "edit" | "view"

type SectionId = "master" | "fabric" | "other" | "yarn" | "summary" | "notes" | "revisions"

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Info }> = [
  { id: "master", label: "Master Info", icon: Info },
  { id: "fabric", label: "Fabric", icon: Layers },
  { id: "other", label: "Other Items", icon: Boxes },
  { id: "yarn", label: "Yarn", icon: Spool },
  { id: "summary", label: "Summary", icon: Calculator },
  { id: "notes", label: "Treatments & Comments", icon: MessageSquare },
  { id: "revisions", label: "Revisions", icon: History },
]

// ---------- a read-only grid ----------

type Col<T> = { key: string; header: string; letter?: string; title?: string; width?: string; number?: number; value: (row: T) => ReactNode; highlight?: boolean }

function ReadGrid<T extends { clientId: string }>({
  rows,
  cols,
  minWidth,
  empty,
  rowClassName,
  onRowClick,
  footer,
}: {
  rows: T[]
  cols: Col<T>[]
  minWidth: string
  empty: string
  rowClassName?: (row: T) => string | undefined
  onRowClick?: (row: T) => void
  footer?: ReactNode
}) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-slate-200/70 pb-1 dark:border-white/10">
      <table className={cn("w-full border-collapse text-xs", minWidth)}>
        <thead className="bg-slate-50/80 dark:bg-white/5">
          <tr className="border-b">
            <th className={cn(TH_CLASS, "w-10")}>SL</th>
            {cols.map((c) => (
              <th key={c.key} title={c.title} className={cn(TH_CLASS, c.width, c.number !== undefined ? "text-right" : "", c.highlight ? "bg-sky-100 dark:bg-sky-900/60" : "")}>
                {c.header}
                {c.letter ? <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">{c.letter}</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length + 1} className="p-6 text-center text-slate-500">{empty}</td>
            </tr>
          ) : null}
          {rows.map((row, i) => (
            <tr key={row.clientId} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("border-b", onRowClick ? "cursor-pointer" : "", rowClassName?.(row) ?? "hover:bg-muted/40")}>
              <td className={cn(TD_CLASS, "tabular-nums")}>{i + 1}</td>
              {cols.map((c) => {
                const v = c.value(row)
                return (
                  <td key={c.key} className={cn(TD_CLASS, "h-7 whitespace-nowrap", c.number !== undefined ? "text-right tabular-nums" : "")}>
                    {c.number !== undefined && typeof v === "number" ? formatNumber(v, c.number) : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        {footer}
      </table>
    </div>
  )
}

const text = (v: string) => v || ""

const FABRIC_COLS: Col<BookingFabricRow>[] = [
  { key: "fabricItem", header: "Fabric", width: "min-w-52", value: (r) => text(r.fabricItem) },
  { key: "gmtParts", header: "GMT Parts", value: (r) => text(r.gmtParts) },
  { key: "gmtColor", header: "GMT Color", value: (r) => text(r.gmtColor) },
  { key: "gmtSize", header: "Size Group", value: (r) => text(r.gmtSize) },
  { key: "materialColor", header: "Fabric Color", value: (r) => text(r.materialColor) },
  { key: "finishDia", header: "Finish Dia", value: (r) => text(r.finishDia) },
  { key: "fabricGsm", header: "GSM", value: (r) => text(r.fabricGsm) },
  { key: "fabricForm", header: "Fabric Form", value: (r) => text(r.fabricForm) },
  { key: "uom", header: "UOM", value: (r) => text(r.uom) },
  { key: "poQty", header: "PO Qty", letter: "A", title: "PO qty of this GMT colour in the size group", number: 0, value: (r) => r.poQty },
  { key: "cons", header: "Cons./Pcs", letter: "B", title: "Budget qty per pcs, before wastage (shown only)", number: 4, value: (r) => r.customConsumptionPerPcs },
  { key: "gmtW", header: "GMT W%", letter: "C", title: "Σ budget GMT wastage %: already inside E", number: 2, value: (r) => r.factoryGmtWastagePer },
  { key: "procW", header: "Process W%", letter: "D", title: "Σ budget fabric process wastage %: carried by the yarn qty, not by F", number: 2, value: (r) => r.totalComBomProcessWastage },
  { key: "bookingCons", header: "Booking Cons./Pcs+GW%", letter: "E", title: "E = B × (1 + C/100): the budget's total qty per pcs", number: 6, value: (r) => r.fabricBookingConPerPcs },
  { key: "bookingQty", header: "Booking Qty", letter: "F", title: "F = A × E", number: 2, value: (r) => r.totalFabricBookingQty },
  { key: "pcsQty", header: "Collar/Cuff Pcs", number: 0, value: (r) => r.pcsQty },
  { key: "sample", header: "Sample Qty", title: "Budget row's sample fabric qty (first colour row only)", number: 2, value: (r) => r.sampleFabricQty },
  { key: "remarks", header: "Remarks", width: "min-w-40", value: (r) => text(r.remarks) },
]

const OTHER_COLS: Col<BookingFabricRow>[] = [
  { key: "fabricItem", header: "Item", width: "min-w-52", value: (r) => text(r.fabricItem) },
  { key: "materialGroup", header: "Material Group", value: (r) => text(r.materialGroup) },
  { key: "gmtParts", header: "GMT Parts", value: (r) => text(r.gmtParts) },
  { key: "gmtColor", header: "GMT Color", value: (r) => text(r.gmtColor) },
  { key: "gmtSize", header: "Size Group", value: (r) => text(r.gmtSize) },
  { key: "materialColor", header: "Item Color", value: (r) => text(r.materialColor) },
  { key: "uom", header: "UOM", value: (r) => text(r.uom) },
  { key: "poQty", header: "PO Qty", letter: "A", number: 0, value: (r) => r.poQty },
  { key: "cons", header: "Cons./Pcs", letter: "B", number: 4, value: (r) => r.customConsumptionPerPcs },
  { key: "gmtW", header: "GMT W%", letter: "C", number: 2, value: (r) => r.factoryGmtWastagePer },
  { key: "bookingCons", header: "Booking Cons./Pcs+GW%", letter: "E", title: "E = B × (1 + C/100)", number: 6, value: (r) => r.fabricBookingConPerPcs },
  { key: "bookingQty", header: "Booking Qty", letter: "F", title: "F = A × E", number: 2, value: (r) => r.totalFabricBookingQty },
  { key: "remarks", header: "Remarks", width: "min-w-40", value: (r) => text(r.remarks) },
]

const YARN_COLS: Col<YarnGridRow>[] = [
  { key: "fabricItem", header: "Fabric", width: "min-w-40", value: (r) => text(r.fabricItem) },
  { key: "yarn", header: "Yarn", width: "min-w-48", value: (r) => text(r.yarn) },
  { key: "yarnDyeingColor", header: "Yarn Dyeing Color", value: (r) => text(r.yarnDyeingColor) },
  { key: "gmtParts", header: "GMT Parts", value: (r) => text(r.gmtParts) },
  { key: "gmtColor", header: "GMT Color", value: (r) => text(r.gmtColor) },
  { key: "gmtSize", header: "Size Group", value: (r) => text(r.gmtSize) },
  { key: "materialColor", header: "Fabric Color", value: (r) => text(r.materialColor) },
  { key: "uom", header: "UOM", value: (r) => text(r.uom) },
  { key: "poQty", header: "PO Qty", letter: "G", title: "G = A: the fabric row's PO qty", number: 0, value: (r) => r.poQty },
  { key: "ratio", header: "Yarn/Kg Ratio", letter: "H", title: "The budget yarn's share of 1 kg fabric (shown as I ÷ B)", number: 4, value: (r) => r.yarnRatio },
  { key: "cons", header: "Cons./Pcs", letter: "I", title: "I = B × H", number: 6, value: (r) => r.customConsumptionPerPcs },
  { key: "perKg", header: "Yarn/Kg+W%", letter: "J", title: "Yarn qty per kg fabric, every process wastage in (shown as K ÷ E)", number: 6, highlight: true, value: (r) => r.yarnPerKg },
  { key: "bookingCons", header: "Cons./Pcs+W%", letter: "K", title: "K = E × J", number: 6, highlight: true, value: (r) => r.bookingConPerPcs },
  { key: "qty", header: "Yarn Qty", letter: "L", title: "L = G × K", number: 2, value: (r) => r.totalBookingQty },
  { key: "greyKg", header: "Grey/Kg+W%", letter: "M", title: "Grey qty per kg fabric: process wastage without knitting and yarn dyeing", number: 6, value: (r) => r.greyPerKg },
  { key: "greyCons", header: "Grey Cons./Pcs", letter: "N", title: "N = E × M", number: 6, value: (r) => r.factoryTotalGreyBookingConPerpcsGmt },
  { key: "greyQty", header: "Grey Qty", letter: "O", title: "O = G × N", number: 2, value: (r) => r.factoryTotalGreyBookingQuantity },
  { key: "dyedKg", header: "Dyed/Kg+W%", letter: "P", title: "Dyed yarn qty per kg fabric: process wastage without yarn dyeing", number: 6, value: (r) => r.dyedPerKg },
  { key: "dyedCons", header: "Dyed Yarn Cons./Pcs", letter: "Q", title: "Q = E × P", number: 6, value: (r) => r.factoryTotalDyedYarnBookingConPerpcsGmt },
  { key: "dyedQty", header: "Dyed Yarn Qty", letter: "R", title: "R = G × Q", number: 2, value: (r) => r.factoryTotalDyedYarnBookingQuantity },
  { key: "strip", header: "Strip Measurement", value: (r) => text(r.stripMeasurement) },
]

// ---------- the dialog ----------

export function GmtBookingFormDialog({
  mode: initialMode,
  bookingId,
  ctx,
  access,
  onAuthFailure,
  onOpenChange,
  onSaved,
  onOpenBooking,
}: {
  mode: GmtBookingDialogMode
  bookingId: number | null
  ctx: ApiContext
  access: AccessRules
  onAuthFailure: (message: string) => boolean
  onOpenChange: (open: boolean) => void
  onSaved: (id: number) => void
  onOpenBooking: (id: number) => void
}) {
  const [mode, setMode] = useState(initialMode)
  const readOnly = mode === "view"
  const [booking, setBooking] = useState<GmtBooking>(emptyBooking)
  const [loading, setLoading] = useState(Boolean(bookingId))
  const [busy, setBusy] = useState<"" | "refresh" | "load" | "save">("")
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [poStyles, setPoStyles] = useState<BudgetedPoStyle[]>([])
  const [selectedFabric, setSelectedFabric] = useState<string | null>(null)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>("master")
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})
  const yarnRef = useRef<HTMLDivElement>(null)
  // a fabric row's material group decides the grid; the GMT costing screen's names (default "Fabric")
  const groupNames = useMemo(() => readSettings().fabricMaterialGroupNames.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean), [])

  const fail = useCallback(
    (caught: unknown, fallback: string) => {
      const message = caught instanceof Error ? caught.message : fallback
      if (!onAuthFailure(message)) toast.error(message)
      return message
    },
    [onAuthFailure],
  )
  const update = (change: Partial<GmtBooking>) => {
    setBooking((b) => ({ ...b, ...change }))
    setDirty(true)
  }

  useEffect(() => {
    if (!bookingId) return
    let active = true
    fetchBooking(ctx, bookingId)
      .then((dto) => active && setBooking(bookingFromDto(dto)))
      .catch((caught) => {
        fail(caught, "Unable to load the booking.")
        onOpenChange(false)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [bookingId, ctx, fail, onOpenChange])

  // the buyer's PO + styles with a budget
  useEffect(() => {
    if (!booking.buyerId || booking.id) return
    let active = true
    fetchBudgetedPoStyles(ctx, booking.buyerId)
      .then((rows) => active && setPoStyles(rows))
      .catch((caught) => fail(caught, "Unable to load the budgeted POs."))
    return () => {
      active = false
    }
  }, [booking.buyerId, booking.id, ctx, fail])

  const fabricRows = useMemo(() => booking.fabricDetails.filter((r) => isFabricRow(r, groupNames)), [booking.fabricDetails, groupNames])
  const otherRows = useMemo(() => booking.fabricDetails.filter((r) => !isFabricRow(r, groupNames)), [booking.fabricDetails, groupNames])
  const yarnRows = useMemo(() => yarnGridRows(booking.details, booking.fabricDetails), [booking.details, booking.fabricDetails])
  const selected = booking.fabricDetails.find((r) => r.clientId === selectedFabric) ?? null
  const linkedCount = selected ? booking.details.filter((y) => isYarnOfFabric(y, selected)).length : 0

  const fabricSummary = useMemo(() => fabricSummaryOf(fabricRows, booking.details), [booking.details, fabricRows])
  const yarnSummary = useMemo(() => yarnSummaryOf(booking.details), [booking.details])
  const otherSummary = useMemo(() => otherSummaryOf(otherRows), [otherRows])

  const loadBuyers = useCallback((p: AppComboboxLoadParams) => loadBuyerOptions(ctx, p), [ctx])
  const loadSources = useCallback((p: AppComboboxLoadParams) => loadFabricSourceOptions(ctx, p), [ctx])
  const loadTreatments = useCallback((p: AppComboboxLoadParams) => loadSpecialTreatmentOptions(ctx, p), [ctx])

  async function runRefresh(poId = booking.poId, styleId = booking.styleId) {
    setBusy("refresh")
    try {
      const r = await refreshFromBudget(ctx, poId, styleId)
      setBooking((b) => ({
        ...b,
        budgetId: r.budgetId ?? b.budgetId,
        fabricSourceId: b.fabricSourceId ?? r.fabricSourceId,
        fabricDetails: r.fabricDetails,
        details: r.details,
        wastages: r.wastages,
      }))
      setSelectedFabric(null)
      setDirty(true)
      toast.success(`${r.fabricDetails.length} fabric / item row(s) and ${r.details.length} yarn row(s) from the budget.`)
    } catch (caught) {
      fail(caught, "Unable to work the booking out from the budget.")
    } finally {
      setBusy("")
    }
  }

  async function loadSaved() {
    setBusy("load")
    try {
      const saved = await fetchBookingByPoStyle(ctx, booking.poId, booking.styleId)
      if (!saved) {
        toast.info("This PO and style have no saved booking.")
        return
      }
      const b = bookingFromDto(saved)
      setBooking((current) => ({ ...current, fabricDetails: b.fabricDetails, details: b.details, wastages: b.wastages }))
      setSelectedFabric(null)
      toast.success("Saved rows loaded.")
    } catch (caught) {
      fail(caught, "Unable to load the saved booking.")
    } finally {
      setBusy("")
    }
  }

  function pickPoStyle(value: string | null) {
    const row = poStyles.find((r) => `${r.poId}|${r.styleId}` === value)
    if (!row) {
      update({ poId: 0, poNo: "", styleId: 0, style: "", styleName: "", budgetId: null, fabricDetails: [], details: [], wastages: [] })
      return
    }
    if (row.bookingId) {
      toast.info("This PO and style already have a booking; it is opened.")
      onOpenBooking(row.bookingId)
      return
    }
    update({ poId: row.poId, poNo: row.poNo, styleId: row.styleId, style: row.style, styleName: row.styleName, budgetId: row.budgetId })
    void runRefresh(row.poId, row.styleId)
  }

  function validate() {
    const problems: string[] = []
    if (!booking.buyerId) problems.push("Buyer is required.")
    if (!booking.poId || !booking.styleId) problems.push("Pick the PO and style.")
    if (booking.fabricDetails.length === 0) problems.push("Please add fabric data: Refresh New Data from the budget.")
    booking.revises.forEach((r) => {
      if (!r.id && !r.reviceReason.trim()) problems.push("The new revision needs a reason.")
    })
    return problems
  }

  async function save() {
    const problems = validate()
    setErrors(problems)
    if (problems.length) {
      toast.error(problems[0])
      return
    }
    setBusy("save")
    try {
      const body = bookingToDto(booking)
      if (booking.id) {
        await updateBooking(ctx, booking.id, body)
        setBooking(bookingFromDto(await fetchBooking(ctx, booking.id)))
        toast.success("Booking updated.")
        onSaved(booking.id)
      } else {
        const saved = bookingFromDto(await createBooking(ctx, body))
        setBooking(saved)
        setMode("edit")
        toast.success("Booking saved.")
        onSaved(saved.id)
      }
      setDirty(false)
    } catch (caught) {
      setErrors([fail(caught, "Unable to save the booking.")])
    } finally {
      setBusy("")
    }
  }

  function requestClose() {
    if (dirty && !readOnly) setConfirmClose(true)
    else onOpenChange(false)
  }

  function section(id: SectionId, heading: string, body: ReactNode, actions?: ReactNode) {
    return (
      <Card ref={(el) => { sectionRefs.current[id] = el }} id={`gmt-booking-${id}`} className={SECTION_CARD_CLASS}>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
          <CardTitle className="text-sm">{heading}</CardTitle>
          {actions}
        </CardHeader>
        <CardContent className="max-w-full min-w-0 px-3 pb-3 sm:px-4">{body}</CardContent>
      </Card>
    )
  }

  const poStyleOptions = poStyles.map((r) => ({
    value: `${r.poId}|${r.styleId}`,
    label: `${r.poNo} · ${r.style}${r.bookingId ? " (booked)" : ""}`,
  }))
  const poStyleValue = booking.poId ? { value: `${booking.poId}|${booking.styleId}`, label: `${booking.poNo} · ${booking.style}` } : null
  const hasRows = booking.fabricDetails.length > 0 || booking.details.length > 0
  const title = mode === "create" ? "New booking" : mode === "view" ? "Booking" : "Edit booking"
  const counts: Partial<Record<SectionId, number>> = { fabric: fabricRows.length, other: otherRows.length, yarn: booking.details.length, revisions: booking.revises.length }

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : requestClose())}>
      <DialogContent className="top-0 left-0 h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-slate-200/70 bg-slate-50 p-0 shadow-2xl sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg 2xl:w-[min(1700px,calc(100vw-2rem))] 2xl:max-w-[min(1700px,calc(100vw-2rem))] dark:border-white/10 dark:bg-[#080a14]">
        <form
          className="grid h-full min-h-0 w-full max-w-full min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden sm:max-h-[calc(100vh-2rem)] sm:min-h-[85vh]"
          onSubmit={(e) => {
            e.preventDefault()
            if (!readOnly) void save()
          }}
        >
          <div className="flex min-h-0 w-full max-w-full min-w-0 overflow-hidden">
            <aside className="hidden w-[230px] shrink-0 border-r border-slate-200/70 bg-white/55 p-3 lg:block dark:border-white/10 dark:bg-[#0a0d19]/90">
              <nav className="space-y-1.5">
                {SECTIONS.map((s) => {
                  const Icon = s.icon
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(s.id)
                        sectionRefs.current[s.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-600 dark:text-slate-300",
                        activeSection === s.id ? "border-l-2 border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "hover:bg-slate-900/5 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{s.label}</span>
                      {typeof counts[s.id] === "number" ? (
                        <Badge className="rounded-md bg-blue-600/15 px-2 py-0 text-xs text-blue-700 hover:bg-blue-600/15 dark:text-blue-200">{counts[s.id]}</Badge>
                      ) : null}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <div className="min-h-0 w-full max-w-full min-w-0 overflow-hidden">
              <ScrollArea className="h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden" viewportClassName="overflow-x-hidden [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full">
                <div className="w-full max-w-full min-w-0 space-y-2.5 overflow-x-hidden p-2 sm:p-3">
                  <DialogHeader className="flex flex-col gap-2 rounded-lg border border-slate-200/70 bg-white/90 p-3 sm:flex-row sm:items-start sm:justify-between dark:border-white/10 dark:bg-[#17131d]/90">
                    <div className="space-y-1">
                      <DialogTitle>{title}</DialogTitle>
                      <DialogDescription>
                        {[booking.bomNo, booking.buyer, booking.poNo, booking.style].filter(Boolean).join(" · ") || "Pick the buyer and a PO + style with a GMT budget."}
                      </DialogDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {booking.isApproved ? <Badge className="rounded-md bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">Released {formatDate(booking.bookingReleaseDate)}</Badge> : null}
                      {booking.revisedNo ? <Badge variant="outline" className="rounded-md">Revised {booking.revisedNo}</Badge> : null}
                      {!readOnly && booking.poId ? (
                        <>
                          <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={Boolean(busy)} onClick={() => (hasRows ? setConfirmRefresh(true) : void runRefresh())}>
                            {busy === "refresh" ? <Loader2 className="size-3 animate-spin" /> : <RefreshCcw className="size-3" />} Refresh New Data
                          </Button>
                          {booking.id ? (
                            <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={Boolean(busy)} onClick={() => void loadSaved()}>
                              {busy === "load" ? <Loader2 className="size-3 animate-spin" /> : <Database className="size-3" />} Load Saved Data
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {readOnly && access.canUpdate ? (
                        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setMode("edit")}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </DialogHeader>

                  {errors.length ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                      <p className="font-medium">Please fix the following:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}</div>
                  ) : (
                    <>
                      {section(
                        "master",
                        "Master Info",
                        <div className="grid max-w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>Buyer</FieldLabel>
                            <LookupCombobox
                              value={booking.buyerId}
                              label={booking.buyer}
                              loadItems={loadBuyers}
                              placeholder="Buyer"
                              disabled={readOnly || booking.id > 0}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => update({ buyerId: o ? Number(o.value) : 0, buyer: o?.label ?? "", poId: 0, poNo: "", styleId: 0, style: "", budgetId: null, fabricDetails: [], details: [], wastages: [] })}
                            />
                          </div>
                          <div className={cn(FIELD_CLASS, "xl:col-span-2")}>
                            <FieldLabel required>PO · Style (with a GMT budget)</FieldLabel>
                            <AppCombobox
                              key={`po-${booking.buyerId}-${poStyles.length}`}
                              items={poStyleOptions}
                              value={poStyleValue}
                              onValueChange={(o) => pickPoStyle(o?.value ?? null)}
                              placeholder={booking.buyerId ? (poStyles.length ? "PO · style" : "No PO of this buyer has a budget") : "Pick a buyer first"}
                              disabled={readOnly || booking.id > 0 || !booking.buyerId}
                              inputClassName={INPUT_CLASS}
                              contentClassName={COMBO_CONTENT_CLASS}
                            />
                            {booking.styleName ? <p className="truncate text-[11px] text-slate-500">{booking.styleName}{booking.budgetName ? ` · ${booking.budgetName}` : ""}</p> : null}
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Booking No</FieldLabel>
                            <Input value={booking.bomNo} readOnly={readOnly} maxLength={100} placeholder="Optional" className={INPUT_CLASS} onChange={(e) => update({ bomNo: e.target.value })} />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Fabric Source</FieldLabel>
                            <LookupCombobox value={booking.fabricSourceId} label={booking.fabricSource} loadItems={loadSources} placeholder="Fabric source" disabled={readOnly} inputClassName={INPUT_CLASS} onChange={(o) => update({ fabricSourceId: o ? Number(o.value) : null, fabricSource: o?.label ?? "" })} />
                          </div>
                          <label className="flex items-end gap-2 pb-1 text-xs font-semibold text-slate-700 dark:text-slate-300" title="The release date is stamped by the server on the first release">
                            <Checkbox checked={booking.isApproved} disabled={readOnly} onCheckedChange={(v) => update({ isApproved: Boolean(v) })} /> Released
                          </label>
                          <label className="flex items-end gap-2 pb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <Checkbox checked={booking.isOpenDia} disabled={readOnly} onCheckedChange={(v) => update({ isOpenDia: Boolean(v) })} /> Open Dia
                          </label>
                        </div>,
                      )}

                      {section(
                        "fabric",
                        "Fabric",
                        <div className="space-y-1.5">
                          <ReadGrid
                            rows={fabricRows}
                            cols={FABRIC_COLS}
                            minWidth="min-w-[2000px]"
                            empty={booking.poId ? "No fabric rows: Refresh New Data from the budget." : "Pick the PO and style first."}
                            onRowClick={(r) => {
                              const next = selectedFabric === r.clientId ? null : r.clientId
                              setSelectedFabric(next)
                              if (next) yarnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                            }}
                            rowClassName={(r) => (r.clientId === selectedFabric ? "bg-amber-100/70 dark:bg-amber-500/15" : undefined)}
                            footer={<TotalsFoot cols={FABRIC_COLS.length} label="Booking qty" totals={totalsByUom(fabricSummary, (r) => r.finishQty)} />}
                          />
                          <p className="text-[11px] text-slate-500">Click a fabric row to mark its yarn rows below. Hover a lettered header for its formula.</p>
                        </div>,
                      )}

                      {section(
                        "other",
                        "Other Items",
                        <ReadGrid
                          rows={otherRows}
                          cols={OTHER_COLS}
                          minWidth="min-w-[1500px]"
                          empty="No other items (trims, accessories)."
                          footer={<TotalsFoot cols={OTHER_COLS.length} label="Booking qty" totals={totalsByUom(otherSummary, (r) => r.qty)} />}
                        />,
                      )}

                      {section(
                        "yarn",
                        "Yarn",
                        <div ref={yarnRef} className="scroll-mt-3">
                          <ReadGrid
                            rows={yarnRows}
                            cols={YARN_COLS}
                            minWidth="min-w-[2400px]"
                            empty="No yarn rows."
                            rowClassName={(r) => (selected && isYarnOfFabric(r, selected) ? "bg-amber-100/70 dark:bg-amber-500/15" : undefined)}
                            footer={<TotalsFoot cols={YARN_COLS.length} label="Yarn qty" totals={totalsByUom(yarnSummary, (r) => r.yarnQty)} />}
                          />
                        </div>,
                        selected ? <Badge className="rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200">{linkedCount} yarn row(s) of {selected.fabricItem} · {selected.gmtColor}</Badge> : null,
                      )}

                      {section(
                        "summary",
                        "Summary",
                        <div className="grid gap-3 xl:grid-cols-3">
                          <SummaryTable
                            title="Fabric"
                            heads={["Fabric", "UOM", "Finish Qty", "Grey Qty", "Cons./Pcs"]}
                            rows={fabricSummary.map((r) => [r.item, r.uom, formatNumber(r.finishQty, 2), formatNumber(r.greyQty, 2), formatNumber(consumptionOf(r.finishQty, poQtyOf([r])), 4)])}
                            totals={totalsByUom(fabricSummary, (r) => r.finishQty).map((t) => ["Total", t.uom, formatNumber(t.qty, 2), formatNumber(fabricSummary.filter((r) => r.uom === t.uom).reduce((s, r) => s + r.greyQty, 0), 2), formatNumber(t.consumption, 4)])}
                          />
                          <SummaryTable
                            title="Yarn"
                            heads={["Yarn", "UOM", "Yarn Qty", "Cons./Pcs"]}
                            rows={yarnSummary.map((r) => [r.yarn, r.uom, formatNumber(r.yarnQty, 2), formatNumber(consumptionOf(r.yarnQty, poQtyOf([r])), 4)])}
                            totals={totalsByUom(yarnSummary, (r) => r.yarnQty).map((t) => ["Total", t.uom, formatNumber(t.qty, 2), formatNumber(t.consumption, 4)])}
                          />
                          <SummaryTable
                            title="Other items"
                            heads={["Item", "UOM", "Qty", "Cons./Pcs"]}
                            rows={otherSummary.map((r) => [r.item, r.uom, formatNumber(r.qty, 2), formatNumber(consumptionOf(r.qty, poQtyOf([r])), 4)])}
                            totals={totalsByUom(otherSummary, (r) => r.qty).map((t) => ["Total", t.uom, formatNumber(t.qty, 2), formatNumber(t.consumption, 4)])}
                          />
                        </div>,
                      )}

                      {section(
                        "notes",
                        "Special Treatments & Comments",
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <FieldLabel>Special Treatments</FieldLabel>
                            <SpecialTreatmentSection
                              rows={booking.specialTreatments.map((t) => ({ clientId: t.clientId, id: t.id, masterId: t.masterId, specialTreatmentId: t.specialTreatmId, treatment: t.treatment }))}
                              readOnly={readOnly}
                              loadOptions={loadTreatments}
                              onChange={(rows) => update({ specialTreatments: rows.map((t) => ({ clientId: t.clientId, id: t.id, masterId: t.masterId, specialTreatmId: t.specialTreatmentId, treatment: t.treatment })) })}
                            />
                          </div>
                          <CommentsSection label="Comments" rows={booking.comments} readOnly={readOnly} onChange={(comments) => update({ comments })} />
                        </div>,
                      )}

                      {section("revisions", "Revisions", <RevisionSection rows={booking.revises} readOnly={readOnly} isSaved={booking.id > 0} onChange={(revises) => update({ revises })} />)}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 px-3 py-3 sm:px-4 dark:border-white/10 dark:bg-[#0a0d19]/95">
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
              <p className="mr-auto hidden text-xs text-slate-500 sm:block">{dirty && !readOnly ? "Unsaved changes" : booking.id ? `Booking #${booking.id}` : ""}</p>
              <Button type="button" variant="outline" className="rounded-xl" onClick={requestClose}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly ? (
                <Button type="submit" disabled={loading || Boolean(busy)} className="rounded-xl">
                  {busy === "save" ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                  {booking.id ? "Save changes" : "Save booking"}
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        </form>

        <AppConfirmDialog
          open={confirmRefresh}
          title="Refresh the rows from the budget?"
          description="Every fabric, other item, yarn and wastage row is worked out again from the PO and style's budget; the rows now on screen are replaced. Saving then replaces the saved rows."
          confirmLabel="Refresh"
          onOpenChange={setConfirmRefresh}
          onConfirm={() => {
            setConfirmRefresh(false)
            void runRefresh()
          }}
        />
        <AppConfirmDialog
          open={confirmClose}
          title="Discard unsaved changes?"
          description="The changes made to this booking since it was last saved will be lost."
          confirmLabel="Discard"
          destructive
          onOpenChange={setConfirmClose}
          onConfirm={() => {
            setConfirmClose(false)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function TotalsFoot({ cols, label, totals }: { cols: number; label: string; totals: Array<{ uom: string; qty: number }> }) {
  if (!totals.length) return null
  return (
    <tfoot>
      {totals.map((t) => (
        <tr key={t.uom} className="bg-slate-50 font-semibold dark:bg-white/5">
          <td className={TD_CLASS} colSpan={cols + 1}>
            {label} ({t.uom || "no UOM"}): <span className="tabular-nums">{formatNumber(t.qty, 2)}</span>
          </td>
        </tr>
      ))}
    </tfoot>
  )
}

function SummaryTable({ title, heads, rows, totals }: { title: string; heads: string[]; rows: string[][]; totals: string[][] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">
        <Scissors className="mr-1 inline size-3" />
        {title}
      </p>
      <div className="overflow-x-auto rounded-md border border-slate-200/70 dark:border-white/10">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50/80 dark:bg-white/5">
            <tr className="border-b">
              {heads.map((h, i) => (
                <th key={h} className={cn(TH_CLASS, i >= 2 ? "text-right" : "")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={heads.length} className="p-3 text-center text-slate-500">Nothing.</td>
              </tr>
            ) : null}
            {[...rows.map((r) => ({ r, total: false })), ...totals.map((r) => ({ r, total: true }))].map(({ r, total }, i) => (
              <tr key={i} className={cn("border-b", total ? "bg-slate-50 font-semibold dark:bg-white/5" : "")}>
                {r.map((cell, j) => (
                  <td key={j} className={cn(TD_CLASS, j >= 2 ? "text-right tabular-nums" : "")}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
