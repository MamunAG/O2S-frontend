"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  clearAuthUserAvatarCookie,
  getAuthUserImageUrl,
  getAuthUserLabel,
  parseStoredAuthUser,
  SESSION_EXPIRED_FLAG,
  serializeAuthSessionCookie,
  serializeAuthUserAvatarCookie,
  serializeAuthUserLabelCookie,
} from "@/lib/auth-session"

import { LoginForm } from "./login-form"
import { LoginHero } from "./login-hero"

function hasStoredAuth() {
  if (typeof window === "undefined") {
    return false
  }

  const accessToken = window.localStorage.getItem("access_token")
  const refreshToken = window.localStorage.getItem("refresh_token")

  return Boolean(accessToken || refreshToken)
}

export function LoginPage() {
  const router = useRouter()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  useEffect(() => {
    if (!hasStoredAuth()) {
      // Sent here by endSession(): say why, once.
      try {
        if (window.sessionStorage.getItem(SESSION_EXPIRED_FLAG)) {
          window.sessionStorage.removeItem(SESSION_EXPIRED_FLAG)
          // after the layout's Toaster has mounted (this effect runs before the parent's)
          window.setTimeout(() => toast.warning("Your session expired. Please sign in again."), 0)
        }
      } catch {
        // storage blocked: nothing to say
      }
      return
    }

    const storedUser = parseStoredAuthUser(window.localStorage.getItem("auth_user"))
    const userLabel = getAuthUserLabel(storedUser)
    const userImageUrl = getAuthUserImageUrl(storedUser)

    document.cookie = serializeAuthSessionCookie()
    document.cookie = serializeAuthUserLabelCookie(userLabel)
    if (userImageUrl) {
      document.cookie = serializeAuthUserAvatarCookie(userImageUrl)
    } else {
      document.cookie = clearAuthUserAvatarCookie()
    }
    router.replace("/")
  }, [router])

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(180deg,_#faf7ff_0%,_#f8fafc_48%,_#ffffff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.28),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.22),_transparent_28%),linear-gradient(180deg,_#09090b_0%,_#111827_48%,_#020617_100%)] dark:text-slate-100">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl items-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="grid w-full gap-5 lg:gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <LoginHero />
          <LoginForm apiUrl={apiUrl} />
        </div>
      </div>
    </main>
  )
}
