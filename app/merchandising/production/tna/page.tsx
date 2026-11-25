import { TnaWorkspace } from "@/features/merchandising/tna/tna-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <TnaWorkspace apiUrl={apiUrl} />
}
