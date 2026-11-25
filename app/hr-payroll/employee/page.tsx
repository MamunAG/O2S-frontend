import { EmployeeWorkspace } from "@/features/hr-payroll/employee/employee-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <EmployeeWorkspace apiUrl={apiUrl} />
}
