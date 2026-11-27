"use client"

// The fabric costing of one details row (desktop frmImportFabricCosting). Yarns with their req qty per kg of
// fabric and price, the common processes (rate and wastage per kg fabric), and per-yarn extra processes;
// every total recalculates as it is typed. Load a costing from another row of this costing (This costing)
// or from any GMT costing of the organization (Other costings). Set writes it onto the row, whose item price
// then follows the fabric cost.

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { AppCombobox } from "@/components/app-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import {
  copyFabricCost,
  emptyFabricCost,
  emptyProcess,
  emptyYarn,
  emptyYarnProcess,
  fabricWastagePercent,
  recalcFabricCost,
  thisCostingItems,
  type ProcessGroups,
} from "../gmt-costing.calc"
import { searchFabricCosts, type ApiContext } from "../gmt-costing.api"
import type {
  CostScope,
  FabricCostSearchItem,
  GmtCostingDetail,
  GmtFabricCost,
  GmtFabricCostProcess,
  GmtFabricCostYarn,
  GmtFabricCostYarnProcess,
} from "../gmt-costing.types"
import { CELL_INPUT_CLASS, COMBO_CONTENT_CLASS, LookupCombobox, NumInput, TD_CLASS, TH_CLASS, formatNumber } from "./gmt-ui"

type Load = (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>

export function GmtFabricCostDialog({
  ctx,
  row,
  rows,
  readOnly,
  scopes,
  groups,
  isForward,
  initialSearch,
  loadMaterials,
  loadColors,
  onSet,
  onClose,
}: {
  ctx: ApiContext
  row: GmtCostingDetail
  rows: GmtCostingDetail[]
  readOnly: boolean
  scopes: CostScope[]
  groups: ProcessGroups
  isForward: boolean
  /** The Other costings tab starts searching for this (the costing's style no). */
  initialSearch: string
  loadMaterials: Load
  loadColors: Load
  onSet: (cost: GmtFabricCost | null) => void
  onClose: () => void
}) {
  // recalculated on open, so a saved costing shows the current direction
  const [cost, setCost] = useState<GmtFabricCost>(() => {
    const start = row.FabricCost
      ? { ...row.FabricCost }
      : { ...emptyFabricCost(), fabricId: row.fabricItemId || null, fabricName: row.fabricItemName }
    const result = recalcFabricCost(start.lastYarnDtls, start.lstProcessDtls, groups, isForward)
    return { ...start, lastYarnDtls: result.yarns, totalFabricCost: result.totalFabricCost }
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<"this" | "other">("this")

  const processOptions = useMemo(
    () => scopes.filter((s) => s.isProcessCost).map((s) => ({ value: String(s.id), label: s.name })),
    [scopes],
  )

  /** Every change goes through here: the yarn totals and the fabric cost follow. */
  const commit = useCallback(
    (next: Pick<GmtFabricCost, "lastYarnDtls" | "lstProcessDtls"> & Partial<GmtFabricCost>) => {
      setCost((current) => {
        const merged = { ...current, ...next }
        const result = recalcFabricCost(merged.lastYarnDtls, merged.lstProcessDtls, groups, isForward)
        return { ...merged, lastYarnDtls: result.yarns, totalFabricCost: result.totalFabricCost }
      })
    },
    [groups, isForward],
  )

  const yarns = cost.lastYarnDtls
  const processes = cost.lstProcessDtls
  const setYarns = (next: GmtFabricCostYarn[]) => commit({ lastYarnDtls: next, lstProcessDtls: processes })
  const setProcesses = (next: GmtFabricCostProcess[]) => commit({ lastYarnDtls: yarns, lstProcessDtls: next })
  const patchYarn = (clientId: string, change: Partial<GmtFabricCostYarn>) =>
    setYarns(yarns.map((y) => (y.clientId === clientId ? { ...y, ...change } : y)))
  const patchProcess = (clientId: string, change: Partial<GmtFabricCostProcess>) =>
    setProcesses(processes.map((p) => (p.clientId === clientId ? { ...p, ...change } : p)))
  const patchYarnProcess = (yarnId: string, clientId: string, change: Partial<GmtFabricCostYarnProcess>) =>
    setYarns(
      yarns.map((y) =>
        y.clientId === yarnId
          ? { ...y, lstYarnWiseProcessDtls: y.lstYarnWiseProcessDtls.map((p) => (p.clientId === clientId ? { ...p, ...change } : p)) }
          : y,
      ),
    )

  const loadCosting = (source: GmtFabricCost) => {
    const copy = copyFabricCost(source)
    commit({ ...copy, id: cost.id, detailsId: cost.detailsId, fabricId: row.fabricItemId || copy.fabricId, fabricName: row.fabricItemName })
    toast.success("Fabric costing loaded. Set writes it onto the row.")
  }

  const totalRatio = yarns.reduce((s, y) => s + Number(y.yarnReqQtyPerKgFabric || 0), 0)
  const wastage = fabricWastagePercent(yarns, isForward)
  const thisItems = useMemo(() => thisCostingItems(rows, row.clientId), [row.clientId, rows])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[min(1500px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <DialogHeader className="border-b border-slate-200/70 p-4 dark:border-white/10">
          <DialogTitle>Fabric costing</DialogTitle>
          <DialogDescription>
            {row.fabricItemName || "Fabric"} {row.gmtPartsName ? `· ${row.gmtPartsName}` : ""} · {isForward ? "forward" : "backward"} wastage
            calculation
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {!readOnly ? (
            <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-slate-200/70 lg:max-h-none lg:w-80 lg:border-r lg:border-b-0 dark:border-white/10">
              <div className="flex gap-1 p-2">
                <Button type="button" size="sm" variant={tab === "this" ? "secondary" : "ghost"} className="flex-1" onClick={() => setTab("this")}>
                  This costing ({thisItems.length})
                </Button>
                <Button type="button" size="sm" variant={tab === "other" ? "secondary" : "ghost"} className="flex-1" onClick={() => setTab("other")}>
                  Other costings
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {tab === "this" ? (
                  thisItems.length === 0 ? (
                    <p className="p-2 text-xs text-slate-500">No other row of this costing has a fabric costing yet.</p>
                  ) : (
                    thisItems.map((item) => (
                      <CostingCard key={item.key} title={item.label} cost={item.cost} onLoad={() => loadCosting(item.cost)} />
                    ))
                  )
                ) : (
                  <OtherCostings ctx={ctx} initialSearch={initialSearch} onLoad={loadCosting} />
                )}
              </div>
            </aside>
          ) : null}

          <ScrollArea
            className="min-h-0 min-w-0 flex-1"
            viewportClassName="overflow-x-hidden [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full"
          >
            <div className="w-full max-w-full min-w-0 space-y-4 p-3 sm:p-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Yarns</h3>
                  {!readOnly ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setYarns([...yarns, emptyYarn()])}>
                      <Plus className="size-3" /> Add yarn
                    </Button>
                  ) : null}
                </div>
                <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-slate-200/70 dark:border-white/10">
                  <table className="w-full min-w-[1500px] border-collapse text-xs">
                    <thead className="bg-slate-50/80 dark:bg-white/5">
                      <tr className="border-b">
                        <th className={cn(TH_CLASS, "w-8")} />
                        <th className={cn(TH_CLASS, "min-w-56")}>Yarn</th>
                        <th className={cn(TH_CLASS, "w-24")} title="A">Req Qty/Kg Fabric</th>
                        <th className={cn(TH_CLASS, "w-24")}>Raw Price/Kg</th>
                        <th className={cn(TH_CLASS, "w-20")}>Import Charge %</th>
                        <th className={cn(TH_CLASS, "w-24")} title="Raw price / (1 - import %)">Total Price/Kg</th>
                        <th className={cn(TH_CLASS, "w-24")} title="E: A grown by every process wastage">Total Qty/Kg Fabric</th>
                        <th className={cn(TH_CLASS, "w-24")} title="Without knitting and yarn dyeing wastage">Grey Qty</th>
                        <th className={cn(TH_CLASS, "w-24")} title="Without yarn dyeing wastage">Dyed Qty</th>
                        <th className={cn(TH_CLASS, "min-w-40")}>Yarn Dyeing Color</th>
                        <th className={cn(TH_CLASS, "w-28")}>Strip Measurement</th>
                        <th className={cn(TH_CLASS, "w-24")} title="E x (total price + process rates)">Price/Kg Fabric</th>
                        <th className={cn(TH_CLASS, "w-10")} />
                      </tr>
                    </thead>
                    <tbody>
                      {yarns.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="p-6 text-center text-slate-500">No yarns.</td>
                        </tr>
                      ) : null}
                      {yarns.map((yarn) => {
                        const open = expanded.has(yarn.clientId)
                        return (
                          <YarnRows
                            key={yarn.clientId}
                            yarn={yarn}
                            open={open}
                            readOnly={readOnly}
                            processOptions={processOptions}
                            loadMaterials={loadMaterials}
                            loadColors={loadColors}
                            onToggle={() => {
                              const next = new Set(expanded)
                              if (open) next.delete(yarn.clientId)
                              else next.add(yarn.clientId)
                              setExpanded(next)
                            }}
                            onPatch={(change) => patchYarn(yarn.clientId, change)}
                            onPatchProcess={(id, change) => patchYarnProcess(yarn.clientId, id, change)}
                            onRemove={() => setYarns(yarns.filter((y) => y.clientId !== yarn.clientId))}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {yarns.length > 0 && Math.abs(totalRatio - 1) > 0.0001 ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    The yarns&apos; req qty adds up to {formatNumber(totalRatio)} kg per kg of fabric (usually 1).
                  </p>
                ) : null}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Processes (every yarn)</h3>
                  {!readOnly ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => setProcesses([...processes, emptyProcess()])}>
                      <Plus className="size-3" /> Add process
                    </Button>
                  ) : null}
                </div>
                <ProcessTable
                  rows={processes}
                  readOnly={readOnly}
                  options={processOptions}
                  onPatch={patchProcess}
                  onRemove={(id) => setProcesses(processes.filter((p) => p.clientId !== id))}
                />
                {processOptions.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No cost scope is marked as a process cost (GMT Cost Scope setup).</p>
                ) : null}
              </section>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-slate-200/70 p-3 sm:flex-row sm:items-center dark:border-white/10">
          <div className="mr-auto flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="rounded-md" title={`${isForward ? "(ΣE ÷ ΣA − 1)" : "(1 − ΣA ÷ ΣE)"} × 100`}>
              Fabric wastage {formatNumber(wastage, 2)}%
            </Badge>
            <Badge className="rounded-md bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">
              Fabric cost {formatNumber(cost.totalFabricCost)} $/kg
            </Badge>
          </div>
          {!readOnly && row.FabricCost ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                onSet(null)
                onClose()
              }}
            >
              Remove costing
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? (
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => {
                const clean = {
                  ...cost,
                  lastYarnDtls: cost.lastYarnDtls.filter((y) => !!y.yarnId),
                  lstProcessDtls: cost.lstProcessDtls.filter((p) => !!p.processId),
                }
                onSet(clean.lastYarnDtls.length || clean.lstProcessDtls.length ? clean : null)
                onClose()
              }}
            >
              Set
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeCombobox({
  value,
  label,
  options,
  disabled,
  onChange,
}: {
  value: string
  label: string
  options: AppComboboxOption[]
  disabled: boolean
  onChange: (option: AppComboboxOption | null) => void
}) {
  return (
    <AppCombobox
      items={options}
      value={value ? { value: String(value), label: label || String(value) } : null}
      onValueChange={onChange}
      placeholder="Process"
      disabled={disabled}
      inputClassName={CELL_INPUT_CLASS}
      contentClassName={COMBO_CONTENT_CLASS}
    />
  )
}

function ProcessTable({
  rows,
  readOnly,
  options,
  onPatch,
  onRemove,
}: {
  rows: Array<GmtFabricCostProcess | GmtFabricCostYarnProcess>
  readOnly: boolean
  options: AppComboboxOption[]
  onPatch: (clientId: string, change: Partial<GmtFabricCostProcess>) => void
  onRemove: (clientId: string) => void
}) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-slate-200/70 dark:border-white/10">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-xs">
        <thead className="bg-slate-50/80 dark:bg-white/5">
          <tr className="border-b">
            <th className={TH_CLASS}>Process</th>
            <th className={cn(TH_CLASS, "w-36")}>Rate/Kg Fabric ($)</th>
            <th className={cn(TH_CLASS, "w-32")}>Wastage %</th>
            <th className={cn(TH_CLASS, "w-12")} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-4 text-center text-slate-500">No processes.</td>
            </tr>
          ) : null}
          {rows.map((p) => (
            <tr key={p.clientId} className="border-b">
              <td className={TD_CLASS}>
                <ScopeCombobox
                  value={p.processId}
                  label={p.processName}
                  options={options}
                  disabled={readOnly}
                  onChange={(o) => onPatch(p.clientId, { processId: o ? String(o.value) : "", processName: o?.label ?? "" })}
                />
              </td>
              <td className={TD_CLASS}>
                <NumInput value={p.processRatePerKgFabric} onValueChange={readOnly ? undefined : (v) => onPatch(p.clientId, { processRatePerKgFabric: v })} />
              </td>
              <td className={TD_CLASS}>
                <NumInput value={p.wastagePercentage} onValueChange={readOnly ? undefined : (v) => onPatch(p.clientId, { wastagePercentage: v })} />
              </td>
              <td className={cn(TD_CLASS, "text-right")}>
                {!readOnly ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove process" onClick={() => onRemove(p.clientId)}>
                    <Trash2 className="size-3.5 text-red-600" />
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function YarnRows({
  yarn,
  open,
  readOnly,
  processOptions,
  loadMaterials,
  loadColors,
  onToggle,
  onPatch,
  onPatchProcess,
  onRemove,
}: {
  yarn: GmtFabricCostYarn
  open: boolean
  readOnly: boolean
  processOptions: AppComboboxOption[]
  loadMaterials: Load
  loadColors: Load
  onToggle: () => void
  onPatch: (change: Partial<GmtFabricCostYarn>) => void
  onPatchProcess: (clientId: string, change: Partial<GmtFabricCostYarnProcess>) => void
  onRemove: () => void
}) {
  const ownCount = yarn.lstYarnWiseProcessDtls.length
  return (
    <>
      <tr className="border-b">
        <td className={TD_CLASS}>
          <Button type="button" variant="ghost" size="icon-xs" onClick={onToggle} title="This yarn's own processes" aria-label="Toggle yarn processes">
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </Button>
        </td>
        <td className={TD_CLASS}>
          <div className="flex items-center gap-1">
            <LookupCombobox
              className="min-w-0 flex-1"
              value={yarn.yarnId}
              label={yarn.yarnName}
              loadItems={loadMaterials}
              placeholder="Yarn"
              disabled={readOnly}
              onChange={(o) => onPatch({ yarnId: o ? String(o.value) : "", yarnName: o?.label ?? "" })}
            />
            {ownCount ? <Badge variant="outline" className="rounded-md px-1 text-[10px]">+{ownCount}</Badge> : null}
          </div>
        </td>
        <td className={TD_CLASS}>
          <NumInput value={yarn.yarnReqQtyPerKgFabric} onValueChange={readOnly ? undefined : (v) => onPatch({ yarnReqQtyPerKgFabric: v })} />
        </td>
        <td className={TD_CLASS}>
          <NumInput value={yarn.rowYarnPricePerKg} onValueChange={readOnly ? undefined : (v) => onPatch({ rowYarnPricePerKg: v })} />
        </td>
        <td className={TD_CLASS}>
          <NumInput
            value={yarn.importChargePercentagePerKgYarn}
            onValueChange={readOnly ? undefined : (v) => onPatch({ importChargePercentagePerKgYarn: v })}
          />
        </td>
        <td className={TD_CLASS}><NumInput value={yarn.totalYarnPricePerKg} /></td>
        <td className={TD_CLASS}><NumInput value={yarn.totalYarnReqQtyPerKgFabric} /></td>
        <td className={TD_CLASS}><NumInput value={yarn.totalGreyReqQtyPerKgFabric} /></td>
        <td className={TD_CLASS}><NumInput value={yarn.totalDyedYarnReqQtyPerKgFabric} /></td>
        <td className={TD_CLASS}>
          <LookupCombobox
            value={yarn.yarnDyeingColorId}
            label={yarn.yarnDyeingColorName}
            loadItems={loadColors}
            placeholder="Color"
            disabled={readOnly}
            onChange={(o) => onPatch({ yarnDyeingColorId: o ? String(o.value) : null, yarnDyeingColorName: o?.label ?? "" })}
          />
        </td>
        <td className={TD_CLASS}>
          <Input
            value={yarn.stripMeasurement}
            readOnly={readOnly}
            maxLength={100}
            className={CELL_INPUT_CLASS}
            onChange={(e) => onPatch({ stripMeasurement: e.target.value })}
          />
        </td>
        <td className={TD_CLASS}><NumInput value={yarn.totalYarnPricePerKgFabric} /></td>
        <td className={cn(TD_CLASS, "text-right")}>
          {!readOnly ? (
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove yarn" onClick={onRemove}>
              <Trash2 className="size-3.5 text-red-600" />
            </Button>
          ) : null}
        </td>
      </tr>
      {open ? (
        <tr className="border-b bg-slate-50/60 dark:bg-white/[0.03]">
          <td />
          <td colSpan={12} className="p-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-medium">Processes of {yarn.yarnName || "this yarn"} only</p>
                {!readOnly ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => onPatch({ lstYarnWiseProcessDtls: [...yarn.lstYarnWiseProcessDtls, emptyYarnProcess()] })}
                  >
                    <Plus className="size-2.5" /> Add
                  </Button>
                ) : null}
              </div>
              <ProcessTable
                rows={yarn.lstYarnWiseProcessDtls}
                readOnly={readOnly}
                options={processOptions}
                onPatch={(id, change) => onPatchProcess(id, change)}
                onRemove={(id) => onPatch({ lstYarnWiseProcessDtls: yarn.lstYarnWiseProcessDtls.filter((p) => p.clientId !== id) })}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

function CostingCard({ title, subtitle, cost, onLoad }: { title: string; subtitle?: string; cost: GmtFabricCost; onLoad: () => void }) {
  return (
    <button
      type="button"
      onClick={onLoad}
      className="mb-1.5 w-full rounded-lg border border-slate-200/70 bg-white/80 p-2 text-left text-xs transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-blue-500/10"
    >
      <p className="truncate font-medium">{title || "Fabric costing"}</p>
      {subtitle ? <p className="truncate text-[11px] text-slate-500">{subtitle}</p> : null}
      <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300">
        {cost.lastYarnDtls.map((y) => y.yarnName).filter(Boolean).join(", ") || "No yarn"}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold tabular-nums">{formatNumber(cost.totalFabricCost)} $/kg</p>
    </button>
  )
}

function OtherCostings({ ctx, initialSearch, onLoad }: { ctx: ApiContext; initialSearch: string; onLoad: (cost: GmtFabricCost) => void }) {
  const [search, setSearch] = useState(initialSearch)
  const [query, setQuery] = useState(initialSearch)
  const [items, setItems] = useState<FabricCostSearchItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")
  const requestKey = `${query}|${page}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    let active = true
    searchFabricCosts(ctx, query, page)
      .then((result) => {
        if (!active) return
        setItems((current) => (page === 1 ? result.items : [...current, ...result.items]))
        setHasMore(result.hasMore)
      })
      .catch((caught) => toast.error(caught instanceof Error ? caught.message : "Unable to search fabric costings."))
      .finally(() => active && setLoadedKey(requestKey))
    return () => {
      active = false
    }
  }, [ctx, page, query, requestKey])

  return (
    <div className="space-y-2">
      <form
        className="flex gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(1)
          setQuery(search.trim())
        }}
      >
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buyer, style, costing, fabric" className={CELL_INPUT_CLASS} />
        <Button type="submit" size="icon-sm" variant="outline" aria-label="Search">
          <Search className="size-3" />
        </Button>
      </form>
      {items.length === 0 && !loading ? <p className="p-2 text-xs text-slate-500">No fabric costing found.</p> : null}
      {items.map((item, i) =>
        item.fabricCost ? (
          <CostingCard
            key={`${item.gmtCostingId}-${item.fabricCost.id}-${i}`}
            title={item.fabricCost.fabricName || item.costName}
            subtitle={`${item.costName} · ${item.buyerName} · ${item.styleNo}`}
            cost={item.fabricCost}
            onLoad={() => onLoad(item.fabricCost!)}
          />
        ) : null,
      )}
      {loading ? <Loader2 className="mx-auto size-4 animate-spin text-slate-400" /> : null}
      {hasMore && !loading ? (
        <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setPage((p) => p + 1)}>
          Load more
        </Button>
      ) : null}
    </div>
  )
}
