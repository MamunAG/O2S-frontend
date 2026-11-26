"use client"

// The sections of the GMT Budget entry dialog below the details grid: GMT Wastage, Other Cost, Commission,
// Price (cost per pcs), Special Treatments, Revisions and Comments. Each shows the costing's figure beside
// its budgeted copy, which is the one typed. (Files use the GMT costing screen's section.)

import { useMemo, useState } from "react"
import { Plus, X } from "lucide-react"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { ColorPicker, EmptyRow, RemoveButton, ScopePicker, Table } from "../../gmt-costing/component/gmt-costing-sections"
import { CELL_INPUT_CLASS, LookupCombobox, NumInput, TD_CLASS, TH_CLASS, formatDate, formatNumber } from "../../gmt-costing/component/gmt-ui"
import { newClientId } from "../../gmt-costing/gmt-costing.calc"
import type { CostScope } from "../../gmt-costing/gmt-costing.types"
import { recalcBudgetRow, syncGmtWastageTotal } from "../gmt-budget.calc"
import type {
  BudgetComment,
  BudgetCommission,
  BudgetCostPerPcs,
  BudgetDetail,
  BudgetOtherCost,
  BudgetRevise,
  BudgetSpecialTreatment,
  BudgetWastage,
  PoStyleContext,
} from "../gmt-budget.types"

type Load = (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>
const n = (v: unknown) => Number(v ?? 0) || 0

// ---------- GMT wastage ----------

const comboKey = (r: BudgetDetail) => [r.fabricItemId, r.colors.length ? r.colorGroupName : "All Color", r.gmtPartsId ?? ""].join("|")

/**
 * Per fabric / colour group / part and per GMT process (cost scopes marked GMT process), the budgeted
 * wastage %. A change goes to every row of the combination: its wastage lines, its GMT W% (their sum) and
 * the figures on it. Double Pcs Qty goes to the row and its lines; a double row with no wastage keeps one
 * 0% line (of the first process) to hold it, as the desktop does.
 */
export function BudgetWastageSection({
  rows,
  scopes,
  po,
  readOnly,
  onChange,
}: {
  rows: BudgetDetail[]
  scopes: CostScope[]
  po: PoStyleContext | null
  readOnly: boolean
  onChange: (rows: BudgetDetail[]) => void
}) {
  const processes = useMemo(() => scopes.filter((s) => s.isGmtProcess), [scopes])
  const combos = useMemo(() => {
    const seen = new Map<string, BudgetDetail>()
    rows.forEach((r) => r.fabricItemId && !seen.has(comboKey(r)) && seen.set(comboKey(r), r))
    return [...seen.entries()].map(([key, r]) => ({ key, row: r }))
  }, [rows])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const current = combos.find((c) => c.key === selectedKey) ?? combos[0] ?? null

  const apply = (key: string, change: (r: BudgetDetail) => BudgetDetail) =>
    onChange(rows.map((r) => (comboKey(r) === key ? recalcBudgetRow(syncGmtWastageTotal(change(r)), po, false) : r)))

  function setPercent(processId: string, processName: string, value: number) {
    if (!current) return
    apply(current.key, (row) => {
      const existing = row.wastages.find((w) => w.gmtProcessId === processId)
      const others = row.wastages.filter((w) => w.gmtProcessId !== processId)
      const line: BudgetWastage = {
        ...(existing ?? { clientId: newClientId(), id: "", detailsId: "", gmtWastagePercentage: 0 }),
        gmtProcessId: processId,
        gmtProcessName: processName,
        gmtWastagePercentageBudget: value,
        isWastageDouble: row.isDoubleInPcsQty,
      }
      const keep = value > 0 || (existing && existing.gmtWastagePercentage > 0)
      const wastages = keep ? [...others, line] : others
      return { ...row, wastages, gmtWastagePercentageBudget: wastages.length ? row.gmtWastagePercentageBudget : 0 }
    })
  }

  function setDouble(key: string, isDouble: boolean) {
    apply(key, (row) => {
      let wastages = row.wastages.map((w) => ({ ...w, isWastageDouble: isDouble }))
      if (isDouble && wastages.length === 0 && processes[0]) {
        wastages = [{ clientId: newClientId(), id: "", detailsId: "", gmtProcessId: processes[0].id, gmtProcessName: processes[0].name, gmtWastagePercentage: 0, gmtWastagePercentageBudget: 0, isWastageDouble: true }]
      }
      return { ...row, isDoubleInPcsQty: isDouble, wastages }
    })
  }

  if (combos.length === 0) return <p className="text-xs text-slate-500">The details have no fabric / item yet.</p>

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Table
        minWidth="min-w-[520px]"
        head={
          <>
            <th className={TH_CLASS}>Fabric / Item</th>
            <th className={TH_CLASS}>Color</th>
            <th className={TH_CLASS}>Parts</th>
            <th className={cn(TH_CLASS, "w-20 text-right")}>W % (budget)</th>
            <th className={cn(TH_CLASS, "w-20 text-center")}>Double Pcs Qty</th>
          </>
        }
      >
        {combos.map(({ key, row }) => (
          <tr key={key} onClick={() => setSelectedKey(key)} className={cn("cursor-pointer border-b", key === current?.key ? "border-l-2 border-l-blue-500 bg-blue-500/10" : "hover:bg-muted/40")}>
            <td className={TD_CLASS}>{row.fabricItemName}</td>
            <td className={TD_CLASS}>{row.colors.length ? row.colorGroupName : "All Color"}</td>
            <td className={TD_CLASS}>{row.gmtPartsName || "--"}</td>
            <td className={cn(TD_CLASS, "text-right tabular-nums")}>{formatNumber(row.gmtWastagePercentageBudget, 2)}</td>
            <td className={cn(TD_CLASS, "text-center")} onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={row.isDoubleInPcsQty || row.wastages.some((w) => w.isWastageDouble)} disabled={readOnly} onCheckedChange={(v) => setDouble(key, Boolean(v))} aria-label="Double pcs qty" />
            </td>
          </tr>
        ))}
      </Table>
      <div className="space-y-2">
        {current ? (
          <p className="rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1 text-xs dark:border-blue-500/30 dark:bg-blue-500/10">
            {current.row.fabricItemName} · {current.row.colors.length ? current.row.colorGroupName : "All Color"} · {current.row.gmtPartsName || "no part"}
          </p>
        ) : null}
        <Table
          minWidth="min-w-[360px]"
          head={
            <>
              <th className={TH_CLASS}>GMT Process</th>
              <th className={cn(TH_CLASS, "w-24")}>W % (costing)</th>
              <th className={cn(TH_CLASS, "w-28")}>W % (budget)</th>
            </>
          }
        >
          {processes.length === 0 ? <EmptyRow span={3} text="No cost scope is marked as a GMT process." /> : null}
          {processes.map((p) => {
            const line = current?.row.wastages.find((w) => w.gmtProcessId === p.id)
            return (
              <tr key={p.id} className="border-b">
                <td className={TD_CLASS}>{p.name}</td>
                <td className={TD_CLASS}><NumInput value={line?.gmtWastagePercentage ?? 0} /></td>
                <td className={TD_CLASS}>
                  <NumInput value={line?.gmtWastagePercentageBudget ?? 0} onValueChange={readOnly ? undefined : (v) => setPercent(p.id, p.name, v)} />
                </td>
              </tr>
            )
          })}
        </Table>
      </div>
    </div>
  )
}

// ---------- Other cost ----------

export function BudgetOtherCostSection({
  rows,
  scopes,
  colors,
  readOnly,
  onChange,
}: {
  rows: BudgetOtherCost[]
  scopes: CostScope[]
  colors: Array<{ id: string; name: string }>
  readOnly: boolean
  onChange: (rows: BudgetOtherCost[]) => void
}) {
  const options = useMemo(() => scopes.filter((s) => s.isOtherTypeCost).map((s) => ({ value: String(s.id), label: s.name })), [scopes])
  const patch = (id: string, change: Partial<BudgetOtherCost>) => onChange(rows.map((r) => (r.clientId === id ? { ...r, ...change } : r)))
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[900px]"
        head={
          <>
            <th className={cn(TH_CLASS, "w-10")}>SL</th>
            <th className={cn(TH_CLASS, "min-w-52")}>Cost</th>
            <th className={cn(TH_CLASS, "w-28")}>Costing /Pcs</th>
            <th className={cn(TH_CLASS, "w-28")}>Budget /Pcs ($)</th>
            <th className={cn(TH_CLASS, "w-28")}>Budget /Dzn ($)</th>
            <th className={cn(TH_CLASS, "min-w-52")} title="No color = every color">Colors</th>
            <th className={cn(TH_CLASS, "w-10")} />
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={7} text="No other cost." /> : null}
        {rows.map((row, i) => (
          <tr key={row.clientId} className="border-b">
            <td className={TD_CLASS}>{i + 1}</td>
            <td className={TD_CLASS}>
              <ScopePicker value={row.costId} label={row.costName} options={options} disabled={readOnly} placeholder="Cost" onChange={(o) => patch(row.clientId, { costId: o ? String(o.value) : "", costName: o?.label ?? "" })} />
            </td>
            <td className={TD_CLASS}><NumInput value={row.costPerPcsGmt} /></td>
            <td className={TD_CLASS}>
              <NumInput value={row.costPerPcsGmtBudget} onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { costPerPcsGmtBudget: v, costPerDznGmtBudget: Number((v * 12).toFixed(2)) })} />
            </td>
            <td className={TD_CLASS}>
              <NumInput value={row.costPerDznGmtBudget} onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { costPerDznGmtBudget: v, costPerPcsGmtBudget: Number((v / 12).toFixed(4)) })} />
            </td>
            <td className={TD_CLASS}>
              <ColorPicker
                selected={row.lstColors.map((c) => ({ id: c.gmtColorId, name: c.gmtColorName }))}
                options={colors}
                readOnly={readOnly}
                onChange={(picked) =>
                  patch(row.clientId, {
                    lstColors: picked.map((c) => row.lstColors.find((x) => x.gmtColorId === c.id) ?? { clientId: newClientId(), id: "", otherCostDtlsId: row.id, gmtColorId: c.id, gmtColorName: c.name }),
                  })
                }
              />
            </td>
            <td className={cn(TD_CLASS, "text-right")}>
              {!readOnly ? <RemoveButton label="Remove cost" onClick={() => onChange(rows.filter((r) => r.clientId !== row.clientId))} /> : null}
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex items-center justify-between text-xs">
        <span>
          Total <b className="tabular-nums">{formatNumber(rows.reduce((s, r) => s + n(r.costPerPcsGmtBudget), 0))}</b> / pcs (costing {formatNumber(rows.reduce((s, r) => s + n(r.costPerPcsGmt), 0))})
        </span>
        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() => onChange([...rows, { clientId: newClientId(), id: "", masterId: "", costId: "", costName: "", costPerPcsGmt: 0, costPerDznGmt: 0, costPerPcsGmtBudget: 0, costPerDznGmtBudget: 0, lstColors: [] }])}
          >
            <Plus className="size-3" /> Add cost
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ---------- Commission ----------

export function BudgetCommissionSection({
  rows,
  scopes,
  readOnly,
  onChange,
}: {
  rows: BudgetCommission[]
  scopes: CostScope[]
  readOnly: boolean
  onChange: (rows: BudgetCommission[]) => void
}) {
  const options = useMemo(() => scopes.filter((s) => s.isCommission).map((s) => ({ value: String(s.id), label: s.name })), [scopes])
  const patch = (id: string, change: Partial<BudgetCommission>) => onChange(rows.map((r) => (r.clientId === id ? { ...r, ...change } : r)))
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[760px]"
        head={
          <>
            <th className={cn(TH_CLASS, "w-10")}>SL</th>
            <th className={cn(TH_CLASS, "min-w-52")}>Commission</th>
            <th className={cn(TH_CLASS, "w-24")}>Costing %</th>
            <th className={cn(TH_CLASS, "w-28")}>Budget %</th>
            <th className={cn(TH_CLASS, "w-24")}>Costing value</th>
            <th className={cn(TH_CLASS, "w-28")}>Budget value ($)</th>
            <th className={cn(TH_CLASS, "w-10")} />
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={7} text="No commission." /> : null}
        {rows.map((row, i) => (
          <tr key={row.clientId} className="border-b">
            <td className={TD_CLASS}>{i + 1}</td>
            <td className={TD_CLASS}>
              <ScopePicker value={row.commissionId} label={row.commissionName} options={options} disabled={readOnly} placeholder="Commission" onChange={(o) => patch(row.clientId, { commissionId: o ? String(o.value) : "", commissionName: o?.label ?? "" })} />
            </td>
            <td className={TD_CLASS}><NumInput value={row.commissionPercentage} /></td>
            <td className={TD_CLASS}>
              <NumInput value={row.commissionPercentageBudget} onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { commissionPercentageBudget: v, ...(v ? { commissionValueBudget: 0 } : {}) })} />
            </td>
            <td className={TD_CLASS}><NumInput value={row.commissionValue} /></td>
            <td className={TD_CLASS}>
              <NumInput value={row.commissionValueBudget} onValueChange={readOnly ? undefined : (v) => patch(row.clientId, { commissionValueBudget: v, ...(v ? { commissionPercentageBudget: 0 } : {}) })} />
            </td>
            <td className={cn(TD_CLASS, "text-right")}>
              {!readOnly ? <RemoveButton label="Remove commission" onClick={() => onChange(rows.filter((r) => r.clientId !== row.clientId))} /> : null}
            </td>
          </tr>
        ))}
      </Table>
      {!readOnly ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={() => onChange([...rows, { clientId: newClientId(), id: "", masterId: "", commissionId: "", commissionName: "", commissionPercentage: 0, commissionPercentageBudget: 0, commissionValue: 0, commissionValueBudget: 0 }])}
          >
            <Plus className="size-3" /> Add commission
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ---------- Price ----------

export function BudgetPriceSection({ rows, readOnly, onChange }: { rows: BudgetCostPerPcs[]; readOnly: boolean; onChange: (rows: BudgetCostPerPcs[]) => void }) {
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[560px]"
        head={
          <>
            <th className={TH_CLASS}>Color Group</th>
            <th className={TH_CLASS}>Size Group</th>
            <th className={cn(TH_CLASS, "w-36 text-right")}>Budget Price / Pcs ($)</th>
            <th className={cn(TH_CLASS, "w-36")}>Confirm Price / Pcs ($)</th>
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={4} text="The price shows once the details have rows." /> : null}
        {rows.map((row) => (
          <tr key={row.clientId} className="border-b">
            <td className={TD_CLASS}>{row.colorGroupName}</td>
            <td className={TD_CLASS}>{row.sizeGroupName}</td>
            <td className={cn(TD_CLASS, "text-right font-semibold tabular-nums")}>$ {formatNumber(row.costingPricePerPcs)}</td>
            <td className={TD_CLASS}>
              <NumInput value={row.confirmPricePerPcs} onValueChange={readOnly ? undefined : (v) => onChange(rows.map((r) => (r.clientId === row.clientId ? { ...r, confirmPricePerPcs: v } : r)))} />
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-[11px] text-slate-500">
        Per colour group × size group: the rows&apos; budgeted price / pcs, plus the other costs, then the commission %, then the commission values.
      </p>
    </div>
  )
}

// ---------- Special treatments ----------

export function SpecialTreatmentSection({
  rows,
  readOnly,
  loadOptions,
  onChange,
}: {
  rows: BudgetSpecialTreatment[]
  readOnly: boolean
  loadOptions: Load
  onChange: (rows: BudgetSpecialTreatment[]) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {rows.length === 0 && readOnly ? <span className="text-slate-500">None.</span> : null}
      {rows.map((t) => (
        <Badge key={t.clientId} variant="outline" className="gap-1 rounded-md">
          {t.treatment}
          {!readOnly ? (
            <button type="button" aria-label={`Remove ${t.treatment}`} onClick={() => onChange(rows.filter((r) => r.clientId !== t.clientId))}>
              <X className="size-3" />
            </button>
          ) : null}
        </Badge>
      ))}
      {!readOnly ? (
        <LookupCombobox
          key={rows.length}
          className="w-56"
          value={null}
          label=""
          loadItems={loadOptions}
          placeholder="Add special treatment"
          onChange={(o) => {
            if (!o || rows.some((r) => r.specialTreatmentId === String(o.value))) return
            onChange([...rows, { clientId: newClientId(), id: "", masterId: "", specialTreatmentId: String(o.value ?? ""), treatment: o.label }])
          }}
        />
      ) : null}
    </div>
  )
}

// ---------- Revisions ----------

/** Saved revisions are read-only (the API numbers, dates and stamps a new one). Edit adds one, with a reason. */
export function RevisionSection({ rows, readOnly, isSaved, onChange }: { rows: BudgetRevise[]; readOnly: boolean; isSaved: boolean; onChange: (rows: BudgetRevise[]) => void }) {
  const pending = rows.find((r) => !r.id)
  return (
    <div className="space-y-2">
      <Table
        minWidth="min-w-[560px]"
        head={
          <>
            <th className={cn(TH_CLASS, "w-16")}>No</th>
            <th className={cn(TH_CLASS, "w-32")}>Date</th>
            <th className={TH_CLASS}>Reason</th>
            <th className={cn(TH_CLASS, "w-40")}>By</th>
            <th className={cn(TH_CLASS, "w-10")} />
          </>
        }
      >
        {rows.length === 0 ? <EmptyRow span={5} text="No revision." /> : null}
        {rows.map((r) => (
          <tr key={r.clientId} className="border-b">
            <td className={TD_CLASS}>{r.id ? r.reviceNo : "new"}</td>
            <td className={TD_CLASS}>{r.id ? formatDate(r.reviceDate) : "on save"}</td>
            <td className={TD_CLASS}>
              {r.id || readOnly ? (
                r.reviceReason
              ) : (
                <Input value={r.reviceReason} maxLength={1000} placeholder="Why is the budget revised?" className={CELL_INPUT_CLASS} onChange={(e) => onChange(rows.map((x) => (x.clientId === r.clientId ? { ...x, reviceReason: e.target.value } : x)))} />
              )}
            </td>
            <td className={TD_CLASS}>{r.revisedByName || "--"}</td>
            <td className={cn(TD_CLASS, "text-right")}>
              {!r.id && !readOnly ? <RemoveButton label="Remove revision" onClick={() => onChange(rows.filter((x) => x.clientId !== r.clientId))} /> : null}
            </td>
          </tr>
        ))}
      </Table>
      {!readOnly && isSaved && !pending ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-lg"
          onClick={() => onChange([...rows, { clientId: newClientId(), id: "", masterId: "", reviceNo: 0, reviceDate: "", reviceReason: "", revisedByName: "" }])}
        >
          <Plus className="size-3" /> Add revision
        </Button>
      ) : null}
    </div>
  )
}

// ---------- Comments ----------

export function CommentsSection({ label, rows, readOnly, onChange }: { label: string; rows: BudgetComment[]; readOnly: boolean; onChange: (rows: BudgetComment[]) => void }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
      {rows.length === 0 && readOnly ? <p className="text-xs text-slate-500">None.</p> : null}
      {rows.map((c) => (
        <div key={c.clientId} className="flex items-start gap-1">
          <Textarea
            value={c.comments}
            readOnly={readOnly}
            rows={2}
            maxLength={2000}
            className="min-h-0 text-xs"
            onChange={(e) => onChange(rows.map((x) => (x.clientId === c.clientId ? { ...x, comments: e.target.value } : x)))}
          />
          {!readOnly ? <RemoveButton label="Remove comment" onClick={() => onChange(rows.filter((x) => x.clientId !== c.clientId))} /> : null}
        </div>
      ))}
      {!readOnly ? (
        <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => onChange([...rows, { clientId: newClientId(), id: "", masterId: "", comments: "" }])}>
          <Plus className="size-3" /> Add comment
        </Button>
      ) : null}
    </div>
  )
}
