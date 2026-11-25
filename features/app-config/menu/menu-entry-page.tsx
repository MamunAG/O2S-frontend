import { MenuWorkspace } from "./menu-workspace"

export function MenuEntryPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <MenuWorkspace apiUrl={apiUrl} />
}
