"use client"

// The GMT Budget entry dialog: create, edit or view the budget of one PO + style. Picking the PO reads its
// job lines of the style (PO qty, colours, sizes, Total FOB); picking a GMT costing of the style copies its
// rows, split by the PO's colours, with every budgeted figure at the costing's value. Ported from ClickERP's
// gmt-budget-form; the look is this app's entry dialog.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BadgeDollarSign, Calculator, FileText, History, Info, Layers, Loader2, MessageSquare, Paperclip, Percent, Users } from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { AppConfirmDialog } from "@/components/app-confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { FilesSection } from "../../gmt-costing/component/gmt-costing-sections"
import { GmtGroupDialog } from "../../gmt-costing/component/gmt-group-dialog"
import { FIELD_CLASS, FieldLabel, INPUT_CLASS, LookupCombobox, NumInput, SECTION_CARD_CLASS, formatNumber } from "../../gmt-costing/component/gmt-ui"
import {
  downloadAttachment,
  fetchCostScopes,
  fetchGmtCosting,
  fetchMaterialInfo,
  loadBuyerOptions,
  loadColorOptions,
  loadMaterialOptions,
  loadPartOptions,
  loadStyleOptions,
  saveBlob,
  uploadFile,
  type ApiContext,
} from "../../gmt-costing/gmt-costing.api"
import { costingFromDto, isFabricGroup, processGroupsOf, readSettings } from "../../gmt-costing/gmt-costing.calc"
import type { AccessRules, CostScope } from "../../gmt-costing/gmt-costing.types"
import {
  createGmtBudget,
  fetchGmtBudget,
  fetchPoStyleLines,
  findPoStyle,
  loadCostingOptions,
  loadFabricSourceOptions,
  loadFactoryOptions,
  loadPoOptions,
  loadSpecialTreatmentOptions,
  updateGmtBudget,
} from "../gmt-budget.api"
import {
  asCostingRow,
  balanceValueOf,
  budgetFromDto,
  budgetToDto,
  buildCostPerPcs,
  costingToBudget,
  emptyBudget,
  fromCostingRows,
  poContextOf,
  poStyleQtyOf,
  recalcBudgetRow,
  totalFobOf,
  withBudgetFabricCost,
} from "../gmt-budget.calc"
import type { BudgetDetail, GmtBudget, PoStyleContext } from "../gmt-budget.types"
import { GmtBudgetDetailsGrid } from "./gmt-budget-details-grid"
import { GmtBudgetFabricCostDialog } from "./gmt-budget-fabric-cost-dialog"
import {
  BudgetCommissionSection,
  BudgetOtherCostSection,
  BudgetPriceSection,
  BudgetWastageSection,
  CommentsSection,
  RevisionSection,
  SpecialTreatmentSection,
} from "./gmt-budget-sections"

export type GmtBudgetDialogMode = "create" | "edit" | "view"

/** A new budget handed over from the list: its PO + style. */
export type BudgetSeed = { buyerId: string; buyer: string; styleId: string; style: string; poId: string; po: string }

type SectionId = "master" | "details" | "wastage" | "other-cost" | "commission" | "price" | "notes" | "revisions" | "files"

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Info }> = [
  { id: "master", label: "Master Info", icon: Info },
  { id: "details", label: "Details", icon: Layers },
  { id: "wastage", label: "GMT Wastage", icon: Percent },
  { id: "other-cost", label: "Other Cost", icon: BadgeDollarSign },
  { id: "commission", label: "Commission", icon: Users },
  { id: "price", label: "Price", icon: Calculator },
  { id: "notes", label: "Treatments & Notes", icon: MessageSquare },
  { id: "revisions", label: "Revisions", icon: History },
  { id: "files", label: "Files", icon: Paperclip },
]

export function GmtBudgetFormDialog({
  mode: initialMode,
  budgetId,
  seed,
  ctx,
  access,
  onAuthFailure,
  onOpenChange,
  onSaved,
  onOpenBudget,
}: {
  mode: GmtBudgetDialogMode
  budgetId: string | null
  seed: BudgetSeed | null
  ctx: ApiContext
  access: AccessRules
  onAuthFailure: (message: string) => boolean
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
  /** The PO + style already has a budget: open that one instead. */
  onOpenBudget: (id: string) => void
}) {
  const [mode, setMode] = useState<GmtBudgetDialogMode>(initialMode)
  const readOnly = mode === "view"
  const [budget, setBudget] = useState<GmtBudget>(() => (seed ? { ...emptyBudget(), ...seed } : emptyBudget()))
  const [po, setPo] = useState<PoStyleContext | null>(null)
  const [poKey, setPoKey] = useState("")
  const [loading, setLoading] = useState(initialMode !== "create")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [scopes, setScopes] = useState<CostScope[]>([])
  const [fabricFor, setFabricFor] = useState<string | null>(null)
  const [groupFor, setGroupFor] = useState<{ clientId: string; kind: "size" | "color" } | null>(null)
  const [pendingCosting, setPendingCosting] = useState<AppComboboxOption | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>("master")
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})
  const settings = useMemo(() => readSettings(), [])

  const fail = useCallback(
    (caught: unknown, fallback: string) => {
      const message = caught instanceof Error ? caught.message : fallback
      if (!onAuthFailure(message)) toast.error(message)
      return message
    },
    [onAuthFailure],
  )

  const update = useCallback((change: Partial<GmtBudget>) => {
    setBudget((b) => ({ ...b, ...change }))
    setDirty(true)
  }, [])

  /** The PO's job lines of the style; every row's PO qty and Total Req. Qty follow them (desktop UpdatePOQty). */
  const loadPo = useCallback(
    async (poNo: string, poId: string, styleId: string, refreshRows: boolean) => {
      setPoKey(`${poId}|${styleId}`)
      try {
        const context = poContextOf(await fetchPoStyleLines(ctx, poNo, poId, styleId))
        setPo(context)
        setBudget((b) => {
          const totalFob = totalFobOf(context)
          return {
            ...b,
            totalFob,
            balanceValue: balanceValueOf(totalFob, b.buyingCommission),
            details: refreshRows ? b.details.map((r) => recalcBudgetRow(r, context, true)) : b.details,
          }
        })
        if (context.lines.length === 0) toast.warning("No job line of this PO has this style. PO qty and Total FOB stay 0.")
      } catch (caught) {
        setPo(null)
        fail(caught, "Unable to read the PO's job lines.")
      }
    },
    [ctx, fail],
  )

  // the budget, and its PO
  useEffect(() => {
    if (!budgetId) return
    let active = true
    fetchGmtBudget(ctx, budgetId)
      .then((dto) => {
        if (!active) return
        const loaded = budgetFromDto(dto)
        setBudget(loaded)
        return loadPo(loaded.po, loaded.poId, loaded.styleId, true)
      })
      .catch((caught) => {
        fail(caught, "Unable to load the GMT budget.")
        onOpenChange(false)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [budgetId, ctx, fail, loadPo, onOpenChange])

  // a new budget handed a PO + style: its lines, or its existing budget
  const seeded = useRef(false)
  useEffect(() => {
    if (budgetId || !seed || seeded.current) return
    seeded.current = true
    void (async () => {
      const existing = await findPoStyle(ctx, seed.poId, seed.styleId).catch(() => null)
      if (existing?.budgetId) {
        toast.info("This PO and style already have a budget; it is opened.")
        onOpenBudget(existing.budgetId)
        return
      }
      await loadPo(seed.po, seed.poId, seed.styleId, false)
    })()
  }, [budgetId, ctx, loadPo, onOpenBudget, seed])

  useEffect(() => {
    let active = true
    fetchCostScopes(ctx)
      .then((list) => active && setScopes(list))
      .catch((caught) => fail(caught, "Unable to load the GMT cost scopes."))
    return () => {
      active = false
    }
  }, [ctx, fail])

  const groups = useMemo(() => processGroupsOf(scopes, settings), [scopes, settings])
  const costPerPcs = useMemo(
    () => buildCostPerPcs(budget.details, budget.otherCosts, budget.commissions, budget.costPerPcs),
    [budget.commissions, budget.costPerPcs, budget.details, budget.otherCosts],
  )
  const setRows = useCallback((details: BudgetDetail[]) => update({ details }), [update])

  // lookups
  const loadBuyers = useCallback((p: AppComboboxLoadParams) => loadBuyerOptions(ctx, p), [ctx])
  const buyerKey = budget.buyerId ? String(budget.buyerId) : undefined
  const styleKey = budget.styleId ? String(budget.styleId) : undefined
  const loadStyles = useCallback((p: AppComboboxLoadParams) => loadStyleOptions(ctx, p, buyerKey), [buyerKey, ctx])
  const loadPos = useCallback((p: AppComboboxLoadParams) => loadPoOptions(ctx, p, buyerKey, styleKey, false), [buyerKey, ctx, styleKey])
  const loadCostings = useCallback((p: AppComboboxLoadParams) => loadCostingOptions(ctx, p, styleKey), [ctx, styleKey])
  const loadSources = useCallback((p: AppComboboxLoadParams) => loadFabricSourceOptions(ctx, p), [ctx])
  const loadFactories = useCallback((p: AppComboboxLoadParams) => loadFactoryOptions(ctx, p), [ctx])
  const loadTreatments = useCallback((p: AppComboboxLoadParams) => loadSpecialTreatmentOptions(ctx, p), [ctx])
  const loadMaterials = useCallback((p: AppComboboxLoadParams) => loadMaterialOptions(ctx, p), [ctx])
  const loadParts = useCallback((p: AppComboboxLoadParams) => loadPartOptions(ctx, p), [ctx])
  const loadColors = useCallback((p: AppComboboxLoadParams) => loadColorOptions(ctx, p), [ctx])
  const resolveMaterial = useCallback(
    async (id: string) => {
      const info = await fetchMaterialInfo(ctx, id)
      return info ? { unitId: info.unitId, unitName: info.unitName, isColorWise: isFabricGroup(info.materialGroupName, settings) } : null
    },
    [ctx, settings],
  )

  async function pickPo(option: AppComboboxOption | null) {
    if (!option) {
      update({ poId: "", po: "", totalFob: 0, balanceValue: 0 })
      setPo(null)
      return
    }
    const poId = String(option.value)
    update({ poId, po: option.label })
    const existing = await findPoStyle(ctx, poId, budget.styleId).catch(() => null)
    if (existing?.budgetId && existing.budgetId !== budget.id) {
      toast.info("This PO and style already have a budget; it is opened.")
      onOpenBudget(existing.budgetId)
      return
    }
    await loadPo(option.label, poId, budget.styleId, true)
  }

  /** desktop LoadDataByGMTCost: the costing's rows on this PO (replacing any rows), other costs and commissions. */
  async function applyCosting(option: AppComboboxOption) {
    if (!po) {
      toast.error("Pick the PO first: the costing's rows are split by its colours.")
      return
    }
    try {
      const costing = costingFromDto(await fetchGmtCosting(ctx, String(option.value)))
      const built = costingToBudget(costing, po)
      setBudget((b) => ({
        ...b,
        costId: built.costId,
        costingNo: built.costingNo,
        techSheetId: built.techSheetId,
        techSheet: built.techSheet,
        details: built.details,
        otherCosts: built.otherCosts,
        commissions: built.commissions,
      }))
      setDirty(true)
      toast.success(`${built.details.length} row(s) taken from ${built.costingNo}.`)
      if (built.missingColors.length) toast.warning(`Not on this PO, left out: ${built.missingColors.join(", ")}.`)
    } catch (caught) {
      fail(caught, "Unable to load the GMT costing.")
    }
  }

  function validate() {
    const problems: string[] = []
    if (!budget.buyerId) problems.push("Buyer is required.")
    if (!budget.styleId) problems.push("Style is required.")
    if (!budget.poId) problems.push("PO is required.")
    if (!budget.costId) problems.push("GMT costing is required.")
    if (!budget.details.length) problems.push("Please add at least one fabric row.")
    budget.details.forEach((r, i) => {
      if (!r.fabricItemId) problems.push(`Details row ${i + 1}: pick the fabric / item.`)
    })
    budget.revises.forEach((r) => {
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
    setSaving(true)
    try {
      const body = budgetToDto({ ...budget, costPerPcs, budgetDate: budget.id ? budget.budgetDate : new Date().toISOString().slice(0, 10) })
      if (budget.id) {
        await updateGmtBudget(ctx, budget.id, body)
        const reloaded = budgetFromDto(await fetchGmtBudget(ctx, budget.id))
        setBudget({ ...reloaded, details: reloaded.details.map((r) => recalcBudgetRow(r, po, false)) })
        toast.success("GMT budget updated.")
        onSaved(reloaded.id)
      } else {
        const saved = budgetFromDto(await createGmtBudget(ctx, body))
        setBudget(saved)
        setMode("edit")
        toast.success("GMT budget saved.")
        onSaved(saved.id)
      }
      setDirty(false)
    } catch (caught) {
      setErrors([fail(caught, "Unable to save the GMT budget.")])
    } finally {
      setSaving(false)
    }
  }

  function requestClose() {
    if (dirty && !readOnly) setConfirmClose(true)
    else onOpenChange(false)
  }

  function scrollTo(id: SectionId) {
    setActiveSection(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const fabricRow = fabricFor ? budget.details.find((r) => r.clientId === fabricFor) ?? null : null
  const groupRow = groupFor ? budget.details.find((r) => r.clientId === groupFor.clientId) ?? null : null
  const poLoading = Boolean(budget.poId) && !po && poKey === `${budget.poId}|${budget.styleId}`
  const averagePrice = costPerPcs.length ? costPerPcs.reduce((s, r) => s + r.costingPricePerPcs, 0) / costPerPcs.length : null
  const counts: Partial<Record<SectionId, number>> = {
    details: budget.details.length,
    "other-cost": budget.otherCosts.length,
    commission: budget.commissions.length,
    price: costPerPcs.length,
    revisions: budget.revises.length,
    files: budget.mstFiles.length,
  }

  function section(id: SectionId, heading: string, body: React.ReactNode) {
    return (
      <Card ref={(el) => { sectionRefs.current[id] = el }} id={`gmt-budget-${id}`} className={SECTION_CARD_CLASS}>
        <CardHeader className="px-4 pt-3 pb-2">
          <CardTitle className="text-sm">{heading}</CardTitle>
        </CardHeader>
        <CardContent className="max-w-full min-w-0 px-3 pb-3 sm:px-4">{body}</CardContent>
      </Card>
    )
  }

  const title = mode === "create" ? "New GMT budget" : mode === "view" ? "GMT budget" : "Edit GMT budget"

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
                      onClick={() => scrollTo(s.id)}
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
                        {[budget.budgetName, budget.buyer, budget.style, budget.po].filter(Boolean).join(" · ") || "Pick the buyer, style, PO and GMT costing."}
                      </DialogDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {po ? <Badge variant="outline" className="rounded-md">PO qty {formatNumber(poStyleQtyOf(po), 0)}</Badge> : null}
                      {averagePrice !== null ? <Badge variant="outline" className="rounded-md">Price {formatNumber(averagePrice)} $/pcs</Badge> : null}
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
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {errors.map((e) => <li key={e}>{e}</li>)}
                      </ul>
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
                    </div>
                  ) : (
                    <>
                      {section(
                        "master",
                        "Master Info",
                        <div className="grid max-w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>Buyer</FieldLabel>
                            <LookupCombobox
                              value={budget.buyerId}
                              label={budget.buyer}
                              loadItems={loadBuyers}
                              placeholder="Buyer"
                              disabled={readOnly || !!budget.id}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => {
                                update({ buyerId: o ? String(o.value) : "", buyer: o?.label ?? "", styleId: "", style: "", poId: "", po: "", costId: "", costingNo: "", details: [] })
                                setPo(null)
                              }}
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>Style</FieldLabel>
                            <LookupCombobox
                              key={`s-${budget.buyerId}`}
                              value={budget.styleId}
                              label={budget.style}
                              loadItems={loadStyles}
                              placeholder={budget.buyerId ? "Style" : "Pick a buyer first"}
                              disabled={readOnly || !!budget.id || !budget.buyerId}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => {
                                update({ styleId: o ? String(o.value) : "", style: o?.label ?? "", poId: "", po: "", costId: "", costingNo: "", details: [] })
                                setPo(null)
                              }}
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>PO</FieldLabel>
                            <LookupCombobox
                              key={`p-${budget.styleId}`}
                              value={budget.poId}
                              label={budget.po}
                              loadItems={loadPos}
                              placeholder={budget.styleId ? "PO without a budget" : "Pick a style first"}
                              disabled={readOnly || !!budget.id || !budget.styleId}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => void pickPo(o)}
                            />
                            {poLoading ? <p className="flex items-center gap-1 text-[11px] text-slate-500"><Loader2 className="size-3 animate-spin" /> Reading the PO&apos;s lines...</p> : null}
                            {po ? <p className="text-[11px] text-slate-500">{po.colors.length} colour(s), {po.sizes.length} size(s), {po.lines.length} line(s)</p> : null}
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>GMT Costing</FieldLabel>
                            <LookupCombobox
                              key={`c-${budget.styleId}`}
                              value={budget.costId}
                              label={budget.costingNo}
                              loadItems={loadCostings}
                              placeholder={budget.styleId ? "Costing of the style" : "Pick a style first"}
                              disabled={readOnly || !budget.styleId}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => {
                                if (!o || String(o.value) === budget.costId) return
                                if (budget.details.length) setPendingCosting(o)
                                else void applyCosting(o)
                              }}
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Budget Name</FieldLabel>
                            <Input value={budget.budgetName} readOnly={readOnly} maxLength={200} placeholder={budget.po ? `${budget.po} Budget` : "Defaults to <PO> Budget"} className={INPUT_CLASS} onChange={(e) => update({ budgetName: e.target.value })} />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Technical Sheet</FieldLabel>
                            <Input value={budget.techSheet || "--"} readOnly className={cn(INPUT_CLASS, "bg-slate-50 dark:bg-white/5")} />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Fabric Source</FieldLabel>
                            <LookupCombobox value={budget.fabricSourceId} label={budget.fabricSource} loadItems={loadSources} placeholder="Fabric source" disabled={readOnly} inputClassName={INPUT_CLASS} onChange={(o) => update({ fabricSourceId: o ? String(o.value) : null, fabricSource: o?.label ?? "" })} />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Commercial Factory</FieldLabel>
                            <LookupCombobox value={budget.commercialFactoryId} label={budget.commercialFactory} loadItems={loadFactories} placeholder="Factory" disabled={readOnly} inputClassName={INPUT_CLASS} onChange={(o) => update({ commercialFactoryId: o ? String(o.value) : null, commercialFactory: o?.label ?? "" })} />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Total FOB ($)</FieldLabel>
                            <NumInput value={budget.totalFob} title="Σ qty × FOB of the PO's lines of the style" />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Buying Commission (%)</FieldLabel>
                            <NumInput
                              value={budget.buyingCommission}
                              onValueChange={readOnly ? undefined : (v) => update({ buyingCommission: v, balanceValue: balanceValueOf(budget.totalFob, v) })}
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Balance Value ($)</FieldLabel>
                            <NumInput value={budget.balanceValue} title="Total FOB less the buying commission %" />
                          </div>
                        </div>,
                      )}

                      {section(
                        "details",
                        "Details",
                        <GmtBudgetDetailsGrid
                          rows={budget.details}
                          po={po}
                          readOnly={readOnly}
                          onRowsChange={setRows}
                          loadMaterials={loadMaterials}
                          loadParts={loadParts}
                          loadColors={loadColors}
                          resolveMaterial={resolveMaterial}
                          onOpenFabricCost={setFabricFor}
                          onOpenGroup={(clientId, kind) => setGroupFor({ clientId, kind })}
                        />,
                      )}

                      {section("wastage", "GMT Wastage", <BudgetWastageSection rows={budget.details} scopes={scopes} po={po} readOnly={readOnly} onChange={setRows} />)}

                      {section(
                        "other-cost",
                        "Other Cost",
                        <BudgetOtherCostSection rows={budget.otherCosts} scopes={scopes} colors={po?.colors ?? []} readOnly={readOnly} onChange={(otherCosts) => update({ otherCosts })} />,
                      )}

                      {section("commission", "Commission", <BudgetCommissionSection rows={budget.commissions} scopes={scopes} readOnly={readOnly} onChange={(commissions) => update({ commissions })} />)}

                      {section("price", "Price per Color & Size Group", <BudgetPriceSection rows={costPerPcs} readOnly={readOnly} onChange={(rows) => update({ costPerPcs: rows })} />)}

                      {section(
                        "notes",
                        "Special Treatments & Comments",
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <FieldLabel>Special Treatments</FieldLabel>
                            <SpecialTreatmentSection rows={budget.specialTreatments} readOnly={readOnly} loadOptions={loadTreatments} onChange={(specialTreatments) => update({ specialTreatments })} />
                          </div>
                          <div className="grid gap-4 lg:grid-cols-2">
                            <CommentsSection label="Budget comments" rows={budget.budgetComments} readOnly={readOnly} onChange={(budgetComments) => update({ budgetComments })} />
                            <CommentsSection label="Booking comments" rows={budget.bookingComments} readOnly={readOnly} onChange={(bookingComments) => update({ bookingComments })} />
                          </div>
                        </div>,
                      )}

                      {section("revisions", "Revisions", <RevisionSection rows={budget.revises} readOnly={readOnly} isSaved={!!budget.id} onChange={(revises) => update({ revises })} />)}

                      {section(
                        "files",
                        "Files",
                        <FilesSection
                          files={budget.mstFiles}
                          readOnly={readOnly}
                          onUpload={(file) => uploadFile(ctx, file)}
                          onDownload={(id, name) =>
                            void downloadAttachment(ctx, id)
                              .then((blob) => saveBlob(blob, name))
                              .catch((caught) => fail(caught, "Unable to download the file."))
                          }
                          onChange={(mstFiles) => update({ mstFiles })}
                        />,
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 px-3 py-3 sm:px-4 dark:border-white/10 dark:bg-[#0a0d19]/95">
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
              <p className="mr-auto hidden text-xs text-slate-500 sm:block">{dirty && !readOnly ? "Unsaved changes" : budget.id ? `Budget #${budget.id}` : ""}</p>
              <Button type="button" variant="outline" className="rounded-xl" onClick={requestClose}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly ? (
                <Button type="submit" disabled={loading || saving} className="rounded-xl">
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                  {budget.id ? "Save changes" : "Save GMT budget"}
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        </form>

        {fabricRow ? (
          <GmtBudgetFabricCostDialog
            ctx={ctx}
            row={fabricRow}
            rows={budget.details}
            readOnly={readOnly}
            scopes={scopes}
            groups={groups}
            initialSearch={budget.style}
            loadMaterials={loadMaterials}
            loadColors={loadColors}
            onSet={(cost) => setRows(budget.details.map((r) => recalcBudgetRow(r.clientId === fabricRow.clientId ? withBudgetFabricCost(r, cost) : r, po, false)))}
            onClose={() => setFabricFor(null)}
          />
        ) : null}

        {groupRow && groupFor ? (
          <GmtGroupDialog
            kind={groupFor.kind}
            row={asCostingRow(groupRow)}
            rows={budget.details.map(asCostingRow)}
            styleItems={groupFor.kind === "size" ? po?.sizes ?? [] : po?.colors ?? []}
            readOnly={readOnly}
            // the groups decide a row's PO qty, so Total Req. Qty follows
            onApply={(edited) => setRows(fromCostingRows(budget.details, edited).map((r) => recalcBudgetRow(r, po, true)))}
            onClose={() => setGroupFor(null)}
          />
        ) : null}

        <AppConfirmDialog
          open={Boolean(pendingCosting)}
          title="Replace the rows with this costing?"
          description={`The details, other costs and commissions are taken from ${pendingCosting?.label ?? "the costing"} again; what was changed here is lost.`}
          confirmLabel="Replace"
          destructive
          onOpenChange={(open) => !open && setPendingCosting(null)}
          onConfirm={() => {
            if (pendingCosting) void applyCosting(pendingCosting)
            setPendingCosting(null)
          }}
        />

        <AppConfirmDialog
          open={confirmClose}
          title="Discard unsaved changes?"
          description="The changes made to this GMT budget since it was last saved will be lost."
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
