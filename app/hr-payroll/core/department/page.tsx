import { DepartmentWorkspace } from "@/features/app-config/departments/department.workspace"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

export default function DepartmentSetupPage() {
  return <DepartmentWorkspace apiUrl={API_URL} />
}