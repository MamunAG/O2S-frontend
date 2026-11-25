import { MASTER_DATA_CONFIGS, MasterDataWorkspace } from "@/features/hr-payroll/master-data"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"
export default function PayGroupPage() { return <MasterDataWorkspace apiUrl={API_URL} config={MASTER_DATA_CONFIGS.payGroup} /> }
