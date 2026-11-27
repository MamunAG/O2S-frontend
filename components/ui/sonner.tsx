"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ExternalToast, type ToasterProps } from "sonner"
import { CheckCircleIcon, InfoIcon, WarningIcon, XCircleIcon, SpinnerIcon } from "@phosphor-icons/react"

// Where toasts appear (rule in the new-page skill): errors and warnings at the top middle, where they are seen;
// everything else (success, info, loading, plain) at the bottom right, out of the way. The Toaster's position is the
// bottom right; toast.error / toast.warning default to the top middle here, once, for every import of `toast` from
// "sonner", so screens call them as usual. A toast that passes its own `position` keeps it.
export const DEFAULT_TOAST_POSITION = "bottom-right" as const
export const ALERT_TOAST_POSITION = "top-center" as const

type ToastFn = (message: Parameters<typeof toast.error>[0], data?: ExternalToast) => string | number
const patched = Symbol.for("o2s.toast.alertPosition")
const toastRecord = toast as unknown as Record<string | symbol, unknown>
if (!toastRecord[patched]) {
  toastRecord[patched] = true
  for (const kind of ["error", "warning"] as const) {
    const original: ToastFn = toast[kind]
    toast[kind] = (message, data) => original(message, { position: ALERT_TOAST_POSITION, ...data })
  }
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={DEFAULT_TOAST_POSITION}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <WarningIcon className="size-4" />
        ),
        error: (
          <XCircleIcon className="size-4" />
        ),
        loading: (
          <SpinnerIcon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
