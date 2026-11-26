import { GmtBookingWorkspace } from "@/features/merchandising/gmt-booking/gmt-booking-workspace"

export default function GmtBookingPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

  return <GmtBookingWorkspace apiUrl={apiUrl} />
}
