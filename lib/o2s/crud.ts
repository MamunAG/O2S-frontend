// A code-crafter CRUD resource (`/api/v1/<resource>`) on an O2S slice (`/api/v1/{organizationId}<o2sPath>`):
//   GET    /<resource>                -> GET /paginated-list   (deletedOnly=true -> the soft-deleted rows)
//   GET    /<resource>/{id}           -> GET /{id}
//   POST   /<resource>                -> POST /
//   PATCH  /<resource>/{id}           -> GET /{id}, merge, PUT /{id}   (O2S replaces the whole record)
//   DELETE /<resource>/{id}           -> DELETE /{id}              (O2S marks the row deleted)
//   DELETE /<resource>/{id}/permanent -> DELETE /{id}/permanent    (a deleted row gone for good)
//   POST   /<resource>/{id}/restore   -> POST /{id}/restore
//   POST   /<resource>/upload, GET /template/upload -> a clear "not in O2S" error
// Every record gets code-crafter's audit names (created_at, created_by_user, organizationId, ...).

import { organizationPath, isRecord, mapItems, O2sError, singularNavs, type O2sContext, type O2sRule } from "./adapter"

type Rec = Record<string, unknown>

export type CrudOptions = {
  /** O2S → screen, per record (after the audit names are added). */
  fromO2s?: (record: Rec, ctx: O2sContext) => Rec
  /** Screen → O2S, per body. On PATCH `stored` is the O2S record being changed (also the merge base). */
  toO2s?: (body: Rec, ctx: O2sContext, stored?: Rec) => Rec
  /** Renames the list's query keys (screen name -> O2S name). */
  queryNames?: Record<string, string>
  /** Extra rules for this resource, tried before the CRUD ones. */
  extra?: O2sRule[]
  /** The record's name in messages ("This buyer"). */
  label?: string
}

/** Audit and ownership names code-crafter's records carried. */
export function withAuditNames(r: Rec): Rec {
  return {
    ...r,
    organizationId: r.organizationId ?? r.organizationId,
    created_by_id: r.createdBy ?? null,
    updated_by_id: r.updatedBy ?? null,
    created_by_user: r.createdBy ? { id: r.createdBy, name: r.createdByName ?? r.createdBy } : null,
    updated_by_user: r.updatedBy ? { id: r.updatedBy, name: r.updatedByName ?? r.updatedBy } : null,
    created_at: r.createdDate ?? r.created_at ?? null,
    updated_at: r.updatedDate ?? r.updated_at ?? null,
    deleted_at: r.deletedDate ?? null,
    deleted_by_id: r.deletedBy ?? null,
    deleted_by_user: r.deletedBy ? { id: r.deletedBy, name: r.deletedByName ?? r.deletedBy } : null,
  }
}

export function crudRules(resource: string, o2sPath: string, options: CrudOptions = {}): O2sRule[] {
  const esc = resource.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  const base = new RegExp(`^/api/v1/${esc}$`)
  const one = new RegExp(`^/api/v1/${esc}/([^/]+)$`)
  const from = (data: unknown, ctx: O2sContext) =>
    mapItems(data, (r) => {
      const record = singularNavs(withAuditNames(r)) as Rec
      return options.fromO2s ? options.fromO2s(record, ctx) : record
    })
  const to = (body: unknown, ctx: O2sContext, stored?: Rec) =>
    isRecord(body) && options.toO2s ? options.toO2s(body, ctx, stored) : body

  return [
    ...(options.extra ?? []),
    {
      match: new RegExp(`^/api/v1/${esc}/(template/upload|upload)$`),
      handle: async () => {
        throw new O2sError(`Excel upload is not available for this screen in O2S yet. Add the records one by one.`, 400)
      },
    },
    {
      methods: ["POST"],
      match: new RegExp(`^/api/v1/${esc}/([^/]+)/restore$`),
      to: (m, ctx) => organizationPath(ctx, `${o2sPath}/${m[1]}/restore`),
      method: "POST",
      response: () => ({ restored: true }),
    },
    {
      methods: ["DELETE"],
      match: new RegExp(`^/api/v1/${esc}/([^/]+)/permanent$`),
      to: (m, ctx) => organizationPath(ctx, `${o2sPath}/${m[1]}/permanent`),
      response: () => ({ deleted: true }),
    },
    { methods: ["GET"], match: base, handle: crudListHandler(o2sPath, options) },
    {
      methods: ["GET"],
      match: one,
      to: (m, ctx) => organizationPath(ctx, `${o2sPath}/${m[1]}`),
      response: (data, ctx) => from(data, ctx),
    },
    {
      methods: ["POST"],
      match: base,
      to: (_m, ctx) => organizationPath(ctx, o2sPath),
      request: (body, ctx) => to(body, ctx),
      response: (data, ctx) => from(data, ctx),
    },
    {
      methods: ["PATCH", "PUT"],
      match: one,
      handle: async (m, ctx) => {
        const path = organizationPath(ctx, `${o2sPath}/${m[1]}`)
        const stored = (await ctx.call(path)) as Rec
        const changes = to(ctx.body, ctx, stored) as Rec
        await ctx.call(path, { method: "PUT", body: { ...stored, ...changes } })
        return { data: from(await ctx.call(path), ctx), message: "Saved successfully" }
      },
    },
    {
      methods: ["DELETE"],
      match: one,
      to: (m, ctx) => organizationPath(ctx, `${o2sPath}/${m[1]}`),
      response: () => ({ deleted: true }),
    },
  ]
}

/** GET /<resource>: the O2S paginated list with the screen's filters, as `{ items, meta }`. */
export function crudListHandler(o2sPath: string, options: CrudOptions = {}): NonNullable<O2sRule["handle"]> {
  return async (_m, ctx) => {
    const q = new URLSearchParams()
    if (ctx.query.get("deletedOnly") === "true") q.set("deletedOnly", "true")
    ctx.query.forEach((value, key) => {
      if (key === "deletedOnly" || key === "organizationId" || value === "" || value === "all") return
      if (key === "page") q.set("pageNumber", value)
      else if (key === "limit") q.set("pageSize", value)
      else q.set(options.queryNames?.[key] ?? key, value)
    })
    if (!q.has("pageSize")) q.set("pageSize", "1000")
    const data = await ctx.call(organizationPath(ctx, `${o2sPath}/paginated-list?${q}`))
    const page = pageOf(data, ctx.query)
    return {
      data: mapItems(page, (r) => {
        const record = singularNavs(withAuditNames(r)) as Rec
        return options.fromO2s ? options.fromO2s(record, ctx) : record
      }),
    }
  }
}

/** An O2S page (or a plain list) as code-crafter's `{ items, meta }`. */
export function pageOf(data: unknown, q: URLSearchParams): Rec {
  if (isRecord(data) && Array.isArray(data.data) && typeof data.totalItems === "number") {
    const limit = (data.pageSize as number) || Number(q.get("limit") ?? 0) || (data.data as unknown[]).length || 1
    const page = (data.pageNumber as number) || Number(q.get("page") ?? 1) || 1
    const totalPages = (data.totalPages as number) || Math.ceil((data.totalItems as number) / limit)
    return {
      items: data.data,
      meta: { total: data.totalItems, page, limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    }
  }
  const items = Array.isArray(data) ? data : []
  return { items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1, hasNextPage: false, hasPreviousPage: false } }
}
