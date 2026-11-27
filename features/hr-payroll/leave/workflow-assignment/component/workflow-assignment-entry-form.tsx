"use client"

import { Loader2 } from "lucide-react"

import { AppSelect } from "@/components/app-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { Label } from "@/components/ui/label"

import type { MasterDataFormValues } from "../../../master-data/master-data.types"
import type { HrOption } from "../../../shared/hr.types"
import { AppDatePicker } from "@/components/app-date-picker"

const priorities: Record<string, number> = {
  ORGANIZATION: 6,
  FACTORY: 5,
  DEPARTMENT: 4,
  SECTION: 3,
  DESIGNATION: 2,
  EMPLOYEE: 1,
}

type Props = {
  open: boolean
  mode: "create" | "edit"
  values: MasterDataFormValues
  workflows: HrOption[]
  submitting: boolean
  error: string
  onOpenChange: (value: boolean) => void
  onChange: (value: MasterDataFormValues) => void
  onSubmit: () => void
}

export function WorkflowAssignmentEntryForm({
  open,
  mode,
  values,
  workflows,
  submitting,
  error,
  onOpenChange,
  onChange,
  onSubmit,
}: Props) {
  const updateSetting = (key: string, value: unknown) =>
    onChange({ ...values, settings: { ...values.settings, [key]: value } })
  const target = String(values.settings.targetType ?? "ORGANIZATION")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create workflow assignment" : "Edit workflow assignment"}
          </DialogTitle>
          <DialogDescription>
            Employee assignments take precedence over designation, section, department, factory,
            and organization assignments.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Code *</Label>
            <Input
              value={values.code}
              disabled={mode === "edit"}
              onChange={(event) =>
                onChange({ ...values, code: event.target.value.toUpperCase() })
              }
            />
          </div>
          <div>
            <Label>Name *</Label>
            <Input
              value={values.name}
              onChange={(event) => onChange({ ...values, name: event.target.value })}
            />
          </div>
          <div>
            <Label>Target type *</Label>
            <AppSelect
              value={target}
              onValueChange={(value) =>
                onChange({
                  ...values,
                  settings: {
                    ...values.settings,
                    targetType: value,
                    targetId: value === "ORGANIZATION" ? "" : values.settings.targetId,
                    priority: priorities[value],
                  },
                })
              }
              options={Object.keys(priorities).map((value) => ({ value, label: value }))}
              triggerClassName="mt-1 h-9"
            />
          </div>
          <div>
            <Label>Target ID {target !== "ORGANIZATION" ? "*" : ""}</Label>
            <Input
              disabled={target === "ORGANIZATION"}
              value={String(values.settings.targetId ?? "")}
              onChange={(event) => updateSetting("targetId", event.target.value)}
              placeholder={target === "ORGANIZATION" ? "Organization-wide" : `${target} UUID`}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Approval workflow *</Label>
            <AppSelect
              value={String(values.settings.workflowId ?? "")}
              onValueChange={(value) => updateSetting("workflowId", value)}
              options={workflows}
              placeholder="Select workflow"
              triggerClassName="mt-1 h-9"
            />
          </div>
          <div>
            <Label>Effective from</Label>
            <AppDatePicker
              value={String(values.settings.effectiveFrom ?? "")}
              onValueChange={(value) => updateSetting("effectiveFrom", value)}
            />
          </div>
          <div>
            <Label>Effective to</Label>
            <AppDatePicker
              min={String(values.settings.effectiveFrom ?? "")}
              value={String(values.settings.effectiveTo ?? "")}
              onValueChange={(value) => updateSetting("effectiveTo", value)}
            />
          </div>
          <div>
            <Label>Resolution priority</Label>
            <Input
              type="number"
              value={String(values.settings.priority ?? priorities[target])}
              readOnly
            />
          </div>
          {error ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={submitting} onClick={onSubmit}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
