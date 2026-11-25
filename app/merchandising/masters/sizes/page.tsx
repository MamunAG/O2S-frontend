import { SizeWorkspace } from "@/features/merchandising/sizes/size-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <SizeWorkspace apiUrl={apiUrl} />
}
