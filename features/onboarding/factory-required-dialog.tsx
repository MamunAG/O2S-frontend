"use client"

import { ArrowLeftRight, CheckCircle2, Factory, LogOut, RefreshCw, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  clearAuthSessionCookie,
  clearAuthUserAvatarCookie,
  clearAuthUserLabelCookie,
  clearStoredAuthSession,
} from "@/lib/auth-session"

import { ChoiceCard } from "./onboarding-choice-dialog"

type FactoryRequiredDialogProps = {
  open: boolean
  organizationName: string
  /** The organization's admin (or a global admin): creates, never needs to ask. */
  isAdmin: boolean
  /** May create a factory: an admin, or a member with Create on Factory. */
  canCreate: boolean
  /** A request went to the admins in this visit: show that, and "Check again". */
  requestSent: boolean
  onCreateFactory: () => void
  onRequestPermission: () => void
  onSwitchOrganization: () => void
}

/**
 * A user works only inside a factory: with none in the selected organization this dialog can't be closed. They
 * create a factory (an admin, or anyone allowed to create one, who then gets it) or ask the admins for one.
 */
export function FactoryRequiredDialog({
  open,
  organizationName,
  isAdmin,
  canCreate,
  requestSent,
  onCreateFactory,
  onRequestPermission,
  onSwitchOrganization,
}: FactoryRequiredDialogProps) {
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
          <DialogTitle>A factory is needed</DialogTitle>
          <DialogDescription>
            You have no factory in <span className="font-medium text-slate-900 dark:text-slate-100">{organizationName}</span>.
            Every module and menu works inside a factory.
          </DialogDescription>
          <p lang="bn" className="text-sm text-slate-500 dark:text-slate-400">
            এই প্রতিষ্ঠানে আপনার কোনো ফ্যাক্টরি নেই। কাজ শুরু করতে একটি ফ্যাক্টরি তৈরি করুন, অথবা অ্যাডমিনের কাছে ফ্যাক্টরির অনুমতি চেয়ে অনুরোধ পাঠান।
          </p>
        </DialogHeader>

        {requestSent ? (
          <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Request sent to the admins.</p>
              <p lang="bn" className="text-xs leading-5">
                অ্যাডমিন অনুমতি দিলে &quot;Check again&quot; চাপুন — ফ্যাক্টরি পাওয়া গেলে মডিউল ও মেনু খুলে যাবে।
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 rounded-xl text-xs" onClick={() => window.location.reload()}>
              <RefreshCw className="size-3.5" />
              Check again
            </Button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            icon={<Factory className="size-5" />}
            title="Create new factory"
            banglaTitle="নতুন ফ্যাক্টরি তৈরি করুন"
            summary="এই প্রতিষ্ঠানে একটি ফ্যাক্টরি যোগ করুন। তৈরি করার সাথে সাথে ফ্যাক্টরিটি আপনার হবে এবং মডিউল ও মেনু দেখা যাবে।"
            steps={[
              "ফ্যাক্টরির নাম ও ডিসপ্লে নাম দিন — কোড, ঠিকানা, ছবি ঐচ্ছিক।",
              "সংরক্ষণ করলে ফ্যাক্টরিটি উপরের ফ্যাক্টরি মেনুতে নির্বাচিত হবে।",
              "পরে আরও ফ্যাক্টরি যোগ করা যাবে; অ্যাডমিন সদস্যদের ফ্যাক্টরির অনুমতি দেবেন।",
            ]}
            actionLabel="Create factory"
            onAction={onCreateFactory}
            disabledNote={canCreate ? undefined : "আপনার ফ্যাক্টরি তৈরি করার অনুমতি নেই। অ্যাডমিনের কাছে ফ্যাক্টরির অনুমতি চেয়ে অনুরোধ পাঠান।"}
          />
          <ChoiceCard
            icon={<Send className="size-5" />}
            title="Request factory permission"
            banglaTitle="ফ্যাক্টরির অনুমতির অনুরোধ"
            summary="প্রতিষ্ঠানের কোনো ফ্যাক্টরিতে কাজ করার জন্য অ্যাডমিনের কাছে অনুরোধ পাঠান।"
            steps={[
              "চাইলে একটি ছোট বার্তা লিখুন — কোন ফ্যাক্টরি, কোন কাজ।",
              "প্রতিষ্ঠানের অ্যাডমিনরা নোটিফিকেশন ও ইমেইল পাবেন।",
              "অ্যাডমিন User Factory Permission থেকে ফ্যাক্টরি দিলে মডিউল ও মেনু দেখা যাবে।",
            ]}
            actionLabel={requestSent ? "Send again" : "Send request"}
            onAction={onRequestPermission}
            disabledNote={isAdmin ? "আপনি এই প্রতিষ্ঠানের অ্যাডমিন — অনুরোধের দরকার নেই, নিজেই ফ্যাক্টরি তৈরি করুন।" : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
          >
            <LogOut className="size-3.5" />
            Logout
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onSwitchOrganization}>
            <ArrowLeftRight className="size-3.5" />
            Switch organization
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
