import { ExchangeRateWorkspace } from "@/features/app-config/exchange-rates/exchange-rate-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <ExchangeRateWorkspace apiUrl={apiUrl} />
}
