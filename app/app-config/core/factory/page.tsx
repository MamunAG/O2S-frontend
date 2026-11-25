import { FactoryWorkspace } from "@/features/app-config/factory/factory.workspace"


export default function Page() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5299"

    return <FactoryWorkspace apiUrl={apiUrl} />
}