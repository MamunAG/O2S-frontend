// Step 4: HR & payroll. O2S kept code-crafter's HR routes and field names, under /api/v1/{organizationId}/hr, so most
// calls only gain the organization; the differences are handled here: list routes (/paginated-list), singular
// shift / roster routes, master-data kinds (plural there, singular here), payroll's paid-status and job
// status (O2S calculates in the request, so there is no job to poll).

import { organizationPath, isRecord, O2sError, type O2sRule } from "../adapter"
import { crudListHandler, crudRules } from "../crud"

type Rec = Record<string, unknown>

/** code-crafter master-data path -> O2S resource ("leave-policies" -> "leave-policy"). */
function masterDataResource(kind: string) {
  if (kind.endsWith("ies")) return `${kind.slice(0, -3)}y`
  return kind.endsWith("s") ? kind.slice(0, -1) : kind
}

/** A code-crafter route that answered a plain list (shifts): the O2S page's items. */
const asList: NonNullable<O2sRule["response"]> = (data) =>
  isRecord(data) && Array.isArray(data.items) ? data.items : data

export const hrRules: O2sRule[] = [
  // --- employees ---
  ...crudRules("hr/employee", "/hr/employee", { label: "This employee" }),

  // --- shifts and rosters (O2S: /hr/shift, /hr/roster) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/hr\/(shifts|rosters)$/,
    handle: async (m, ctx) => {
      const result = await crudListHandler(`/hr/${m[1].slice(0, -1)}`)(m, ctx)
      return { data: asList(result.data, ctx) }
    },
  },
  ...crudRules("hr/shifts", "/hr/shift", { label: "This shift" }),
  ...crudRules("hr/rosters", "/hr/roster", { label: "This roster" }),

  // --- HR master data (employment types, grades, ..., leave policies) ---
  {
    // Not in O2S: salary components are part of the salary structure there.
    match: /^\/api\/v1\/hr\/master-data\/salary-components(\/.*)?$/,
    handle: async (_m, ctx) => {
      if (ctx.method === "GET") {
        return { data: { items: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0, hasNextPage: false, hasPreviousPage: false } } }
      }
      throw new O2sError("Salary components are set on the salary structure in O2S.", 400)
    },
  },
  {
    match: /^\/api\/v1\/hr\/master-data\/([a-z-]+)(\/.*)?$/,
    handle: async (m, ctx) => {
      // Re-run as a CRUD resource on the O2S kind (query name `search` -> `name`).
      const resource = masterDataResource(m[1])
      const rules = crudRules(`hr/master-data/${m[1]}`, `/hr/${resource}`, { queryNames: { search: "name" }, label: "This record" })
      const rule = rules.find((r) => (!r.methods || r.methods.includes(ctx.method)) && r.match.test(ctx.url.pathname))
      if (!rule) throw new O2sError("Not found.", 404)
      const match = ctx.url.pathname.match(rule.match)!
      if (rule.handle) return rule.handle(match, ctx)
      // A plain mapped call (get one / create / delete).
      const path = rule.to!(match, ctx)
      const body = rule.request ? await rule.request(ctx.body, ctx) : ctx.body
      const data = await ctx.call(path, { method: typeof rule.method === "string" ? rule.method : ctx.method, body: ctx.method === "GET" || ctx.method === "DELETE" ? undefined : body })
      return { data: rule.response ? rule.response(data, ctx) : data }
    },
  },

  // --- leave: the list route ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/hr\/leave$/,
    to: (_m, ctx) => organizationPath(ctx, "/hr/leave/paginated-list"),
  },

  // --- payroll ---
  {
    methods: ["POST"],
    match: /^\/api\/v1\/hr\/payroll-runs\/([^/]+)\/paid-status\/([^/]+)$/,
    handle: async (m, ctx) => {
      const run = (await ctx.call(organizationPath(ctx, `/hr/payroll-runs/${m[1]}`))) as Rec
      const data = await ctx.call(organizationPath(ctx, `/hr/payroll-runs/${m[1]}/paid-status`), {
        method: "POST",
        body: { status: decodeURIComponent(m[2]), rowVersion: run.rowVersion ?? 0 },
      })
      return { data }
    },
  },
  {
    // A run's transition sends the version the screen read; when it does not, use the stored one.
    methods: ["POST"],
    match: /^\/api\/v1\/hr\/payroll-runs\/([^/]+)\/(calculate|submit-review|approve|lock|reject|reverse)$/,
    handle: async (m, ctx) => {
      const body = isRecord(ctx.body) ? ctx.body : {}
      let rowVersion = body.rowVersion
      if (rowVersion === undefined) rowVersion = ((await ctx.call(organizationPath(ctx, `/hr/payroll-runs/${m[1]}`))) as Rec).rowVersion
      const data = await ctx.call(organizationPath(ctx, `/hr/payroll-runs/${m[1]}/${m[2]}`), { method: "POST", body: { ...body, rowVersion } })
      return { data }
    },
  },
  {
    // O2S calculates in the request: a "job" is always finished.
    methods: ["GET"],
    match: /^\/api\/v1\/hr\/payroll-runs\/jobs\/([^/]+)\/status$/,
    handle: async (m) => ({ data: { id: m[1], status: "COMPLETED", progress: 100, result: null, error: null } }),
  },

  // --- reports, payslips and imports: files pass through ---
  { methods: ["GET"], match: /^\/api\/v1\/hr\/(reports\/[^/]+|payslips\/.+|imports\/templates\/.+)$/, to: (m, ctx) => organizationPath(ctx, `/hr/${m[1]}`), file: true },

  // --- everything else under /hr: the same route in the organization ---
  { match: /^\/api\/v1\/hr\/(.+)$/, to: (m, ctx) => organizationPath(ctx, `/hr/${m[1]}`) },
]
