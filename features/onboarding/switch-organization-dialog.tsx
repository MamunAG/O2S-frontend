"use client"

import { useEffect, useState } from "react"
import { Building2, Check, Loader2, Pencil, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrganizationEntryDialog } from "@/features/organization/organization-entry-dialog"
import { fetchCurrentUserOrganizations } from "@/features/organization/organization.service"
import type { OrganizationRecord } from "@/features/organization/organization.types"
import { readSelectedOrganizationId, switchOrganization } from "@/lib/organization-selection"
import { cn } from "@/lib/utils"

import { CreateOrganizationFlow } from "./create-organization-flow"

type SwitchOrganizationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The user's organizations as cards to pick from; switching reloads the page into the chosen one. */
export function SwitchOrganizationDialog({ open, onOpenChange }: SwitchOrganizationDialogProps) {
  const [organizations, setOrganizations] = useState<OrganizationRecord[] | null>(null)
  const [error, setError] = useState("")
  const [chosenId, setChosenId] = useState(() => (typeof window === "undefined" ? "" : readSelectedOrganizationId()))
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<OrganizationRecord | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState("")

  const currentId = typeof window === "undefined" ? "" : readSelectedOrganizationId()

  useEffect(() => {
    if (!open) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token") ?? ""
    let cancelled = false
    fetchCurrentUserOrganizations({ apiUrl, accessToken })
      .then((list) => {
        if (cancelled) return
        setOrganizations(list)
        setError("")
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load your organizations.")
      })
    return () => {
      cancelled = true
    }
  }, [open, reloadKey])

  async function apply() {
    if (!chosenId || chosenId === currentId) {
      onOpenChange(false)
      return
    }
    setSwitching(true)
    setSwitchError("")
    try {
      // The backend checks the choice, remembers it and answers a token for it.
      await switchOrganization(chosenId)
      // Every menu, screen and the factory list follow the organization.
      window.location.reload()
    } catch (caught) {
      setSwitchError(caught instanceof Error ? caught.message : "Unable to switch organization right now.")
      setSwitching(false)
    }
  }

  const chosen = organizations?.find((organization) => organization.id === chosenId) ?? null

  return (
    <>
      <Dialog open={open && !creating && !editing} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Switch organization</DialogTitle>
            <DialogDescription>Choose the organization to work in. Its factories, modules and menus follow it.</DialogDescription>
          </DialogHeader>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">{error}</p>
          ) : organizations === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              Loading organizations
            </div>
          ) : (
            <div role="radiogroup" aria-label="Organizations" className="space-y-2">
              {organizations.map((organization) => {
                const checked = organization.id === chosenId
                return (
                  <button
                    key={organization.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setChosenId(organization.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                      checked
                        ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-white/10"
                        : "border-slate-200 hover:border-slate-400 dark:border-white/10 dark:hover:border-white/30",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        checked ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "border-slate-300 dark:border-white/30",
                      )}
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </span>
                    <Building2 className="size-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">{organization.name}</span>
                      {organization.address ? (
                        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{organization.address}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {organization.id === currentId ? <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px]">Current</Badge> : null}
                      {organization.isDefault ? <Badge variant="outline" className="rounded-full px-2 py-0 text-[11px]">Default</Badge> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
            <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs" onClick={() => setCreating(true)}>
              <Plus className="size-3.5" />
              Create new organization
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-xl text-xs" disabled={!chosen} onClick={() => setEditing(chosen)}>
              <Pencil className="size-3.5" />
              Edit selected
            </Button>
          </div>

          {switchError ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">{switchError}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" disabled={!chosenId || switching} onClick={apply}>
              {switching ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {chosenId && chosenId !== currentId ? "Switch" : "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateOrganizationFlow open={creating} onCancel={() => setCreating(false)} />
      <OrganizationEntryDialog
        open={Boolean(editing)}
        mode="edit"
        organization={editing}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        onSaved={() => setReloadKey((current) => current + 1)}
      />
    </>
  )
}
