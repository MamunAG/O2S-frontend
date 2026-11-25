import { FabricCostingWorkspace } from "@/features/merchandising/fabric-costing/fabric-costing-workspace"

export default function FabricCostingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <FabricCostingWorkspace apiUrl={apiUrl} />
}
