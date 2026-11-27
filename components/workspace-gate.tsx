"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { CreateOrganizationFlow } from "@/features/onboarding/create-organization-flow"
import { OnboardingChoiceDialog } from "@/features/onboarding/onboarding-choice-dialog"
import { fetchCurrentUserOrganizations } from "@/features/organization/organization.service"
import { parseStoredAuthUser } from "@/lib/auth-session"
import { readSelectedOrganizationId, writeSelectedOrganizationId } from "@/lib/organization-selection"

/** Pages an account without an organization may still open (the request form among them). */
const OPEN_WITHOUT_ORGANIZATION = ["/organization-access-request", "/profile", "/account", "/notifications"]

/**
 * Keeps a valid organization selected (the one remembered, else the default, else the first) and, for an account
 * with none, shows the onboarding choice: create an organization or request access to one. Mounted once, in the
 * top bar; it draws nothing else (the organization is switched from the factory menu).
 */
export function WorkspaceGate() {
  const router = useRouter()
  const pathname = usePathname()
  const [noOrganization, setNoOrganization] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token")
    const user = parseStoredAuthUser(window.localStorage.getItem("auth_user"))
    if (!apiUrl || !accessToken || !user?.id) return

    let cancelled = false
    fetchCurrentUserOrganizations({ apiUrl, accessToken })
      .then((organizations) => {
        if (cancelled) return
        setNoOrganization(organizations.length === 0)
        if (organizations.length === 0) return

        const stored = readSelectedOrganizationId()
        if (!organizations.some((organization) => organization.id === stored)) {
          const next = organizations.find((organization) => organization.isDefault) ?? organizations[0]
          writeSelectedOrganizationId(next.id)
        }
      })
      .catch(() => {
        // offline or signed out: the pages show their own errors
      })

    return () => {
      cancelled = true
    }
  }, [])

  const blocked = noOrganization && !OPEN_WITHOUT_ORGANIZATION.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  useEffect(() => {
    // Module pages make no sense without an organization: the choice is shown on the home page.
    if (blocked && pathname !== "/") router.replace("/")
  }, [blocked, pathname, router])

  return (
    <>
      <OnboardingChoiceDialog
        open={blocked && !creating}
        onCreateOrganization={() => setCreating(true)}
        onRequestAccess={() => router.push("/organization-access-request")}
      />
      <CreateOrganizationFlow open={creating} onCancel={() => setCreating(false)} />
    </>
  )
}
