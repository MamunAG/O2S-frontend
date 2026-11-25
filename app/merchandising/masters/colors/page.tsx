import { ColorWorkspace } from "@/features/merchandising/colors/color-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return (
    <ColorWorkspace apiUrl={apiUrl} />
  )
}
