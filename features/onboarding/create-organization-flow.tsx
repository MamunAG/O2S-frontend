"use client"

import { useRef, useState } from "react"

import { FactoryQuickEntryDialog } from "@/features/app-config/factory/factory-quick-entry-dialog"
import { OrganizationEntryDialog } from "@/features/organization/organization-entry-dialog"
import type { OrganizationRecord } from "@/features/organization/organization.types"
import { writeSelectedFactoryId } from "@/lib/factory-selection"
import { switchOrganization } from "@/lib/organization-selection"

type CreateOrganizationFlowProps = {
  open: boolean
  /** Closed without creating (the organization form's Cancel). */
  onCancel: () => void
}

/**
 * Create an organization, then its first factory (required: nothing works without one). The creator is the
 * organization's admin. The page then reloads into the new organization, so the top bar, menus and screens follow it.
 */
export function CreateOrganizationFlow({ open, onCancel }: CreateOrganizationFlowProps) {
  const [created, setCreated] = useState<OrganizationRecord | null>(null)
  // The form calls onSaved and then onOpenChange(false) in the same tick, before `created` is applied.
  const savedRef = useRef(false)

  function finish(organizationId: string) {
    writeSelectedFactoryId("", organizationId)
    window.location.replace("/")
  }

  return (
    <>
      <OrganizationEntryDialog
        open={open && !created}
        mode="create"
        organization={null}
        onOpenChange={(next) => {
          if (!next && !savedRef.current) onCancel()
        }}
        onSaved={(organization) => {
          savedRef.current = true
          // Work in the new organization (its token) before its first factory is added there.
          switchOrganization(organization.id)
            .catch(() => {
              // The organization exists; the factory step below then reports the problem itself.
            })
            .finally(() => setCreated(organization))
        }}
      />
      {created ? (
        <FactoryQuickEntryDialog
          open
          required
          organizationId={created.id}
          onOpenChange={() => finish(created.id)}
          onCreated={() => finish(created.id)}
        />
      ) : null}
    </>
  )
}
