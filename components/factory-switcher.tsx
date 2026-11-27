"use client"

import { useEffect, useState } from "react"
import { Factory } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { fetchMyFactories } from "@/features/iam/user-factory-permissions/user-factory-permission.service"
import type { MyFactoriesRecord } from "@/features/iam/user-factory-permissions/user-factory-permission.types"
import { readSelectedFactoryId, writeSelectedFactoryId } from "@/lib/factory-selection"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"
import { cn } from "@/lib/utils"

const ALL_FACTORIES = "__all_factories__"

/**
 * The factory the user works in, next to the organization switcher. The factory-based screens (Employee Setup,
 * Payroll Processing, Job, Order Placement, Create Budget) show only its records, and the left menu hides those
 * the user may not use in it. Switching reloads the page so every screen and menu follows the new factory.
 */
export function FactorySwitcher({ className }: { className?: string }) {
  const [organizationId, setOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  const [loaded, setLoaded] = useState<{ organizationId: string; data: MyFactoriesRecord | null } | null>(null)

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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token") ?? ""
    const request =
      apiUrl && accessToken && organizationId
        ? fetchMyFactories({ apiUrl, accessToken, organizationId })
        : Promise.resolve(null)

    request
      .catch(() => null)
      .then((data) => {
        if (cancelled) return
        setLoaded({ organizationId, data })
        if (!data) return

        // A remembered factory the user no longer has, or none for a user who must work in one: pick again.
        const stored = readSelectedFactoryId(organizationId)
        const valid = stored ? data.factories.some((factory) => factory.id === stored) : data.isUnrestricted
        if (!valid) {
          const next = data.isUnrestricted ? "" : data.factories[0]?.id ?? ""
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

  const data = loaded?.organizationId === organizationId ? loaded.data : null
  if (!organizationId || !data) return null

  const selected = readSelectedFactoryId(organizationId)
  const value = selected || (data.isUnrestricted ? ALL_FACTORIES : "")
  const noFactories = !data.isUnrestricted && data.factories.length === 0

  return (
    <Select
      value={value}
      disabled={noFactories}
      onValueChange={(next) => {
        const factoryId = next === ALL_FACTORIES ? "" : next
        if (factoryId === selected) return
        writeSelectedFactoryId(factoryId, organizationId)
        window.location.reload()
      }}
    >
      <SelectTrigger
        aria-label="Factory"
        title="Factory"
        className={cn("h-8 w-[12rem] max-w-[min(12rem,calc(100vw-7rem))] rounded-full text-xs", className)}
      >
        <Factory className="size-3.5 shrink-0 text-slate-500" />
        <SelectValue placeholder={noFactories ? "No factory" : "Choose a factory"} />
      </SelectTrigger>
      <SelectContent>
        {data.isUnrestricted ? <SelectItem value={ALL_FACTORIES} className="text-xs">All factories</SelectItem> : null}
        {data.factories.map((factory) => (
          <SelectItem key={factory.id} value={factory.id} className="text-xs">
            {factory.displayName || factory.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
