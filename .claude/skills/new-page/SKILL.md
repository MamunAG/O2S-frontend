---
name: new-page
description: >
  Build a new CRUD master-data screen in the O2S frontend (Next.js app router + shadcn/ui),
  modelled on the Factory Setup page (/app-config/core/factory): route page, feature folder
  (types, service, workspace, active table section, deleted table section, create/edit form
  dialog), sidebar navigation entry, O2S adapter rule and menu-name mapping. Use this whenever
  the user asks to add, scaffold, create or wire up a new page, screen, setup page, entry
  page, master-data page, list/table page, or CRUD UI for an entity in O2S-frontend — even if
  they only say "make a page for X", "frontend for the new X endpoints" or "add X setup to
  the sidebar". Also use when adding filters, columns, form fields, a lookup combobox or an
  image upload to an existing page built this way.
---

# New CRUD page in O2S-frontend

Creates one screen: **1 route file + 6 feature files**, and **2–3 edits** to shared files.

The live reference is the Factory Setup page — when this document and that code disagree, read both and ask:

| Piece | Reference file |
|---|---|
| Route | `app/app-config/core/factory/page.tsx` |
| Feature folder | `features/app-config/factory/` |
| Adapter rule | `lib/o2s/rules/configuration.ts` (`crudRules("factory", …)`) |
| CRUD translation | `lib/o2s/crud.ts` |
| Sidebar | `lib/module-navigation.ts` |
| Menu names | `lib/o2s/menus.ts` |
| Lookup combobox example | `features/app-config/materials/` (unit, material group) |
| Backend slice | `../O2S-backend/O2S/Endpoints/Configuration/FactoryEndpoints.cs`, `Features/Configuration/Factory/` |

All paths below are relative to `O2S-frontend/` unless they start with `O2S-backend/`.

## How the page talks to the backend (read once)

The screens were written for an older API ("code-crafter"). Every service still calls
`${apiUrl}/api/v1/<resource>` and reads `{ success, message, data }`. `lib/o2s/adapter.ts` wraps
`window.fetch` and, for each request, finds a rule in `lib/o2s/rules/*.ts` that rewrites it to the
O2S route `/api/v1/{companyId}<o2sPath>` (companyId = the selected organization). For a standard CRUD
resource one line does it all:

```ts
...crudRules("<resource>", "/<module-segment>/<thing-segment>", { label: "This <label>" }),
```

| Service calls | O2S receives |
|---|---|
| `GET /<resource>?page&limit&<filters>[&deletedOnly=true]` | `GET /paginated-list?pageNumber&pageSize&…` → `{ items, meta }` |
| `GET /<resource>/{id}` | `GET /{id}` |
| `POST /<resource>` | `POST /` |
| `PATCH /<resource>/{id}` | `GET /{id}`, merge, `PUT /{id}` (O2S replaces the whole record) |
| `DELETE /<resource>/{id}` | `DELETE /{id}` (soft delete) |
| `POST /<resource>/{id}/restore` | `POST /{id}/restore` |
| `DELETE /<resource>/{id}/permanent` | `DELETE /{id}/permanent` |
| `/<resource>/upload`, `/<resource>/template/upload` | **always an error** ("Excel upload is not available…") |

`crudRules` also adds the audit names the tables show (`created_at`, `updated_at`, `deleted_at`,
`created_by_user`, …) from O2S's `createdDate` / `createdBy` / `createdByName` etc. Numeric ids come back as strings.

## Before writing any code

Collect these. Read the backend slice first — most answers are there. Ask the user for anything still missing.

| Input | Where it comes from | Factory example |
|---|---|---|
| **Thing** (singular / plural, Pascal + camel + kebab + human) | the user | `Factory` / `Factories`, `factory` / `factories`, `factory`, "factory" / "factories" |
| **Module + route** | the user, or the module the backend slice lives in | `app-config`, `/app-config/core/factory` |
| **Sidebar group** | the existing groups of that module in `lib/module-navigation.ts` | App Config → Core |
| **Page title + eyebrow** | the user; title usually `<Thing> Setup` or `<Thing> Entry` | "Factory Setup", "App configuration" |
| **Resource segment** | kebab-case code-crafter segment the service calls; usually the O2S thing segment | `factory` |
| **O2S path** | `MapGroup(...)` in `O2S-backend/O2S/Endpoints/<Module>/<Thing>Endpoints.cs`, minus `/api/v{version}/{companyId}` | `/configuration/factory` |
| **O2S menu name** | `public const string menuName` on that endpoints class | `"Factory"` |
| **Nav label / permission name** | the sidebar label; if it differs from the O2S menu name, it needs a `MENU_NAME_TO_O2S` entry | `"Factory Setup"` → `"Factory"` |
| **Fields** | `O2S-backend/O2S/Features/<Module>/<Thing>/Dto/<Thing>.Dto.cs` — name, kind (see table below), required? | `name`*, `displayName`*, `code`, `contact`, `email`, `address`, `remarks`, `isActive`, `imageId` |
| **Required fields** | `<Thing>.Validator.cs` (`NotEmpty()` rules) | `name`, `displayName` |
| **Filters** | properties of `<Thing>.Params.cs` — **only these** | `name`, `displayName`, `code`, `isActive` |
| **Table columns** | the user; default: identity column + 3–4 short fields + Status + Created + Updated + Actions | |
| **Lookups** | DTO properties named `<x>Id` pointing at another entity; their picker source is that entity's `/select-options` route or its existing frontend service | material → unit, material group |
| **Image?** | DTO has `imageId` | yes |

> **No backend slice yet?** Stop and say so. The backend is built with the `production-feature`
> skill in `O2S-backend`; this page needs its routes (`paginated-list`, `{id}`, POST, PUT, DELETE and
> `SoftDeleteRoutes.Map<…>` for the deleted list / restore / permanent delete).

> **Filters must exist in `<Thing>Params`.** The list handler forwards every non-empty query key to
> O2S; a key O2S does not bind is silently ignored, so the filter box appears to do nothing. (The Factory
> page filters on `contact` and `email`, which `FactoryParams` does not have — don't copy that.)
> Strings filter with case-insensitive *contains*, bools and numbers exactly.

### Field kinds

Every field appears in up to 6 places. Use the row for its kind:

| Kind | `<Thing>Record` | `<Thing>FormValues` / default | Edit-load (`rec` → form) | Payload (`build<Thing>Payload`) | Form control | Table cell |
|---|---|---|---|---|---|---|
| Required text | `x: string` | `string` / `""` | `rec.x ?? ""` | `values.x.trim()` + a check in `submitEditor` | `Input` + `FieldLabel required` | text |
| Optional text | `x?: string \| null` | `string` / `""` | `rec.x ?? ""` | `optionalString(values.x)` | `Input` (`type="email"` for email) | `x \|\| "-"` |
| Long text | `x?: string \| null` | `string` / `""` | `rec.x ?? ""` | `optionalString(values.x)` | `Textarea rows={4}` | usually not shown |
| Number | `x?: number \| null` | `string` / `""` | `rec.x != null ? String(rec.x) : ""` | `optionalNumber(values.x)` | `Input type="number" inputMode="decimal"` | number, right-aligned |
| Date | `x?: string \| null` | `string` / `""` (`yyyy-MM-dd`) | `rec.x?.slice(0, 10) ?? ""` | `optionalString(values.x)` | `Input type="date"` | `formatDate(x)` |
| Active flag | `isActive?: boolean` | `boolean` / `true` | `rec.isActive !== false` | `values.isActive` | `Switch` in a bordered row | Status badge |
| Lookup | `xId?: string \| null` + `x?: { id, name } \| null` | `xId: string` / `""` | `rec.xId ?? ""` | `values.xId \|\| null` | `AppCombobox` — see `references/add-ons.md` | `row.original.x?.name ?? "-"` |
| Image | `imageId?: string \| null` + `image?: FileSummary \| null` | `imageId: string` / `""` | `rec.imageId ?? ""` | `values.imageId \|\| null` | upload box — see `references/add-ons.md` | thumbnail in the identity column |

The field names on the screen are the **O2S DTO's camelCase names** (`displayName`, `isActive`, `unitId`).
Then `crudRules` needs no `fromO2s` / `toO2s` mapping. Only rename when an existing shared service forces it.

## Steps

Templates for every file are in **`references/templates.md`**; optional pieces (lookup combobox, image
upload, Excel upload) are in **`references/add-ons.md`**. Write each file from its template, replacing the
`__tokens__` and expanding the `FIELDS` markers using the field-kind table above.

1. **Types** — `features/<module>/<file>/<file>.types.ts`
2. **Service** — `features/<module>/<file>/<file>.service.ts`
3. **Active section** — `features/<module>/<file>/component/active-<file>-section.tsx`
4. **Deleted section** — `features/<module>/<file>/component/deleted-<file>-section.tsx`
5. **Form dialog** — `features/<module>/<file>/component/<file>-form-dialog.tsx`
6. **Workspace** — `features/<module>/<file>/<file>-workspace.tsx`
7. **Route** — `app/<route>/page.tsx` (a server component that only reads `NEXT_PUBLIC_API_URL` and renders the workspace)
8. **Adapter rule** — add `...crudRules("<resource>", "<o2sPath>", { label: "This <label>" }),` to the module's
   rule file: `lib/o2s/rules/configuration.ts` (App Config / IAM), `merchandising.ts` (uses the `MERCH`
   prefix constant), `hr.ts`, or `account.ts`. Put it next to its neighbours. **Skip only if a rule for that
   resource already exists** — grep `lib/o2s/rules` for the resource first.
9. **Sidebar** — add the item to the right group in `lib/module-navigation.ts`:
   ```ts
   { label: "<Title>", href: "<route>", permissionMenuName: "<Title>" },
   ```
   **Always set `permissionMenuName`.** An item without one is shown only to global admins
   (`filterSidebarItemsByPermissions` drops it for everyone else). The Factory item has this bug.
10. **Menu name** — if `<Title>` is not exactly the O2S `menuName`, add `"<Title>": "<O2S menuName>",`
    to `MENU_NAME_TO_O2S` in `lib/o2s/menus.ts`. Without it, non-admin users with the O2S permission
    still don't see the item.

## Conventions the templates follow (keep them)

- Feature folders: `features/<module>/<kebab-thing>/`, components in `component/` (singular).
  Import the workspace from `<file>-workspace`; don't add a `<file>.workspace.tsx` re-export.
- Every service function takes `{ apiUrl, accessToken, organizationId?, … }`, builds the URL with
  `new URL(path, apiUrl)`, sends `Authorization: Bearer` + `x-organization-id`, and goes through `readJsonResponse`.
- The workspace reads `access_token` from `localStorage` on every call; a "session expired" / "unauthorized"
  error clears the stored tokens and `router.replace("/sign-in")` (`handleAuthFailure`).
- The workspace reloads on organization change (`SELECTED_ORGANIZATION_CHANGED_EVENT`) and passes
  `organizationId: selectedOrganizationId || undefined` to every call.
- One effect fetches the active page and the deleted page in parallel, keyed by `requestKey`; `loading` /
  `error` are derived from which key last finished. Any mutation calls `triggerRefresh()`.
- The form dialog is controlled (`values` / `onValuesChange`); the workspace owns the editor values.
- Active list: 10 per page; deleted list: 5 per page; page-size options `[5, 10, 25, 50]`.
- Feedback: `toast.success` / `toast.error` from `sonner`; form errors also shown inside the dialog.
- Delete is soft first (confirm dialog → amber "recently deleted" banner with Restore / Delete permanently);
  the deleted card offers the same two actions per row.
- Below `lg` the tables become cards with a pager; from `lg` up they use `AppDataTable`.
- Styling: copy the class strings from the templates verbatim — the glass cards, `rounded-xl` buttons,
  `h-7 text-xs` filter inputs and `h-8 py-1` table cells are what make the screens look alike.
- 2-space indent, no semicolons, as in the templates.

### Where the templates deliberately differ from Factory

Factory is the visual and behavioural reference, not a lint-clean one. The templates fix these; don't
reintroduce them when copying from Factory:

| Factory | Templates |
|---|---|
| `setLoading(true)` + `void loadFactories()` in an effect, dialog copies `initialValues` into a draft in an effect — both fail `react-hooks/set-state-in-effect` | derived `loading` / `error` from `requestKey`; controlled dialog |
| stale list responses can overwrite newer ones while typing in a filter | the effect cancels the older request's result |
| filters on `contact`, `email`, `address` that `FactoryParams` ignores | only `<Thing>Params` properties |
| bulk upload menu that always errors under O2S | omitted (add-on C) |
| sidebar item without `permissionMenuName` | always set |
| unused `imageInputRef`, `uploadingTemplate`, `optionalNumber`, `activeCount`; `factory.workspace.tsx` re-export | not present |

## Verify

1. `npm run typecheck` and `npx eslint <the new and edited files>` — no errors. The one expected warning
   per table section is `Compilation Skipped: Use of incompatible library` (TanStack Table under the React
   Compiler); every existing section has it. Fix anything else.
2. If the dev server is running (`npm run dev`, port 3000) and the backend is up, open
   `http://localhost:3000<route>` and walk through: list loads → filter → create → edit → delete →
   restore from the banner → delete → permanently delete from the deleted card.
   If you cannot run it, say so in your summary rather than claiming it works.

## Pitfalls

- **Ids are GUID strings.** Never `Number(id)`; compare with `===` on strings. `editingId` is `string | null`.
- **PATCH merges into the stored record**, so a field left out of the payload keeps its old value — but a
  field sent as `undefined` is dropped by `JSON.stringify` and also keeps its old value. To clear an optional
  field, the payload builder must send `null`, not `undefined`, when that matters (lookups, image).
- **Excel upload / template download don't exist in O2S** — `crudRules` turns them into an error. Don't add
  the bulk-actions dropdown unless the backend has those routes (see `references/add-ons.md`).
- **Don't send display-only objects back.** If the record carries `unit: { id, name }` or `image: {…}`, the
  form values hold only `unitId` / `imageId`; for a lookup, also strip the object in `toO2s` (see the
  `material` rule in `configuration.ts`).
- **Images:** the rule needs `fromO2s: imageFields` so the record gets an `image` object (the O2S DTO has only `imageId`).
- **Status filter values** are the strings `"true"` / `"false"`; `""` means all (the list handler drops it).
- **The header's "Active N" badge counts the current page only**, not the whole table (as in Factory).
