import { AppConfigOverview } from "@/features/app-config/overview/app-config-overview"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <AppConfigOverview apiUrl={apiUrl} />
}
