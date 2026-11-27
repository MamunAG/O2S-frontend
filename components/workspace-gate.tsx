"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import { FactoryQuickEntryDialog } from "@/features/app-config/factory/factory-quick-entry-dialog"
import { fetchCurrentMenuPermission } from "@/features/iam/menu-permissions/menu-permission.service"
import { CreateOrganizationFlow } from "@/features/onboarding/create-organization-flow"
import { FactoryRequiredDialog } from "@/features/onboarding/factory-required-dialog"
import { OnboardingChoiceDialog } from "@/features/onboarding/onboarding-choice-dialog"
import { RequestFactoryPermissionDialog } from "@/features/onboarding/request-factory-permission-dialog"
import { SwitchOrganizationDialog } from "@/features/onboarding/switch-organization-dialog"
import { fetchCurrentUserOrganizations } from "@/features/organization/organization.service"
import { parseStoredAuthUser } from "@/lib/auth-session"
import { loadMyFactories } from "@/lib/my-factories"
import { readSelectedOrganizationId, writeSelectedOrganizationId } from "@/lib/organization-selection"

/** Pages an account may still open without an organization or a factory (the request form among them). */
const OPEN_PAGES = ["/organization-access-request", "/profile", "/account", "/notifications"]

/** The selected organization, when the user has no factory in it. */
type NoFactory = { organizationId: string; organizationName: string; isAdmin: boolean; canCreate: boolean }

type FactoryDialog = "create" | "request" | "switch" | null

/**
 * Keeps a valid organization selected (the one remembered, else the default, else the first) and holds the user
 * at two steps until they are done: an account with no organization chooses to create one or to request access,
 * and a user with no factory in the selected organization creates one or requests factory permission. Mounted once,
 * in the top bar; it draws nothing else (the organization is switched from the factory menu).
 */
export function WorkspaceGate() {
  const router = useRouter()
  const pathname = usePathname()
  const [noOrganization, setNoOrganization] = useState(false)
  const [creatingOrganization, setCreatingOrganization] = useState(false)
  const [noFactory, setNoFactory] = useState<NoFactory | null>(null)
  const [factoryDialog, setFactoryDialog] = useState<FactoryDialog>(null)
  const [requestSent, setRequestSent] = useState(false)

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ""
    const accessToken = window.localStorage.getItem("access_token") ?? ""
    const user = parseStoredAuthUser(window.localStorage.getItem("auth_user"))
    if (!apiUrl || !accessToken || !user?.id) return

    let cancelled = false

    async function check() {
      const organizations = await fetchCurrentUserOrganizations({ apiUrl, accessToken })
      if (cancelled) return
      setNoOrganization(organizations.length === 0)
      if (organizations.length === 0) return

      let organization = organizations.find((item) => item.id === readSelectedOrganizationId())
      if (!organization) {
        organization = organizations.find((item) => item.isDefault) ?? organizations[0]
        writeSelectedOrganizationId(organization.id)
      }

      // null = could not be read (offline, ...): nothing is blocked on a guess.
      const mine = await loadMyFactories(organization.id)
      if (cancelled || !mine || mine.factories.length > 0) return

      const canCreate =
        mine.isUnrestricted ||
        (await fetchCurrentMenuPermission({ apiUrl, accessToken, organizationId: organization.id, menuName: "Factory" })
          .then((permission) => permission.canCreate)
          .catch(() => false))
      if (cancelled) return
      setNoFactory({ organizationId: organization.id, organizationName: organization.name, isAdmin: mine.isUnrestricted, canCreate })
    }

    check().catch(() => {
      // offline or signed out: the pages show their own errors
    })

    return () => {
      cancelled = true
    }
  }, [])

  const onOpenPage = OPEN_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const blockedByOrganization = noOrganization && !onOpenPage
  const blockedByFactory = Boolean(noFactory) && !noOrganization && !onOpenPage

  useEffect(() => {
    // Module pages make no sense without an organization: the choice is shown on the home page.
    if (blockedByOrganization && pathname !== "/") router.replace("/")
  }, [blockedByOrganization, pathname, router])

  return (
    <>
      <OnboardingChoiceDialog
        open={blockedByOrganization && !creatingOrganization}
        onCreateOrganization={() => setCreatingOrganization(true)}
        onRequestAccess={() => router.push("/organization-access-request")}
      />
      <CreateOrganizationFlow open={creatingOrganization} onCancel={() => setCreatingOrganization(false)} />

      {noFactory ? (
        <>
          <FactoryRequiredDialog
            open={blockedByFactory && factoryDialog === null}
            organizationName={noFactory.organizationName}
            isAdmin={noFactory.isAdmin}
            canCreate={noFactory.canCreate}
            requestSent={requestSent}
            onCreateFactory={() => setFactoryDialog("create")}
            onRequestPermission={() => setFactoryDialog("request")}
            onSwitchOrganization={() => setFactoryDialog("switch")}
          />
          {factoryDialog === "create" ? (
            <FactoryQuickEntryDialog
              open
              organizationId={noFactory.organizationId}
              onOpenChange={(open) => setFactoryDialog(open ? "create" : null)}
              onCreated={() => window.location.reload()}
            />
          ) : null}
          <RequestFactoryPermissionDialog
            open={factoryDialog === "request"}
            organizationName={noFactory.organizationName}
            onOpenChange={(open) => setFactoryDialog(open ? "request" : null)}
            onSent={() => setRequestSent(true)}
          />
          <SwitchOrganizationDialog open={factoryDialog === "switch"} onOpenChange={(open) => setFactoryDialog(open ? "switch" : null)} />
        </>
      ) : null}
    </>
  )
}
