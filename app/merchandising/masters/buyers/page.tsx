import { BuyerWorkspace } from "@/features/merchandising/buyers/buyer-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <BuyerWorkspace apiUrl={apiUrl} />
}
