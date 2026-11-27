"use client"

import { Factory } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import type { MenuFactoryChoice } from "./menu-permission.types"

type MenuFactoryPickerProps = {
  menuName: string
  choices: MenuFactoryChoice[]
  /** [] = every factory the user has. */
  value: string[]
  disabled?: boolean
  onChange: (factoryIds: string[]) => void
}

function summary(choices: MenuFactoryChoice[], value: string[]) {
  if (value.length === 0) return "All factories"
  const names = choices.filter((choice) => value.includes(choice.id)).map((choice) => choice.displayName || choice.name)
  return names.length <= 2 ? names.join(", ") : `${names.length} factories`
}

/** Which of the user's factories a factory-based menu works in; the menu is hidden in the other factories. */
export function MenuFactoryPicker({ menuName, choices, value, disabled, onChange }: MenuFactoryPickerProps) {
  const selected = new Set(value)

  function toggle(factoryId: string, checked: boolean) {
    const next = checked ? [...value, factoryId] : value.filter((id) => id !== factoryId)
    // Every factory ticked is the same as no limit.
    onChange(next.length === choices.length ? [] : next)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-auto min-h-9 justify-start gap-2 rounded-xl border-sky-200 bg-sky-50 px-3 py-2 text-left text-sm font-semibold text-sky-900 hover:bg-sky-100 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100"
        >
          <Factory className="size-3.5 shrink-0" />
          <span className="truncate">{summary(choices, value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-slate-100 px-3 py-2 dark:border-white/10">
          <p className="text-xs font-semibold text-slate-950 dark:text-white">Factories for {menuName}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            The menu shows and works only in the factories ticked here. None ticked = all of the user&apos;s factories.
          </p>
        </div>
        {choices.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">
            This user has no factories. Give them factories on User Factory Permission first.
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto py-1">
            {choices.map((choice) => {
              const id = `menu-factory-${menuName}-${choice.id}`
              return (
                <li key={choice.id}>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-white/5">
                    <Checkbox id={id} checked={selected.has(choice.id)} onCheckedChange={(checked) => toggle(choice.id, checked === true)} />
                    <span className="min-w-0 flex-1 truncate font-medium">{choice.displayName || choice.name}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <div className="border-t border-slate-100 p-2 dark:border-white/10">
          <Button type="button" variant="ghost" size="sm" className="h-7 w-full rounded-lg text-xs" disabled={value.length === 0} onClick={() => onChange([])}>
            All factories
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
