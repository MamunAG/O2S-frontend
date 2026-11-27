"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, Loader2, LogOut } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  clearAuthSessionCookie,
  clearAuthUserAvatarCookie,
  clearAuthUserLabelCookie,
  clearStoredAuthSession,
  markPasswordChangeRequired,
  serializeAuthSessionCookie,
} from "@/lib/auth-session"

import { setNewPassword } from "./set-password.service"

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">
        {label}
      </label>
      <Input
        id={id}
        type="password"
        required
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl"
      />
    </div>
  )
}

/**
 * After a login with a one-time password (User Setup) the user must choose their own password here; the backend
 * refuses everything else until they have. Signing out is the only other way off this page.
 */
export function SetPasswordPage() {
  const router = useRouter()
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPasswordValue] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    // Not signed in: nothing to change.
    if (!window.localStorage.getItem("access_token")) router.replace("/sign-in")
  }, [router])

  function logout() {
    clearStoredAuthSession()
    document.cookie = clearAuthSessionCookie()
    document.cookie = clearAuthUserLabelCookie()
    document.cookie = clearAuthUserAvatarCookie()
    window.location.replace("/sign-in")
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (newPassword !== confirmPassword) {
      setError("The new password and its confirmation must match.")
      return
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password, different from the one-time password.")
      return
    }
    const accessToken = window.localStorage.getItem("access_token")
    if (!accessToken) {
      router.replace("/sign-in")
      return
    }

    setSaving(true)
    try {
      const session = await setNewPassword({ apiUrl, accessToken, currentPassword, newPassword })
      if (session.access_token) window.localStorage.setItem("access_token", session.access_token)
      if (session.user) window.localStorage.setItem("auth_user", JSON.stringify(session.user))
      document.cookie = serializeAuthSessionCookie()
      markPasswordChangeRequired(false)
      toast.success("Your new password is set.")
      router.replace("/")
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to set the new password right now."
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(180deg,_#faf7ff_0%,_#f8fafc_48%,_#ffffff_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.28),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.22),_transparent_28%),linear-gradient(180deg,_#09090b_0%,_#111827_48%,_#020617_100%)] dark:text-slate-100">
      <div className="mx-auto flex min-h-svh w-full max-w-md items-center px-4 py-10">
        <section className="w-full rounded-3xl border border-white/60 bg-white/85 p-6 shadow-[0_20px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-950/75 sm:p-8">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
            <KeyRound className="size-5" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Set your new password</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            You signed in with a one-time password from your organization admin. Choose your own password to continue.
          </p>
          <p lang="bn" className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            অ্যাডমিনের দেওয়া এককালীন পাসওয়ার্ড দিয়ে লগইন করেছেন। চালিয়ে যেতে নিজের একটি নতুন পাসওয়ার্ড দিন।
          </p>

          <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
            <Field id="currentPassword" label="One-time password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <Field id="newPassword" label="New password" value={newPassword} onChange={setNewPasswordValue} autoComplete="new-password" />
            <Field id="confirmPassword" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              At least 6 characters, with an upper-case letter, a lower-case letter, a digit and a symbol.
            </p>
            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">{error}</p>
            ) : null}
            <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Set password and continue
            </Button>
          </form>

          <Button type="button" variant="ghost" className="mt-3 w-full rounded-xl text-slate-600 dark:text-slate-300" onClick={logout}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </section>
      </div>
    </main>
  )
}
