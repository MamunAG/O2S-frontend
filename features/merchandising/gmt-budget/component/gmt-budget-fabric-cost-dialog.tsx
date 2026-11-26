"use client"

// The fabric costing of one budget row (desktop frmImportFabricCosting_Budget): the costing's figures stay
// read-only beside their budgeted copies (`...Budget`, the processes' `...Buget`), which are typed here.
// Always forward wastage, as the desktop budget. Load from another row of this budget, or from any GMT
// costing of the company (its figures become both the costing and the budgeted values). Set writes it
// onto the row, whose budgeted item price then follows the budgeted fabric cost.

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { ScopePicker } from "../../gmt-costing/component/gmt-costing-sections"
import { CELL_INPUT_CLASS, LookupCombobox, NumInput, TD_CLASS, TH_CLASS, formatNumber } from "../../gmt-costing/component/gmt-ui"
import { searchFabricCosts, type ApiContext } from "../../gmt-costing/gmt-costing.api"
import type { CostScope, FabricCostSearchItem, GmtFabricCost } from "../../gmt-costing/gmt-costing.types"
import {
  copyBudgetFabricCost,
  emptyBudgetFabricCost,
  emptyBudgetProcess,
  emptyBudgetYarn,
  emptyBudgetYarnProcess,
  fabricWastageBudget,
  recalcFabricCostBudget,
  type ProcessGroups,
} from "../gmt-budget.calc"
import type { BudgetDetail, BudgetFabricCost, BudgetFabricProcess, BudgetYarn, BudgetYarnProcess } from "../gmt-budget.types"

type Load = (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>

/** A GMT costing's fabric costing as a budget one: each figure both the costing and the budgeted value. */
function fromCostingFabricCost(fc: GmtFabricCost): BudgetFabricCost {
  return {
    ...emptyBudgetFabricCost(),
    costTemplateName: fc.costTemplateName,
    fabricId: fc.fabricId ?? 0,
    fabricName: fc.fabricName,
    totalFabricCost: fc.totalFabricCost,
    totalFabricCostBudget: fc.totalFabricCost,
    yarns: fc.lastYarnDtls.map((y) => ({
      ...emptyBudgetYarn(),
      yarnId: y.yarnId, yarnName: y.yarnName, uomId: y.uomId, uomName: y.uomName, yarnReqQtyPerKgFabric: y.yarnReqQtyPerKgFabric,
      rowYarnPricePerKg: y.rowYarnPricePerKg, rowYarnPricePerKgBudget: y.rowYarnPricePerKg,
      importChargePercentagePerKgYarn: y.importChargePercentagePerKgYarn, importChargePercentagePerKgYarnBudget: y.importChargePercentagePerKgYarn,
      totalYarnPricePerKg: y.totalYarnPricePerKg, totalYarnPricePerKgFabric: y.totalYarnPricePerKgFabric,
      yarnDyeingColorId: y.yarnDyeingColorId, yarnDyeingColorName: y.yarnDyeingColorName, stripMeasurement: y.stripMeasurement,
      yarnWiseProcesses: y.lstYarnWiseProcessDtls.map((p) => ({
        ...emptyBudgetYarnProcess(), processId: p.processId, processName: p.processName,
        processRatePerKgFabric: p.processRatePerKgFabric, processRatePerKgFabricBuget: p.processRatePerKgFabric,
        wastagePercentage: p.wastagePercentage, wastagePercentageBuget: p.wastagePercentage,
      })),
    })),
    processes: fc.lstProcessDtls.map((p) => ({
      ...emptyBudgetProcess(), processId: p.processId, processName: p.processName,
      processRatePerKgFabric: p.processRatePerKgFabric, processRatePerKgFabricBuget: p.processRatePerKgFabric,
      wastagePercentage: p.wastagePercentage, wastagePercentageBuget: p.wastagePercentage,
    })),
  }
}

export function GmtBudgetFabricCostDialog({
  ctx,
  row,
  rows,
  readOnly,
  scopes,
  groups,
  initialSearch,
  loadMaterials,
  loadColors,
  onSet,
  onClose,
}: {
  ctx: ApiContext
  row: BudgetDetail
  rows: BudgetDetail[]
  readOnly: boolean
  scopes: CostScope[]
  groups: ProcessGroups
  initialSearch: string
  loadMaterials: Load
  loadColors: Load
  onSet: (cost: BudgetFabricCost | null) => void
  onClose: () => void
}) {
  // recalculated on open, so an older budget shows the current split
  const [cost, setCost] = useState<BudgetFabricCost>(() => recalcFabricCostBudget(row.fabricCost ? { ...row.fabricCost } : emptyBudgetFabricCost(row), groups))
  const [tab, setTab] = useState<"this" | "costing">("this")
  const options = useMemo(() => scopes.filter((s) => s.isProcessCost).map((s) => ({ value: String(s.id), label: s.name })), [scopes])

  const commit = (change: Partial<BudgetFabricCost>) => setCost((current) => recalcFabricCostBudget({ ...current, ...change }, groups))
  const patchYarn = (id: string, change: Partial<BudgetYarn>) => commit({ yarns: cost.yarns.map((y) => (y.clientId === id ? { ...y, ...change } : y)) })
  const patchProcess = (id: string, change: Partial<BudgetFabricProcess>) =>
    commit({ processes: cost.processes.map((p) => (p.clientId === id ? { ...p, ...change } : p)) })
  const load = (source: BudgetFabricCost) => {
    const copy = copyBudgetFabricCost(source)
    commit({ ...copy, id: cost.id, detailsId: cost.detailsId, fabricId: row.fabricItemId || copy.fabricId, fabricName: row.fabricItemName })
    toast.success("Fabric costing loaded. Set writes it onto the row.")
  }

  const others = useMemo(
    () => rows.filter((r) => r.clientId !== row.clientId && r.fabricCost?.yarns.length).map((r) => ({ key: r.clientId, label: [r.fabricItemName, r.gmtPartsName, r.colorGroupName].filter(Boolean).join(" · "), cost: r.fabricCost! })),
    [row.clientId, rows],
  )
  const ratio = cost.yarns.reduce((s, y) => s + Number(y.yarnReqQtyPerKgFabric || 0), 0)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="top-0 left-0 flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:top-1/2 sm:left-1/2 sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[min(1600px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <DialogHeader className="border-b border-slate-200/70 p-4 dark:border-white/10">
          <DialogTitle>Fabric costing (budget)</DialogTitle>
          <DialogDescription>
            {row.fabricItemName || "Fabric"} {row.gmtPartsName ? `· ${row.gmtPartsName}` : ""} · {row.colorGroupName} · forward wastage. The costing&apos;s figures are read-only; type the budgeted ones.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {!readOnly ? (
            <aside className="flex max-h-72 w-full shrink-0 flex-col border-b border-slate-200/70 lg:max-h-none lg:w-80 lg:border-r lg:border-b-0 dark:border-white/10">
              <div className="flex gap-1 p-2">
                <Button type="button" size="sm" variant={tab === "this" ? "secondary" : "ghost"} className="flex-1" onClick={() => setTab("this")}>
                  This budget ({others.length})
                </Button>
                <Button type="button" size="sm" variant={tab === "costing" ? "secondary" : "ghost"} className="flex-1" onClick={() => setTab("costing")}>
                  GMT costings
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {tab === "this" ? (
                  others.length === 0 ? (
                    <p className="p-2 text-xs text-slate-500">No other row of this budget has a fabric costing.</p>
                  ) : (
                    others.map((o) => <Card key={o.key} title={o.label} cost={o.cost} onLoad={() => load(o.cost)} />)
                  )
                ) : (
                  <CostingSearch ctx={ctx} initialSearch={initialSearch} onLoad={(fc) => load(fromCostingFabricCost(fc))} />
                )}
              </div>
            </aside>
          ) : null}

          <ScrollArea className="min-h-0 min-w-0 flex-1" viewportClassName="overflow-x-hidden [&>div]:!block [&>div]:!w-full [&>div]:!min-w-0 [&>div]:!max-w-full">
            <div className="w-full max-w-full min-w-0 space-y-4 p-3 sm:p-4">
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Yarns</h3>
                  {!readOnly ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => commit({ yarns: [...cost.yarns, emptyBudgetYarn()] })}>
                      <Plus className="size-3" /> Add yarn
                    </Button>
                  ) : null}
                </div>
                <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-slate-200/70 dark:border-white/10">
                  <table className="w-full min-w-[1600px] border-collapse text-xs">
                    <thead className="bg-slate-50/80 dark:bg-white/5">
                      <tr className="border-b">
                        <th className={cn(TH_CLASS, "min-w-56")}>Yarn</th>
                        <th className={cn(TH_CLASS, "w-24")} title="A">Req Qty/Kg Fabric</th>
                        <th className={cn(TH_CLASS, "w-24")}>Costing Price/Kg</th>
                        <th className={cn(TH_CLASS, "w-24")}>Budget Price/Kg</th>
                        <th className={cn(TH_CLASS, "w-20")}>Import %</th>
                        <th className={cn(TH_CLASS, "w-24")} title="Budget price / (1 − import %)">Total Price/Kg</th>
                        <th className={cn(TH_CLASS, "w-24")} title="E = A × (1 + Σ wastage %)">Total Qty/Kg Fabric</th>
                        <th className={cn(TH_CLASS, "w-24")}>Grey Qty</th>
                        <th className={cn(TH_CLASS, "w-24")}>Dyed Qty</th>
                        <th className={cn(TH_CLASS, "min-w-36")}>Yarn Dyeing Color</th>
                        <th className={cn(TH_CLASS, "w-28")}>Strip Measurement</th>
                        <th className={cn(TH_CLASS, "w-24")} title="E × (total price + process rates)">Price/Kg Fabric</th>
                        <th className={cn(TH_CLASS, "w-10")} />
                      </tr>
                    </thead>
                    <tbody>
                      {cost.yarns.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="p-6 text-center text-slate-500">No yarns.</td>
                        </tr>
                      ) : null}
                      {cost.yarns.map((y) => (
                        <tr key={y.clientId} className="border-b">
                          <td className={TD_CLASS}>
                            <LookupCombobox value={y.yarnId} label={y.yarnName} loadItems={loadMaterials} placeholder="Yarn" disabled={readOnly} onChange={(o) => patchYarn(y.clientId, { yarnId: o ? Number(o.value) : 0, yarnName: o?.label ?? "" })} />
                          </td>
                          <td className={TD_CLASS}>
                            <NumInput value={y.yarnReqQtyPerKgFabric} onValueChange={readOnly ? undefined : (v) => patchYarn(y.clientId, { yarnReqQtyPerKgFabric: v })} />
                          </td>
                          <td className={TD_CLASS}><NumInput value={y.rowYarnPricePerKg} /></td>
                          <td className={TD_CLASS}>
                            <NumInput value={y.rowYarnPricePerKgBudget} onValueChange={readOnly ? undefined : (v) => patchYarn(y.clientId, { rowYarnPricePerKgBudget: v })} />
                          </td>
                          <td className={TD_CLASS}>
                            <NumInput value={y.importChargePercentagePerKgYarnBudget} onValueChange={readOnly ? undefined : (v) => patchYarn(y.clientId, { importChargePercentagePerKgYarnBudget: v })} />
                          </td>
                          <td className={TD_CLASS}><NumInput value={y.totalYarnPricePerKgBudget} /></td>
                          <td className={TD_CLASS}><NumInput value={y.totalYarnReqQtyPerKgFabric} /></td>
                          <td className={TD_CLASS}><NumInput value={y.totalGreyReqQtyPerKgFabric} /></td>
                          <td className={TD_CLASS}><NumInput value={y.totalDyedYarnReqQtyPerKgFabric} /></td>
                          <td className={TD_CLASS}>
                            <LookupCombobox value={y.yarnDyeingColorId} label={y.yarnDyeingColorName} loadItems={loadColors} placeholder="Color" disabled={readOnly} onChange={(o) => patchYarn(y.clientId, { yarnDyeingColorId: o ? Number(o.value) : null, yarnDyeingColorName: o?.label ?? "" })} />
                          </td>
                          <td className={TD_CLASS}>
                            <Input value={y.stripMeasurement} readOnly={readOnly} maxLength={100} className={CELL_INPUT_CLASS} onChange={(e) => patchYarn(y.clientId, { stripMeasurement: e.target.value })} />
                          </td>
                          <td className={TD_CLASS}><NumInput value={y.totalYarnPricePerKgFabricBudget} /></td>
                          <td className={cn(TD_CLASS, "text-right")}>
                            {!readOnly ? (
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove yarn" onClick={() => commit({ yarns: cost.yarns.filter((x) => x.clientId !== y.clientId) })}>
                                <Trash2 className="size-3.5 text-red-600" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {cost.yarns.length > 0 && Math.abs(ratio - 1) > 0.0001 ? (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">The yarns&apos; req qty adds up to {formatNumber(ratio)} kg per kg of fabric (usually 1).</p>
                ) : null}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Common process cost and wastage</h3>
                  {!readOnly ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => commit({ processes: [...cost.processes, emptyBudgetProcess()] })}>
                      <Plus className="size-3" /> Add process
                    </Button>
                  ) : null}
                </div>
                <ProcessGrid
                  rows={cost.processes}
                  options={options}
                  readOnly={readOnly}
                  onPatch={patchProcess}
                  onRemove={(id) => commit({ processes: cost.processes.filter((p) => p.clientId !== id) })}
                />
              </section>

              {cost.yarns.length ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Advance: each yarn&apos;s own processes</h3>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {cost.yarns.map((y, i) => {
                      const commonIds = new Set(cost.processes.map((p) => p.processId))
                      const own = (change: BudgetYarnProcess[]) => patchYarn(y.clientId, { yarnWiseProcesses: change })
                      return (
                        <div key={y.clientId} className="space-y-1.5 rounded-lg border border-slate-200/70 p-2 dark:border-white/10">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">
                              {i + 1}. {y.yarnName || "Yarn"}
                            </span>
                            {!readOnly ? (
                              <Button type="button" size="xs" variant="outline" onClick={() => own([...y.yarnWiseProcesses, emptyBudgetYarnProcess()])}>
                                <Plus className="size-2.5" /> Add
                              </Button>
                            ) : null}
                          </div>
                          <ProcessGrid
                            rows={y.yarnWiseProcesses}
                            options={options.filter((o) => !commonIds.has(Number(o.value)))}
                            readOnly={readOnly}
                            onPatch={(id, change) => own(y.yarnWiseProcesses.map((p) => (p.clientId === id ? { ...p, ...change } : p)))}
                            onRemove={(id) => own(y.yarnWiseProcesses.filter((p) => p.clientId !== id))}
                          />
                        </div>
                      )
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-slate-200/70 p-3 sm:flex-row sm:items-center dark:border-white/10">
          <div className="mr-auto flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="rounded-md" title="(Σ E ÷ Σ A − 1) × 100">
              Fabric wastage {formatNumber(fabricWastageBudget(cost.yarns), 2)}%
            </Badge>
            <Badge variant="outline" className="rounded-md">Costing {formatNumber(cost.totalFabricCost)} $/kg</Badge>
            <Badge className="rounded-md bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">Budget {formatNumber(cost.totalFabricCostBudget)} $/kg</Badge>
          </div>
          {!readOnly && row.fabricCost ? (
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => { onSet(null); onClose() }}>
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
                const clean = { ...cost, yarns: cost.yarns.filter((y) => y.yarnId > 0), processes: cost.processes.filter((p) => p.processId > 0) }
                onSet(clean.yarns.length || clean.processes.length ? clean : null)
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

function ProcessGrid<T extends { clientId: string; processId: number; processName: string; processRatePerKgFabric: number; processRatePerKgFabricBuget: number; wastagePercentage: number; wastagePercentageBuget: number }>({
  rows,
  options,
  readOnly,
  onPatch,
  onRemove,
}: {
  rows: T[]
  options: AppComboboxOption[]
  readOnly: boolean
  onPatch: (clientId: string, change: Partial<T>) => void
  onRemove: (clientId: string) => void
}) {
  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-slate-200/70 dark:border-white/10">
      <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
        <thead className="bg-slate-50/80 dark:bg-white/5">
          <tr className="border-b">
            <th className={TH_CLASS}>Process</th>
            <th className={cn(TH_CLASS, "w-24")}>Rate (costing)</th>
            <th className={cn(TH_CLASS, "w-24")}>Rate (budget)</th>
            <th className={cn(TH_CLASS, "w-24")}>W % (costing)</th>
            <th className={cn(TH_CLASS, "w-24")}>W % (budget)</th>
            <th className={cn(TH_CLASS, "w-10")} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-3 text-center text-slate-500">No processes.</td>
            </tr>
          ) : null}
          {rows.map((p) => (
            <tr key={p.clientId} className="border-b">
              <td className={TD_CLASS}>
                <ScopePicker value={p.processId} label={p.processName} options={options} disabled={readOnly} placeholder="Process" onChange={(o) => onPatch(p.clientId, { processId: o ? Number(o.value) : 0, processName: o?.label ?? "" } as Partial<T>)} />
              </td>
              <td className={TD_CLASS}><NumInput value={p.processRatePerKgFabric} /></td>
              <td className={TD_CLASS}>
                <NumInput value={p.processRatePerKgFabricBuget} onValueChange={readOnly ? undefined : (v) => onPatch(p.clientId, { processRatePerKgFabricBuget: v } as Partial<T>)} />
              </td>
              <td className={TD_CLASS}><NumInput value={p.wastagePercentage} /></td>
              <td className={TD_CLASS}>
                <NumInput value={p.wastagePercentageBuget} onValueChange={readOnly ? undefined : (v) => onPatch(p.clientId, { wastagePercentageBuget: v } as Partial<T>)} />
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

function Card({ title, subtitle, cost, onLoad }: { title: string; subtitle?: string; cost: { totalFabricCostBudget?: number; totalFabricCost: number; yarns?: Array<{ yarnName: string }> }; onLoad: () => void }) {
  return (
    <button
      type="button"
      onClick={onLoad}
      className="mb-1.5 w-full rounded-lg border border-slate-200/70 bg-white/80 p-2 text-left text-xs transition hover:border-blue-300 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-blue-500/10"
    >
      <p className="truncate font-medium">{title || "Fabric costing"}</p>
      {subtitle ? <p className="truncate text-[11px] text-slate-500">{subtitle}</p> : null}
      <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300">{(cost.yarns ?? []).map((y) => y.yarnName).filter(Boolean).join(", ") || "No yarn"}</p>
      <p className="mt-0.5 text-[11px] font-semibold tabular-nums">{formatNumber(cost.totalFabricCostBudget ?? cost.totalFabricCost)} $/kg</p>
    </button>
  )
}

function CostingSearch({ ctx, initialSearch, onLoad }: { ctx: ApiContext; initialSearch: string; onLoad: (fc: GmtFabricCost) => void }) {
  const [search, setSearch] = useState(initialSearch)
  const [query, setQuery] = useState(initialSearch)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<FabricCostSearchItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loadedKey, setLoadedKey] = useState("")
  const key = `${query}|${page}`

  useEffect(() => {
    let active = true
    searchFabricCosts(ctx, query, page)
      .then((r) => {
        if (!active) return
        setItems((current) => (page === 1 ? r.items : [...current, ...r.items]))
        setHasMore(r.hasMore)
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Unable to search fabric costings."))
      .finally(() => active && setLoadedKey(key))
    return () => {
      active = false
    }
  }, [ctx, key, page, query])

  return (
    <div className="space-y-2">
      <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()) }}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buyer, style, costing, fabric" className={CELL_INPUT_CLASS} />
        <Button type="submit" size="icon-sm" variant="outline" aria-label="Search">
          <Search className="size-3" />
        </Button>
      </form>
      {items.length === 0 && loadedKey === key ? <p className="p-2 text-xs text-slate-500">No fabric costing found.</p> : null}
      {items.map((item, i) =>
        item.fabricCost ? (
          <Card
            key={`${item.gmtCostingId}-${i}`}
            title={item.fabricCost.fabricName || item.costName}
            subtitle={`${item.costName} · ${item.buyerName} · ${item.styleNo}`}
            cost={{ totalFabricCost: item.fabricCost.totalFabricCost, yarns: item.fabricCost.lastYarnDtls }}
            onLoad={() => onLoad(item.fabricCost!)}
          />
        ) : null,
      )}
      {loadedKey !== key ? <Loader2 className="mx-auto size-4 animate-spin text-slate-400" /> : null}
      {hasMore && loadedKey === key ? (
        <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setPage((p) => p + 1)}>
          Load more
        </Button>
      ) : null}
    </div>
  )
}
