// Step 2: App Config (countries ... materials, departments, designations, module / menu entry) and IAM
// (memberships, menu permissions, organization menus, access requests) plus the audit log.

import { companyPath, isRecord, O2sError, type O2sContext, type O2sRule } from "../adapter"
import { crudRules, pageOf, withAuditNames } from "../crud"
import { fromO2sModuleName } from "../menus"

type Rec = Record<string, unknown>

const lookup = (value: unknown, nameKey = "name") =>
  isRecord(value) ? { id: value.id, name: value[nameKey] ?? value.name } : null

/** O2S image id 0 / null means none. */
const imageFields = (r: Rec): Rec => ({ ...r, image: r.imageId ? { id: r.imageId } : null })

function kebab(text: string) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

// ---------- memberships (O2S company users) ----------

function toMembership(row: Rec, companyId: string): Rec {
  return {
    userId: row.userId,
    organizationId: row.companyId ?? companyId,
    role: row.role,
    isDefault: row.isDefault,
    organization: { id: row.companyId ?? companyId, name: row.companyName, isActive: row.isCompanyActive ?? true },
    user: { id: row.userId, name: row.fullName ?? row.userName, email: row.email, user_name: row.userName },
  }
}

async function companyMembers(ctx: O2sContext, companyId: string): Promise<Rec[]> {
  const page = (await ctx.call(`/api/v1/${encodeURIComponent(companyId)}/configuration/company-user/paginated-list?pageSize=1000`)) as Rec
  return (Array.isArray(page?.data) ? page.data : []) as Rec[]
}

/** A user's memberships: one's own from /account/companies; another user's by looking in each company. */
async function userMemberships(ctx: O2sContext, userId: string): Promise<Rec[]> {
  if (userId === ctx.userId) {
    const own = (await ctx.call("/api/v1/account/companies")) as Rec[]
    return own.map((row) => toMembership({ ...row, userId }, String(row.companyId)))
  }
  const companies = (await ctx.call(companyPath(ctx, "/configuration/company/paginated-list?pageSize=1000"))) as Rec
  const rows: Rec[] = []
  for (const company of (company_rows(companies))) {
    const members = await companyMembers(ctx, String(company.id)).catch(() => [])
    const found = members.find((m) => m.userId === userId)
    if (found) rows.push(toMembership({ ...found, companyName: found.companyName ?? company.name }, String(company.id)))
  }
  return rows
}

function company_rows(page: Rec): Rec[] {
  return (Array.isArray(page?.data) ? page.data : []) as Rec[]
}

// ---------- access requests ----------

function toAccessRequest(r: Rec, ctx: O2sContext): Rec {
  return {
    id: r.id,
    requestedByUserId: r.requestedByUserId,
    requestedAdminUserId: "",
    requestedAdminEmail: r.adminEmail,
    message: r.message ?? null,
    status: String(r.status ?? "").toLowerCase(),
    reviewedByUserId: null,
    reviewedAt: r.reviewedDate ?? null,
    reviewNote: r.reviewNote ?? null,
    requestedByUser: { id: r.requestedByUserId, name: r.requestedByName ?? "", email: r.requestedByEmail ?? "" },
    requestedAdminUser: { id: "", name: r.requestedAdminName ?? "", email: r.adminEmail ?? "" },
    reviewedByUser: r.reviewedByName ? { id: "", name: r.reviewedByName, email: "" } : null,
    assignments: r.assignments,
    rowVersion: r.rowVersion,
    created_at: r.createdDate,
    updated_at: r.reviewedDate ?? r.createdDate,
    _userId: ctx.userId,
  }
}

async function findAccessRequest(ctx: O2sContext, id: string): Promise<Rec> {
  for (const list of ["pending", "mine"]) {
    const rows = (await ctx.call(`/api/v1/account/company-access-requests/${list}`)) as Rec[]
    const found = rows.find((r) => String(r.id) === id)
    if (found) return found
  }
  throw new O2sError("Access request not found.", 404)
}

// ---------- audit log ----------

function auditFeed(page: Rec, q: URLSearchParams): Rec {
  const events = (Array.isArray(page.data) ? page.data : []) as Rec[]
  const limit = (page.pageSize as number) || Number(q.get("limit") ?? 20)
  return {
    generatedAt: new Date().toISOString(),
    page: (page.pageNumber as number) || Number(q.get("page") ?? 1),
    limit,
    total: page.totalItems,
    totalPages: page.totalPages || Math.ceil(((page.totalItems as number) || 0) / (limit || 1)),
    // O2S does not count these across the whole log; they describe the events on this page.
    stats: {
      total: page.totalItems,
      cronTotal: events.filter((e) => e.category === "CRON").length,
      cronOnSchedule: events.filter((e) => e.scheduleStatus === "ON_SCHEDULE").length,
      issues: events.filter((e) => e.status === "ERROR" || (e.scheduleStatus && e.scheduleStatus !== "ON_SCHEDULE")).length,
    },
    events: events.map((e) => ({ ...e, organizationId: e.companyId ?? null, schedule: null, runId: null })),
  }
}

export const configurationRules: O2sRule[] = [
  // --- App Config masters ---
  ...crudRules("country", "/configuration/country", { label: "This country" }),
  ...crudRules("currency", "/configuration/currency", {
    label: "This currency",
    extra: [
      {
        methods: ["GET"],
        match: /^\/api\/v1\/currency\/exchange-rates\/([^/]+)\/([^/]+)$/,
        to: (m, ctx) =>
          companyPath(ctx, m[1] === "latest"
            ? `/configuration/currency/exchange-rates/latest/${m[2]}`
            : `/configuration/currency/exchange-rates/${m[1]}/${m[2]}`),
        response: (data) => {
          const d = data as Rec
          // O2S stores pairs; these routes read the code -> BDT one.
          return { id: d.id, currency_date: d.currencyDate, currency_code: d.fromCurrencyCode, rate_in_bdt: d.rate }
        },
      },
      {
        // The rate to convert `from` into `to` (amount x rate): ?from=USD&to=BDT[&date=yyyy-MM-dd].
        methods: ["GET"],
        match: /^\/api\/v1\/currency\/exchange-rates\/rate$/,
        to: (_m, ctx) => companyPath(ctx, `/configuration/currency/exchange-rates/rate?${ctx.query}`),
      },
      {
        methods: ["POST"],
        match: /^\/api\/v1\/currency\/exchange-rates\/update$/,
        to: (_m, ctx) => companyPath(ctx, "/configuration/currency/exchange-rates/update"),
      },
    ],
  }),
  // Exchange Rates screen (global table). Inline edit = PATCH (merged into the stored rate, PUT); the ticked
  // rows go to DELETE /selected; Rerun latest replaces today's (Dhaka) rates with the provider's.
  ...crudRules("exchange-rate", "/configuration/exchange-rate", {
    label: "This exchange rate",
    extra: [
      {
        // The grid: paged by date, a row per date + from currency, a cell per to currency.
        methods: ["GET"],
        match: /^\/api\/v1\/exchange-rate\/matrix$/,
        handle: async (_m, ctx) => {
          const q = new URLSearchParams()
          ctx.query.forEach((value, key) => {
            if (!value || key === "organizationId") return
            if (key === "page") q.set("pageNumber", value)
            else if (key === "limit") q.set("pageSize", value)
            else q.set(key, value)
          })
          const d = (await ctx.call(companyPath(ctx, `/configuration/exchange-rate/matrix?${q}`))) as Rec
          const page = (d.pageNumber as number) || 1
          const limit = (d.pageSize as number) || 10
          const totalPages = (d.totalPages as number) || 0
          return {
            data: {
              items: d.data ?? [],
              currencies: d.currencies ?? [],
              meta: {
                total: d.totalItems ?? 0,
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
              },
            },
          }
        },
      },
      {
        methods: ["DELETE"],
        match: /^\/api\/v1\/exchange-rate\/selected$/,
        to: (_m, ctx) => companyPath(ctx, "/configuration/exchange-rate/selected"),
      },
      {
        methods: ["POST"],
        match: /^\/api\/v1\/exchange-rate\/rerun$/,
        to: (_m, ctx) => companyPath(ctx, "/configuration/exchange-rate/rerun"),
      },
    ],
  }),
  ...crudRules("unit", "/configuration/unit", { label: "This unit" }),
  ...crudRules("factory", "/configuration/factory", { label: "This factory", fromO2s: imageFields }),
  ...crudRules("supplier", "/configuration/supplier", { label: "This supplier" }),
  ...crudRules("material-group", "/configuration/material-group", { label: "This material group" }),
  ...crudRules("material", "/configuration/material", {
    label: "This material",
    fromO2s: (r) => imageFields({ ...r, unit: lookup(r.units), materialGroup: lookup(r.materialGroups) }),
    toO2s: (b) => {
      const { unit: _u, materialGroup: _g, image: _i, ...rest } = b
      void _u
      void _g
      void _i
      return rest
    },
  }),
  ...crudRules("hr/department", "/hr/department", { label: "This department" }),
  ...crudRules("hr/designation", "/hr/designation", { label: "This designation" }),

  // --- module and menu entry ---
  ...crudRules("module-entry", "/configuration/module", {
    label: "This module",
    fromO2s: (r) => ({ ...r, moduleKey: kebab(String(r.moduleName ?? "")), displayOrder: r.serialNo ?? 0, description: null }),
    toO2s: (b) => ({
      ...(b.moduleName !== undefined ? { moduleName: b.moduleName } : {}),
      ...(b.displayOrder !== undefined ? { serialNo: Number(b.displayOrder) || null } : {}),
      ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
    }),
  }),
  ...crudRules("menu", "/configuration/menu", {
    label: "This menu",
    fromO2s: (r) => ({
      ...r,
      displayOrder: r.serialNo ?? 0,
      description: null,
      moduleEntry: { id: r.moduleId, moduleName: fromO2sModuleName(r.moduleName as string), moduleKey: kebab(String(r.moduleName ?? "")) },
    }),
    toO2s: (b) => ({
      ...(b.menuName !== undefined ? { menuName: b.menuName } : {}),
      ...(b.menuPath !== undefined ? { menuPath: b.menuPath || null } : {}),
      ...(b.moduleId !== undefined ? { moduleId: b.moduleId } : {}),
      ...(b.displayOrder !== undefined ? { serialNo: Number(b.displayOrder) || null } : {}),
      ...(b.isActive !== undefined ? { isActive: b.isActive } : {}),
    }),
    queryNames: { moduleName: "moduleName" },
  }),

  // --- organization memberships (O2S company users) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-to-oranization-map\/organization\/([^/]+)\/mappings$/,
    handle: async (m, ctx) => ({ data: (await companyMembers(ctx, m[1])).map((r) => toMembership(r, m[1])) }),
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-to-oranization-map\/user\/([^/]+)\/mappings$/,
    handle: async (m, ctx) => ({ data: await userMemberships(ctx, decodeURIComponent(m[1])) }),
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-to-oranization-map\/user\/([^/]+)\/organizations$/,
    handle: async (m, ctx) => ({
      data: (await userMemberships(ctx, decodeURIComponent(m[1]))).map((r) => ({ ...(r.organization as Rec), isDefault: r.isDefault, role: r.role })),
    }),
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-to-oranization-map\/admin\/users$/,
    handle: async (_m, ctx) => ({ data: (await companyMembers(ctx, ctx.companyId)).map((r) => toMembership(r, ctx.companyId)) }),
  },
  {
    methods: ["DELETE"],
    match: /^\/api\/v1\/user-to-oranization-map\/mapping\/([^/]+)\/([^/]+)$/,
    to: (m) => `/api/v1/${m[2]}/configuration/company-user/${m[1]}`,
  },
  {
    match: /^\/api\/v1\/user-to-oranization-map\/mapping\/([^/]+)\/([^/]+)\/role$/,
    handle: async (m, ctx) => {
      const [userId, companyId] = [decodeURIComponent(m[1]), m[2]]
      const current = (await companyMembers(ctx, companyId)).find((r) => r.userId === userId)
      if (!current) throw new O2sError("This user is not a member of the organization.", 404)
      const saved = await ctx.call(`/api/v1/${companyId}/configuration/company-user/${encodeURIComponent(userId)}`, {
        method: "PUT",
        body: { ...current, role: (ctx.body as Rec)?.role ?? current.role },
      })
      return { data: toMembership((saved as Rec) ?? current, companyId) }
    },
  },

  // --- a user's per-factory limits on the factory-based menus (IAM screen) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/menu-permission\/factory-limits$/,
    handle: async (_m, ctx) => {
      const companyId = encodeURIComponent(ctx.query.get("organizationId") || ctx.companyId)
      const userId = encodeURIComponent(ctx.query.get("userId") ?? "")
      const [rows, factories] = (await Promise.all([
        ctx.call(`/api/v1/${companyId}/configuration/user-menu-permission/user/${userId}`),
        ctx.call(`/api/v1/${companyId}/configuration/user-menu-permission/user/${userId}/factories`),
      ])) as [Rec[], Rec]
      const scoped = (rows ?? []).filter((r) => r.isFactoryScoped)
      const all = (Array.isArray(factories?.factories) ? factories.factories : []) as Rec[]
      return {
        data: {
          choices: all
            .filter((f) => factories?.isUnrestricted || f.isAssigned)
            .map((f) => ({ id: String(f.factoryId), name: f.name, displayName: f.displayName })),
          scopedMenuIds: scoped.map((r) => String(r.menuId)),
          limits: Object.fromEntries(scoped.map((r) => [String(r.menuId), ((r.factoryIds as unknown[]) ?? []).map(String)])),
        },
      }
    },
  },

  // --- menu permissions of a user (IAM screen) ---
  {
    methods: ["PUT", "POST"],
    match: /^\/api\/v1\/menu-permission$/,
    handle: async (_m, ctx) => {
      const body = ctx.body as Rec
      const companyId = String(body.organizationId ?? ctx.companyId)
      const userId = String(body.userId)
      const rows = (Array.isArray(body.permissions) ? body.permissions : []) as Rec[]
      const saved = (await ctx.call(`/api/v1/${companyId}/configuration/user-menu-permission/user/${encodeURIComponent(userId)}`, {
        method: "PUT",
        // factoryIds only on factory-based menus; left out (null) = the limit stays as it is.
        body: rows.map((p) => ({
          menuId: p.menuId, isAccess: !!p.canView, isInsert: !!p.canCreate, isUpdate: !!p.canUpdate, isDelete: !!p.canDelete,
          ...(Array.isArray(p.factoryIds) ? { factoryIds: (p.factoryIds as unknown[]).map(String) } : {}),
        })),
      })) as Rec[]
      return {
        data: (saved ?? []).filter((p) => p.isAccess).map((p) => ({
          id: `${p.menuId}`, organizationId: companyId, userId, menuId: p.menuId,
          canView: p.isAccess, canCreate: p.isInsert, canUpdate: p.isUpdate, canDelete: p.isDelete,
          menu: { id: p.menuId, menuName: p.menuName, menuPath: p.menuPath, moduleId: p.moduleId, displayOrder: p.menuSerialNo ?? 0, isActive: true,
            moduleEntry: { id: p.moduleId, moduleName: fromO2sModuleName(p.moduleName as string), moduleKey: kebab(String(p.moduleName ?? "")) } },
        })),
        message: "Menu permissions saved",
      }
    },
  },

  // --- the factories a user may work with (IAM "User Factory Permission"; O2S is strict: none = no factory) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-factory-permission$/,
    handle: async (_m, ctx) => {
      const q = new URLSearchParams()
      ctx.query.forEach((value, key) => {
        if (key === "organizationId" || value === "" || value === "all") return
        if (key === "page") q.set("pageNumber", value)
        else if (key === "limit") q.set("pageSize", value)
        else q.set(key, value)
      })
      const data = await ctx.call(companyPath(ctx, `/configuration/user-factory-permission/summary?${q}`))
      return { data: pageOf(data, ctx.query) }
    },
  },
  // the caller's own factories (the top bar's factory switcher); before the /{userId} rule below
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-factory-permission\/mine$/,
    to: (_m, ctx) => companyPath(ctx, "/configuration/user-factory-permission/mine"),
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-factory-permission\/([^/]+)$/,
    to: (m, ctx) => companyPath(ctx, `/configuration/user-factory-permission/user/${m[1]}`),
  },
  {
    methods: ["PUT"],
    match: /^\/api\/v1\/user-factory-permission\/([^/]+)$/,
    handle: async (m, ctx) => {
      const ids = (ctx.body as Rec)?.factoryIds
      const data = await ctx.call(companyPath(ctx, `/configuration/user-factory-permission/user/${m[1]}`), {
        method: "PUT",
        body: { factoryIds: Array.isArray(ids) ? ids.map(String) : [] },
      })
      return { data, message: "Factory access saved" }
    },
  },

  // --- an organization's menu list (O2S: no list = every menu) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/menu-to-organization-map$/,
    handle: async (_m, ctx) => {
      const companyId = ctx.query.get("organizationId") || ctx.companyId
      const list = (await ctx.call(`/api/v1/${companyId}/configuration/company-menu`)) as Rec
      const menus = (Array.isArray(list?.menus) ? list.menus : []) as Rec[]
      return {
        data: menus.filter((m) => m.isAvailable).map((m) => ({
          menuId: m.menuId,
          organizationId: companyId,
          menu: { id: m.menuId, menuName: m.menuName, moduleId: m.moduleId, displayOrder: 0, isActive: true,
            moduleEntry: { id: m.moduleId, moduleName: fromO2sModuleName(m.moduleName as string), moduleKey: kebab(String(m.moduleName ?? "")) } },
        })),
      }
    },
  },
  {
    methods: ["PUT", "POST"],
    match: /^\/api\/v1\/menu-to-organization-map$/,
    handle: async (_m, ctx) => {
      const body = ctx.body as Rec
      const companyId = String(body.organizationId ?? ctx.companyId)
      const menuIds = ((body.menuIds as unknown[]) ?? []).map(Number)
      const saved = (await ctx.call(`/api/v1/${companyId}/configuration/company-menu`, { method: "PUT", body: { menuIds } })) as Rec
      const menus = (Array.isArray(saved?.menus) ? saved.menus : []) as Rec[]
      return {
        data: menus.filter((m) => m.isAvailable).map((m) => ({ menuId: m.menuId, organizationId: companyId, menu: { id: m.menuId, menuName: m.menuName } })),
        message: "Organization menus saved",
      }
    },
  },

  // --- access requests (O2S: /account/company-access-requests) ---
  {
    methods: ["POST"],
    match: /^\/api\/v1\/organization-access-requests$/,
    to: () => "/api/v1/account/company-access-requests",
    response: (data, ctx) => toAccessRequest(data as Rec, ctx),
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/organization-access-requests(?:\/(pending|mine))?$/,
    handle: async (m, ctx) => {
      const rows = (await ctx.call(`/api/v1/account/company-access-requests/${m[1] ?? "mine"}`)) as Rec[]
      return { data: rows.map((r) => toAccessRequest(r, ctx)) }
    },
  },
  {
    methods: ["POST", "PATCH"],
    match: /^\/api\/v1\/organization-access-requests\/([^/]+)\/(approve|reject|cancel)$/,
    handle: async (m, ctx) => {
      const stored = await findAccessRequest(ctx, m[1])
      const body = (ctx.body ?? {}) as Rec
      const assignments = ((body.assignments as Rec[]) ?? []).map((a) => ({ companyId: String(a.organizationId ?? a.companyId), role: a.role ?? "user" }))
      const saved = (await ctx.call(`/api/v1/account/company-access-requests/${m[1]}/${m[2]}`, {
        method: "POST",
        body: { assignments, reviewNote: body.reviewNote ?? null, rowVersion: stored.rowVersion },
      })) as Rec
      return { data: toAccessRequest(saved ?? stored, ctx) }
    },
  },

  // --- audit log (every module's screen: O2S keeps one log, filtered by moduleName) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/audit-log$/,
    handle: async (_m, ctx) => {
      const q = new URLSearchParams()
      ctx.query.forEach((value, key) => {
        if (!value) return
        if (key === "page") q.set("pageNumber", value)
        else if (key === "limit") q.set("pageSize", value)
        else q.set(key, value)
      })
      const page = (await ctx.call(companyPath(ctx, `/support/audit-log/paginated-list?${q}`))) as Rec
      return { data: auditFeed(page, ctx.query) }
    },
  },
  {
    methods: ["DELETE"],
    match: /^\/api\/v1\/audit-log\/(selected|all)$/,
    handle: async (m, ctx) => {
      const moduleName = ctx.query.get("moduleName")
      const query = m[1] === "all" && moduleName ? `?moduleName=${encodeURIComponent(moduleName)}` : ""
      const result = await ctx.call(companyPath(ctx, `/support/audit-log/${m[1]}${query}`), {
        method: "DELETE",
        body: m[1] === "selected" ? { ids: ((ctx.body as Rec)?.ids as unknown[] ?? []).map(Number) } : undefined,
      })
      return { data: isRecord(result) ? result : { deleted: result } }
    },
  },
]

// Records shown by other modules use the same audit names.
export { withAuditNames, pageOf }
