"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight, ChevronDown, Factory, Loader2, Send, Star } from "lucide-react"
import { toast } from "sonner"

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
import { saveMyDefaultFactory } from "@/features/iam/user-factory-permissions/user-factory-permission.service"
import type { MyFactoriesRecord } from "@/features/iam/user-factory-permissions/user-factory-permission.types"
import { RequestFactoryPermissionDialog } from "@/features/onboarding/request-factory-permission-dialog"
import { SwitchOrganizationDialog } from "@/features/onboarding/switch-organization-dialog"
import { fetchCurrentUserOrganizations } from "@/features/organization/organization.service"
import { readSelectedFactoryId, writeSelectedFactoryId } from "@/lib/factory-selection"
import { loadMyFactories, rememberMyFactories } from "@/lib/my-factories"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"
import { cn } from "@/lib/utils"

type Loaded = { organizationId: string; organizationName: string; mine: MyFactoriesRecord | null }

/**
 * The top bar's factory menu (it replaces the organization combobox): the factory the user works in, then "Set
 * selected factory as default" (saved on the user, selected on their next sign-in), "Request factory permission" for
 * a non-admin, and "Switch organization". Factories are added from Factory Setup.
 * The factory-based screens show only the selected factory's records and the left menu hides those the user may not
 * use in it; a user with no factory sees no module at all. Switching reloads the page so everything follows.
 */
export function FactorySwitcher({ className }: { className?: string }) {
  const [organizationId, setOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [dialog, setDialog] = useState<"switch" | "request" | null>(null)
  const [savingDefault, setSavingDefault] = useState(false)

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

      // None remembered (a new sign-in clears it), or one the user no longer has: their default factory (the backend
      // sends it only while it is one of theirs here), else the first (admins too; there is no "all factories").
      const stored = readSelectedFactoryId(organizationId)
      const valid = stored ? mine.factories.some((factory) => factory.id === stored) : mine.factories.length === 0
      if (!valid) {
        const next = mine.defaultFactoryId || mine.factories[0]?.id || ""
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
  const selectedFactory = factories.find((factory) => factory.id === selected)
  const selectedLabel = selectedFactory
    ? selectedFactory.displayName || selectedFactory.name
    : factories.length === 0
      ? "No factory"
      : "Choose a factory"
  const defaultFactoryId = mine?.defaultFactoryId ?? ""
  const selectedIsDefault = Boolean(selectedFactory) && selectedFactory?.id === defaultFactoryId

  async function setSelectedAsDefault() {
    if (!selectedFactory || selectedIsDefault || savingDefault) return
    setSavingDefault(true)
    try {
      const next = await saveMyDefaultFactory({
        apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
        accessToken: window.localStorage.getItem("access_token") ?? "",
        organizationId,
        factoryId: selectedFactory.id,
      })
      rememberMyFactories(organizationId, next)
      setLoaded((previous) => (previous?.organizationId === organizationId ? { ...previous, mine: next } : previous))
      toast.success(`${selectedFactory.displayName || selectedFactory.name} is now your default factory.`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to set the default factory right now.")
    } finally {
      setSavingDefault(false)
    }
  }

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
              value={selected}
              onValueChange={(factoryId) => {
                if (!factoryId || factoryId === selected) return
                writeSelectedFactoryId(factoryId, organizationId)
                window.location.reload()
              }}
            >
              {factories.map((factory) => (
                <DropdownMenuRadioItem key={factory.id} value={factory.id} className="text-xs">
                  <span className="min-w-0 flex-1 truncate">{factory.displayName || factory.name}</span>
                  {factory.id === defaultFactoryId ? (
                    <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Default
                    </span>
                  ) : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          <DropdownMenuSeparator />
          {selectedFactory ? (
            <DropdownMenuItem
              className="text-xs"
              disabled={selectedIsDefault || savingDefault}
              onSelect={() => void setSelectedAsDefault()}
            >
              {savingDefault ? <Loader2 className="size-3.5 animate-spin" /> : <Star className={cn("size-3.5", selectedIsDefault && "fill-amber-400 text-amber-500")} />}
              {selectedIsDefault ? "Selected factory is your default" : "Set selected factory as default"}
            </DropdownMenuItem>
          ) : null}
          {isAdmin ? null : (
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
    </>
  )
}
