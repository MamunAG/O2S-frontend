"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import type { UserRole, UserSetupFormValues } from "../user-setup.types"

type UserSetupFormDialogProps = {
  open: boolean
  mode: "create" | "edit"
  values: UserSetupFormValues
  submitting: boolean
  error: string
  onValuesChange: (values: UserSetupFormValues) => void
  onOpenChange: (open: boolean) => void
  onSubmit: () => void
}

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-slate-700 dark:text-slate-200">
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  )
}

/** A new login (user name, details, role, one-time password) or a member's details (edit). */
export function UserSetupFormDialog({ open, mode, values, submitting, error, onValuesChange, onOpenChange, onSubmit }: UserSetupFormDialogProps) {
  const isCreate = mode === "create"
  function update<K extends keyof UserSetupFormValues>(key: K, value: UserSetupFormValues[K]) {
    onValuesChange({ ...values, [key]: value })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!submitting ? onOpenChange(next) : undefined)}>
      <DialogContent className="max-h-[95dvh] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{isCreate ? "New user" : "Edit user"}</DialogTitle>
            <DialogDescription>
              {isCreate
                ? "The user signs in with a one-time password and must then choose their own."
                : "Name, email and phone of this login."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <FieldLabel htmlFor="userSetupUserName" required>User name</FieldLabel>
              <Input
                id="userSetupUserName"
                value={values.userName}
                disabled={!isCreate}
                required
                autoComplete="off"
                onChange={(event) => update("userName", event.target.value)}
                placeholder="e.g. rahim.uddin"
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="userSetupFirstName">First name</FieldLabel>
              <Input id="userSetupFirstName" value={values.firstName} onChange={(event) => update("firstName", event.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="userSetupLastName">Last name</FieldLabel>
              <Input id="userSetupLastName" value={values.lastName} onChange={(event) => update("lastName", event.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="userSetupEmail">Email</FieldLabel>
              <Input id="userSetupEmail" type="email" value={values.email} onChange={(event) => update("email", event.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor="userSetupPhone">Phone</FieldLabel>
              <Input id="userSetupPhone" value={values.phoneNumber} onChange={(event) => update("phoneNumber", event.target.value)} className="h-9 rounded-xl" />
            </div>

            {isCreate ? (
              <>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="userSetupRole" required>Role in this organization</FieldLabel>
                  <Select value={values.role} onValueChange={(value) => update("role", value as UserRole)}>
                    <SelectTrigger id="userSetupRole" className="h-9 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel htmlFor="userSetupOtp">One-time password</FieldLabel>
                  <Input
                    id="userSetupOtp"
                    value={values.oneTimePassword}
                    autoComplete="off"
                    onChange={(event) => update("oneTimePassword", event.target.value)}
                    placeholder="Leave empty to generate one"
                    className="h-9 rounded-xl font-mono"
                  />
                </div>
                <label htmlFor="userSetupSendEmail" className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:col-span-2 dark:border-white/10">
                  <Checkbox
                    id="userSetupSendEmail"
                    checked={values.sendEmail}
                    disabled={!values.email.trim()}
                    onCheckedChange={(checked) => update("sendEmail", checked === true)}
                  />
                  <span>
                    <span className="block font-medium text-slate-800 dark:text-slate-100">Email the one-time password to the user</span>
                    <span className="block text-slate-500 dark:text-slate-400">
                      {values.email.trim() ? "Sent with the user name and the date it expires." : "Enter an email address first."}
                    </span>
                  </span>
                </label>
                <p lang="bn" className="text-xs leading-5 text-slate-500 sm:col-span-2 dark:text-slate-400">
                  এককালীন পাসওয়ার্ডটি ৭ দিন কাজ করবে। প্রথম লগইনের পরই ব্যবহারকারীকে নিজের নতুন পাসওয়ার্ড দিতে হবে।
                </p>
              </>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">{error}</p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={submitting || !values.userName.trim()}>
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {isCreate ? "Create user" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
