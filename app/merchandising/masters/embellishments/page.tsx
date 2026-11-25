import { EmbellishmentWorkspace } from "@/features/merchandising/embellishments/embellishment-workspace"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return (
    <EmbellishmentWorkspace apiUrl={apiUrl} />
  )
}
