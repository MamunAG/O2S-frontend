import { SupplierWorkspace } from "@/features/app-config/suppliers/supplier-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <SupplierWorkspace apiUrl={apiUrl} />
}
