import { UnitWorkspace } from "@/features/app-config/units/unit-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <UnitWorkspace apiUrl={apiUrl} />
}
