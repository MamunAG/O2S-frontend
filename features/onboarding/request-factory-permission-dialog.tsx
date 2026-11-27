"use client"

import { useState } from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { requestFactoryPermission } from "@/features/iam/user-factory-permissions/user-factory-permission.service"
import { readSelectedOrganizationId } from "@/lib/organization-selection"

type RequestFactoryPermissionDialogProps = {
  open: boolean
  organizationName: string
  onOpenChange: (open: boolean) => void
  /** After the admins were told (the blocking factory dialog shows "request sent"). */
  onSent?: () => void
}

/** Sends the organization's admins a notification and an email asking for factory permission. */
export function RequestFactoryPermissionDialog({ open, organizationName, onOpenChange, onSent }: RequestFactoryPermissionDialogProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  function close() {
    if (sending) return
    setMessage("")
    setError("")
    onOpenChange(false)
  }

  async function send() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token")
    if (!apiUrl || !accessToken) return

    setSending(true)
    setError("")
    try {
      const sentTo = await requestFactoryPermission({ apiUrl, accessToken, organizationId: readSelectedOrganizationId(), message })
      toast.success(`Request sent to ${sentTo} ${sentTo === 1 ? "admin" : "admins"}. You'll see the factories once they give you permission.`)
      setMessage("")
      onOpenChange(false)
      onSent?.()
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Unable to send the request right now."
      setError(text)
      toast.error(text)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request factory permission</DialogTitle>
          <DialogDescription>
            The admins of <span className="font-medium text-slate-900 dark:text-slate-100">{organizationName}</span> get a
            notification and an email. Once they give you factories, the modules and menus appear.
          </DialogDescription>
        </DialogHeader>
        <p lang="bn" className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-white/5 dark:text-slate-300">
          অ্যাডমিন আপনার অনুরোধ পেয়ে User Factory Permission থেকে ফ্যাক্টরি দিলে, উপরের ফ্যাক্টরি মেনু থেকে ফ্যাক্টরি বেছে নিয়ে কাজ শুরু করতে পারবেন।
        </p>
        <div className="space-y-1.5">
          <label htmlFor="factory-request-message" className="text-xs font-medium text-slate-700 dark:text-slate-200">
            Message (optional)
          </label>
          <Textarea
            id="factory-request-message"
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="e.g. I work in the Gazipur unit's payroll team."
          />
        </div>
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">{error}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={close}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" disabled={sending} onClick={() => void send()}>
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
