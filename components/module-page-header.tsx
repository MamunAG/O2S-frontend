"use client"

import type { ReactNode } from "react"
import AppAddNewButton from "@/components/app-add-new-button"
import AppRefreshButton from "@/components/app-refresh-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export type ModulePageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  badges?: Array<{
    label: ReactNode
    variant?: "default" | "secondary" | "destructive" | "outline"
  }>
  onRefresh?: () => void
  onCreate?: () => void
  createLabel?: string
  actions?: ReactNode
}

export function ModulePageHeader({
  eyebrow,
  title,
  description,
  badges = [],
  onRefresh,
  onCreate,
  createLabel,
  actions,
}: ModulePageHeaderProps) {
  return (
    <Card
      size="sm"
      className="overflow-hidden border-white/60 bg-white/85 py-0 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75"
    >
      <CardContent className="px-3 py-2 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-base leading-6 font-semibold tracking-tight sm:text-lg">
                {title}
              </h1>
              <span className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase dark:text-slate-400">
                {eyebrow}
              </span>
              {badges.map((badge, index) => (
                <Badge
                  key={index}
                  variant={badge.variant ?? "outline"}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
            <p
              className="max-w-3xl truncate text-xs leading-5 text-slate-600 dark:text-slate-300"
              title={description}
            >
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {onRefresh ? (
              <AppRefreshButton
                triggerRefresh={onRefresh}
                title="Refresh"
                size="sm"
              />
            ) : null}
            {actions}
            {onCreate ? (
              <AppAddNewButton
                openCreateDialog={onCreate}
                title={createLabel ?? "New record"}
                size="sm"
              />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
