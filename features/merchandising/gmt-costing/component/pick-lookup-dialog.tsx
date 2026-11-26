"use client"

// Picks one lookup (a fabric, a part, ...) and hands it back: Change Fabric / Change GMT Parts.

import { useState } from "react"

import type { AppComboboxLoadParams, AppComboboxOption } from "@/components/app-combobox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { INPUT_CLASS, LookupCombobox } from "./gmt-ui"

export function PickLookupDialog({
  open,
  title,
  description,
  loadItems,
  onOpenChange,
  onPick,
  confirmLabel = "Set",
}: {
  open: boolean
  title: string
  description?: string
  loadItems: (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>
  onOpenChange: (open: boolean) => void
  onPick: (option: AppComboboxOption) => void
  confirmLabel?: string
}) {
  const [picked, setPicked] = useState<AppComboboxOption | null>(null)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPicked(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <LookupCombobox
          value={picked ? picked.value : null}
          label={picked?.label ?? ""}
          loadItems={loadItems}
          placeholder="Search..."
          inputClassName={INPUT_CLASS}
          onChange={setPicked}
        />
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!picked}
            onClick={() => {
              if (picked) onPick(picked)
              setPicked(null)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
