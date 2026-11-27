"use client"

import { useMemo, useState } from "react"

import { Info, Loader2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import type { UserFactoryAccessRecord } from "../user-factory-permission.types"

type UserFactoryDialogProps = {
  open: boolean
  userLabel: string
  loading: boolean
  saving: boolean
  error: string
  record: UserFactoryAccessRecord | null
  selectedIds: string[]
  onSelectedIdsChange: (nextIds: string[]) => void
  onOpenChange: (open: boolean) => void
  onSave: () => void
}

export function UserFactoryDialog({
  open,
  userLabel,
  loading,
  saving,
  error,
  record,
  selectedIds,
  onSelectedIdsChange,
  onOpenChange,
  onSave,
}: UserFactoryDialogProps) {
  const [search, setSearch] = useState("")

  const factories = useMemo(() => record?.factories ?? [], [record])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return factories
    return factories.filter((f) =>
      [f.displayName, f.name, f.code ?? ""].some((text) => text.toLowerCase().includes(term)),
    )
  }, [factories, search])

  const selected = new Set(selectedIds)
  const changed =
    record != null &&
    (selectedIds.length !== record.factoryIds.length || selectedIds.some((id) => !record.factoryIds.includes(id)))

  function toggle(factoryId: string, checked: boolean) {
    onSelectedIdsChange(checked ? [...selectedIds, factoryId] : selectedIds.filter((id) => id !== factoryId))
  }

  function selectVisible() {
    const next = new Set(selectedIds)
    visible.forEach((f) => next.add(f.factoryId))
    onSelectedIdsChange([...next])
  }

  function clearVisible() {
    const hidden = new Set(visible.map((f) => f.factoryId))
    onSelectedIdsChange(selectedIds.filter((id) => !hidden.has(id)))
  }

  return (
    // The workspace remounts the dialog (key) each time it opens, so the search starts empty.
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(44rem,90dvh)] sm:max-h-[min(44rem,calc(100dvh-2rem))] flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Factory access</DialogTitle>
          <DialogDescription>
            Choose the factories <span className="font-medium text-slate-900 dark:text-slate-100">{userLabel}</span> may work
            with in this organization. A user with no factories sees none.
          </DialogDescription>
        </DialogHeader>

        {record?.isUnrestricted ? (
          <div className="flex gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-400/30 dark:bg-sky-500/10 dark:text-sky-100">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <p>This user is an admin and sees every factory, whatever is ticked here.</p>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Loading factories
          </div>
        ) : record ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search factories"
                  className="h-8 rounded-xl pl-8 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs" disabled={visible.length === 0} onClick={selectVisible}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl text-xs" disabled={visible.length === 0} onClick={clearVisible}>
                  Clear
                </Button>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedIds.length} of {factories.length} {factories.length === 1 ? "factory" : "factories"} selected
            </p>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10">
              {factories.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  This organization has no factories yet. Add them on Factory Setup.
                </p>
              ) : visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No factory matches the search.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-white/10">
                  {visible.map((factory) => {
                    const checkboxId = `user-factory-${factory.factoryId}`
                    return (
                      <li key={factory.factoryId}>
                        <label htmlFor={checkboxId} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5">
                          <Checkbox
                            id={checkboxId}
                            checked={selected.has(factory.factoryId)}
                            onCheckedChange={(checked) => toggle(factory.factoryId, checked === true)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-slate-950 dark:text-slate-50">{factory.displayName}</span>
                            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {[factory.name, factory.code].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          {factory.isActive ? null : (
                            <Badge variant="outline" className="shrink-0 rounded-full px-2 py-0 text-[11px]">Inactive</Badge>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" disabled={loading || saving || !record || !changed} onClick={onSave}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
