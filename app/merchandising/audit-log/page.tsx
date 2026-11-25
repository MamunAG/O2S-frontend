import { AUDIT_LOG_MODULES, AuditLogWorkspace } from "@/features/audit-log"

export default function Page() {
  return (
    <AuditLogWorkspace
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"}
      config={AUDIT_LOG_MODULES.merchandising}
    />
  )
}
