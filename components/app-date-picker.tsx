"use client"

import { forwardRef, useState } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/** "2026-11-27" (or "2026-11-27T…") -> a local Date at midnight; anything else -> undefined. */
export function parseDateValue(value?: string | null) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value ?? "").trim())
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getMonth() === Number(match[2]) - 1 ? date : undefined
}

/** A local Date -> "2026-11-27". */
export function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export type AppDatePickerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  /** "yyyy-MM-dd", or "" / null for no date (a "yyyy-MM-ddT…" value is read by its date). */
  value: string | null | undefined
  /** Called with "yyyy-MM-dd", or "" when cleared. */
  onValueChange: (value: string) => void
  placeholder?: string
  /** Earliest / latest selectable day, "yyyy-MM-dd". */
  min?: string | null
  max?: string | null
  /** Shows the date but does not open. */
  readOnly?: boolean
  /** The date cannot be cleared (clicking the selected day keeps it). */
  required?: boolean
  /** Classes for the field, sized like the Input it replaces (e.g. "h-9 rounded-xl"). */
  className?: string
}

/**
 * The shared date field, shadcn's Date Picker (ui.shadcn.com/docs/components/date-picker): an outline Button with a
 * calendar icon and the date (or the placeholder), opening the Calendar in a Popover. Values are "yyyy-MM-dd" strings,
 * as the <Input type="date"> it replaces had. An optional date is cleared by clicking the selected day again (the
 * Calendar's own behaviour) or with Backspace / Delete on the field. Ref, focus, onKeyDown and data-* go to the Button,
 * so grid keyboard navigation keeps working (a page may take Enter; Space or Alt+ArrowDown opens the calendar).
 */
export const AppDatePicker = forwardRef<HTMLButtonElement, AppDatePickerProps>(function AppDatePicker(
  { value, onValueChange, placeholder = "Pick a date", min, max, readOnly = false, required = false, disabled, className, onKeyDown, ...buttonProps },
  ref,
) {
  const [open, setOpen] = useState(false)
  const date = parseDateValue(value)
  const minDate = parseDateValue(min)
  const maxDate = parseDateValue(max)
  const canOpen = !disabled && !readOnly
  const calendarProps = {
    defaultMonth: date ?? maxDate ?? minDate,
    captionLayout: "dropdown" as const,
    startMonth: new Date(1900, 0),
    endMonth: new Date(new Date().getFullYear() + 20, 11),
    disabled: [...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])],
  }

  return (
    <Popover open={open && canOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          {...buttonProps}
          ref={ref}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-readonly={readOnly || undefined}
          data-empty={!date}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            if (event.defaultPrevented || !canOpen) return
            if (event.altKey && event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
            } else if ((event.key === "Backspace" || event.key === "Delete") && date && !required) {
              event.preventDefault()
              onValueChange("")
            }
          }}
          className={cn(
            "w-full min-w-0 justify-start gap-2 px-2 text-left font-normal data-[empty=true]:text-muted-foreground",
            readOnly && "cursor-default",
            className,
          )}
        >
          <CalendarIcon className="size-3.5 shrink-0 opacity-60" />
          <span className="min-w-0 truncate">{date ? format(date, "PP") : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {required ? (
          <Calendar
            {...calendarProps}
            mode="single"
            required
            selected={date}
            onSelect={(next) => {
              onValueChange(toDateValue(next))
              setOpen(false)
            }}
          />
        ) : (
          <Calendar
            {...calendarProps}
            mode="single"
            selected={date}
            onSelect={(next) => {
              onValueChange(next ? toDateValue(next) : "")
              setOpen(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
})
