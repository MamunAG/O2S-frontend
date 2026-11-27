import { UserFactoryPermissionWorkspace } from "@/features/iam/user-factory-permissions/user-factory-permission-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <UserFactoryPermissionWorkspace apiUrl={apiUrl} />
}
