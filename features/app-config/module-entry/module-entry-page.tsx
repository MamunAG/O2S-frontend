import { ModuleEntryWorkspace } from "./module-entry-workspace"

export function ModuleEntryPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <ModuleEntryWorkspace apiUrl={apiUrl} />
}
