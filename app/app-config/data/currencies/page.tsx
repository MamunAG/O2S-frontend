import { CurrencyWorkspace } from "@/features/app-config/currencies/currency-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <CurrencyWorkspace apiUrl={apiUrl} />
}
