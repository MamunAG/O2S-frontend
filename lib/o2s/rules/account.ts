// Step 1: sign-in and account flows, the user's own profile, organizations (O2S companies), the current
// user's menu permissions, notifications and file uploads.

import { apiBase, companyPath, isRecord, type O2sContext, type O2sRule } from "../adapter"
import { fromO2sMenuName, fromO2sModuleName, toO2sMenuName } from "../menus"

type Rec = Record<string, unknown>

// ---------- users ----------

/** O2S account DTO (login answer or UserDto) -> code-crafter's user record (snake_case). */
export function toCodeCrafterUser(u: Rec): Rec {
  const name = (u.fullName as string) || [u.firstName, u.lastName].filter(Boolean).join(" ") || (u.userName as string) || ""
  const roles = Array.isArray(u.roles) ? (u.roles as string[]) : []
  const role = (u.role as string) || (roles.includes("admin") ? "admin" : "user")
  const pictureId = u.profilePictureFileId as number | null | undefined
  return {
    id: u.id ?? u.userId,
    name,
    display_name: name,
    user_name: u.userName,
    email: u.email ?? (typeof u.userName === "string" && u.userName.includes("@") ? u.userName : undefined),
    recovery_email: u.recoveryEmail ?? null,
    phone_no: u.phoneNumber ?? undefined,
    date_of_birth: typeof u.dateOfBirth === "string" ? u.dateOfBirth.slice(0, 10) : undefined,
    gender: u.gender ?? undefined,
    bio: u.bio ?? undefined,
    role,
    status: u.isActive === false ? "inactive" : "active",
    is_email_verified: u.emailConfirmed,
    is_enable_notifications: u.isEnableNotifications,
    last_seen_at: u.lastSeenAt,
    created_at: u.createdDate,
    updated_at: u.updatedDate,
    deleted_at: u.deletedDate,
    profile_pic_id: pictureId ?? null,
    profile_pic: pictureId ? fileRecord(pictureId, null) : null,
  }
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") || null }
}

/** code-crafter profile / register fields -> O2S UserDto fields (only those sent). */
function toO2sUserFields(body: Rec): Rec {
  const out: Rec = {}
  if (typeof body.name === "string") Object.assign(out, splitName(body.name))
  if ("user_name" in body) out.userName = body.user_name
  if ("email" in body) out.email = body.email
  if ("phone_no" in body) out.phoneNumber = body.phone_no || null
  if ("date_of_birth" in body) out.dateOfBirth = body.date_of_birth || null
  if ("gender" in body) out.gender = body.gender || null
  if ("bio" in body) out.bio = body.bio || null
  if ("is_enable_notifications" in body) out.isEnableNotifications = body.is_enable_notifications
  if ("profile_pic_id" in body) out.profilePictureFileId = body.profile_pic_id ? Number(body.profile_pic_id) : null
  if ("password" in body) out.password = body.password
  return out
}

// ---------- files ----------

/** An O2S file attachment as code-crafter's file record. Images are viewed through /support/file/{id}/view. */
function fileRecord(id: unknown, file: Rec | null, companyId?: string): Rec {
  const view = companyId ? `${apiBase()}/api/v1/${companyId}/support/file/${id}/view` : ""
  return {
    success: true,
    id,
    file_id: id,
    file_url: view,
    public_url: view,
    thumbnail_url: view,
    original_name: file?.fileName,
    file_name: file?.fileName,
    file_size: file?.sizeBytes,
    mime_type: file?.contentType,
    file_type: file?.contentType,
    uploaded_at: file?.createdDate,
  }
}

// ---------- companies ----------

function toOrganization(c: Rec): Rec {
  // /account/companies rows (CompanyUserDto) or Company rows (CompanyDto).
  if ("companyId" in c && "companyName" in c) {
    return { id: c.companyId, name: c.companyName, isActive: c.isCompanyActive, isDefault: c.isDefault, role: c.role }
  }
  return { id: c.id, name: c.name, address: c.address ?? null, contact: c.phone ?? c.email ?? null, isActive: c.isActive }
}

function toO2sCompany(body: Rec): Rec {
  return {
    name: body.name,
    address: body.address || null,
    phone: body.contact || null,
    isActive: body.isActive ?? true,
  }
}

// ---------- menu permissions ----------

function toPermissionRecord(p: Rec, ctx: O2sContext, menuName?: string): Rec {
  return {
    id: `${p.menuId}`,
    organizationId: ctx.companyId,
    userId: ctx.userId,
    menuId: p.menuId,
    canView: p.isAccess === true,
    canCreate: p.isInsert === true,
    canUpdate: p.isUpdate === true,
    canDelete: p.isDelete === true,
    menu: {
      id: p.menuId,
      menuName: menuName ?? p.menuName,
      menuPath: p.menuPath ?? null,
      moduleId: p.moduleId,
      moduleEntry: { id: p.moduleId, moduleName: fromO2sModuleName(p.moduleName as string), moduleKey: p.moduleName },
      displayOrder: p.menuSerialNo ?? 0,
      isActive: true,
    },
  }
}

/** The current user's menus, one record per code-crafter name each O2S menu stands for. */
async function currentPermissions(ctx: O2sContext, menuName?: string) {
  const query = menuName ? `?menuName=${encodeURIComponent(toO2sMenuName(menuName))}` : ""
  const rows = (await ctx.call(companyPath(ctx, `/configuration/user-menu-permission/current${query}`))) as Rec[]
  return rows.flatMap((p) => fromO2sMenuName(p.menuName as string).map((name) => toPermissionRecord(p, ctx, name)))
}

const NO_PERMISSION = (ctx: O2sContext, menuName: string): Rec => ({
  id: "",
  organizationId: ctx.companyId,
  userId: ctx.userId,
  menuId: "",
  canView: false,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  menu: { id: "", menuName, moduleId: "", displayOrder: 0, isActive: true },
})

// ---------- notifications ----------

function toNotification(n: Rec, ctx: O2sContext): Rec {
  return { ...n, userId: ctx.userId, readAt: n.readDate ?? null, created_at: n.createdDate }
}

export const accountRules: O2sRule[] = [
  // --- sign-in and anonymous account flows ---
  {
    methods: ["POST"],
    match: /^\/api\/v1\/auth\/login$/,
    to: () => "/api/v1/account/login",
    request: (body) => ({ userName: (body as Rec).email ?? (body as Rec).user_name, password: (body as Rec).password }),
    response: (data) => {
      const d = data as Rec
      return { access_token: d.token, refresh_token: d.refreshToken, user: toCodeCrafterUser(d) }
    },
  },
  {
    methods: ["POST"],
    match: /^\/api\/v1\/auth\/register$/,
    to: () => "/api/v1/account/register",
    request: (body) => toO2sUserFields(body as Rec),
    response: (data) => toCodeCrafterUser(data as Rec),
  },
  {
    methods: ["POST"],
    match: /^\/api\/v1\/auth\/(refresh|logout|forgot-password|verify-reset-code|reset-password|resend-confirm-email|confirm-email)$/,
    to: (m) => `/api/v1/account/${m[1]}`,
    request: (body) => {
      const b = body as Rec
      return { ...b, refreshToken: b.refreshToken ?? b.refresh_token }
    },
    response: (data) => {
      // code-crafter answered forgot / resend with the code's lifetime.
      if (isRecord(data) && typeof data.token === "string") {
        return { access_token: data.token, refresh_token: data.refreshToken }
      }
      return data ?? { expires_in_seconds: 15 * 60 }
    },
  },

  // --- the signed-in user's own profile (code-crafter: /users/{id}) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/users\/([^/]+)$/,
    to: () => "/api/v1/account/profile",
    response: (data) => toCodeCrafterUser(data as Rec),
  },
  {
    methods: ["PATCH", "PUT"],
    match: /^\/api\/v1\/users\/([^/]+)$/,
    handle: async (_m, ctx) => {
      // O2S replaces the profile fields: start from the stored profile, apply what the screen changed.
      const current = (await ctx.call("/api/v1/account/profile")) as Rec
      const saved = (await ctx.call("/api/v1/account/profile", {
        method: "PUT",
        body: { ...current, ...toO2sUserFields(ctx.body as Rec) },
      })) as Rec
      return { data: toCodeCrafterUser(saved ?? current), message: "Profile updated successfully" }
    },
  },
  {
    match: /^\/api\/v1\/users\/([^/]+)\/recovery-email$/,
    to: () => "/api/v1/account/recovery-email",
    method: "PUT",
    request: (body) => ({ recoveryEmail: (body as Rec).recovery_email ?? null }),
  },

  // --- organizations = O2S companies ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/user-to-oranization-map\/me\/organizations$/,
    to: () => "/api/v1/account/companies",
    response: (data) => (Array.isArray(data) ? data.map((c) => toOrganization(c as Rec)) : data),
  },
  {
    match: /^\/api\/v1\/user-to-oranization-map\/mapping\/([^/]+)\/([^/]+)\/default$/,
    to: (m) => `/api/v1/account/companies/${m[2]}/default`,
    method: "PUT",
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/organization$/,
    to: (_m, ctx) => companyPath(ctx, "/configuration/company/paginated-list"),
    query: (q) => {
      q.set("pageSize", q.get("pageSize") ?? "500")
      const search = q.get("search")
      if (search) {
        q.delete("search")
        q.set("name", search)
      }
    },
    response: (data) => {
      const items = isRecord(data) && Array.isArray(data.items) ? data.items : data
      return Array.isArray(items) ? items.map((c) => toOrganization(c as Rec)) : data
    },
  },
  {
    methods: ["GET"],
    match: /^\/api\/v1\/organization\/([^/]+)$/,
    to: (m, ctx) => companyPath(ctx, `/configuration/company/${m[1]}`),
    response: (data) => toOrganization(data as Rec),
  },
  {
    methods: ["POST"],
    match: /^\/api\/v1\/organization$/,
    // A first company can be created before any is selected.
    to: (_m, ctx) => `/api/v1/${encodeURIComponent(ctx.companyId || "0")}/configuration/company`,
    request: (body) => toO2sCompany(body as Rec),
    response: (data) => toOrganization(data as Rec),
  },
  {
    methods: ["PATCH", "PUT"],
    match: /^\/api\/v1\/organization\/([^/]+)$/,
    handle: async (m, ctx) => {
      const path = companyPath(ctx, `/configuration/company/${m[1]}`)
      const current = (await ctx.call(path)) as Rec
      await ctx.call(path, { method: "PUT", body: { ...current, ...toO2sCompany({ ...toOrganization(current), ...(ctx.body as Rec) }) } })
      return { data: toOrganization((await ctx.call(path)) as Rec), message: "Organization updated successfully" }
    },
  },
  {
    methods: ["DELETE"],
    match: /^\/api\/v1\/organization\/([^/]+)$/,
    to: (m, ctx) => companyPath(ctx, `/configuration/company/${m[1]}`),
  },

  // --- the current user's menu permissions (sidebar and each screen's check) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/menu-permission\/current$/,
    handle: async (_m, ctx) => {
      const menuName = ctx.query.get("menuName")?.trim() ?? ""
      const menuPath = ctx.query.get("menuPath")?.trim() ?? ""
      const rows = await currentPermissions(ctx, menuName || undefined)
      const found = menuName
        ? rows.find((r) => ((r.menu as Rec).menuName as string).toLowerCase() === menuName.toLowerCase()) ?? rows[0]
        : rows.find((r) => (r.menu as Rec).menuPath === menuPath)
      return { data: found ?? NO_PERMISSION(ctx, menuName) }
    },
  },
  {
    // Without a userId, or for oneself: the sidebar's list. Another user's grants: the IAM screen (step 2).
    methods: ["GET"],
    match: /^\/api\/v1\/menu-permission$/,
    handle: async (_m, ctx) => {
      const userId = ctx.query.get("userId")
      if (userId && userId !== ctx.userId) {
        const rows = (await ctx.call(companyPath(ctx, `/configuration/user-menu-permission/user/${encodeURIComponent(userId)}`))) as Rec[]
        return {
          data: rows
            .filter((p) => p.isAccess || p.isInsert || p.isUpdate || p.isDelete)
            .flatMap((p) => fromO2sMenuName(p.menuName as string).map((name) => ({ ...toPermissionRecord(p, ctx, name), userId }))),
        }
      }
      return { data: await currentPermissions(ctx) }
    },
  },

  // --- notifications (the same routes in O2S) ---
  {
    methods: ["GET"],
    match: /^\/api\/v1\/notifications$/,
    response: (data, ctx) => (isRecord(data) && Array.isArray(data.items) ? { ...data, items: data.items.map((n) => toNotification(n as Rec, ctx)) } : data),
  },

  // --- uploads: an O2S file of the selected company ---
  {
    methods: ["POST"],
    match: /^\/api\/v1\/files\/upload$/,
    to: (_m, ctx) => companyPath(ctx, "/support/file"),
    request: (body) => {
      // O2S reads the form field "file".
      if (!(body instanceof FormData)) return body
      const out = new FormData()
      body.forEach((value, key) => out.append(key === "files" ? "file" : key, value))
      return out
    },
    response: (data) => {
      const d = data as Rec
      return fileRecord(d.id, d, String(d.companyId ?? ""))
    },
  },
]
