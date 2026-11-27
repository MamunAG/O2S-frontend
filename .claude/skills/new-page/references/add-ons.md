# Add-ons

Optional pieces on top of the base templates. Tokens as in `templates.md`.

---

## A. Lookup field (foreign key → combobox)

Use for a DTO property `<x>Id` that points at another entity (material → unit). Example below: `unitId` → Unit.

### Adapter rule

O2S returns the related row as a navigation object (often plural-named, e.g. `units`). Give the screen a
`{ id, name }` object and strip it again before saving — copy the `material` rule in
`lib/o2s/rules/configuration.ts`:

```ts
...crudRules("__resource__", "<o2sPath>", {
  label: "This __label__",
  fromO2s: (r) => ({ ...r, unit: lookup(r.units) }),
  toO2s: (b) => {
    const { unit: _u, ...rest } = b
    void _u
    return rest
  },
}),
```

Check the real navigation property name in the backend DTO / entity; if the DTO carries a flat
`unitName` instead, map `unit: r.unitId ? { id: r.unitId, name: r.unitName } : null`.

### Types

```ts
export type LookupSummary = { id: string; name: string }

// __Thing__Record
unitId?: string | null
unit?: LookupSummary | null

// __Thing__FormValues + EMPTY_FORM_VALUES
unitId: string            // ""
```

Payload: `unitId: values.unitId || null` (send `null`, not `undefined`, so clearing the field sticks).

### Workspace — option loader and the selected option on edit

Reuse the related entity's existing list service; never write a second one.

```tsx
import type { AppComboboxLoadParams, AppComboboxLoadResult, AppComboboxOption } from "@/components/app-combobox"
import { fetchUnits } from "@/features/app-config/units/unit.service"

const [editorUnit, setEditorUnit] = useState<AppComboboxOption | null>(null)

const loadUnitOptions = useCallback(
  async ({ query, page: lookupPage, limit: lookupLimit }: AppComboboxLoadParams): Promise<AppComboboxLoadResult<AppComboboxOption>> => {
    const token = readToken()
    if (!token) return { items: [], hasNextPage: false }

    const response = await fetchUnits({
      apiUrl,
      accessToken: token,
      page: lookupPage,
      limit: lookupLimit,
      filters: { name: query, isActive: "true" },
      organizationId,
    })

    return {
      items: response.items.map((unit) => ({ value: String(unit.id), label: unit.name })),
      hasNextPage: response.meta.hasNextPage,
    }
  },
  [apiUrl, organizationId, readToken],
)

// openCreateDialog and when the dialog closes:  setEditorUnit(null)
// openEditDialog, after fetching rec:
setEditorUnit(rec.unit ? { value: String(rec.unit.id), label: rec.unit.name } : null)
```

Pass `unit={editorUnit}`, `onUnitChange={setEditorUnit}` and `loadUnitOptions={loadUnitOptions}` to the dialog.
The selected option lives in the workspace next to `editorValues`, like the values themselves — no effect
to sync it (Materials syncs it in a `useEffect`; don't copy that).

### Form dialog

```tsx
import { useState } from "react"
import { AppCombobox, type AppComboboxLoadParams, type AppComboboxLoadResult, type AppComboboxOption } from "@/components/app-combobox"

// props
unit: AppComboboxOption | null
onUnitChange: (option: AppComboboxOption | null) => void
loadUnitOptions: (params: AppComboboxLoadParams) => Promise<AppComboboxLoadResult<AppComboboxOption>>

// state (only whether the list is open)
const [unitOpen, setUnitOpen] = useState(false)

// field
<div className="space-y-2">
  <FieldLabel>Unit</FieldLabel>
  <AppCombobox
    open={unitOpen}
    onOpenChange={setUnitOpen}
    value={unit}
    onValueChange={(option) => {
      onUnitChange(option)
      update("unitId", option?.value ?? "")
      setUnitOpen(false)
    }}
    loadItems={loadUnitOptions}
    initialLimit={10}
    searchLimit={10}
    placeholder="Search unit"
    emptyMessage="No units found."
    showClear={Boolean(draft.unitId)}
    disabled={disabled}
    inputClassName="w-full min-w-0"
    contentClassName="rounded-lg"
  />
</div>
```

Table cell: `row.original.unit?.name ?? "-"`. A lookup filter, if `<Thing>Params` has `unitId`, is an
`AppDataFilterForm` field of kind `"custom"` whose `control` is the same `AppCombobox` (with `filterUnit`
state in the section). It applies **at once on selection** — no debounce (rule R1a):

```tsx
onValueChange={(option) => {
  setFilterUnit(option)
  onFilterChange({ ...filters, unitId: option?.value ?? "" })
}}
```

Reset must clear `filterUnit` as well as the filters.

---

## B. Image upload (`imageId`)

The Factory page is the live reference (`factory-workspace.tsx` `uploadFactoryImage`,
`factory-form-dialog.tsx` "Factory image" block, `factory.service.ts` `uploadFactoryImageFile`).

- **Rule:** `crudRules(..., { label, fromO2s: imageFields })` — `imageFields` is already defined in
  `configuration.ts`; copy it into other rule files if needed. Combine with a lookup mapping as
  `fromO2s: (r) => imageFields({ ...r, unit: lookup(r.units) })` and strip `image` in `toO2s`.
- **Types:** `imageId?: string | null` and `image?: FileSummary | null` on the record (copy `FileSummary`
  from `factory.types.ts`); `imageId: string` (default `""`) on the form values.
- **Payload:** `imageId: values.imageId || null`.
- **Service:** `upload__Thing__ImageFile({ apiUrl, accessToken, file })` posts `FormData` with field `file` to
  `/api/v1/files/upload` (the account rule sends it to O2S `/support/file`) and returns `{ file_id, public_url, … }`.
- **Workspace:** `imagePreviewUrl` + `imageUploading` state; the upload callback checks
  `file.type.startsWith("image/")`, uploads, then
  `setEditorValues((current) => ({ ...current, imageId: String(record.file_id) }))` and sets the preview
  URL. Reset both in `openCreateDialog` and when the dialog closes. On edit, preview from
  `rec.image?.public_url || rec.image?.file_url || rec.image?.thumbnail_url || ""`.
- **Dialog:** a hidden `<input type="file" accept="image/*">` behind an "Upload image" button, a 32-high
  preview box, props `imagePreviewUrl`, `imageUploading`, `onImageUpload`.

> **Known gap:** `imageFields` gives the record only `image: { id }`, so an *existing* image has no URL — the
> table thumbnail and the edit preview fall back to the initial letter / "No image uploaded". The preview
> right after an upload uses the O2S `/support/file/{id}/view` URL. Mention this to the user rather than
> silently building on it.

---

## C. Excel template download / bulk upload (on demand)

**Off by default.** Add it only when the user asks for it on a page. Under plain `crudRules`,
`/<resource>/upload` and `/<resource>/template/upload` always answer with an error, so the feature also
needs the backend routes (R4).

**1. Backend first.** The slice needs a template-download route and an upload route. If they don't exist,
add them in `O2S-backend` (its `production-feature` skill) before writing the frontend.

**2. Adapter rule.** Add `extra` rules to the resource's `crudRules(...)` options that send the two paths
to the O2S routes. Copy the shape of the `job/po-details/template/upload` and `job/po-details/upload`
rules in `lib/o2s/rules/merchandising.ts`, and set `file: true` on the template download.

**3. Service** (`__file__.service.ts`):

```ts
export async function download__Thing__Template({
  apiUrl,
  accessToken,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  organizationId?: string
}) {
  const response = await fetch(new URL("/api/v1/__resource__/template/upload", apiUrl), {
    method: "GET",
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })

  if (!response.ok) throw new Error("Unable to download the __label__ template.")
  return response.blob()
}

export async function upload__Thing__Template({
  apiUrl,
  accessToken,
  file,
  organizationId,
}: {
  apiUrl: string
  accessToken: string
  file: File
  organizationId?: string
}) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch(new URL("/api/v1/__resource__/upload", apiUrl), {
    method: "POST",
    headers: buildRequestHeaders({ accessToken, organizationId }),
    body: formData,
  })

  return readJsonResponse(response)
}
```

**4. Workspace** (`__file__-workspace.tsx`): one ref, two flags, two callbacks and a hidden input.

```tsx
const uploadInputRef = useRef<HTMLInputElement | null>(null)
const [downloadingTemplate, setDownloadingTemplate] = useState(false)
const [uploadingTemplate, setUploadingTemplate] = useState(false)

const downloadTemplate = useCallback(async () => {
  setDownloadingTemplate(true)
  try {
    const token = readToken()
    if (!token) return

    const blob = await download__Thing__Template({ apiUrl, accessToken: token, organizationId })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "__file__-upload-template.csv"
    anchor.click()
    window.URL.revokeObjectURL(url)
  } catch (caught) {
    const message = errorMessage(caught, "Unable to download the __label__ template right now.")
    if (!handleAuthFailure(message)) toast.error(message)
  } finally {
    setDownloadingTemplate(false)
  }
}, [apiUrl, handleAuthFailure, organizationId, readToken])

const uploadTemplate = useCallback(async (file?: File) => {
  if (!file) return
  setUploadingTemplate(true)
  try {
    const token = readToken()
    if (!token) return

    await upload__Thing__Template({ apiUrl, accessToken: token, file, organizationId })
    toast.success("__Labels__ uploaded successfully.")
    triggerRefresh()
  } catch (caught) {
    const message = errorMessage(caught, "Unable to upload the __label__ file right now.")
    if (!handleAuthFailure(message)) toast.error(message)
  } finally {
    setUploadingTemplate(false)
    if (uploadInputRef.current) uploadInputRef.current.value = ""
  }
}, [apiUrl, handleAuthFailure, organizationId, readToken, triggerRefresh])
```

Pass the flags and callbacks to the active section, and render the input next to it:

```tsx
<Active__Thing__Section
  /* …the usual props… */
  onDownloadTemplate={downloadTemplate}
  onUploadTemplate={() => uploadInputRef.current?.click()}
  downloadingTemplate={downloadingTemplate}
  uploadingTemplate={uploadingTemplate}
/>

<input
  ref={uploadInputRef}
  type="file"
  accept=".csv,text/csv,application/vnd.ms-excel"
  className="hidden"
  onChange={(event) => void uploadTemplate(event.target.files?.[0])}
/>
```

**5. Active section.** Add the four props (`onDownloadTemplate`, `onUploadTemplate`, `downloadingTemplate`,
`uploadingTemplate`), import `Download`, `Upload` and the dropdown pieces, and put the menu in
`AppDataSection`'s `headerActions`:

```tsx
headerActions={
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" className="rounded-full" disabled={downloadingTemplate || uploadingTemplate}>
        <MoreHorizontal className="size-2.5" />
        <span className="sr-only">Bulk actions</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuItem onSelect={onDownloadTemplate} disabled={downloadingTemplate}>
        <Download className="mr-2 size-3.5" />
        {downloadingTemplate ? "Downloading template..." : "Download template"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onUploadTemplate} disabled={uploadingTemplate}>
        <Upload className="mr-2 size-3.5" />
        {uploadingTemplate ? "Uploading __labels__..." : "Upload __labels__"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}
```

Every piece above must be used: a flag the section never reads breaks R10.
