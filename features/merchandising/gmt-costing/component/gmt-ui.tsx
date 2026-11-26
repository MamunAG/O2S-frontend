"use client"

// Small controls shared by the GMT Costing screen (and the budget / booking ports that follow it).

import { useState, type ReactNode } from "react"

import { AppCombobox, type AppComboboxLoadParams, type AppComboboxOption } from "@/components/app-combobox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const FIELD_CLASS = "min-w-0 space-y-1.5"
export const INPUT_CLASS = "h-7 w-full min-w-0 rounded-md px-2 text-xs"
export const CELL_INPUT_CLASS = "h-7 w-full min-w-0 rounded-sm px-1.5 text-xs"
export const COMBO_CONTENT_CLASS =
  "overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.14)] ring-1 ring-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-slate-950/95"
export const SECTION_CARD_CLASS =
  "max-w-full min-w-0 scroll-mt-3 overflow-hidden rounded-lg border-slate-200/70 bg-white/75 shadow-none dark:border-white/10 dark:bg-[#17131d]/80"
export const TH_CLASS = "px-1.5 py-2 text-left font-medium whitespace-nowrap text-foreground"
export const TD_CLASS = "px-1.5 py-1 align-middle"

export function FieldLabel({ children, required = false, htmlFor }: { children: ReactNode; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
      {children} {required ? <span className="text-red-500">*</span> : null}
    </label>
  )
}

const display = (value: number) => (Number.isFinite(value) && value !== 0 ? String(value) : "")

/**
 * A number box that keeps what is typed ("1.", "0.0") while it has focus and hands a number up on every
 * change; a blank box is 0. Outside focus it shows the value it is given (a calculated value follows).
 */
export function NumInput({
  value,
  onValueChange,
  disabled,
  className,
  placeholder = "0",
  readOnly,
  id,
  title,
}: {
  value: number
  onValueChange?: (value: number) => void
  disabled?: boolean
  className?: string
  placeholder?: string
  readOnly?: boolean
  id?: string
  title?: string
}) {
  // what is typed, kept while it still reads as the value (a value written from outside replaces it)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft !== null && Number(draft || 0) === value ? draft : display(value)
  return (
    <Input
      id={id}
      title={title}
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly || !onValueChange}
      className={cn(CELL_INPUT_CLASS, "text-right tabular-nums", readOnly || !onValueChange ? "bg-slate-50 dark:bg-white/5" : "", className)}
      onFocus={(event) => {
        setDraft(display(value))
        event.target.select()
      }}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        const next = event.target.value.replace(/,/g, "")
        if (next !== "" && next !== "-" && !/^-?\d*\.?\d*$/.test(next)) return
        setDraft(next)
        const parsed = Number(next)
        onValueChange?.(Number.isFinite(parsed) ? parsed : 0)
      }}
    />
  )
}

/** A remote combobox holding an id + label pair (a row's picked lookup). */
export function LookupCombobox({
  value,
  label,
  onChange,
  loadItems,
  placeholder,
  disabled,
  className,
  inputClassName = CELL_INPUT_CLASS,
  id,
}: {
  value: number | null | undefined
  label: string
  onChange: (option: AppComboboxOption | null) => void
  loadItems: (params: AppComboboxLoadParams) => Promise<{ items: AppComboboxOption[]; hasNextPage: boolean }>
  placeholder?: string
  disabled?: boolean
  className?: string
  inputClassName?: string
  id?: string
}) {
  const selected = value ? { value: String(value), label: label || String(value) } : null
  return (
    <AppCombobox
      value={selected}
      onValueChange={onChange}
      loadItems={loadItems}
      initialLimit={20}
      searchLimit={20}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      inputClassName={inputClassName}
      contentClassName={COMBO_CONTENT_CLASS}
      inputProps={id ? { id } : undefined}
      showClear={Boolean(value) && !disabled}
    />
  )
}

export const formatNumber = (value: number, digits = 4) =>
  Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "0"

export function formatDate(value?: string | null) {
  if (!value) return "--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10)
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parsed)
}
