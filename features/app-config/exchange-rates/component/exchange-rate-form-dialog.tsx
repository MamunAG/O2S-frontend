"use client"

import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import type { ExchangeRateFormValues } from "../exchange-rate.types"

type ExchangeRateFormDialogProps = {
  open: boolean
  submitting: boolean
  error: string
  values: ExchangeRateFormValues
  onValuesChange: (values: ExchangeRateFormValues) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ExchangeRateFormValues) => void
}

function FieldLabel({ htmlFor, children, required = false }: { htmlFor: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  )
}

/** Adds a rate by hand (a date or currency the provider missed). Existing rates are edited inline in the list. */
export function ExchangeRateFormDialog({
  open,
  submitting,
  error,
  values: draft,
  onValuesChange,
  onOpenChange,
  onSubmit,
}: ExchangeRateFormDialogProps) {
  function update<K extends keyof ExchangeRateFormValues>(key: K, value: ExchangeRateFormValues[K]) {
    onValuesChange({ ...draft, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <form
          className="flex max-h-[calc(100vh-2rem)] flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(draft)
          }}
        >
          <div className="border-b border-slate-200/70 px-6 pb-4 pt-6 dark:border-white/10">
            <DialogHeader>
              <DialogTitle>Add exchange rate</DialogTitle>
              <DialogDescription>
                A rate added here is marked Manual: the daily job leaves it as it is, and Rerun latest replaces it only on today&apos;s date.
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            ) : null}
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="exchangeRateCode" required>Currency code</FieldLabel>
                <Input
                  id="exchangeRateCode"
                  value={draft.currencyCode}
                  onChange={(event) => update("currencyCode", event.target.value.toUpperCase())}
                  placeholder="e.g. USD"
                  maxLength={10}
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="exchangeRateDate" required>Date</FieldLabel>
                <Input
                  id="exchangeRateDate"
                  type="date"
                  value={draft.currencyDate}
                  onChange={(event) => update("currencyDate", event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="exchangeRateValue" required>Rate in BDT</FieldLabel>
              <Input
                id="exchangeRateValue"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.0001"
                value={draft.rateInBdt}
                onChange={(event) => update("rateInBdt", event.target.value)}
                placeholder="BDT for 1 unit of the currency, e.g. 122.5"
                disabled={submitting}
              />
            </div>
          </div>

          <div className="border-t border-slate-200/70 px-6 py-4 dark:border-white/10">
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="rounded-xl">
                {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Save rate
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
