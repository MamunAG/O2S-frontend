// Installs the O2S adapter (lib/o2s/adapter.ts) on window.fetch, once, in the browser.
import { createO2sFetch, type O2sRule } from "./adapter"
import { accountRules } from "./rules/account"
import { configurationRules } from "./rules/configuration"

/** Every rule, the first match wins. Steps 2–4 add their modules' rules here. */
export const O2S_RULES: O2sRule[] = [...accountRules, ...configurationRules]

declare global {
  interface Window {
    __o2sFetchInstalled?: boolean
  }
}

export function installO2sFetch() {
  if (typeof window === "undefined" || window.__o2sFetchInstalled) return
  window.fetch = createO2sFetch(window.fetch.bind(window), O2S_RULES)
  window.__o2sFetchInstalled = true
}

installO2sFetch()
