export type AuthUser = {
  id?: string
  email?: string
  name?: string
  role?: string
  user_name?: string
  display_name?: string
  avatar?: string
  avatar_url?: string
  image?: string
  image_url?: string
  picture?: string
  photo_url?: string
  profile_image?: string
  profile_image_url?: string
  profile_pic?: {
    public_url?: string
    file_url?: string
    thumbnail_url?: string
  } | null
}

export const AUTH_COOKIE_NAME = "auth_session"
export const AUTH_USER_LABEL_COOKIE_NAME = "auth_user_label"
export const AUTH_USER_AVATAR_COOKIE_NAME = "auth_user_avatar"
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function clearStoredAuthSession() {
  window.localStorage.removeItem("access_token")
  window.localStorage.removeItem("refresh_token")
  window.localStorage.removeItem("auth_user")
}

export function getAuthUserLabel(user: AuthUser | null | undefined, fallback = "User") {
  if (!user) {
    return fallback
  }

  return (
    user.display_name ||
    user.name ||
    user.user_name ||
    user.email ||
    fallback
  )
}

export function getAuthUserImageUrl(user: AuthUser | null | undefined) {
  if (!user) {
    return ""
  }

  return (
    user.avatar ||
    user.avatar_url ||
    user.image ||
    user.image_url ||
    user.picture ||
    user.photo_url ||
    user.profile_image ||
    user.profile_image_url ||
    user.profile_pic?.public_url ||
    user.profile_pic?.file_url ||
    user.profile_pic?.thumbnail_url ||
    ""
  )
}

export function getAuthInitials(label: string) {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    return "U"
  }

  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase()
  }

  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
}

export function parseStoredAuthUser(rawUser: string | null) {
  if (!rawUser) {
    return null
  }

  try {
    return JSON.parse(rawUser) as AuthUser
  } catch {
    return null
  }
}

export function isGlobalAdmin(user: AuthUser | null | undefined) {
  return user?.role === "admin"
}

export function serializeAuthSessionCookie() {
  return `${AUTH_COOKIE_NAME}=1; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

export function serializeAuthUserLabelCookie(label: string) {
  return `${AUTH_USER_LABEL_COOKIE_NAME}=${encodeURIComponent(label)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

export function serializeAuthUserAvatarCookie(value: string) {
  return `${AUTH_USER_AVATAR_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${AUTH_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
}

export function clearAuthSessionCookie() {
  return `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

export function clearAuthUserLabelCookie() {
  return `${AUTH_USER_LABEL_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

export function clearAuthUserAvatarCookie() {
  return `${AUTH_USER_AVATAR_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
}

/** sessionStorage key: the page the session ended on, opened again after sign-in (lib/return-path.ts). */
export const RETURN_PATH_KEY = "o2s_return_path"

/** Pages that are never a place to come back to. */
export const AUTH_PAGES = ["/sign-in", "/login", "/register", "/forgot-password", "/confirm-email"]

/** Remembers the current page, to open it again after the next sign-in. */
export function rememberReturnPath() {
  if (typeof window === "undefined") return
  const { pathname, search, hash } = window.location
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return
  try {
    window.sessionStorage.setItem(RETURN_PATH_KEY, `${pathname}${search}${hash}`)
  } catch {
    // storage blocked: the user lands on the home page
  }
}

/** sessionStorage flag: the sign-in page tells the user their session expired. */
export const SESSION_EXPIRED_FLAG = "o2s_session_expired"

let endingSession = false

/**
 * The session is over (the API refused the token and it could not be refreshed): forget the stored tokens and the
 * login cookies, then go to the sign-in page. Tokens first: the sign-in page sends anyone with a stored token home, and
 * the middleware sends /sign-in home while the auth_session cookie is set. Safe to call many times.
 */
export function endSession() {
  if (typeof window === "undefined" || endingSession) return
  endingSession = true
  clearStoredAuthSession()
  document.cookie = clearAuthSessionCookie()
  document.cookie = clearAuthUserLabelCookie()
  document.cookie = clearAuthUserAvatarCookie()
  if (window.location.pathname.startsWith("/sign-in")) {
    endingSession = false
    return
  }
  rememberReturnPath()
  try {
    window.sessionStorage.setItem(SESSION_EXPIRED_FLAG, "1")
  } catch {
    // private mode: the sign-in page just won't say why
  }
  window.location.replace("/sign-in")
}

export function readAuthUserLabelCookie(value: string | undefined | null) {
  if (!value) {
    return "User"
  }

  try {
    return decodeURIComponent(value).trim() || "User"
  } catch {
    return value.trim() || "User"
  }
}

export function readAuthUserAvatarCookie(value: string | undefined | null) {
  if (!value) {
    return ""
  }

  try {
    return decodeURIComponent(value).trim()
  } catch {
    return value.trim()
  }
}
