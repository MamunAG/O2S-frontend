"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Loader2, ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { parseStoredAuthUser } from "@/lib/auth-session"
import { canOpenIam } from "@/lib/iam-access"
import { readSelectedOrganizationId, SELECTED_ORGANIZATION_CHANGED_EVENT } from "@/lib/organization-selection"

/** Shows the IAM pages only to the selected organization's admins (and global admins). */
export function IamAccessGuard({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : readSelectedOrganizationId(),
  )
  // Which organization the last check was for, so "checking" is derived rather than set in the effect.
  const [checked, setChecked] = useState<{ organizationId: string; allowed: boolean } | null>(null)

  useEffect(() => {
    function handleOrganizationChange(event: Event) {
      const next = event instanceof CustomEvent ? event.detail?.organizationId : readSelectedOrganizationId()
      setOrganizationId(next || "")
    }

    window.addEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
    return () => window.removeEventListener(SELECTED_ORGANIZATION_CHANGED_EVENT, handleOrganizationChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token") ?? ""
    const user = parseStoredAuthUser(window.localStorage.getItem("auth_user"))
    const check = apiUrl && accessToken ? canOpenIam({ apiUrl, accessToken, user, organizationId }) : Promise.resolve(false)

    check
      .catch(() => false)
      .then((allowed) => {
        if (!cancelled) setChecked({ organizationId, allowed })
      })

    return () => {
      cancelled = true
    }
  }, [organizationId])

  if (checked?.organizationId !== organizationId) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        Checking access
      </div>
    )
  }

  if (!checked.allowed) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="flex max-w-md flex-col items-center rounded-3xl border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center backdrop-blur dark:border-white/10 dark:bg-slate-950/60">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <ShieldAlert className="size-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-950 dark:text-white">IAM is for organization admins</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Only an admin of the selected organization can manage users, permissions and access here. Ask one of its
            admins if you need a change.
          </p>
          <Button asChild className="mt-6 rounded-xl">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
