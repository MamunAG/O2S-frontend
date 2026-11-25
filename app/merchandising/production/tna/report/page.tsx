import { TnaReportClient } from "./tna-report-client"

export default function Page() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <TnaReportClient apiUrl={apiUrl} />
}
