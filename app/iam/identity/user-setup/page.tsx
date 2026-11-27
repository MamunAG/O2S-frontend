import { UserSetupWorkspace } from "@/features/iam/user-setup/user-setup-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <UserSetupWorkspace apiUrl={apiUrl} />
}
