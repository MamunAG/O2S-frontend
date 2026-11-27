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
needs the backend routes (R4). **Every template upload follows the rules below** — the same on every page.

### C.0 The rules (U1–U6)

**U1 — Who can do what.**

| Action | Who | Enforced by |
|---|---|---|
| Download the template | any signed-in user with **Read** on the page's menu | the route's `PermissionFilter(menuName, Read)` |
| Step 1 — verify a file | any signed-in user with **Read** on the page's menu | the route's `PermissionFilter(menuName, Read)` |
| Quick add a missing record from the report | a user with **Create** (new record) / **Update** (e.g. re-activate one) on **that record's own menu** (Color, Size, Unit, …), not the page's | the backend sends `canCreate` / `canUpdate` per kind; the entity's own POST / PUT checks again |
| Step 2 — save the file | **any user with Create on the page's upload menu**: a menu of its own named `<Page title> Upload` (Factory Setup → **"Factory Setup Upload"**), granted on User Menu Permission like any other menu | the save route's `PermissionFilter(uploadMenuName, Create)` |

The frontend hides nothing it can't check, but the **backend is the authority** for every row of this table: a button
the page shows is a convenience, never the check. The page's own Create does **not** allow saving an upload, and the
upload menu's Create allows nothing else: they are granted separately. As with every menu, a company admin (and a user
whose menu checks are off) has it without a grant.

**The upload menu** is a real menu: a `public const string uploadMenuName = "<Page title> Upload";` on the backend
endpoints class, a `SEC_MENU` row in the page's module (seeded by a migration, `MenuSeed`), and a name the frontend
checks with `fetchCurrentMenuPermission({ menuName: "<Page title> Upload" })`. It is not a sidebar item (no
`module-navigation.ts` entry, no `MENU_NAME_TO_O2S` entry). See `production-feature`'s "Template upload" for the backend.

**U2 — Two steps, two routes; the save never trusts step 1.**
- Step 1 `POST .../upload/verify` (multipart `file`) reads and checks every row against the page's rules and the
  company's data and **saves nothing**. Valid → 200 `{ valid: true, rowCount, rows }` (`rows` = a preview the page may
  show). Invalid → **400** whose `Data` is the **upload report** (U3) and whose `ErrorMessage` is one sentence.
- Step 2 `POST .../upload` (multipart `file`, the same file) is refused first without Create on the upload menu (U1),
  then runs step 1's check again on the server, then saves every row in **one** `SaveChangesAsync` (all or nothing).
  - Invalid → 400 + the report (as step 1; the data may have changed since).
  - No Create on the upload menu → **403** (the permission filter's own answer, before the file is read). The page
    offers Save only after a successful verify, so it shows its own message for it:
    **"This file is valid, but saving it needs the Create permission on "<Page title> Upload". Ask an admin to grant it."**
    (403, never 401: the adapter treats a 401 as an expired session and signs the user out.)
  - Saved → 200 `{ inserted, updated, skipped }`.

**U3 — The upload report** (`Data` of the 400), per page but always this shape:

```jsonc
{
  "rowCount": 120,
  "missing": [                       // records the file names that the company does not have (quick-addable)
    {
      "kind": "color",               // stable key
      "label": "Color",              // what the dialog shows
      "menuName": "Color",           // the O2S menuName of the entity's screen
      "canCreate": true,             // the caller's grants on that menu, in this company
      "canUpdate": false,
      "items": [
        { "value": "Navy", "reason": "missing", "rows": [3, 7], "existingId": null, "fields": { } },
        { "value": "Red",  "reason": "inactive", "rows": [9],  "existingId": "0190…", "fields": { } }
      ]
    }
  ],
  "errors": [                        // problems a quick add can't fix: blank required cell, bad number / date, duplicate key
    { "row": 12, "column": "Quantity", "value": "abc", "message": "Quantity must be a number." }
  ]
}
```

`rows` are the file's row numbers (header = row 1). `fields` carries whatever the quick add needs beyond the value
(e.g. a style's name and buyer from the same row). `reason`: `missing` (needs Create) or `inactive` (exists but is
inactive / deleted; needs Update to re-activate or Delete-menu restore).

**U4 — The report dialog** (one component per page, modelled on Job Entry's `JobPoDetailsUploadReportDialog` +
`MissingPoDetailsSetupList` in `features/merchandising/jobs/component/job-form-dialog.tsx`):
- Title "<Label> upload report", a one-line summary ("120 rows checked · 4 missing records · 1 error"), then one block
  per `missing` kind ("Colors — 2 missing") listing each value with its row numbers, then the `errors` table
  (Row / Column / Value / Problem), scrollable inside the dialog.
- Each missing item has a quick-add button — **Add** for `missing` when the kind's `canCreate`, **Activate** for
  `inactive` when `canUpdate` — that calls the **entity's own service** (its `create…` / `update…` / `restore…`, through its
  adapter rule, R11), never a page-local fetch. While saving: spinner; done: "Saved" + check, disabled; failed: the
  adapter's message under the item. Without the grant: no button, and the line reads
  "Ask someone with <menuName> access to add it."
- Footer: **Close** and **Verify again**, which re-runs step 1 with the **same `File`** (kept in state; the user does
  not pick it again). Once step 1 passes, the dialog moves on to step 2 (U5).
- Feedback through the dialog (and `toast.error` for a failure, R12); a quick add calls no `triggerRefresh()` of the
  page — only the final save does.

**U5 — After a successful verify** the same dialog shows "All <rowCount> rows are valid." and:
- for a user with **Create on the upload menu** (U1; `canSaveUpload`, C.4): a **Save <labels>** button → step 2 →
  `toast.success("<n> <labels> saved.")`, close, `triggerRefresh()`;
- for anyone else: no Save button, and an amber access notice with U2's 403 message. If the server still answers 403
  (the role changed meanwhile), show the same notice instead of a toast.

**U6 — Limits and file types** as the backend's `JobPoUpload`: `.csv` and `.xlsx` (first sheet), ≤ 5 MB, ≤ 10 000 rows,
headers matched case- and space-insensitively; `.xls` is refused ("save it as .xlsx"). The template the page downloads
is the one the verify reads — same columns, same order.

### C.1 Backend first

The slice needs three routes: `GET .../upload/template`, `POST .../upload/verify`, `POST .../upload`. If they don't
exist, add them in `O2S-backend` with its `production-feature` skill (section "Template upload") before writing the
frontend.

### C.2 Adapter rule

`extra` rules on the resource's `crudRules(...)` (they run before the "not available" fallback):

```ts
...crudRules("__resource__", "__o2sPath__", {
  label: "This __label__",
  extra: [
    { methods: ["GET"], match: /^\/api\/v1\/__resource__\/template\/upload$/, to: (_m, ctx) => companyPath(ctx, "__o2sPath__/upload/template"), file: true },
    { methods: ["POST"], match: /^\/api\/v1\/__resource__\/upload\/verify$/, to: (_m, ctx) => companyPath(ctx, "__o2sPath__/upload/verify") },
    { methods: ["POST"], match: /^\/api\/v1\/__resource__\/upload$/, to: (_m, ctx) => companyPath(ctx, "__o2sPath__/upload") },
  ],
}),
```

### C.3 Service (`__file__.service.ts`)

```ts
export class __Thing__UploadReportError extends Error {
  constructor(message: string, public report: __Thing__UploadReport) {
    super(message)
  }
}

/** 403 on save: the file is valid but the caller has no Create on the upload menu (U2). */
export class __Thing__UploadForbiddenError extends Error {}

export async function download__Thing__Template({ apiUrl, accessToken, organizationId }: {
  apiUrl: string
  accessToken: string
  organizationId?: string
}) {
  const response = await fetch(new URL("/api/v1/__resource__/template/upload", apiUrl), {
    headers: buildRequestHeaders({ accessToken, organizationId }),
  })
  if (!response.ok) throw new Error(extractErrorMessage(await response.json().catch(() => null), "Unable to download the __label__ template."))
  return response.blob()
}

/** Step 1 (verify) or step 2 (save): the same file, a different route. */
async function send__Thing__Upload(step: "verify" | "save", { apiUrl, accessToken, file, organizationId }: {
  apiUrl: string
  accessToken: string
  file: File
  organizationId?: string
}) {
  const body = new FormData()
  body.append("file", file)
  const path = step === "verify" ? "/api/v1/__resource__/upload/verify" : "/api/v1/__resource__/upload"
  const response = await fetch(new URL(path, apiUrl), { method: "POST", headers: buildRequestHeaders({ accessToken, organizationId }), body })
  const payload: unknown = await response.json().catch(() => null)

  if (response.status === 401) throw new Error("Your session expired. Please sign in again.")
  const message = extractErrorMessage(payload, "The __label__ file could not be uploaded.")
  if (response.status === 403) throw new __Thing__UploadForbiddenError(message)
  if (!response.ok) {
    const report = extract__Thing__UploadReport(payload)
    if (report) throw new __Thing__UploadReportError(message, report)
    throw new Error(message)
  }
  return isRecord(payload) ? payload.data : null
}

export const verify__Thing__Upload = (args: Parameters<typeof send__Thing__Upload>[1]) =>
  send__Thing__Upload("verify", args) as Promise<__Thing__UploadVerified>
export const save__Thing__Upload = (args: Parameters<typeof send__Thing__Upload>[1]) =>
  send__Thing__Upload("save", args) as Promise<__Thing__UploadSaved>
```

Types (`__file__.types.ts`): `__Thing__UploadReport` / `…MissingGroup` / `…MissingItem` / `…RowError` as U3,
`__Thing__UploadVerified = { valid: true; rowCount: number; rows: … }`, `__Thing__UploadSaved = { inserted: number; updated: number; skipped: number }`.

### C.4 Workspace (`__file__-workspace.tsx`)

State: the hidden input's ref, `downloadingTemplate`, the upload dialog's state
`{ file: File; phase: "verifying" | "report" | "verified" | "saving"; report?: …; verified?: …; forbidden?: boolean } | null`,
and `canSaveUpload` (Create on the upload menu, `fetchCurrentMenuPermission({ menuName: "<Page title> Upload" })`,
loaded with the page's other access data, keyed to `selectedOrganizationId` — no setState in an effect beyond the
loader's own pattern, R2).

- picking a file → `phase: "verifying"` → `verify__Thing__Upload` → `"verified"` or, on `__Thing__UploadReportError`, `"report"`;
- **Verify again** → the same with `upload.file`;
- **Save** (only with `canSaveUpload`) → `"saving"` → `save__Thing__Upload` → success toast, close, `triggerRefresh()`;
  `__Thing__UploadReportError` → back to `"report"`; `__Thing__UploadForbiddenError` → `forbidden: true` (the notice shows
  U2's message, not the server's text);
- clear the input's value after reading the file, so the same file can be picked again.

### C.5 The dropdown goes in the page header

R15: built in the workspace and passed as `ModulePageHeader`'s `actions` (between Refresh and New), never in the
table section. Shown to everyone who can open the page (Read), since U1 lets them download and verify.

```tsx
const templateMenu = (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="rounded-xl" disabled={downloadingTemplate || upload?.phase === "verifying" || upload?.phase === "saving"}>
        {downloadingTemplate || upload?.phase === "verifying" || upload?.phase === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
        Bulk upload
        <ChevronDown className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-52">
      <DropdownMenuItem onSelect={() => void downloadTemplate()} disabled={downloadingTemplate}>
        <Download className="mr-2 size-3.5" />
        {downloadingTemplate ? "Downloading template..." : "Download template"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => uploadInputRef.current?.click()}>
        <Upload className="mr-2 size-3.5" />
        Upload __labels__
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)

const header = (
  <ModulePageHeader
    /* …eyebrow, title, description, badges, onRefresh, onCreate, createLabel… */
    actions={error ? undefined : templateMenu}
  />
)
```

Render the hidden file input and the upload dialog (C.4 / U4 / U5) once in the workspace, next to the other dialogs:

```tsx
<input
  ref={uploadInputRef}
  type="file"
  accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  className="hidden"
  onChange={(event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) void verifyUpload(file)
  }}
/>
```

Every piece above must be used: a flag or import nobody reads breaks R10.

### C.6 Verify (in the browser, with the backend up)

Download the template as a Read-only user → upload a file with a missing record and a bad cell → the report lists
both with row numbers → quick add the record (button only with that entity's Create) → Verify again → "All rows are
valid" → without Create on "<Page title> Upload": the access notice, no Save → grant it on User Menu Permission →
Save → toast, list refreshed.
