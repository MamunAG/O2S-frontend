"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight, ChevronDown, Factory, Plus, Send } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FactoryQuickEntryDialog } from "@/features/app-config/factory/factory-quick-entry-dialog"
import type { MyFactoriesRecord } from "@/features/iam/user-factory-permissions/user-factory-permission.types"
import { RequestFactoryPermissionDialog } from "@/features/onboarding/request-factory-permission-dialog"
import { SwitchOrganizationDialog } from "@/features/onboarding/switch-organization-dialog"
import { fetchCurrentUserOrganizations } from "@/features/organization/organization.service"
import { readSelectedFactoryId, writeSelectedFactoryId } from "@/lib/factory-selection"
import { loadMyFactories } from "@/lib/my-factories"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"
import { cn } from "@/lib/utils"

const ALL_FACTORIES = "__all_factories__"

type Loaded = { organizationId: string; organizationName: string; mine: MyFactoriesRecord | null }

/**
 * The top bar's factory menu (it replaces the organization combobox): the factory the user works in, then "Add
 * factory" for an organization admin, "Request factory permission" for everyone else, and "Switch organization".
 * The factory-based screens show only the selected factory's records and the left menu hides those the user may not
 * use in it; a user with no factory sees no module at all. Switching reloads the page so everything follows.
 */
export function FactorySwitcher({ className }: { className?: string }) {
  const [organizationId, setOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [dialog, setDialog] = useState<"switch" | "request" | "add" | null>(null)

  useEffect(() => {
    function handleOrganizationChange(event: Event) {
      const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
      setOrganizationId(next || "")
    }

    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
  }, [])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token") ?? ""

    Promise.all([
      loadMyFactories(organizationId),
      fetchCurrentUserOrganizations({ apiUrl, accessToken }).catch(() => []),
    ]).then(([mine, organizations]) => {
      if (cancelled) return
      const organizationName = organizations.find((organization) => organization.id === organizationId)?.name ?? "Organization"
      setLoaded({ organizationId, organizationName, mine })
      if (!mine) return

      // A remembered factory the user no longer has, or none for a user who must work in one: pick again.
      const stored = readSelectedFactoryId(organizationId)
      const valid = stored ? mine.factories.some((factory) => factory.id === stored) : mine.isUnrestricted || mine.factories.length === 0
      if (!valid) {
        const next = mine.isUnrestricted ? "" : mine.factories[0]?.id ?? ""
        if (next !== stored) {
          writeSelectedFactoryId(next, organizationId)
          window.location.reload()
        }
      }
    })

    return () => {
      cancelled = true
    }
  }, [organizationId])

  const current = loaded?.organizationId === organizationId ? loaded : null
  if (!organizationId || !current) return null

  const mine = current.mine
  const isAdmin = Boolean(mine?.isUnrestricted)
  const factories = mine?.factories ?? []
  const selected = readSelectedFactoryId(organizationId)
  const value = selected || (isAdmin ? ALL_FACTORIES : "")
  const selectedLabel =
    factories.find((factory) => factory.id === selected)?.displayName ??
    (factories.length === 0 ? "No factory" : isAdmin ? "All factories" : "Choose a factory")

  return (
    <>
      {/* modal={false}: a dialog opened from an item would otherwise leave the page without pointer events. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Factory and organization"
            className={cn(
              "flex h-9 w-[15rem] max-w-[min(15rem,calc(100vw-7rem))] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-left transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20",
              className,
            )}
          >
            <Factory className={cn("size-3.5 shrink-0", factories.length === 0 ? "text-amber-600" : "text-slate-500")} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{current.organizationName}</span>
              <span className={cn("block truncate text-xs font-medium", factories.length === 0 ? "text-amber-700 dark:text-amber-300" : "text-slate-900 dark:text-white")}>
                {selectedLabel}
              </span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-slate-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Factory</DropdownMenuLabel>
          {factories.length === 0 ? (
            <DropdownMenuItem disabled className="text-xs">
              {isAdmin ? "No factory in this organization yet" : "You have no factory yet"}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuRadioGroup
              value={value}
              onValueChange={(next) => {
                const factoryId = next === ALL_FACTORIES ? "" : next
                if (factoryId === selected) return
                writeSelectedFactoryId(factoryId, organizationId)
                window.location.reload()
              }}
            >
              {isAdmin ? (
                <DropdownMenuRadioItem value={ALL_FACTORIES} className="text-xs">
                  All factories
                </DropdownMenuRadioItem>
              ) : null}
              {factories.map((factory) => (
                <DropdownMenuRadioItem key={factory.id} value={factory.id} className="text-xs">
                  {factory.displayName || factory.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          {isAdmin ? (
            <DropdownMenuItem className="text-xs" onSelect={() => setDialog("add")}>
              <Plus className="size-3.5" />
              Add factory
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-xs" onSelect={() => setDialog("request")}>
              <Send className="size-3.5" />
              Request factory permission
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-xs" onSelect={() => setDialog("switch")}>
            <ArrowLeftRight className="size-3.5" />
            Switch organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SwitchOrganizationDialog open={dialog === "switch"} onOpenChange={(open) => setDialog(open ? "switch" : null)} />
      <RequestFactoryPermissionDialog
        open={dialog === "request"}
        organizationName={current.organizationName}
        onOpenChange={(open) => setDialog(open ? "request" : null)}
      />
      {dialog === "add" ? (
        <FactoryQuickEntryDialog
          open
          firstFactory={factories.length === 0}
          organizationId={organizationId}
          onOpenChange={(open) => setDialog(open ? "add" : null)}
          onCreated={() => window.location.reload()}
        />
      ) : null}
    </>
  )
}
