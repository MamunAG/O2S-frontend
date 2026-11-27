"use client"

// The GMT Costing entry dialog: create, edit, view, or copy a costing as a new one. One costing is a style's
// costing before the order (ClickERP's gmt-costing-crud-form + its dialogs): basic info, the details grid
// (with each row's fabric costing and size / color group), GMT wastage, other cost, commission, the price
// per color x size group, IE info, item-wise suppliers and files. Everything is saved together.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BadgeDollarSign,
  Calculator,
  Factory,
  FileText,
  Info,
  Layers,
  Loader2,
  Paperclip,
  Percent,
  Settings2,
  Truck,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams } from "@/components/app-combobox"
import { AppConfirmDialog } from "@/components/app-confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import {
  createGmtCosting,
  downloadAttachment,
  fetchCostScopes,
  fetchGmtCosting,
  fetchMaterialInfo,
  fetchStyleInfo,
  loadBuyerOptions,
  loadColorOptions,
  loadMaterialOptions,
  loadPartOptions,
  loadStyleOptions,
  loadSupplierOptions,
  loadTechSheetOptions,
  saveBlob,
  updateGmtCosting,
  uploadFile,
  type ApiContext,
} from "../gmt-costing.api"
import {
  buildPriceRows,
  copyDetail,
  costingFromDto,
  costingToDto,
  costPerPcsFromPrices,
  emptyCommission,
  emptyCosting,
  emptyOtherCost,
  fobOf,
  gmtWastageTotalOf,
  isFabricGroup,
  itemWiseSupplierRows,
  newClientId,
  processGroupsOf,
  readSettings,
  recalcRow,
  withFabricCost,
  writeSettings,
  type GmtCostingSettings,
  type GroupKind,
} from "../gmt-costing.calc"
import type { AccessRules, CostScope, GmtCosting, GmtCostingDetail, StyleInfo } from "../gmt-costing.types"
import { GmtDetailsGrid } from "./gmt-details-grid"
import { GmtFabricCostDialog } from "./gmt-fabric-cost-dialog"
import { GmtGroupDialog } from "./gmt-group-dialog"
import {
  CommissionSection,
  FilesSection,
  IeInfoSection,
  OtherCostSection,
  PriceSection,
  SupplierSection,
  WastageSection,
} from "./gmt-costing-sections"
import { FIELD_CLASS, FieldLabel, INPUT_CLASS, LookupCombobox, NumInput, SECTION_CARD_CLASS, formatNumber } from "./gmt-ui"
import { AppDatePicker } from "@/components/app-date-picker"

export type GmtCostingDialogMode = "create" | "edit" | "view" | "copy"

type SectionId = "basic" | "details" | "wastage" | "other-cost" | "commission" | "price" | "ie" | "suppliers" | "files"

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Info }> = [
  { id: "basic", label: "Basic Info", icon: Info },
  { id: "details", label: "Details", icon: Layers },
  { id: "wastage", label: "GMT Wastage", icon: Percent },
  { id: "other-cost", label: "Other Cost", icon: BadgeDollarSign },
  { id: "commission", label: "Commission", icon: Users },
  { id: "price", label: "Price", icon: Calculator },
  { id: "ie", label: "IE Info", icon: Factory },
  { id: "suppliers", label: "Item Suppliers", icon: Truck },
  { id: "files", label: "Files", icon: Paperclip },
]

const DEFAULT_OTHER_COST_NAME = "CM"
const DEFAULT_COMMISSION_NAME = "COMMERCIAL"
const named = (scope: CostScope, name: string) => scope.name.trim().toUpperCase() === name

/** A loaded costing as a new one: every saved id reset, a new name. */
function asCopy(source: GmtCosting): GmtCosting {
  return {
    ...source,
    id: "",
    costName: `${source.costName} (copy)`,
    lstDetails: source.lstDetails.map((row) => copyDetail(row)),
    lstGMTCostPerPcs: source.lstGMTCostPerPcs.map((r) => ({ ...r, clientId: newClientId(), id: "", masterId: "" })),
    lstGMTOtherCost: source.lstGMTOtherCost.map((r) => ({
      ...r,
      clientId: newClientId(),
      id: "",
      masterId: "",
      lstColors: r.lstColors.map((c) => ({ ...c, clientId: newClientId(), id: "", otherCostDtlsId: "" })),
    })),
    lstGMTCommission: source.lstGMTCommission.map((r) => ({ ...r, clientId: newClientId(), id: "", masterId: "" })),
    lstFile: [],
    lstItemWiseSupplier: source.lstItemWiseSupplier.map((r) => ({
      ...r,
      clientId: newClientId(),
      id: "",
      masterId: "",
      lstSupplierDetails: r.lstSupplierDetails.map((s) => ({ ...s, clientId: newClientId(), id: "", itemWiseSupplierMasterId: "" })),
    })),
    createdBy: null,
    createdDate: null,
    updatedBy: null,
    updatedDate: null,
    createdByName: null,
    updatedByName: null,
  }
}

export function GmtCostingFormDialog({
  open,
  mode: initialMode,
  costingId,
  ctx,
  access,
  onAuthFailure,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  mode: GmtCostingDialogMode
  costingId: string | null
  ctx: ApiContext
  access: AccessRules
  onAuthFailure: (message: string) => boolean
  onOpenChange: (open: boolean) => void
  onSaved: (id: string) => void
}) {
  const [mode, setMode] = useState<GmtCostingDialogMode>(initialMode)
  const readOnly = mode === "view"
  const [costing, setCosting] = useState<GmtCosting>(emptyCosting)
  const [loading, setLoading] = useState(initialMode !== "create")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [scopes, setScopes] = useState<CostScope[]>([])
  const [loadedStyle, setLoadedStyle] = useState<StyleInfo | null>(null)
  const [settings, setSettings] = useState<GmtCostingSettings>(() => readSettings())
  const [fabricFor, setFabricFor] = useState<string | null>(null)
  const [groupFor, setGroupFor] = useState<{ clientId: string; kind: GroupKind } | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>("basic")
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({})
  const defaultsAdded = useRef(false)

  const fail = useCallback(
    (caught: unknown, fallback: string) => {
      const message = caught instanceof Error ? caught.message : fallback
      if (!onAuthFailure(message)) toast.error(message)
      return message
    },
    [onAuthFailure],
  )

  // the costing
  useEffect(() => {
    if (initialMode === "create" || !costingId) return
    let active = true
    fetchGmtCosting(ctx, costingId)
      .then((dto) => {
        if (!active) return
        const loaded = costingFromDto(dto)
        // a row whose GMT W% lags its wastage lines (saved by an older screen) shows their sum, and the totals on it
        const isForward = readSettings().isGmtForwardCalculation
        loaded.lstDetails = loaded.lstDetails.map((row) => {
          if (row.lstGMTWastage.length === 0) return row
          const total = gmtWastageTotalOf(row.lstGMTWastage)
          return total === row.gmtWastagePercentage ? row : recalcRow({ ...row, gmtWastagePercentage: total }, isForward)
        })
        setCosting(initialMode === "copy" ? asCopy(loaded) : loaded)
        if (initialMode === "copy") setDirty(true)
      })
      .catch((caught) => {
        fail(caught, "Unable to load the GMT costing.")
        onOpenChange(false)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [costingId, ctx, fail, initialMode, onOpenChange])

  // the cost scopes (process / GMT process / other cost / commission pickers)
  useEffect(() => {
    let active = true
    fetchCostScopes(ctx)
      .then((list) => active && setScopes(list))
      .catch((caught) => fail(caught, "Unable to load the GMT cost scopes."))
    return () => {
      active = false
    }
  }, [ctx, fail])

  // the style's colors and sizes
  useEffect(() => {
    if (!costing.styleId) return
    let active = true
    fetchStyleInfo(ctx, costing.styleId)
      .then((info) => active && setLoadedStyle(info))
      .catch(() => active && setLoadedStyle(null))
    return () => {
      active = false
    }
  }, [costing.styleId, ctx])
  const style = loadedStyle && loadedStyle.id === costing.styleId ? loadedStyle : null

  // a new costing starts with a CM other cost and a COMMERCIAL commission, when the scopes have them
  useEffect(() => {
    if (mode !== "create" || defaultsAdded.current || scopes.length === 0) return
    defaultsAdded.current = true
    const cm = scopes.find((s) => s.isOtherTypeCost && named(s, DEFAULT_OTHER_COST_NAME))
    const commercial = scopes.find((s) => s.isCommission && named(s, DEFAULT_COMMISSION_NAME))
    setCosting((current) => ({
      ...current,
      lstGMTOtherCost:
        cm && !current.lstGMTOtherCost.some((o) => o.costId === cm.id) ? [...current.lstGMTOtherCost, emptyOtherCost(cm)] : current.lstGMTOtherCost,
      lstGMTCommission:
        commercial && !current.lstGMTCommission.some((c) => c.commissionId === commercial.id)
          ? [...current.lstGMTCommission, emptyCommission(commercial)]
          : current.lstGMTCommission,
    }))
  }, [mode, scopes])

  const update = useCallback((change: Partial<GmtCosting>) => {
    setCosting((current) => ({ ...current, ...change }))
    setDirty(true)
  }, [])
  const setRows = useCallback((lstDetails: GmtCostingDetail[]) => update({ lstDetails }), [update])

  const groups = useMemo(() => processGroupsOf(scopes, settings), [scopes, settings])
  const prices = useMemo(
    () => buildPriceRows(costing.lstDetails, costing.lstGMTOtherCost, costing.lstGMTCommission),
    [costing.lstDetails, costing.lstGMTCommission, costing.lstGMTOtherCost],
  )
  const perPcs = useMemo(() => costPerPcsFromPrices(prices, costing.lstGMTCostPerPcs), [costing.lstGMTCostPerPcs, prices])
  const supplierRows = useMemo(
    () => itemWiseSupplierRows(costing.lstItemWiseSupplier, costing.lstDetails),
    [costing.lstDetails, costing.lstItemWiseSupplier],
  )

  // lookups
  const loadBuyers = useCallback((p: AppComboboxLoadParams) => loadBuyerOptions(ctx, p), [ctx])
  const buyerKey = costing.buyerId ? String(costing.buyerId) : undefined
  const loadStyles = useCallback((p: AppComboboxLoadParams) => loadStyleOptions(ctx, p, buyerKey), [buyerKey, ctx])
  const styleKey = costing.styleId ? String(costing.styleId) : undefined
  const loadTechSheets = useCallback((p: AppComboboxLoadParams) => loadTechSheetOptions(ctx, p, styleKey), [ctx, styleKey])
  const loadMaterials = useCallback((p: AppComboboxLoadParams) => loadMaterialOptions(ctx, p), [ctx])
  const loadParts = useCallback((p: AppComboboxLoadParams) => loadPartOptions(ctx, p), [ctx])
  const loadColors = useCallback((p: AppComboboxLoadParams) => loadColorOptions(ctx, p), [ctx])
  const loadSuppliers = useCallback((p: AppComboboxLoadParams) => loadSupplierOptions(ctx, p), [ctx])
  const resolveMaterial = useCallback(
    async (id: string) => {
      const info = await fetchMaterialInfo(ctx, id)
      return info ? { unitId: info.unitId, unitName: info.unitName, isColorWise: isFabricGroup(info.materialGroupName, settings) } : null
    },
    [ctx, settings],
  )

  function changeSettings(next: GmtCostingSettings) {
    setSettings(next)
    writeSettings(next)
    if (next.isGmtForwardCalculation !== settings.isGmtForwardCalculation && !readOnly) {
      setCosting((current) => ({ ...current, lstDetails: current.lstDetails.map((r) => recalcRow(r, next.isGmtForwardCalculation)) }))
      setDirty(true)
    }
  }

  function scrollTo(id: SectionId) {
    setActiveSection(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function validate() {
    const problems: string[] = []
    if (!costing.costName.trim()) problems.push("Cost name is required.")
    if (!costing.buyerId) problems.push("Buyer is required.")
    if (!costing.styleId) problems.push("Style is required.")
    if (!costing.costDate) problems.push("Cost date is required.")
    if (costing.lstDetails.length === 0) problems.push("Add at least one details row.")
    costing.lstDetails.forEach((row, i) => {
      if (!row.fabricItemId) problems.push(`Details row ${i + 1}: pick the fabric / item.`)
      if (row.gmtWastagePercentage < 0 || row.gmtWastagePercentage > 100) problems.push(`Details row ${i + 1}: GMT W% must be 0 to 100.`)
    })
    costing.lstGMTOtherCost.forEach((row, i) => {
      if (!row.costId && (row.costPerPcsGmt || row.costPerDznGmt)) problems.push(`Other cost row ${i + 1}: pick the cost.`)
    })
    costing.lstGMTCommission.forEach((row, i) => {
      if (!row.commissionId && (row.commissionPercentage || row.commissionValue)) problems.push(`Commission row ${i + 1}: pick the commission.`)
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
      const body = costingToDto(
        { ...costing, lstGMTCostPerPcs: perPcs, lstItemWiseSupplier: supplierRows, costName: costing.costName.trim() },
        settings,
      )
      if (costing.id) {
        await updateGmtCosting(ctx, costing.id, body)
        const reloaded = costingFromDto(await fetchGmtCosting(ctx, costing.id))
        setCosting(reloaded)
        setDirty(false)
        toast.success("GMT costing updated.")
        onSaved(reloaded.id)
      } else {
        const saved = costingFromDto(await createGmtCosting(ctx, body))
        setCosting(saved)
        setMode("edit")
        setDirty(false)
        toast.success("GMT costing saved.")
        onSaved(saved.id)
      }
    } catch (caught) {
      setErrors([fail(caught, "Unable to save the GMT costing.")])
    } finally {
      setSaving(false)
    }
  }

  function requestClose() {
    if (dirty && !readOnly) setConfirmClose(true)
    else onOpenChange(false)
  }

  const fabricRow = fabricFor ? costing.lstDetails.find((r) => r.clientId === fabricFor) ?? null : null
  const groupRow = groupFor ? costing.lstDetails.find((r) => r.clientId === groupFor.clientId) ?? null : null
  const title =
    mode === "create" ? "New GMT costing" : mode === "copy" ? "Copy GMT costing" : mode === "view" ? "GMT costing" : "Edit GMT costing"

  const sectionCount: Partial<Record<SectionId, number>> = {
    details: costing.lstDetails.length,
    "other-cost": costing.lstGMTOtherCost.length,
    commission: costing.lstGMTCommission.length,
    price: perPcs.length,
    files: costing.lstFile.length,
  }

  function sectionCard(id: SectionId, heading: string, body: React.ReactNode, actions?: React.ReactNode) {
    return (
      <Card
        ref={(el) => {
          sectionRefs.current[id] = el
        }}
        id={`gmt-${id}`}
        className={SECTION_CARD_CLASS}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-2 px-4 pt-3 pb-2">
          <CardTitle className="text-sm">{heading}</CardTitle>
          {actions}
        </CardHeader>
        <CardContent className="max-w-full min-w-0 px-3 pb-3 sm:px-4">{body}</CardContent>
      </Card>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <DialogContent
        showCloseButton
        className="top-0 left-0 h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-slate-200/70 bg-slate-50 p-0 shadow-2xl sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg 2xl:w-[min(1700px,calc(100vw-2rem))] 2xl:max-w-[min(1700px,calc(100vw-2rem))] dark:border-white/10 dark:bg-[#080a14]"
      >
        <form
          className="grid h-full min-h-0 w-full max-w-full min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden sm:max-h-[calc(100vh-2rem)] sm:min-h-[85vh]"
          onSubmit={(event) => {
            event.preventDefault()
            if (!readOnly) void save()
          }}
        >
          <div className="flex min-h-0 w-full max-w-full min-w-0 overflow-hidden">
            <aside className="hidden w-[220px] shrink-0 border-r border-slate-200/70 bg-white/55 p-3 lg:block dark:border-white/10 dark:bg-[#0a0d19]/90">
              <nav className="space-y-1.5">
                {SECTIONS.map((section) => {
                  const Icon = section.icon
                  const active = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollTo(section.id)}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-slate-600 transition-colors dark:text-slate-300",
                        active ? "border-l-2 border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "hover:bg-slate-900/5 dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      {typeof sectionCount[section.id] === "number" ? (
                        <Badge className="rounded-md bg-blue-600/15 px-2 py-0 text-xs text-blue-700 hover:bg-blue-600/15 dark:text-blue-200">
                          {sectionCount[section.id]}
                        </Badge>
                      ) : null}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <div className="min-h-0 w-full max-w-full min-w-0 overflow-hidden">
              <ScrollArea
                className="h-full min-h-0 w-full max-w-full min-w-0 overflow-hidden"
                viewportClassName="overflow-x-hidden [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full"
              >
                <div className="w-full max-w-full min-w-0 space-y-2.5 overflow-x-hidden p-2 sm:p-3">
                  <DialogHeader className="flex flex-col gap-2 rounded-lg border border-slate-200/70 bg-white/90 p-3 sm:flex-row sm:items-start sm:justify-between dark:border-white/10 dark:bg-[#17131d]/90">
                    <div className="space-y-1">
                      <DialogTitle>{title}</DialogTitle>
                      <DialogDescription>
                        {costing.costName ? `${costing.costName} · ` : ""}
                        {costing.buyerName || "Buyer"} · {costing.styleNo || "Style"}
                        {costing.updatedByName ? ` · last changed by ${costing.updatedByName}` : costing.createdByName ? ` · by ${costing.createdByName}` : ""}
                      </DialogDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {prices.length ? (
                        <Badge variant="outline" className="rounded-md">
                          Price {formatNumber(Math.min(...prices.map((p) => p.price)))}
                          {prices.length > 1 ? ` – ${formatNumber(Math.max(...prices.map((p) => p.price)))}` : ""} $/pcs
                        </Badge>
                      ) : null}
                      {readOnly && access.canUpdate ? (
                        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setMode("edit")}>
                          Edit
                        </Button>
                      ) : null}
                      <SettingsPopover settings={settings} disabled={readOnly} onChange={changeSettings} />
                    </div>
                  </DialogHeader>

                  {errors.length ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                      <p className="font-medium">Please fix the following:</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4">
                        {errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <>
                      {sectionCard(
                        "basic",
                        "Basic Info",
                        <div className="grid max-w-full min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className={cn(FIELD_CLASS, "xl:col-span-2")}>
                            <FieldLabel required htmlFor="gmtCostName">Cost Name</FieldLabel>
                            <Input
                              id="gmtCostName"
                              value={costing.costName}
                              readOnly={readOnly}
                              maxLength={200}
                              onChange={(e) => update({ costName: e.target.value })}
                              className={INPUT_CLASS}
                              placeholder="e.g. Style 1234 - SS27"
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>Buyer</FieldLabel>
                            <LookupCombobox
                              value={costing.buyerId}
                              label={costing.buyerName}
                              loadItems={loadBuyers}
                              placeholder="Buyer"
                              disabled={readOnly}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => {
                                const buyerId = o ? String(o.value) : ""
                                if (buyerId === costing.buyerId) return
                                update({ buyerId, buyerName: o?.label ?? "", styleId: "", styleNo: "", styleName: "", techSheetId: null, technicalSheetNo: "" })
                              }}
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel required>Style</FieldLabel>
                            <LookupCombobox
                              key={`style-${costing.buyerId}`}
                              value={costing.styleId}
                              label={costing.styleNo}
                              loadItems={loadStyles}
                              placeholder={costing.buyerId ? "Style" : "Pick a buyer first"}
                              disabled={readOnly || !costing.buyerId}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => update({ styleId: o ? String(o.value) : "", styleNo: o?.label ?? "", styleName: "", techSheetId: null, technicalSheetNo: "" })}
                            />
                            {style?.styleName ? <p className="truncate text-[11px] text-slate-500">{style.styleName}</p> : null}
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Technical Sheet</FieldLabel>
                            <LookupCombobox
                              key={`ts-${costing.styleId}`}
                              value={costing.techSheetId}
                              label={costing.technicalSheetNo}
                              loadItems={loadTechSheets}
                              placeholder={costing.styleId ? "Technical sheet" : "Pick a style first"}
                              disabled={readOnly || !costing.styleId}
                              inputClassName={INPUT_CLASS}
                              onChange={(o) => update({ techSheetId: o ? String(o.value) : null, technicalSheetNo: o?.label ?? "" })}
                            />
                          </div>
                          <DateField label="Cost Date" required value={costing.costDate} readOnly={readOnly} onChange={(v) => update({ costDate: v })} />
                          <DateField label="Ship Date" value={costing.shipDate} readOnly={readOnly} onChange={(v) => update({ shipDate: v })} />
                          <DateField label="Confirm Date" value={costing.confirmDate} readOnly={readOnly} onChange={(v) => update({ confirmDate: v })} />
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Lead Time (days)</FieldLabel>
                            <NumInput value={costing.leadTime} onValueChange={readOnly ? undefined : (v) => update({ leadTime: Math.max(0, Math.round(v)) })} />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>Expected Order Qty</FieldLabel>
                            <NumInput
                              value={costing.expectedOrderQty}
                              onValueChange={readOnly ? undefined : (v) => update({ expectedOrderQty: Math.max(0, Math.round(v)) })}
                            />
                          </div>
                          <div className={FIELD_CLASS}>
                            <FieldLabel>GMT Total Cost FOB ($)</FieldLabel>
                            <div className="flex gap-1">
                              <NumInput value={costing.gmtTotalCostFob} onValueChange={readOnly ? undefined : (v) => update({ gmtTotalCostFob: v })} />
                              {!readOnly && prices.length ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  title="The highest confirmed price, else the highest costing price"
                                  onClick={() => update({ gmtTotalCostFob: fobOf(perPcs, prices) })}
                                >
                                  From price
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          <label className="flex items-end gap-2 pb-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <Checkbox checked={costing.isActive} disabled={readOnly} onCheckedChange={(v) => update({ isActive: Boolean(v) })} />
                            Active
                          </label>
                        </div>,
                      )}

                      {sectionCard(
                        "details",
                        "Details",
                        <GmtDetailsGrid
                          rows={costing.lstDetails}
                          onRowsChange={setRows}
                          readOnly={readOnly}
                          isGmtForward={settings.isGmtForwardCalculation}
                          style={style}
                          loadMaterials={loadMaterials}
                          loadParts={loadParts}
                          loadColors={loadColors}
                          resolveMaterial={resolveMaterial}
                          onOpenFabricCost={setFabricFor}
                          onOpenGroup={(clientId, kind) => setGroupFor({ clientId, kind })}
                        />,
                      )}

                      {sectionCard(
                        "wastage",
                        "GMT Wastage",
                        <WastageSection
                          rows={costing.lstDetails}
                          scopes={scopes}
                          readOnly={readOnly}
                          isGmtForward={settings.isGmtForwardCalculation}
                          onChange={setRows}
                        />,
                      )}

                      {sectionCard(
                        "other-cost",
                        "Other Cost",
                        <OtherCostSection
                          rows={costing.lstGMTOtherCost}
                          scopes={scopes}
                          style={style}
                          readOnly={readOnly}
                          onChange={(lstGMTOtherCost) => update({ lstGMTOtherCost })}
                        />,
                      )}

                      {sectionCard(
                        "commission",
                        "Commission",
                        <CommissionSection
                          rows={costing.lstGMTCommission}
                          scopes={scopes}
                          readOnly={readOnly}
                          onChange={(lstGMTCommission) => update({ lstGMTCommission })}
                        />,
                      )}

                      {sectionCard(
                        "price",
                        "Price per Color & Size Group",
                        <PriceSection prices={prices} perPcs={perPcs} readOnly={readOnly} onChange={(lstGMTCostPerPcs) => update({ lstGMTCostPerPcs })} />,
                      )}

                      {sectionCard("ie", "IE Info", <IeInfoSection costing={costing} readOnly={readOnly} onChange={update} />)}

                      {sectionCard(
                        "suppliers",
                        "Item-wise Supplier",
                        <SupplierSection
                          rows={supplierRows}
                          readOnly={readOnly}
                          loadSuppliers={loadSuppliers}
                          onChange={(lstItemWiseSupplier) => update({ lstItemWiseSupplier })}
                        />,
                      )}

                      {sectionCard(
                        "files",
                        "Files",
                        <FilesSection
                          files={costing.lstFile}
                          readOnly={readOnly}
                          onUpload={(file) => uploadFile(ctx, file)}
                          onDownload={(id, name) =>
                            void downloadAttachment(ctx, id)
                              .then((blob) => saveBlob(blob, name))
                              .catch((caught) => fail(caught, "Unable to download the file."))
                          }
                          onChange={(lstFile) => update({ lstFile })}
                        />,
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 px-3 py-3 sm:px-4 dark:border-white/10 dark:bg-[#0a0d19]/95">
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <p className="mr-auto hidden text-xs text-slate-500 sm:block">
                {dirty && !readOnly ? "Unsaved changes" : costing.id ? `Costing #${costing.id}` : ""}
              </p>
              <Button type="button" variant="outline" className="rounded-xl" onClick={requestClose}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly ? (
                <Button type="submit" disabled={loading || saving} className="rounded-xl">
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
                  {costing.id ? "Save changes" : "Save GMT costing"}
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        </form>

        {fabricRow ? (
          <GmtFabricCostDialog
            ctx={ctx}
            row={fabricRow}
            rows={costing.lstDetails}
            readOnly={readOnly}
            scopes={scopes}
            groups={groups}
            isForward={settings.isFabricForwardCalculation}
            initialSearch={costing.styleNo}
            loadMaterials={loadMaterials}
            loadColors={loadColors}
            onSet={(cost) =>
              setRows(
                costing.lstDetails.map((r) => (r.clientId === fabricRow.clientId ? withFabricCost(r, cost, settings.isGmtForwardCalculation) : r)),
              )
            }
            onClose={() => setFabricFor(null)}
          />
        ) : null}

        {groupRow && groupFor ? (
          <GmtGroupDialog
            kind={groupFor.kind}
            row={groupRow}
            rows={costing.lstDetails}
            styleItems={groupFor.kind === "size" ? style?.sizes ?? [] : style?.colors ?? []}
            readOnly={readOnly}
            onApply={setRows}
            onClose={() => setGroupFor(null)}
          />
        ) : null}

        <AppConfirmDialog
          open={confirmClose}
          title="Discard unsaved changes?"
          description="The changes made to this GMT costing since it was last saved will be lost."
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

function DateField({
  label,
  value,
  required,
  readOnly,
  onChange,
}: {
  label: string
  value: string
  required?: boolean
  readOnly: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className={FIELD_CLASS}>
      <FieldLabel required={required}>{label}</FieldLabel>
      <AppDatePicker value={value} readOnly={readOnly} onValueChange={(value) => onChange(value)} className={INPUT_CLASS} />
    </div>
  )
}

/** ClickERP's page configurations of this page, kept per browser here. */
function SettingsPopover({
  settings,
  disabled,
  onChange,
}: {
  settings: GmtCostingSettings
  disabled: boolean
  onChange: (settings: GmtCostingSettings) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="rounded-lg">
          <Settings2 className="size-3" /> Calculation
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-3 text-xs">
        <p className="font-semibold">Calculation settings (this browser)</p>
        <label className="flex items-start gap-2">
          <Checkbox
            checked={settings.isGmtForwardCalculation}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ ...settings, isGmtForwardCalculation: Boolean(v) })}
          />
          <span>
            GMT wastage forward: qty x (1 + W%). Off: qty ÷ (1 − W%).
          </span>
        </label>
        <label className="flex items-start gap-2">
          <Checkbox
            checked={settings.isFabricForwardCalculation}
            disabled={disabled}
            onCheckedChange={(v) => onChange({ ...settings, isFabricForwardCalculation: Boolean(v) })}
          />
          <span>Fabric costing wastage forward (same rule, for yarn qty).</span>
        </label>
        <SettingText
          label="Fabric material group names"
          hint="Items of these groups are Color Wise when picked."
          value={settings.fabricMaterialGroupNames}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, fabricMaterialGroupNames: v })}
        />
        <SettingText
          label="Knitting process names"
          hint="Cost scopes left out of the grey yarn qty."
          value={settings.knittingProcessNames}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, knittingProcessNames: v })}
        />
        <SettingText
          label="Yarn dyeing process names"
          hint="Left out of the grey and the dyed yarn qty."
          value={settings.yarnDyeingProcessNames}
          disabled={disabled}
          onChange={(v) => onChange({ ...settings, yarnDyeingProcessNames: v })}
        />
      </PopoverContent>
    </Popover>
  )
}

function SettingText({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1">
      <FieldLabel>{label}</FieldLabel>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS} placeholder="Comma-separated" />
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  )
}
