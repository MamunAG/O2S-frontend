import { StyleWorkspace } from "@/features/merchandising/styles/style-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <StyleWorkspace apiUrl={apiUrl} />
}
