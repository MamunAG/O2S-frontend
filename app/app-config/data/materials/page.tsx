import { MaterialWorkspace } from "@/features/app-config/materials/material-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <MaterialWorkspace apiUrl={apiUrl} />
}
