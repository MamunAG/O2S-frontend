"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, Loader2, Mail } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import type { OneTimePasswordResult, UserSetupRecord } from "../user-setup.types"

type OneTimePasswordDialogProps = {
  /** Asking to issue a new one (confirm step), or showing the one just made (result step). */
  target: UserSetupRecord | null
  result: OneTimePasswordResult | null
  working: boolean
  onIssue: (sendEmail: boolean) => void
  onClose: () => void
}

function formatDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(parsed)
}

/** Confirms a new one-time password, then shows it once (with Copy). */
export function OneTimePasswordDialog({ target, result, working, onIssue, onClose }: OneTimePasswordDialogProps) {
  const [sendEmail, setSendEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const open = Boolean(target || result)
  const user = result?.user ?? target

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.oneTimePassword)
      setCopied(true)
      toast.success("One-time password copied.")
    } catch {
      toast.error("Copy is blocked in this browser: select the password and copy it.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next && !working ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{result ? "One-time password" : "New one-time password"}</DialogTitle>
          <DialogDescription>
            {result ? (
              <>
                For <span className="font-medium text-slate-900 dark:text-slate-100">{user?.userName}</span>. It is shown only now:
                pass it on, the user must choose their own password when they sign in.
              </>
            ) : (
              <>
                <span className="font-medium text-slate-900 dark:text-slate-100">{user?.userName}</span>&apos;s current password stops
                working and every session ends. Their next sign-in must set a new password.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/5">
              <KeyRound className="size-4 shrink-0 text-slate-500" />
              <code className="min-w-0 flex-1 select-all break-all font-mono text-lg font-semibold tracking-wider text-slate-950 dark:text-white">
                {result.oneTimePassword}
              </code>
              <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-xl text-xs" onClick={() => void copy()}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              User name: <span className="font-medium">{result.user.userName}</span> · Works until {formatDate(result.expiresAt)}
            </p>
            {result.emailed ? (
              <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <Mail className="size-3.5" />
                Also emailed to {result.user.email}.
              </p>
            ) : null}
            <p lang="bn" className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              পাসওয়ার্ডটি শুধু এখনই দেখা যাবে। ব্যবহারকারীকে দিন — প্রথম লগইনে তাকে নিজের নতুন পাসওয়ার্ড দিতে হবে।
            </p>
          </div>
        ) : (
          <label htmlFor="otpSendEmail" className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs dark:border-white/10">
            <Checkbox id="otpSendEmail" checked={sendEmail} disabled={!user?.email} onCheckedChange={(checked) => setSendEmail(checked === true)} />
            <span>
              <span className="block font-medium text-slate-800 dark:text-slate-100">Email it to the user</span>
              <span className="block text-slate-500 dark:text-slate-400">{user?.email || "This user has no email address."}</span>
            </span>
          </label>
        )}

        <DialogFooter>
          {result ? (
            <Button type="button" className="rounded-xl" onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="rounded-xl" disabled={working} onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" className="rounded-xl" disabled={working} onClick={() => onIssue(sendEmail)}>
                {working ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                Issue one-time password
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
