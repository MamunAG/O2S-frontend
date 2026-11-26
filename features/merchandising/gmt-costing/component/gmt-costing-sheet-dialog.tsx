"use client"

// The costing sheet (GET .../gmt-costing/{id}/costing-sheet; ClickERP's "Show HTML" sheet): per color group,
// size-wise consumption and price, the totals and each fabric's cost breakdown. Print uses the browser.

import { useEffect, useState } from "react"
import { Loader2, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"

import { fetchGmtCostingSheet, type ApiContext } from "../gmt-costing.api"
import type { GmtCostingListItem, GmtCostingSheet, SheetLine } from "../gmt-costing.types"
import { formatDate, formatNumber } from "./gmt-ui"

const cell = "border border-slate-200 px-1.5 py-1 dark:border-white/10"
const value = (v: number | null | undefined, digits = 4) => (v === null || v === undefined ? "" : formatNumber(v, digits))

export function GmtCostingSheetDialog({
  ctx,
  costing,
  onOpenChange,
}: {
  ctx: ApiContext
  costing: GmtCostingListItem
  onOpenChange: (open: boolean) => void
}) {
  const [sheet, setSheet] = useState<GmtCostingSheet | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchGmtCostingSheet(ctx, costing.id)
      .then((result) => active && setSheet(result))
      .catch((caught) => toast.error(caught instanceof Error ? caught.message : "Unable to load the costing sheet."))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [costing.id, ctx])

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 p-0 sm:max-w-[min(1400px,calc(100vw-2rem))]">
        <DialogHeader className="border-b border-slate-200/70 p-4 dark:border-white/10">
          <DialogTitle>Costing sheet · {costing.costName}</DialogTitle>
          <DialogDescription>
            {costing.buyerName} · {costing.styleNo}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="gmt-costing-sheet space-y-6 p-4 text-xs">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-lg" />
                ))}
              </div>
            ) : !sheet ? (
              <p className="text-sm text-slate-500">The costing sheet could not be loaded.</p>
            ) : (
              <>
                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Costing" value={sheet.costName} />
                  <Info label="Date" value={formatDate(sheet.costDate)} />
                  <Info label="Buyer" value={sheet.buyer} />
                  <Info label="Style" value={[sheet.styleNo, sheet.styleName].filter(Boolean).join(" · ")} />
                  <Info label="Technical sheet" value={sheet.technicalSheetNo} />
                  <Info label="GSM" value={sheet.gsm} />
                </div>
                {sheet.colorGroups.length === 0 ? <p className="text-sm text-slate-500">This costing has no rows.</p> : null}
                {sheet.colorGroups.map((group) => (
                  <section key={group.colorGroupName} className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{group.colorGroupName}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-white/5">
                            <th className={`${cell} text-left`}>Item</th>
                            {sheet.sizes.map((s) => (
                              <th key={s.sizeId} className={`${cell} text-right`}>{s.sizeName}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <SheetBlock title="Consumption / pcs" rows={group.consumptionPerPcs} span={sheet.sizes.length + 1} />
                          <SheetBlock title="Price / pcs ($)" rows={group.pricePerPcs} span={sheet.sizes.length + 1} />
                          <tr className="font-semibold">
                            <td className={cell}>Total price / pcs</td>
                            {group.totalPricePerPcs.map((v, i) => (
                              <td key={i} className={`${cell} text-right tabular-nums`}>{value(v)}</td>
                            ))}
                          </tr>
                          <SheetBlock title="Price / dzn ($)" rows={group.pricePerDzn} span={sheet.sizes.length + 1} />
                          <tr className="font-semibold">
                            <td className={cell}>Total price / dzn</td>
                            {group.totalPricePerDzn.map((v, i) => (
                              <td key={i} className={`${cell} text-right tabular-nums`}>{value(v)}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {group.breakdowns.length ? (
                      <div className="grid gap-3 xl:grid-cols-2">
                        {group.breakdowns.map((b, i) => (
                          <div key={`${b.title}-${i}`} className="overflow-x-auto rounded-lg border border-slate-200/70 dark:border-white/10">
                            <p className="bg-slate-50 px-2 py-1.5 font-semibold dark:bg-white/5">
                              {b.title} · GMT wastage {formatNumber(b.gmtWastagePercentage, 2)}% · total {formatNumber(b.total)}
                            </p>
                            <table className="w-full min-w-[560px] border-collapse">
                              <thead>
                                <tr>
                                  {["Name", "UOM", "W %", "Actual qty", "Qty with W", "Unit price", "Amount"].map((h) => (
                                    <th key={h} className={`${cell} text-left`}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <Lines lines={b.materialLines} />
                                {b.processLines.length ? (
                                  <tr>
                                    <td colSpan={7} className={`${cell} bg-slate-50 font-medium dark:bg-white/5`}>Processes</td>
                                  </tr>
                                ) : null}
                                <Lines lines={b.processLines} />
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="border-t border-slate-200/70 p-3 dark:border-white/10">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" className="rounded-xl" disabled={!sheet} onClick={() => printSheet(costing.costName)}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />} Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-900 dark:text-white">{value || "--"}</span>
    </p>
  )
}

function SheetBlock({ title, rows, span }: { title: string; rows: Array<{ name: string; values: Array<number | null> }>; span: number }) {
  return (
    <>
      <tr>
        <td colSpan={span} className={`${cell} bg-slate-50 font-medium dark:bg-white/5`}>{title}</td>
      </tr>
      {rows.map((row, i) => (
        <tr key={`${row.name}-${i}`}>
          <td className={cell}>{row.name}</td>
          {row.values.map((v, j) => (
            <td key={j} className={`${cell} text-right tabular-nums`}>{value(v)}</td>
          ))}
        </tr>
      ))}
    </>
  )
}

function Lines({ lines }: { lines: SheetLine[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <tr key={`${line.name}-${i}`}>
          <td className={cell}>{line.name}</td>
          <td className={cell}>{line.uom ?? ""}</td>
          <td className={`${cell} text-right tabular-nums`}>{formatNumber(line.wastagePercentage, 2)}</td>
          <td className={`${cell} text-right tabular-nums`}>{formatNumber(line.actualQty)}</td>
          <td className={`${cell} text-right tabular-nums`}>{formatNumber(line.qtyWithWastage)}</td>
          <td className={`${cell} text-right tabular-nums`}>{formatNumber(line.unitPrice)}</td>
          <td className={`${cell} text-right tabular-nums`}>{formatNumber(line.amount)}</td>
        </tr>
      ))}
    </>
  )
}

/** Prints the sheet alone in a window of its own. */
function printSheet(title: string) {
  const source = document.querySelector(".gmt-costing-sheet")
  const win = window.open("", "_blank", "width=1200,height=800")
  if (!source || !win) return
  win.document.write(
    `<!doctype html><html><head><title>${title.replace(/</g, "&lt;")}</title><style>
      body{font:11px system-ui,sans-serif;margin:16px;color:#0f172a}table{border-collapse:collapse;width:100%;margin:6px 0}
      th,td{border:1px solid #cbd5e1;padding:3px 5px}td{text-align:right}td:first-child{text-align:left}h3{margin:14px 0 4px}
      p{margin:2px 0}</style></head><body>${source.innerHTML}</body></html>`,
  )
  win.document.close()
  win.focus()
  win.print()
}
