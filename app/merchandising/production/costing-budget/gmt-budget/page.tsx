import { GmtBudgetWorkspace } from "@/features/merchandising/gmt-budget/gmt-budget-workspace"

export default function GmtBudgetPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <GmtBudgetWorkspace apiUrl={apiUrl} />
}
