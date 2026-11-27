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
  the sidebar". Also use for ANY change to an existing CRUD page in O2S-frontend (Factory,
  Designation, Materials, Units, Buyers, HR masters, …) — adding filters, columns, form
  fields, a lookup combobox or an image upload, restyling, fixing a bug, or refactoring —
  because one set of rules applies to every page, new or existing, on every request to create or modify it.
---

# CRUD pages in O2S-frontend (new and existing)

A new page is **1 route file + 6 feature files**, and **2–3 edits** to shared files.

**One set of rules, every page, every time.** All of "Rules (R1–R12)" below apply to every page, new or existing,
whenever the user asks to create **or** modify it — there are no separate rules for new pages and existing ones,
no rule that only some pages follow, and no "later". Whatever the request (a new page, a field, a column, a
bug fix, a restyle), the page comes out of it meeting all of them (see "Applying the rules").

The live reference is the Factory Setup page — when this document and that code disagree, read both and ask:

| Piece | Reference file |
|---|---|
| Route | `app/app-config/core/factory/page.tsx` |
| Feature folder | `features/app-config/factory/` |
| Adapter rule | `lib/o2s/rules/configuration.ts` (`crudRules("factory", …)`) |
| CRUD translation | `lib/o2s/crud.ts` |
| Sidebar | `lib/module-navigation.ts` |
| Menu names | `lib/o2s/menus.ts` |
| Sections built from the shared components | `features/app-config/designations/component/` |
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
| Date | `x?: string \| null` | `string` / `""` (`yyyy-MM-dd`) | `rec.x?.slice(0, 10) ?? ""` | `optionalString(values.x)` | `AppDatePicker` | `formatDate(x)` |
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

## Rules (R1–R12) — one set for every page

Every CRUD page follows all of these, new or existing, on every request to create or modify it. The templates
already meet them; a page built another way is brought to them in the same change — see "Applying the rules".

**R1 — Shared components, never hand-written equivalents.**

| Part of the page | Shared component |
|---|---|
| Page header: eyebrow, title, description, badges, **Refresh** and **New** buttons | `ModulePageHeader` (`components/module-page-header.tsx`), which renders `AppRefreshButton` / `AppAddNewButton` |
| Table card: header with badges, desktop table, mobile cards, skeletons, pager | `AppDataSection` (`components/app-data-section.tsx`) |
| Filter fields + **Reset** button | `AppDataFilterForm` (`components/app-data-filter-form.tsx`), passed as `AppDataSection`'s `filters`, with `debounceMs={FILTER_DEBOUNCE_MS}` |
| Selects, lookups | `AppSelect`, `AppCombobox` |
| Dates (form fields, filters, grid cells) | `AppDatePicker` (`components/app-date-picker.tsx`) — never `<Input type="date">` |

`AppDatePicker` is shadcn's Date Picker (outline Button + Popover + Calendar, `captionLayout="dropdown"`): `value` /
`onValueChange` are `yyyy-MM-dd` strings (`""` = none), with `min` / `max`, `required` (no clearing), `readOnly`,
`disabled`, `placeholder`, and the classes the Input had. An optional date clears by clicking the selected day again or
with Backspace / Delete. Ref, `onKeyDown`, `onFocus` and `data-*` go to its Button, so in a keyboard grid widen the
handler types to `HTMLElement` and call `select()` only on real inputs.

A control the shared components lack (e.g. the bulk-actions dropdown) goes in `AppDataSection`'s
`headerActions` or `ModulePageHeader`'s `actions`. No hand-written `<Card>` table sections, filter `<form>`s,
Search / Reset / New / Refresh `<Button>`s or mobile pagers. Live examples: Factory and Designation sections.

**R1a — Filters apply on their own; no Search button; New only in the header** (active *and* deleted sections).
- Pass `debounceMs={FILTER_DEBOUNCE_MS}` (400 ms) and **no `onSubmit`** to `AppDataFilterForm`: a text filter
  applies once typing pauses; a **select** or **combobox** filter applies **at once** on selection (a
  combobox is a `kind: "custom"` field whose `onValueChange` calls `onFilterChange` directly — never debounce it).
- The filter row has only **Reset**, placed directly after the last filter (`AppDataFilterForm` left-aligns
  its button cell when there is no `onSubmit`; don't add `xl:col-span-*` to push it to the row's end).
  Don't pass `onCreate` / `createLabel` to `AppDataFilterForm` — the
  **New** button lives in `ModulePageHeader` only, so the active section takes no `onCreate` prop.
- The workspace's `onFilterChange` sets the filters **and resets that list to page 1** in one handler.
- A page that still passes `onSubmit` (a Search button) breaks R1a: it is fixed in the change that modifies it.

**R2 — No setState in effects (`react-hooks/set-state-in-effect`).** One effect loads the active and the
deleted page in parallel, keyed by `requestKey`; `loading` / `error` are derived from which key last
finished; a newer request cancels the older one's result. The form dialog is controlled
(`values` / `onValuesChange`) — no draft copied from props in an effect. Same for lookup selections.

**R3 — Filters only for `<Thing>Params` properties.** Read `O2S-backend/.../<Thing>.Params.cs`; a filter O2S
doesn't bind is silently ignored. Status filter values are `"true"` / `"false"`, `""` = all.

**R4 — No Excel upload / template download unless the backend has those routes** (add-on C). Under plain
`crudRules` they always error.

**R5 — Navigation is permission-aware.** The sidebar item has `permissionMenuName`; if it differs from the
O2S `menuName`, `MENU_NAME_TO_O2S` maps it. Without both, non-admins don't see the page.

**R6 — The resource has an adapter rule** (`crudRules(...)` in `lib/o2s/rules/<module>.ts`), with
`imageFields` / lookup `fromO2s` + `toO2s` where the record has an image or lookups.

**R7 — Data handling.** Ids are GUID strings (never `Number(id)`); payloads send `null`, not `undefined`, to
clear a lookup or image; display-only objects (`unit`, `image`) are never sent back.

**R8 — Page behaviour.**
- The service: every function takes `{ apiUrl, accessToken, organizationId?, … }`, builds the URL with
  `new URL(path, apiUrl)`, sends `Authorization: Bearer` + `x-organization-id`, goes through `readJsonResponse`.
- Auth: `access_token` read from `localStorage` per call; "session expired" / "unauthorized" clears the stored
  tokens and `router.replace("/sign-in")` (`handleAuthFailure`).
- Organization: reload on `SELECTED_ORGANIZATION_CHANGED_EVENT`; pass `organizationId: selectedOrganizationId || undefined`.
- Any mutation calls `triggerRefresh()`. Feedback through `toast.success` / `toast.error` (`sonner`); form errors also inside the dialog.
- Delete is soft first (confirm dialog → amber "recently deleted" banner with Restore / Delete permanently);
  the deleted section offers the same two actions per row.
- Active list 10 per page, deleted list 5, page-size options `[5, 10, 25, 50]`.

**R9 — Structure and style.** Feature folder `features/<module>/<kebab-thing>/`, components in `component/`;
the route imports `<file>-workspace` (no `<file>.workspace.tsx` re-export). The page container around the
header and sections (also the skeleton's and the error state's) is `space-y-4 p-2 sm:p-3 lg:p-4` — not the
older `space-y-6 p-4 sm:p-6 lg:p-8`. Class strings inside cells, mobile
cards, empty states, the banner and dialogs as in the templates (`h-8 py-1` cells, `text-xs` cell text,
`rounded-xl` buttons). 2-space indent, no semicolons in new files; keep an existing file's indent.

**R10 — Lint-clean.** `npm run typecheck` passes and `npx eslint` on every new or touched file reports no
errors and no warnings — no unused variables, imports, helpers or props. An `<img>` for an O2S file URL
carries `// eslint-disable-next-line @next/next/no-img-element` with a reason.

**R11 — Every outbound call goes through the service and the O2S adapter** (the frontend side of the
backend's rule that every outbound HTTP call is a Refit client).
- Components, dialogs and the workspace never call `fetch` (nor axios or another HTTP client): they call the
  feature's `<file>.service.ts` (or a shared `*-api.ts` helper), which calls `${apiUrl}/api/v1/...` as in R8 and
  so passes through `lib/o2s/adapter.ts` and its rule (R6).
- The browser calls only the O2S API. A third-party service (exchange rates, AI, a vendor, maps, …) is called by
  the backend through its own Refit client (`O2S-backend` CLAUDE.md, "Every outbound HTTP call goes through
  Refit"), behind an O2S endpoint the page calls; never from the page, and never with a key in `NEXT_PUBLIC_*`.
  No such endpoint yet → add it to the backend first (its `production-feature` skill), then the adapter rule.
- What the user sees of a failure is the adapter's `message` (`toast.error(...)`, the dialog's error): never the
  raw response text. The adapter already turns an HTML answer (the deploy's `app_offline.htm`, IIS error pages)
  or no answer at all into a plain sentence; don't read `response.text()` into a toast to get around it.

**R12 — Toast placement: errors and warnings at the top middle, everything else at the bottom right.**
- A failure the user must notice is `toast.error(...)`; a caution is `toast.warning(...)`. Both show at the **top
  middle**. A success, an info note, a loading toast or a plain `toast(...)` shows at the **bottom right**.
- This is set once in `components/ui/sonner.tsx` (the `Toaster` defaults to bottom right; `toast.error` /
  `toast.warning` default to top center) for every `import { toast } from "sonner"`, so a page passes **no
  `position`**. Never report an error with `toast.success` / `toast.info` / `toast(...)` to change where it shows,
  and never pass `position` to move a toast against this rule.
- Don't add a second `<Toaster>`; the one in `app/layout.tsx` takes no `position` prop.

## Applying the rules

The same steps for every request, whether it creates a page or modifies one (a new field, a filter, a column,
a bug fix, a restyle):

1. **Do the requested change** (a new page: the Steps above, from the templates).
2. **Audit the whole page against R1–R12**, not only the lines the request touched — its route, feature
   folder, adapter rule, sidebar item and menu-name entry. Run `npx eslint <feature folder>` and read the
   backend `<Thing>Params` / DTO.
3. **Fix every rule the page breaks**, in the same change, using the templates as the target shape. Keep the
   page's existing columns, fields, labels, badges, image thumbnails and extra actions — the rules change
   *how* the page is built, not *what* it shows.
4. **Ask before removing anything users can see.** R3 (a filter the backend ignores) and R4 (a bulk-upload
   menu that always errors) remove visible controls: list them and get a yes before deleting them. If the
   user says keep, leave them and note it in the summary.
5. **Report** a short R1–R12 table for the page: ✅ already met / 🔧 fixed / ⏸ left as is (and why).

Known state of the reference pages (update this list when you fix one):

| Page | Open rule breaks |
|---|---|
| Factory (`features/app-config/factory/`) | R2 (loader effect, dialog draft effect), R3 (`contact` / `email` filters), R4 (bulk upload menu), R5 (no `permissionMenuName`), R9 (`factory.workspace.tsx` re-export), R10 (unused `imageInputRef`, `uploadingTemplate`, `downloadingTemplate`, `optionalNumber`; `<img>` warning in the dialog). R1 done. |
| Designation (`features/app-config/designations/`) | R1 header (hand-written header with `AppRefreshButton` / `AppAddNewButton`) — not yet audited for the rest |
| Exchange Rates (`features/app-config/exchange-rates/`) | None. A matrix on `AppDataSection`: a row per date + from currency, a column per to currency built from the response's `currencies`, each cell edited in place (saved at once, toast, reload for the reverse pair), row checkboxes with bulk delete in `headerActions`, Rerun latest in the header's `actions`; its adapter rule has a custom `/matrix` handler. R8's soft delete does not apply: the rates table has no soft delete (a provider rate can be fetched again), so there is no deleted section and Delete is a confirmed hard delete. |
| Other CRUD pages | not yet audited |

## Verify

1. R10: `npm run typecheck` and `npx eslint <the new and touched files>` — no errors and no warnings.
2. Re-check R1–R12 against the finished files: this is the report in step 5 of "Applying the rules".
3. If the dev server is running (`npm run dev`, port 3000) and the backend is up, open
   `http://localhost:3000<route>` and walk through: list loads → filter → create → edit → delete →
   restore from the banner → delete → permanently delete from the deleted card.
   If you cannot run it, say so in your summary rather than claiming it works.

## Pitfalls

- **Why R7's `null`:** PATCH merges into the stored record, so a field left out of the payload keeps its old
  value — and a field sent as `undefined` is dropped by `JSON.stringify`, so it keeps its old value too.
- **Why R7's "never send display objects back":** strip `unit` / `image` in `toO2s` as the `material` rule in
  `configuration.ts` does, or O2S receives a navigation object it can't bind.
- **Images:** the rule needs `fromO2s: imageFields` so the record gets an `image` object (the O2S DTO has only
  `imageId`); existing images still have no URL (see add-on B).
- **`AppDataFilterForm` is 4 per row** (`xl:grid-cols-4`); widen a field with `className: "min-w-0 space-y-1 xl:col-span-2"`.
- **`ModulePageHeader`'s refresh button always says "Refresh"**, including on the error state.
- **The header's "Active N" badge counts the current page only**, not the whole table.
- **A table wider than the card** (many columns, e.g. the Exchange Rates currency grid): give the columns fixed
  widths in `columnClassNames` (the table is `table-fixed`, so it grows to their sum and scrolls inside its card), pin
  the identity columns with `sticky left-… z-10 bg-white dark:bg-slate-950`, and wrap the section in
  `<div className="min-w-0 [contain:inline-size]">` — otherwise the page's `ScrollArea` content grows to the table and
  the header buttons fall off the right edge.
