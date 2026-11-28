"use client"

import { type ReactNode, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Coins,
  Factory,
  Globe2,
  Layers,
  ListTree,
  Loader2,
  Lock,
  Package,
  RefreshCcw,
  Ruler,
  Sparkles,
  Truck,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { fetchMenuPermissions } from "@/features/iam/menu-permissions/menu-permission.service"
import { isGlobalAdmin, parseStoredAuthUser } from "@/lib/auth-session"
import {
  filterModuleSidebarGroupsByPermissions,
  getModuleNavigation,
  type ModuleNavItem,
} from "@/lib/module-navigation"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"
import { cn } from "@/lib/utils"

import {
  fetchAreaCounts,
  fetchCurrencyPulse,
  fetchLatestMaterials,
  type AreaCounts,
  type CurrencyPulse,
  type LatestMaterial,
} from "./app-config-overview.service"

type AreaGroup = "core" | "data"

type AreaConfig = {
  key: string
  label: string
  href: string
  resource: string
  group: AreaGroup
  icon: LucideIcon
  /** Has isActive + soft delete (every App Config list except exchange rates). */
  softDelete: boolean
  /** Counted in "Setup readiness": the module needs at least one active record here. */
  essential: boolean
  /** Plural noun for "No … yet". */
  noun: string
}

const AREAS: AreaConfig[] = [
  { key: "factory", label: "Factories", href: "/app-config/core/factory", resource: "factory", group: "core", icon: Factory, softDelete: true, essential: true, noun: "factories" },
  { key: "module", label: "Modules", href: "/app-config/core/module-entry", resource: "module-entry", group: "core", icon: Boxes, softDelete: true, essential: false, noun: "modules" },
  { key: "menu", label: "Menus", href: "/app-config/core/menu", resource: "menu", group: "core", icon: ListTree, softDelete: true, essential: false, noun: "menus" },
  { key: "country", label: "Countries", href: "/app-config/data/countries", resource: "country", group: "data", icon: Globe2, softDelete: true, essential: true, noun: "countries" },
  { key: "currency", label: "Currencies", href: "/app-config/data/currencies", resource: "currency", group: "data", icon: Coins, softDelete: true, essential: true, noun: "currencies" },
  { key: "exchange-rate", label: "Exchange rates", href: "/app-config/data/exchange-rates", resource: "exchange-rate", group: "data", icon: ArrowLeftRight, softDelete: false, essential: true, noun: "exchange rates" },
  { key: "unit", label: "Units", href: "/app-config/data/units", resource: "unit", group: "data", icon: Ruler, softDelete: true, essential: true, noun: "units" },
  { key: "supplier", label: "Suppliers", href: "/app-config/data/suppliers", resource: "supplier", group: "data", icon: Truck, softDelete: true, essential: false, noun: "suppliers" },
  { key: "material-group", label: "Material groups", href: "/app-config/data/material-groups", resource: "material-group", group: "data", icon: Layers, softDelete: true, essential: false, noun: "material groups" },
  { key: "material", label: "Materials", href: "/app-config/data/materials", resource: "material", group: "data", icon: Package, softDelete: true, essential: false, noun: "materials" },
]

const GROUP_LABELS: Record<AreaGroup, { title: string; description: string }> = {
  core: { title: "Core", description: "Factories and the module / menu structure." },
  data: { title: "Reference data", description: "Shared lists the other modules pick from." },
}

type AreaResult = {
  area: AreaConfig
  counts: AreaCounts | null
  error: string
}

type OverviewData = {
  areas: AreaResult[]
  pulse: CurrencyPulse | null
  /** null: the Materials page isn't visible to this user, or the list failed to load. */
  latestMaterials: LatestMaterial[] | null
  loadedAt: number
}

const CARD_CLASS =
  "overflow-hidden border-white/60 bg-white/85 py-0 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75"

const numberFormat = new Intl.NumberFormat(undefined)
const compactFormat = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 })

function formatCount(value: number) {
  return value >= 10_000 ? compactFormat.format(value) : numberFormat.format(value)
}

function isAuthFailure(message: string) {
  const lower = message.toLowerCase()
  return lower.includes("session expired") || lower.includes("unauthorized")
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}

function collectHrefs(items: ModuleNavItem[]): string[] {
  return items.flatMap((item) => [item.href, ...collectHrefs(item.children ?? [])])
}

/** The App Config pages this user sees in the sidebar (same rule as the sidebar itself). */
async function loadVisibleHrefs(apiUrl: string, accessToken: string, organizationId?: string) {
  const appModule = getModuleNavigation("app-config")
  if (!appModule) return new Set<string>()

  const storedUser = parseStoredAuthUser(window.localStorage.getItem("auth_user"))
  if (isGlobalAdmin(storedUser)) {
    return new Set(appModule.groups.flatMap((group) => collectHrefs(group.items)))
  }

  if (!storedUser?.id || !organizationId) return new Set<string>()

  const permissions = await fetchMenuPermissions({ apiUrl, accessToken, userId: storedUser.id, organizationId })
  const groups = filterModuleSidebarGroupsByPermissions(appModule.groups, permissions, false)
  return new Set(groups.flatMap((group) => collectHrefs(group.items)))
}

async function loadOverview(apiUrl: string, accessToken: string, organizationId?: string): Promise<OverviewData> {
  const visibleHrefs = await loadVisibleHrefs(apiUrl, accessToken, organizationId)
  const areas = AREAS.filter((area) => visibleHrefs.has(area.href))

  const [countResults, pulse, latestMaterials] = await Promise.all([
    Promise.allSettled(
      areas.map((area) =>
        fetchAreaCounts({ apiUrl, accessToken, organizationId, resource: area.resource, softDelete: area.softDelete }),
      ),
    ),
    areas.some((area) => area.key === "currency" || area.key === "exchange-rate")
      ? fetchCurrencyPulse({
          apiUrl,
          accessToken,
          organizationId,
          includeCurrency: areas.some((area) => area.key === "currency"),
          includeRates: areas.some((area) => area.key === "exchange-rate"),
        })
      : Promise.resolve(null),
    areas.some((area) => area.key === "material")
      ? fetchLatestMaterials({ apiUrl, accessToken, organizationId, limit: 5 }).catch(() => null)
      : Promise.resolve(null),
  ])

  const results = countResults.map((result, index): AreaResult => {
    if (result.status === "fulfilled") return { area: areas[index], counts: result.value, error: "" }
    return { area: areas[index], counts: null, error: errorMessage(result.reason, "Unable to load this area.") }
  })

  const authFailure = results.find((result) => isAuthFailure(result.error))
  if (authFailure) throw new Error(authFailure.error)

  return { areas: results, pulse, latestMaterials, loadedAt: Date.now() }
}

/** "Just now", "5 min ago", "3 h ago", "2 d ago", then the date. O2S saves server-local time without an offset. */
function timeAgo(value: string, now: number) {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return value
  const minutes = Math.max(0, Math.round((now - time) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return formatDay(value)
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.trim().slice(0, 2)).toUpperCase() || "?"
}

/** Whole days between a rate's date (yyyy-MM-dd…) and the day the overview loaded. */
function daysSince(value: string, now: number) {
  const day = Date.parse(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(day)) return null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - day) / 86_400_000))
}

function formatDay(value: string) {
  const day = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(day.getTime())
    ? value
    : day.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

/* ------------------------------------------------------------------------------------------------ */

function Meter({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      title={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950", className)}
    >
      <div
        className="h-full rounded-full bg-sky-600 transition-[width] duration-500 dark:bg-sky-400"
        style={{ width: `${share}%` }}
      />
    </div>
  )
}

function AreaTile({ result }: { result: AreaResult }) {
  const { area, counts, error } = result
  const Icon = area.icon
  const total = counts?.total ?? 0
  const active = counts?.active ?? null
  const inactive = active !== null ? Math.max(0, total - active) : null
  const deleted = counts?.deleted ?? 0

  return (
    <Link
      href={area.href}
      className="group relative flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_16px_40px_rgba(14,116,144,0.12)] focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none dark:border-white/10 dark:bg-slate-950/70 dark:hover:border-sky-400/30"
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-50 to-cyan-50 text-sky-700 ring-1 ring-sky-100 ring-inset dark:from-sky-400/15 dark:to-cyan-400/5 dark:text-sky-300 dark:ring-sky-400/20">
          <Icon className="size-4" />
        </div>
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 dark:text-slate-200">{area.label}</p>
        <ArrowRight className="size-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-sky-600 dark:text-slate-600 dark:group-hover:text-sky-300" />
      </div>

      {error ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Lock className="size-3.5" />
          <span className="truncate" title={error}>Not available</span>
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl leading-none font-semibold tracking-tight text-slate-950 dark:text-white">
              {formatCount(active ?? total)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {active !== null ? `active of ${formatCount(total)}` : "records"}
            </span>
          </div>

          {active !== null ? (
            <Meter value={active} max={total} label={`${area.label}: ${active} of ${total} active`} />
          ) : (
            <div className="h-1.5" />
          )}

          <div className="flex min-h-4 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            {total === 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-3" />
                No {area.noun} yet
              </span>
            ) : (
              <>
                {inactive !== null ? <span>{formatCount(inactive)} inactive</span> : null}
                {deleted > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                    {formatCount(deleted)} in recycle bin
                  </span>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </Link>
  )
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-baseline gap-2 px-1">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  )
}

function PanelHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-200/70 px-4 py-2.5 dark:border-white/10">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-950">
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  )
}

function LatestMaterials({ materials, loadedAt }: { materials: LatestMaterial[]; loadedAt: number }) {
  return (
    <Card className={cn(CARD_CLASS, "lg:col-span-2 xl:col-span-3")}>
      <CardContent className="p-0">
        <PanelHeader
          icon={Package}
          title="Latest materials"
          description="The most recently added materials, newest first."
          action={
            <Link
              href="/app-config/data/materials"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
            >
              View all
              <ArrowRight className="size-3.5" />
            </Link>
          }
        />

        {materials.length ? (
          <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
            {materials.map((material) => {
              const details = [material.materialGroup?.name, material.unit?.name].filter(Boolean).join(" · ")
              const addedBy =
                material.created_by_user?.display_name ||
                material.created_by_user?.name ||
                material.created_by_user?.user_name ||
                ""

              return (
                <li key={material.id} className="flex items-center gap-3 px-4 py-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-50 to-cyan-50 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100 ring-inset dark:from-sky-400/15 dark:to-cyan-400/5 dark:text-sky-300 dark:ring-sky-400/20">
                    {initials(material.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{material.name}</p>
                      {material.code ? (
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/5 dark:text-slate-300">
                          {material.code}
                        </span>
                      ) : null}
                      {material.isActive === false ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{details || "No group or unit"}</p>
                  </div>

                  {addedBy ? (
                    <p className="hidden w-36 shrink-0 truncate text-[11px] text-slate-500 sm:block dark:text-slate-400" title={addedBy}>
                      by {addedBy}
                    </p>
                  ) : null}

                  <p
                    className="w-20 shrink-0 text-right text-[11px] text-slate-500 tabular-nums dark:text-slate-400"
                    title={material.created_at ? new Date(material.created_at).toLocaleString() : undefined}
                  >
                    {material.created_at ? timeAgo(material.created_at, loadedAt) : "-"}
                  </p>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">No materials yet.</p>
            <Button asChild variant="outline" className="h-7 rounded-xl text-xs">
              <Link href="/app-config/data/materials">Add the first material</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecordsByArea({ results }: { results: AreaResult[] }) {
  const rows = results
    .filter((result) => result.counts)
    .map((result) => ({ area: result.area, total: result.counts?.total ?? 0 }))
    .sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...rows.map((row) => row.total))

  return (
    <Card className={CARD_CLASS}>
      <CardContent className="p-0">
        <PanelHeader icon={Layers} title="Records by area" description="Saved records in each list, largest first." />
        {rows.length ? (
          <ul className="space-y-2.5 px-4 py-3">
            {rows.map((row) => (
              <li key={row.area.key}>
                <Link href={row.area.href} className="group grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 rounded-md">
                  <span className="truncate text-xs text-slate-600 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
                    {row.area.label}
                  </span>
                  <Meter
                    value={row.total}
                    max={max}
                    label={`${row.area.label}: ${numberFormat.format(row.total)} records`}
                    className="h-2 bg-slate-100 dark:bg-white/5"
                  />
                  <span className="min-w-10 text-right text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                    {formatCount(row.total)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No record counts available.</p>
        )}
      </CardContent>
    </Card>
  )
}

type ChecklistState = "ready" | "empty" | "locked"

function SetupChecklist({ results }: { results: AreaResult[] }) {
  const items = results
    .filter((result) => result.area.essential)
    .map((result) => {
      const count = result.counts ? (result.counts.active ?? result.counts.total) : 0
      const state: ChecklistState = result.error ? "locked" : count > 0 ? "ready" : "empty"
      return { result, count, state }
    })

  const stateStyle: Record<ChecklistState, { icon: LucideIcon; label: string; className: string }> = {
    ready: { icon: CheckCircle2, label: "Ready", className: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-400/10" },
    empty: { icon: AlertTriangle, label: "Needs setup", className: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-400/10" },
    locked: { icon: Lock, label: "No access", className: "text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-white/5" },
  }

  return (
    <Card className={CARD_CLASS}>
      <CardContent className="p-0">
        <PanelHeader icon={CheckCircle2} title="Setup checklist" description="What other modules need before they work." />
        {items.length ? (
          <ul className="divide-y divide-slate-200/70 dark:divide-white/10">
            {items.map(({ result, count, state }) => {
              const style = stateStyle[state]
              const StateIcon = style.icon
              return (
                <li key={result.area.key}>
                  <Link
                    href={result.area.href}
                    className="group flex items-center gap-3 px-4 py-2 transition hover:bg-slate-50/80 dark:hover:bg-white/3"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                        {result.area.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {state === "ready"
                          ? `${formatCount(count)} ${result.area.softDelete ? "active" : "saved"}`
                          : state === "empty"
                            ? `Add the first of your ${result.area.noun}`
                            : "Ask an admin for access"}
                      </span>
                    </span>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", style.className)}>
                      <StateIcon className="size-3" />
                      {style.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">No essential setup pages are available to you.</p>
        )}
      </CardContent>
    </Card>
  )
}

function CurrencyPanel({ pulse, loadedAt, hasRates }: { pulse: CurrencyPulse; loadedAt: number; hasRates: boolean }) {
  const age = pulse.latestRateDate ? daysSince(pulse.latestRateDate, loadedAt) : null
  const fresh = age !== null && age <= 1

  return (
    <Card className={CARD_CLASS}>
      <CardContent className="p-0">
        <PanelHeader icon={Coins} title="Currency & rates" description="The base currency and how fresh the rates are." />
        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-linear-to-br from-slate-50 to-white px-3 py-2.5 dark:border-white/10 dark:from-white/4 dark:to-transparent">
            <div className="flex h-10 min-w-14 items-center justify-center rounded-lg bg-slate-900 px-2 text-sm font-bold tracking-wider text-white dark:bg-white dark:text-slate-950">
              {pulse.defaultCurrencyCode ?? "—"}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Default currency</p>
              <p className="truncate text-xs text-slate-700 dark:text-slate-200">
                {pulse.defaultCurrencyName ?? (pulse.defaultCurrencyCode ? pulse.defaultCurrencyCode : "None set as default")}
              </p>
            </div>
          </div>

          {hasRates ? (
            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200/80 px-3 py-2 dark:border-white/10">
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Latest rates</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {pulse.latestRateDate ? formatDay(pulse.latestRateDate) : "None yet"}
                </dd>
                {age !== null ? (
                  <dd
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 text-[10px] font-semibold",
                      fresh ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {fresh ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                    {age === 0 ? "Up to date" : age === 1 ? "Yesterday" : `${age} days old`}
                  </dd>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-200/80 px-3 py-2 dark:border-white/10">
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">Coverage</dt>
                <dd className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {formatCount(pulse.quotedCurrencies)} currencies
                </dd>
                <dd className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{formatCount(pulse.rateDays)} days of rates</dd>
              </div>
            </dl>
          ) : null}

          <Button asChild variant="outline" className="h-8 w-full rounded-xl text-xs">
            <Link href={hasRates ? "/app-config/data/exchange-rates" : "/app-config/data/currencies"}>
              {hasRates ? "Open exchange rates" : "Open currencies"}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function HeroCard({
  data,
  refreshing,
  onRefresh,
}: {
  data: OverviewData
  refreshing: boolean
  onRefresh: () => void
}) {
  const counted = data.areas.filter((result) => result.counts)
  const activeRecords = counted.reduce((sum, result) => sum + (result.counts?.active ?? result.counts?.total ?? 0), 0)
  const inactiveRecords = counted.reduce(
    (sum, result) => sum + (result.counts?.active != null ? Math.max(0, result.counts.total - result.counts.active) : 0),
    0,
  )
  const deletedRecords = counted.reduce((sum, result) => sum + (result.counts?.deleted ?? 0), 0)

  const essentials = data.areas.filter((result) => result.area.essential && !result.error)
  const ready = essentials.filter((result) => (result.counts?.active ?? result.counts?.total ?? 0) > 0)
  const readiness = essentials.length ? Math.round((ready.length / essentials.length) * 100) : 0
  const updatedAt = new Date(data.loadedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

  return (
    <Card className="relative overflow-hidden border-slate-900/10 bg-slate-950 py-0 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(56,189,248,0.32),transparent_45%),radial-gradient(circle_at_95%_110%,rgba(16,185,129,0.28),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] mask-[linear-gradient(180deg,black,transparent)] bg-size-[28px_28px]" />

      <CardContent className="relative grid gap-5 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-sky-100 uppercase">
              <Sparkles className="size-3" />
              App configuration
            </span>
            <span className="text-[11px] text-slate-400">Updated {updatedAt}</span>
          </div>

          <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">Configuration at a glance</h1>
          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-300 sm:text-sm">
            Factories, menus and the reference data every other module depends on.
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="text-5xl leading-none font-semibold tracking-tight">{formatCount(activeRecords)}</p>
              <p className="mt-1.5 text-xs text-slate-400">
                active records across {data.areas.length} area{data.areas.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                {formatCount(inactiveRecords)} inactive
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200">
                {formatCount(deletedRecords)} in recycle bin
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">Setup readiness</p>
              <p className="mt-1 text-3xl leading-none font-semibold">
                {readiness}
                <span className="text-lg text-slate-400">%</span>
              </p>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {ready.length} of {essentials.length} essential list{essentials.length === 1 ? "" : "s"} ready
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-7 rounded-xl border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white dark:border-white/15 dark:bg-white/10"
            >
              {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
              Refresh
            </Button>
          </div>

          {essentials.length ? (
            <div className="mt-3 flex gap-1" role="list" aria-label="Essential lists">
              {essentials.map((result) => {
                const isReady = ready.includes(result)
                return (
                  <div
                    key={result.area.key}
                    role="listitem"
                    title={`${result.area.label}: ${isReady ? "ready" : "needs setup"}`}
                    className="min-w-0 flex-1"
                  >
                    <div className={cn("h-2 rounded-full", isReady ? "bg-emerald-400" : "bg-white/15")} />
                    <p className="mt-1 truncate text-[10px] text-slate-400">{result.area.label}</p>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-56 animate-pulse rounded-xl bg-slate-900/90 lg:h-44 dark:bg-slate-900" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-white/80 dark:bg-slate-900/70" />
        ))}
      </div>
    </div>
  )
}

export function AppConfigOverview({ apiUrl }: { apiUrl: string }) {
  const router = useRouter()

  const [refreshVersion, setRefreshVersion] = useState(0)
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  const organizationId = selectedOrganizationId || undefined

  // `loaded` records which request last finished, so loading / error are derived (react-hooks/set-state-in-effect).
  const requestKey = JSON.stringify([organizationId, refreshVersion])
  const [loaded, setLoaded] = useState<{ key: string; data: OverviewData | null; error: string } | null>(null)
  const loading = loaded?.key !== requestKey
  // Keep the last numbers on screen while a refresh runs.
  const data = loaded?.data ?? null
  const error = !loading && loaded ? loaded.error : ""

  const handleAuthFailure = useCallback(
    (message: string) => {
      if (!isAuthFailure(message)) return false

      window.localStorage.removeItem("access_token")
      window.localStorage.removeItem("refresh_token")
      window.localStorage.removeItem("auth_user")
      router.replace("/sign-in")
      return true
    },
    [router],
  )

  useEffect(() => {
    function handleOrganizationChange(event: Event) {
      const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
      setSelectedOrganizationId(next || "")
    }

    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
  }, [])

  const triggerRefresh = useCallback(() => setRefreshVersion((current) => current + 1), [])

  useEffect(() => {
    const token = window.localStorage.getItem("access_token")
    if (!token) {
      handleAuthFailure("Your session expired. Please sign in again.")
      return
    }

    let cancelled = false

    loadOverview(apiUrl, token, organizationId)
      .then((next) => {
        if (!cancelled) setLoaded({ key: requestKey, data: next, error: "" })
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        const message = errorMessage(caught, "Unable to load the configuration overview right now.")
        if (handleAuthFailure(message)) return
        toast.error(message)
        setLoaded((previous) => ({ key: requestKey, data: previous?.data ?? null, error: message }))
      })

    return () => {
      cancelled = true
    }
  }, [apiUrl, organizationId, requestKey, handleAuthFailure])

  const groups = (["core", "data"] as const)
    .map((group) => ({ group, results: data?.areas.filter((result) => result.area.group === group) ?? [] }))
    .filter((entry) => entry.results.length)
  const hasCurrency = data?.areas.some((result) => result.area.key === "currency") ?? false
  const hasRates = data?.areas.some((result) => result.area.key === "exchange-rate") ?? false

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ScrollArea className="h-full">
        <div className="min-w-0 space-y-4 p-2 contain-[inline-size] sm:p-3 lg:p-4">
          {!data ? (
            error ? (
              <Card className={CARD_CLASS}>
                <CardContent className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <AlertTriangle className="size-6 text-amber-600" />
                  <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">{error}</p>
                  <Button type="button" variant="outline" onClick={triggerRefresh} className="h-7 rounded-xl">
                    <RefreshCcw className="size-3.5" />
                    Refresh
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <OverviewSkeleton />
            )
          ) : (
            <>
              <HeroCard data={data} refreshing={loading} onRefresh={triggerRefresh} />

              {data.areas.length === 0 ? (
                <Card className={CARD_CLASS}>
                  <CardContent className="px-6 py-10 text-center text-sm text-slate-600 dark:text-slate-300">
                    No App Config pages are available to you in this organization yet.
                  </CardContent>
                </Card>
              ) : null}

              {groups.map(({ group, results }) => (
                <section key={group} className="space-y-2">
                  <SectionTitle title={GROUP_LABELS[group].title} description={GROUP_LABELS[group].description} />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                    {results.map((result) => (
                      <AreaTile key={result.area.key} result={result} />
                    ))}
                  </div>
                </section>
              ))}

              {data.areas.length ? (
                <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {data.latestMaterials ? (
                    <LatestMaterials materials={data.latestMaterials} loadedAt={data.loadedAt} />
                  ) : null}
                  <RecordsByArea results={data.areas} />
                  <SetupChecklist results={data.areas} />
                  {data.pulse && (hasCurrency || hasRates) ? (
                    <CurrencyPanel pulse={data.pulse} loadedAt={data.loadedAt} hasRates={hasRates} />
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
