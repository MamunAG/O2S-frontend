import { GmtCostingWorkspace } from "@/features/merchandising/gmt-costing/gmt-costing-workspace"

export default function GmtCostingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <GmtCostingWorkspace apiUrl={apiUrl} />
}
