"use client"

import { useState } from "react"
import { toast } from "sonner"

import { FactoryFormDialog } from "./component/factory-form-dialog"
import { createFactory, uploadFactoryImageFile } from "./factory.service"
import { EMPTY_FORM_VALUES, type FactoryFormValues } from "./factory.types"

type FactoryQuickEntryDialogProps = {
  open: boolean
  organizationId: string
  /** The first factory right after creating an organization: it can't be skipped (no Cancel, no close). */
  required?: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

/** Adds a factory to the selected organization outside Factory Setup (onboarding, the factory menu). */
export function FactoryQuickEntryDialog({ open, organizationId, required, onOpenChange, onCreated }: FactoryQuickEntryDialogProps) {
  const [values, setValues] = useState<FactoryFormValues>(EMPTY_FORM_VALUES)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const [imageUploading, setImageUploading] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  function close(nextOpen: boolean) {
    if (nextOpen || submitting) return
    setValues(EMPTY_FORM_VALUES)
    setError("")
    setImagePreviewUrl("")
    onOpenChange(false)
  }

  async function submit(next: FactoryFormValues) {
    if (!next.name.trim() || !next.displayName.trim()) {
      setError("Factory name and display name are required.")
      return
    }
    const accessToken = window.localStorage.getItem("access_token")
    if (!accessToken) return

    setSubmitting(true)
    setError("")
    try {
      await createFactory({ apiUrl, accessToken, payload: next, organizationId })
      toast.success("Factory created.")
      setValues(EMPTY_FORM_VALUES)
      setImagePreviewUrl("")
      onCreated()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to create the factory right now."
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function uploadImage(file: File | null | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    const accessToken = window.localStorage.getItem("access_token")
    if (!accessToken) return

    setImageUploading(true)
    try {
      const record = await uploadFactoryImageFile({ apiUrl, accessToken, file })
      setValues((current) => ({ ...current, imageId: String(record.file_id) }))
      setImagePreviewUrl(record.public_url?.trim() || record.file_url?.trim() || record.thumbnail_url?.trim() || "")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to upload the factory image right now.")
    } finally {
      setImageUploading(false)
    }
  }

  return (
    <FactoryFormDialog
      open={open}
      loading={false}
      submitting={submitting}
      error={error}
      mode="create"
      values={values}
      onValuesChange={setValues}
      imagePreviewUrl={imagePreviewUrl}
      imageUploading={imageUploading}
      onOpenChange={close}
      onImageUpload={uploadImage}
      onSubmit={submit}
      title={required ? "Add your first factory" : "Add factory"}
      description={
        required
          ? "An organization needs a factory before its modules and menus can be used. It is selected in the top bar once saved."
          : "Add a factory to the selected organization. Once saved it is yours to work in."
      }
      dismissible={!required}
    />
  )
}
