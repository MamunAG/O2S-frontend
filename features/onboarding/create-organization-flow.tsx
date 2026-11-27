"use client"

import { useRef, useState } from "react"

import { FactoryQuickEntryDialog } from "@/features/app-config/factory/factory-quick-entry-dialog"
import { OrganizationEntryDialog } from "@/features/organization/organization-entry-dialog"
import type { OrganizationRecord } from "@/features/organization/organization.types"
import { writeSelectedFactoryId } from "@/lib/factory-selection"
import { writeSelectedOrganizationId } from "@/lib/organization-selection"

type CreateOrganizationFlowProps = {
  open: boolean
  /** Closed without creating (the organization form's Cancel). */
  onCancel: () => void
}

/**
 * Create an organization, then (optionally) its first factory. The creator is the organization's admin. Either
 * way the page reloads into the new organization, so the top bar, menus and screens follow it.
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
          writeSelectedOrganizationId(organization.id)
          setCreated(organization)
        }}
      />
      {created ? (
        <FactoryQuickEntryDialog
          open
          firstFactory
          organizationId={created.id}
          onOpenChange={() => finish(created.id)}
          onCreated={() => finish(created.id)}
        />
      ) : null}
    </>
  )
}
