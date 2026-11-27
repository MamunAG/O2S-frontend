"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Factory, Loader2, Plus, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FactoryQuickEntryDialog } from "@/features/app-config/factory/factory-quick-entry-dialog"
import { RequestFactoryPermissionDialog } from "@/features/onboarding/request-factory-permission-dialog"
import { loadMyFactories } from "@/lib/my-factories"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

type Checked = { organizationId: string; hasFactory: boolean; isAdmin: boolean }

/**
 * A module (its left menu and pages) opens only for a user with at least one factory in the selected organization.
 * Without one it shows how to get there: an admin adds a factory, anyone else asks the admins for permission.
 */
export function FactoryRequiredGuard({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  const [checked, setChecked] = useState<Checked | null>(null)
  const [dialog, setDialog] = useState<"add" | "request" | null>(null)

  useEffect(() => {
    function handleOrganizationChange(event: Event) {
      const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
      setOrganizationId(next || "")
    }

    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadMyFactories(organizationId).then((mine) => {
      if (cancelled) return
      setChecked({ organizationId, hasFactory: Boolean(mine && mine.factories.length > 0), isAdmin: Boolean(mine?.isUnrestricted) })
    })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  if (checked?.organizationId !== organizationId) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Loading
      </div>
    )
  }

  if (checked.hasFactory) return <>{children}</>

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500 text-white">
          <Factory className="size-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">No factory yet</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {checked.isAdmin
            ? "Modules and menus appear once this organization has a factory."
            : "Modules and menus appear once an admin gives you a factory in this organization."}
        </p>
        <p lang="bn" className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          {checked.isAdmin
            ? "একটি ফ্যাক্টরি যোগ করলেই মডিউল ও মেনু দেখা যাবে।"
            : "অ্যাডমিন আপনাকে ফ্যাক্টরির অনুমতি দিলে মডিউল ও মেনু দেখা যাবে।"}
        </p>
        {checked.isAdmin ? (
          <Button type="button" className="mt-6 rounded-xl" onClick={() => setDialog("add")}>
            <Plus className="size-3.5" />
            Add factory
          </Button>
        ) : (
          <Button type="button" className="mt-6 rounded-xl" onClick={() => setDialog("request")}>
            <Send className="size-3.5" />
            Request factory permission
          </Button>
        )}
      </div>

      <RequestFactoryPermissionDialog
        open={dialog === "request"}
        organizationName="this organization"
        onOpenChange={(open) => setDialog(open ? "request" : null)}
      />
      {dialog === "add" ? (
        <FactoryQuickEntryDialog
          open
          firstFactory
          organizationId={organizationId}
          onOpenChange={(open) => setDialog(open ? "add" : null)}
          onCreated={() => window.location.reload()}
        />
      ) : null}
    </div>
  )
}
