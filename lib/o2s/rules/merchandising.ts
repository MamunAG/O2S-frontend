// Step 3: Merchandising — the masters (buyer, color, size, embellishment, fabric process, GMT cost scope,
// TNA task), style, job (with its PO tools and AI Assist), order placement, fabric costing and TNA.

import { companyPath, isRecord, type O2sContext, type O2sRule } from "../adapter"
import { crudListHandler, crudRules } from "../crud"

type Rec = Record<string, unknown>
const MERCH = "/merchandising"

const list = (value: unknown) => (Array.isArray(value) ? (value as Rec[]) : [])
const day = (value: unknown) => (typeof value === "string" ? value.slice(0, 10) : value ?? null)

/** Renames keys (from -> to) of a record; absent keys are skipped. */
function rename(r: Rec, names: Record<string, string>): Rec {
  const out: Rec = {}
  for (const [key, v] of Object.entries(r)) out[names[key] ?? key] = v
  return out
}

// ---------- style ----------

const styleFromO2s = (r: Rec): Rec => ({
  ...rename(r, { colorMaps: "styleToColorMaps", sizeMaps: "styleToSizeMaps", embellishmentMaps: "styleToEmbellishmentMaps" }),
  image: r.imageId ? { id: r.imageId } : null,
})

const styleToO2s = (b: Rec): Rec => {
  const out = rename(b, { styleToColorMaps: "colorMaps", styleToSizeMaps: "sizeMaps", styleToEmbellishmentMaps: "embellishmentMaps" })
  delete out.buyer
  delete out.currency
  delete out.image
  return out
}

// ---------- job ----------

const jobLineFromO2s = (d: Rec): Rec => ({
  ...rename(d, { cmPerDzn: "cm" }),
  purchaseOrder: { id: d.poId, pono: d.poNo },
  style: { id: d.styleId, styleNo: d.styleNo, styleName: d.styleName },
  deliveryDate: day(d.deliveryDate),
})

const jobFromO2s = (r: Rec): Rec => ({
  ...rename(r, { orderType: "ordertype", details: "jobDetails" }),
  merchandiser: r.merchandiserId ? { id: r.merchandiserId, name: r.merchandiserName } : null,
  poReceiveDate: day(r.poReceiveDate),
  jobDetails: list(r.details).map(jobLineFromO2s),
})

/**
 * The screens send lines without O2S ids (code-crafter matched them itself), and O2S deletes a stored line
 * that is not sent back. On an edit, each line takes the id of the stored line it matches, so lines other
 * documents refer to are kept.
 */
function keepLineIds(lines: Rec[], stored: Rec[] | undefined, key: (line: Rec) => string) {
  if (!stored?.length) return lines
  const free = new Map<string, Rec[]>()
  for (const s of stored) free.set(key(s), [...(free.get(key(s)) ?? []), s])
  return lines.map((line) => {
    if (line.id) return line
    const match = free.get(key(line))?.shift()
    return match ? { ...line, id: match.id } : line
  })
}

const jobLineKey = (d: Rec) =>
  [String(d.poNo ?? "").trim().toUpperCase(), d.styleId, d.sizeId, d.colorId].map(String).join("|")

const jobToO2s = (b: Rec, _ctx: O2sContext, stored?: Rec): Rec => {
  const out = rename(b, { ordertype: "orderType", jobDetails: "details" })
  if (Array.isArray(out.details)) {
    const lines = (out.details as Rec[]).map((d) => rename(d, { pono: "poNo", cm: "cmPerDzn" }))
    out.details = keepLineIds(lines, list(stored?.details), jobLineKey)
  }
  for (const key of ["factory", "buyer", "merchandiser"]) delete out[key]
  return out
}

/** An O2S job line from the PO upload as the job form's line values. */
const uploadRow = (d: Rec): Rec => ({
  pono: d.poNo ?? "",
  styleId: d.styleId,
  styleLabel: [d.styleNo, d.styleName].filter(Boolean).join(" - "),
  sizeId: d.sizeId,
  sizeLabel: isRecord(d.sizes) ? d.sizes.sizeName : "",
  colorId: d.colorId,
  colorLabel: isRecord(d.colors) ? (d.colors.colorDisplayName || d.colors.colorName) : "",
  quantity: String(d.quantity ?? 0),
  fob: String(d.fob ?? 0),
  cm: String(d.cmPerDzn ?? 0),
  deliveryDate: day(d.deliveryDate) ?? "",
  cuttingLimitPercentage: String(d.cuttingLimitPercentage ?? 0),
  remarks: d.remarks ?? "",
})

// ---------- order placement ----------

const placementLineFromO2s = (d: Rec): Rec => ({
  ...rename(d, { cmPerDzn: "cm" }),
  purchaseOrder: { id: d.poId, pono: d.poNo },
  style: { id: d.styleId, styleNo: d.styleNo },
  deliveryDate: day(d.deliveryDate),
  factoryShipmentDate: day(d.factoryShipmentDate),
})

const placementFromO2s = (r: Rec): Rec => ({
  ...rename(r, { details: "orderPlacementDetails", exchangeRateBdt: "exchangeRateBDT" }),
  job: { id: r.jobId, jobNo: r.jobNo },
  placementDate: day(r.placementDate),
  orderPlacementDetails: list(r.details).map(placementLineFromO2s),
})

const placementToO2s = (b: Rec, _ctx: O2sContext, stored?: Rec): Rec => {
  const out = rename(b, { orderPlacementDetails: "details", exchangeRateBDT: "exchangeRateBdt" })
  if (Array.isArray(out.details)) {
    const lines = (out.details as Rec[]).map((d) => rename(d, { cm: "cmPerDzn" }))
    out.details = keepLineIds(lines, list(stored?.details), (d) => String(d.jobDetailId ?? ""))
  }
  for (const key of ["buyer", "job", "currency", "factory"]) delete out[key]
  return out
}

// ---------- TNA ----------

const tnaFromO2s = (r: Rec): Rec => ({
  ...rename(r, { details: "tnaDetails" }),
  job: { id: r.jobId, jobNo: r.jobNo },
  tnaDetails: list(r.details).map((d) => ({
    ...d,
    task: { id: d.taskId, name: d.taskName },
    executionDate: day(d.executionDate),
    revisions: list(d.revisions).map((v) => ({
      ...v,
      previousExecutionDate: day(v.previousExecutionDate),
      newExecutionDate: day(v.newExecutionDate),
      created_at: v.createdDate,
      created_by_user: v.createdByName ? { name: v.createdByName } : null,
    })),
  })),
})

const tnaToO2s = (b: Rec): Rec => {
  const out = rename(b, { tnaDetails: "details" })
  if (Array.isArray(out.details)) {
    // code-crafter sent this edit's date changes as `revisions`; O2S takes them as `newRevisions`.
    out.details = (out.details as Rec[]).map(({ revisions, task: _t, ...d }) => {
      void _t
      return { ...d, newRevisions: list(revisions) }
    })
  }
  delete out.buyer
  delete out.job
  return out
}

const jobQuery = { pono: "poNo", ordertype: "orderType" }

export const merchandisingRules: O2sRule[] = [
  // --- masters ---
  ...crudRules("buyer", `${MERCH}/buyer`, { label: "This buyer" }),
  ...crudRules("color", `${MERCH}/color`, { label: "This color" }),
  ...crudRules("size", `${MERCH}/size`, { label: "This size" }),
  ...crudRules("embellishment", `${MERCH}/embellishment`, { label: "This embellishment" }),
  ...crudRules("fabric-process", `${MERCH}/fabric-process`, { label: "This fabric process" }),
  ...crudRules("gmt-cost-scope", `${MERCH}/gmt-cost-scope`, { label: "This cost scope", queryNames: { costName: "name" } }),
  ...crudRules("tna-task", `${MERCH}/tna-task`, { label: "This TNA task" }),

  // --- style ---
  ...crudRules("style", `${MERCH}/style`, { label: "This style", fromO2s: styleFromO2s, toO2s: styleToO2s }),

  // --- job ---
  ...crudRules("job", `${MERCH}/job`, {
    label: "This job",
    fromO2s: jobFromO2s,
    toO2s: jobToO2s,
    queryNames: jobQuery,
    extra: [
      {
        // O2S lists jobs without their lines; the grid shows each job's POs and line count, so a screen-sized
        // page (≤ 25 rows) reads each job's lines too.
        methods: ["GET"],
        match: /^\/api\/v1\/job$/,
        handle: async (m, ctx) => {
          const result = await crudListHandler(`${MERCH}/job`, { fromO2s: jobFromO2s, queryNames: jobQuery })(m, ctx)
          const page = result.data as Rec
          const items = list(page.items)
          if (items.length === 0 || items.length > 25) return result
          const full = await Promise.all(
            items.map((job) => ctx.call(companyPath(ctx, `${MERCH}/job/${job.id}`)).then((r) => jobFromO2s(r as Rec)).catch(() => job)),
          )
          return { data: { ...page, items: items.map((job, i) => ({ ...job, jobDetails: (full[i] as Rec).jobDetails ?? job.jobDetails })) } }
        },
      },
      {
        methods: ["GET"],
        match: /^\/api\/v1\/job\/next-number$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/job/next-document-number`),
        response: (data) => ({ jobNo: (data as Rec).DocumentNumber, jobSerial: (data as Rec).Serial }),
      },
      {
        methods: ["GET"],
        match: /^\/api\/v1\/job\/numbers-by-buyer$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/job/numbers-by-buyer`),
      },
      {
        methods: ["GET"],
        match: /^\/api\/v1\/job\/po-summary$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/job/po-summary`),
        query: (q) => {
          const pono = q.get("pono")
          q.delete("pono")
          if (pono) q.set("poNo", pono)
        },
        // O2S nests each line's columns under `row`.
        response: (data) => {
          const d = data as Rec
          return {
            ...d,
            groups: list(d.groups).map((g) => ({
              ...g,
              rows: list(g.rows).map((line) => ({ ...(line.row as Rec), totalFob: line.totalFob, totalCm: line.totalCm, deliveryDate: day((line.row as Rec)?.deliveryDate) })),
            })),
          }
        },
      },
      {
        methods: ["GET"],
        match: /^\/api\/v1\/job\/po-details\/template\/upload$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/job/po-details/template/upload`),
        file: true,
      },
      {
        methods: ["POST"],
        match: /^\/api\/v1\/job\/po-details\/upload$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/job/po-details/upload`),
        response: (data) => {
          const d = data as Rec
          return { ...d, rows: list(d.rows).map(uploadRow) }
        },
      },
      {
        methods: ["POST"],
        match: /^\/api\/v1\/job\/ai-assist(\/resolve-row)?$/,
        to: (m, ctx) => companyPath(ctx, `${MERCH}/job/ai-assist${m[1] ?? ""}`),
      },
    ],
  }),

  // --- order placement ---
  ...crudRules("order-placement", `${MERCH}/order-placement`, {
    label: "This order placement",
    fromO2s: placementFromO2s,
    toO2s: placementToO2s,
    extra: [
      {
        // code-crafter filtered by one day; O2S takes a from / to pair.
        methods: ["GET"],
        match: /^\/api\/v1\/order-placement$/,
        handle: async (_m, ctx: O2sContext) => {
          const q = new URLSearchParams(ctx.query)
          const date = q.get("placementDate")
          q.delete("placementDate")
          if (date) {
            const next = new Date(`${date}T00:00:00Z`)
            next.setUTCDate(next.getUTCDate() + 1)
            q.set("fromPlacementDate", date)
            q.set("toPlacementDate", next.toISOString().slice(0, 10))
          }
          return crudListHandler(`${MERCH}/order-placement`, { fromO2s: placementFromO2s })(_m, { ...ctx, query: q })
        },
      },
    ],
  }),

  // --- fabric costing (the nested names are made singular by the CRUD rule) ---
  ...crudRules("fabric-costing", `${MERCH}/fabric-costing`, { label: "This fabric costing" }),

  // --- TNA ---
  ...crudRules("tna", `${MERCH}/tna`, {
    label: "This TNA",
    fromO2s: tnaFromO2s,
    toO2s: tnaToO2s,
    extra: [
      {
        methods: ["GET"],
        match: /^\/api\/v1\/tna\/report$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/tna/report`),
        response: (data) => list(data).map((r) => tnaFromO2s(r)),
      },
      {
        methods: ["GET"],
        match: /^\/api\/v1\/tna\/report\/pdf$/,
        to: (_m, ctx) => companyPath(ctx, `${MERCH}/tna/report/pdf`),
        file: true,
      },
      {
        methods: ["GET"],
        match: /^\/api\/v1\/tna\/([^/]+)\/details\/([^/]+)\/revisions$/,
        to: (m, ctx) => companyPath(ctx, `${MERCH}/tna/${m[1]}/details/${m[2]}/revisions`),
      },
    ],
  }),
]
