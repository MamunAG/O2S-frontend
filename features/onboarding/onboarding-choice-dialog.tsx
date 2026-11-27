"use client"

import { ArrowRight, Building2, LogOut, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  clearAuthSessionCookie,
  clearAuthUserAvatarCookie,
  clearAuthUserLabelCookie,
  clearStoredAuthSession,
} from "@/lib/auth-session"

type OnboardingChoiceDialogProps = {
  open: boolean
  onCreateOrganization: () => void
  onRequestAccess: () => void
}

/** One choice of an onboarding dialog: a title in English and Bangla, what it does and the steps that follow. */
export function ChoiceCard({
  icon,
  title,
  banglaTitle,
  summary,
  steps,
  actionLabel,
  onAction,
  disabledNote,
}: {
  icon: React.ReactNode
  title: string
  banglaTitle: string
  summary: string
  steps: string[]
  actionLabel: string
  onAction: () => void
  /** When set, the card can't be chosen and this (Bangla) reason is shown instead of the action. */
  disabledNote?: string
}) {
  const disabled = Boolean(disabledNote)
  return (
    <button
      type="button"
      onClick={onAction}
      disabled={disabled}
      className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition enabled:hover:border-slate-900 enabled:hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:enabled:hover:border-white"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-950 dark:text-white">{title}</span>
          <span lang="bn" className="block text-sm text-slate-600 dark:text-slate-300">{banglaTitle}</span>
        </span>
      </div>
      <p lang="bn" className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{summary}</p>
      <ol lang="bn" className="mt-2 flex-1 space-y-1.5 text-xs leading-5 text-slate-600 dark:text-slate-300">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
              {["১", "২", "৩", "৪"][index]}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {disabledNote ? (
        <span lang="bn" className="mt-4 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          {disabledNote}
        </span>
      ) : (
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950 group-hover:gap-2.5 dark:text-white">
          {actionLabel}
          <ArrowRight className="size-3.5 transition-all" />
        </span>
      )}
    </button>
  )
}

/**
 * The first screen of an account with no organization: create one, or ask an existing organization's admin for
 * access. It can't be closed (an account works only inside an organization); Logout is the way out.
 */
export function OnboardingChoiceDialog({ open, onCreateOrganization, onRequestAccess }: OnboardingChoiceDialogProps) {
  function logout() {
    clearStoredAuthSession()
    document.cookie = clearAuthSessionCookie()
    document.cookie = clearAuthUserLabelCookie()
    document.cookie = clearAuthUserAvatarCookie()
    window.location.replace("/sign-in")
  }

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Welcome to O2S</DialogTitle>
          <DialogDescription lang="bn">
            শুরু করতে একটি প্রতিষ্ঠান দরকার। নতুন প্রতিষ্ঠান তৈরি করুন, অথবা আপনার প্রতিষ্ঠানে যোগ দেওয়ার অনুরোধ পাঠান।
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={<Building2 className="size-5" />}
            title="Create new organization"
            banglaTitle="নতুন প্রতিষ্ঠান তৈরি করুন"
            summary="নিজের প্রতিষ্ঠান (কোম্পানি) তৈরি করুন। আপনি এর অ্যাডমিন হবেন এবং সব কিছু নিজে পরিচালনা করতে পারবেন।"
            steps={[
              "প্রতিষ্ঠানের নাম, ঠিকানা ও যোগাযোগের তথ্য দিয়ে সংরক্ষণ করুন।",
              "এরপর প্রথম ফ্যাক্টরি যোগ করতে বলা হবে — চাইলে পরে করতে পারবেন। ফ্যাক্টরি ছাড়া কোনো মডিউল বা মেনু দেখা যাবে না।",
              "সদস্যদের যোগ করে তাদের ফ্যাক্টরি ও মেনুর অনুমতি দিন (IAM)।",
            ]}
            actionLabel="Create organization"
            onAction={onCreateOrganization}
          />
          <ChoiceCard
            icon={<Send className="size-5" />}
            title="Request access to an organization"
            banglaTitle="প্রতিষ্ঠানে যোগ দেওয়ার অনুরোধ"
            summary="আপনার প্রতিষ্ঠান যদি আগে থেকেই O2S ব্যবহার করে, তাহলে সেখানে যোগ দেওয়ার জন্য অ্যাডমিনের কাছে অনুরোধ পাঠান।"
            steps={[
              "প্রতিষ্ঠানের অ্যাডমিনের ইমেইল ও একটি ছোট বার্তা দিয়ে অনুরোধ পাঠান।",
              "অ্যাডমিন ইমেইল ও নোটিফিকেশন পাবেন। অনুমোদন করলে আপনি প্রতিষ্ঠানে যুক্ত হবেন এবং ইমেইলে জানতে পারবেন।",
              "এরপর অ্যাডমিন আপনাকে ফ্যাক্টরি ও মেনুর অনুমতি দিলে মডিউলগুলো দেখতে পাবেন।",
            ]}
            actionLabel="Request access"
            onAction={onRequestAccess}
          />
        </div>

        <div className="flex justify-start">
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            <LogOut className="size-3.5" />
            Logout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
