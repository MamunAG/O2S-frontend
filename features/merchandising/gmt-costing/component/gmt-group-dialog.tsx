"use client"

// The Size / Color group of a details row (desktop frmShowSizeGroupGMTCosting / frmShowColourGroup). A group
// is a named set of the style's sizes or colors, shared by every row holding that name: Done changes them
// all, "This row only" gives this row a new group and leaves the others as they were. A color may sit in
// one color group only; a size may sit in several size groups (shown in amber). Clear empties this row's
// group, so it reads "All Size" / "All Color" again.

import { useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
  findColorConflict,
  findPreGroupName,
  groupDefaultName,
  groupItemsOf,
  groupNameOf,
  groupNameSuggestion,
  setGroup,
  type GroupItem,
  type GroupKind,
} from "../gmt-costing.calc"
import type { GmtCostingDetail } from "../gmt-costing.types"
import { FieldLabel, INPUT_CLASS } from "./gmt-ui"

const COLOR_NAME_SUGGESTIONS = ["LIGHT", "AVG", "DEEP"]

export function GmtGroupDialog({
  kind,
  row,
  rows,
  styleItems,
  readOnly,
  onApply,
  onClose,
}: {
  kind: GroupKind
  row: GmtCostingDetail
  rows: GmtCostingDetail[]
  /** The style's sizes or colors. */
  styleItems: GroupItem[]
  readOnly: boolean
  onApply: (rows: GmtCostingDetail[]) => void
  onClose: () => void
}) {
  const oldName = groupNameOf(row, kind)
  const [items, setItems] = useState<GroupItem[]>(() => groupItemsOf(row, kind))
  const [name, setName] = useState(oldName)
  const [nameTouched, setNameTouched] = useState(Boolean(oldName))
  const [thisRowOnly, setThisRowOnly] = useState(false)
  const label = kind === "size" ? "size" : "color"
  const sharedCount = oldName ? rows.filter((r) => groupNameOf(r, kind) === oldName).length : 1

  const available = styleItems.filter((s) => !items.some((i) => i.id === s.id))

  /** Other groups already holding an item (amber for sizes; a color there is refused). */
  const elsewhere = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const r of rows) {
      const isOwn = oldName && !thisRowOnly ? groupNameOf(r, kind) === oldName : r.clientId === row.clientId
      if (isOwn) continue
      for (const item of groupItemsOf(r, kind)) {
        const names = map.get(item.id) ?? []
        const groupName = groupNameOf(r, kind)
        if (groupName && !names.includes(groupName)) names.push(groupName)
        map.set(item.id, names)
      }
    }
    return map
  }, [kind, oldName, row.clientId, rows, thisRowOnly])

  const suggestion = (next: GroupItem[]) => findPreGroupName(rows, kind, next.map((i) => i.id)) || groupNameSuggestion(kind, next)

  function update(next: GroupItem[]) {
    setItems(next)
    if (!nameTouched) setName(next.length ? suggestion(next) : "")
  }

  function add(item: GroupItem) {
    if (kind === "color") {
      const conflict = findColorConflict(rows, thisRowOnly ? "" : oldName, row.clientId, item.id)
      if (conflict) {
        toast.error(`${item.name} is already in color group ${conflict}. A color can be in one color group only.`)
        return
      }
    }
    update([...items, item])
  }

  function apply() {
    const trimmed = name.trim()
    if (items.length === 0) {
      onApply(setGroup(rows, kind, row.clientId, oldName, "", [], "row"))
      onClose()
      return
    }
    if (trimmed.length < 1) {
      toast.error(`Name the ${label} group.`)
      return
    }
    if (trimmed.toLowerCase() === groupDefaultName(kind).toLowerCase()) {
      toast.error(`"${groupDefaultName(kind)}" is kept for rows with no ${label} group. Choose another name.`)
      return
    }
    const scope = thisRowOnly || !oldName ? "row" : "group"
    // another group of the grid already called so, with other items: refuse (a name is one group)
    const sameName = rows.find(
      (r) => groupNameOf(r, kind) === trimmed && (scope === "row" ? r.clientId !== row.clientId : groupNameOf(r, kind) !== oldName),
    )
    if (sameName) {
      const theirs = groupItemsOf(sameName, kind).map((i) => i.id).sort().join(",")
      const ours = items.map((i) => i.id).sort().join(",")
      if (theirs !== ours) {
        toast.error(`The grid already has a ${label} group named ${trimmed} with other ${label}s.`)
        return
      }
    }
    if (kind === "color") {
      for (const item of items) {
        const conflict = findColorConflict(rows, scope === "row" ? "" : oldName, row.clientId, item.id)
        if (conflict && conflict !== trimmed) {
          toast.error(`${item.name} is already in color group ${conflict}.`)
          return
        }
      }
    }
    onApply(setGroup(rows, kind, row.clientId, oldName, trimmed, items, scope))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{kind === "size" ? "Size group" : "Color group"}</DialogTitle>
          <DialogDescription>
            {row.fabricItemName || "This row"}
            {oldName && sharedCount > 1 ? ` · group ${oldName} is on ${sharedCount} rows` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="gmtGroupName">Group name</FieldLabel>
            <Input
              id="gmtGroupName"
              value={name}
              readOnly={readOnly}
              maxLength={100}
              onChange={(event) => {
                setName(event.target.value)
                setNameTouched(true)
              }}
              className={INPUT_CLASS}
              placeholder={items.length ? suggestion(items) : groupDefaultName(kind)}
            />
            {kind === "color" && !readOnly ? (
              <div className="flex flex-wrap gap-1.5">
                {COLOR_NAME_SUGGESTIONS.map((s) => (
                  <Button key={s} type="button" variant="outline" size="xs" onClick={() => { setName(s); setNameTouched(true) }}>
                    {s}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="mb-1.5 font-semibold">In this group ({items.length})</p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {items.length === 0 ? <p className="text-slate-500">Nothing yet: the row reads {groupDefaultName(kind)}.</p> : null}
                {items.map((item) => (
                  <ItemRow key={item.id} item={item} others={elsewhere.get(item.id)} kind={kind}>
                    {!readOnly ? (
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${item.name}`} onClick={() => update(items.filter((i) => i.id !== item.id))}>
                        <ArrowRight className="size-3" />
                      </Button>
                    ) : null}
                  </ItemRow>
                ))}
              </div>
            </div>
            <div className="p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-semibold">Style {label}s ({available.length})</p>
                {!readOnly && available.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      const ok = kind === "size" ? available : available.filter((a) => !elsewhere.has(a.id))
                      update([...items, ...ok])
                    }}
                  >
                    Add all
                  </Button>
                ) : null}
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {styleItems.length === 0 ? <p className="text-slate-500">The style has no {label}s. Add them on the Style screen.</p> : null}
                {available.map((item) => (
                  <ItemRow key={item.id} item={item} others={elsewhere.get(item.id)} kind={kind}>
                    {!readOnly ? (
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`Add ${item.name}`} onClick={() => add(item)}>
                        <ArrowLeft className="size-3" />
                      </Button>
                    ) : null}
                  </ItemRow>
                ))}
              </div>
            </div>
          </div>
          {kind === "size" && elsewhere.size ? (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Amber: the size is in another size group too (a size may be in several).</p>
          ) : null}
          {!readOnly && oldName && sharedCount > 1 ? (
            <label className="flex items-center gap-2">
              <Checkbox checked={thisRowOnly} onCheckedChange={(v) => setThisRowOnly(Boolean(v))} />
              This row only: give this row a new group and leave the other {sharedCount - 1} row(s) on {oldName}
            </label>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              className="mr-auto rounded-xl"
              onClick={() => {
                onApply(setGroup(rows, kind, row.clientId, oldName, "", [], "row"))
                onClose()
              }}
            >
              Clear this row
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? (
            <Button type="button" className="rounded-xl" onClick={apply}>
              <Check className="size-3.5" /> Done
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ItemRow({ item, others, kind, children }: { item: GroupItem; others?: string[]; kind: GroupKind; children?: React.ReactNode }) {
  const marked = Boolean(others?.length)
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border border-transparent px-2 py-1 hover:border-slate-200 dark:hover:border-white/10",
        marked && kind === "size" ? "text-amber-700 dark:text-amber-300" : "",
        marked && kind === "color" ? "text-slate-400" : "",
      )}
      title={marked ? `Also in: ${others!.join(", ")}` : undefined}
    >
      <span className="truncate">{item.name}</span>
      {children}
    </div>
  )
}
