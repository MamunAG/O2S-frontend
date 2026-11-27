export type ApiResponse<T = unknown> = {
    success: boolean
    message: string
    data?: T
    timestamp?: string
}

export type PaginationMeta = {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
}

export type UserSummary = {
    id?: string | null
    name?: string | null
    user_name?: string | null
    display_name?: string | null
}

export type FileSummary = {
    id?: string | null
    file_id?: string | null
    file_name?: string | null
    original_name?: string | null
    file_path?: string | null
    file_url?: string | null
    public_url?: string | null
    thumbnail_url?: string | null
    mime_type?: string | null
}

export type PaginatedResponse<T> = {
    items: T[]
    meta: PaginationMeta
}

export type FactoryRecord = {
    id: string
    name: string
    displayName?: string | null
    code?: string | null
    contact?: string | null
    email?: string | null
    organizationId?: string | null
    imageId?: string | null
    image?: FileSummary | null
    address?: string | null
    remarks?: string | null
    isActive?: boolean

    created_by_id?: string | null
    updated_by_id?: string | null
    deleted_by_id?: string | null
    created_by_user?: UserSummary | null
    updated_by_user?: UserSummary | null
    deleted_by_user?: UserSummary | null
    created_at?: string | null
    updated_at?: string | null
    deleted_at?: string | null
}

/** Only properties of the backend's FactoryParams; anything else is ignored by O2S. */
export type FactoryFilterValues = {
    name: string
    displayName: string
    isActive: string
}

export const EMPTY_FILTERS: FactoryFilterValues = {
    name: "",
    displayName: "",
    isActive: "",
}

export type FactoryFormValues = {
    name: string
    displayName: string
    code: string
    contact: string
    email: string
    imageId: string
    address: string
    remarks: string
    isActive: boolean
}

export const EMPTY_FORM_VALUES: FactoryFormValues = {
    name: "",
    displayName: "",
    code: "",
    contact: "",
    email: "",
    imageId: "",
    address: "",
    remarks: "",
    isActive: true,
}
