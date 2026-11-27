"use client"

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { ChevronDown, Plus, Search } from "lucide-react"

import { AppSelect } from "@/components/app-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type FilterFieldBase = {
  id: string
  label: string
  className?: string
}

export type AppDataTextFilterField = FilterFieldBase & {
  kind: "text"
  value: string
  placeholder?: string
  onValueChange: (value: string) => void
}

export type AppDataSelectFilterField = FilterFieldBase & {
  kind: "select"
  value: string
  placeholder?: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}

export type AppDataCustomFilterField = FilterFieldBase & {
  kind: "custom"
  control: ReactNode
}

export type AppDataFilterField =
  | AppDataTextFilterField
  | AppDataSelectFilterField
  | AppDataCustomFilterField

type AppDataFilterFormProps = {
  fields: AppDataFilterField[]
  /**
   * When set, text fields report a change only after typing has paused this long (ms); select and custom
   * fields (comboboxes) still report at once. Use with no `onSubmit`: the filters then apply on their own.
   */
  debounceMs?: number
  /** Shows a Search button. Leave out when the filters apply on their own. */
  onSubmit?: () => void
  onReset: () => void
  onCreate?: () => void
  createLabel?: string
  submitLabel?: string
  resetLabel?: string
  actions?: ReactNode
}

/** The standard pause (ms) before a typed filter applies. */
export const FILTER_DEBOUNCE_MS = 400

/**
 * `block`: an inline <input> sits on the text baseline and leaves descender space under it, so its cell
 * ends a few px below the box and the Reset button (aligned to the cell's bottom) looks lower than the input.
 */
const FILTER_INPUT_CLASS = "block h-7 rounded-md px-2 text-xs"

/** A text filter that keeps what is typed locally and reports it once typing pauses. */
function DebouncedTextInput({
  id,
  value,
  placeholder,
  delayMs,
  onValueChange,
}: {
  id: string
  value: string
  placeholder?: string
  delayMs: number
  onValueChange: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const [reportedValue, setReportedValue] = useState(value)
  const onValueChangeRef = useRef(onValueChange)

  useEffect(() => {
    onValueChangeRef.current = onValueChange
  })

  // The value changed from outside (Reset, or our own report coming back): show it.
  if (value !== reportedValue) {
    setReportedValue(value)
    setDraft(value)
  }

  useEffect(() => {
    if (draft === value) return
    const timer = window.setTimeout(
      () => onValueChangeRef.current(draft),
      delayMs
    )
    return () => window.clearTimeout(timer)
  }, [delayMs, draft, value])

  return (
    <Input
      id={id}
      value={draft}
      className={FILTER_INPUT_CLASS}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
    />
  )
}

export function AppDataFilterForm({
  fields,
  debounceMs,
  onSubmit,
  onReset,
  onCreate,
  createLabel = "New",
  submitLabel = "Search",
  resetLabel = "Reset",
  actions,
}: AppDataFilterFormProps) {
  // Below `sm` the filters start collapsed behind a "Filters" bar with a chevron; from `sm` up they always show.
  const [mobileOpen, setMobileOpen] = useState(false)
  const formId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <>
      <button
        type="button"
        className="flex h-7 w-full items-center justify-between rounded-md text-xs font-medium text-slate-700 sm:hidden dark:text-slate-300"
        aria-expanded={mobileOpen}
        aria-controls={formId}
        onClick={() => setMobileOpen((open) => !open)}
      >
        Filters
        <ChevronDown
          className={`size-4 text-slate-500 transition-transform duration-200 ${mobileOpen ? "rotate-180" : ""}`}
        />
      </button>
      <form
        id={formId}
        onSubmit={handleSubmit}
        className={`${mobileOpen ? "mt-2 grid" : "hidden"} gap-3 sm:mt-0 sm:grid sm:grid-cols-2 xl:grid-cols-4`}
      >
        {fields.map((field) => (
          <div
            key={field.id}
            className={field.className ?? "min-w-0 space-y-1"}
          >
            <label
              htmlFor={field.id}
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              {field.label}
            </label>
            {field.kind === "text" && debounceMs ? (
              <DebouncedTextInput
                id={field.id}
                value={field.value}
                placeholder={field.placeholder}
                delayMs={debounceMs}
                onValueChange={field.onValueChange}
              />
            ) : field.kind === "text" ? (
              <Input
                id={field.id}
                value={field.value}
                className={FILTER_INPUT_CLASS}
                placeholder={field.placeholder}
                onChange={(event) => field.onValueChange(event.target.value)}
              />
            ) : field.kind === "select" ? (
              <AppSelect
                triggerId={field.id}
                value={field.value}
                onValueChange={field.onValueChange}
                placeholder={field.placeholder}
                options={field.options}
              />
            ) : (
              field.control
            )}
          </div>
        ))}

        {/* Auto-applying filters (no Search): Reset sits right after the last filter. */}
        <div
          className={`flex flex-col gap-2 sm:flex-row sm:items-end ${onSubmit ? "sm:justify-end" : "sm:justify-start"}`}
        >
          {onSubmit ? (
            <Button type="submit" className="w-full rounded-xl sm:w-auto">
              <Search className="size-3.5" />
              {submitLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={onReset}
          >
            {resetLabel}
          </Button>
          {onCreate ? (
            <Button
              type="button"
              className="w-full rounded-xl sm:w-auto"
              onClick={onCreate}
            >
              <Plus className="size-3.5" />
              {createLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      </form>
    </>
  )
}
