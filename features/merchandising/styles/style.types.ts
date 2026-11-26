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

export type PaginatedResponse<T> = {
  items: T[]
  meta: PaginationMeta
}

export type BuyerSummary = {
  id?: string | null
  name?: string | null
  displayName?: string | null
}

export type CurrencySummary = {
  id?: string | null
  currencyName?: string | null
  currencyCode?: string | null
  symbol?: string | null
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

export type ColorSummary = {
  id?: string | null
  colorName?: string | null
  colorDisplayName?: string | null
  colorHexCode?: string | null
}

export type SizeSummary = {
  id?: string | null
  sizeName?: string | null
}

export type EmbellishmentSummary = {
  id?: string | null
  name?: string | null
}

export type StyleToColorMapRecord = {
  id?: string
  colorId: string
  color?: ColorSummary | null
}

export type StyleToSizeMapRecord = {
  id?: string
  sizeId: string
  size?: SizeSummary | null
}

export type StyleToEmbellishmentMapRecord = {
  id?: string
  embellishmentId: string
  embellishment?: EmbellishmentSummary | null
}

export type StyleRecord = {
  id: string
  productType?: string | null
  buyerId: string
  buyer?: BuyerSummary | null
  organizationId?: string | null
  styleNo: string
  styleName?: string | null
  itemType?: string | null
  productDepartment?: string | null
  cmSewing?: number | null
  currencyId: string
  currency?: CurrencySummary | null
  imageId?: string | null
  image?: FileSummary | null
  smvSewing?: number | null
  smvSewingSideSeam?: number | null
  smvCutting?: number | null
  smvCuttingSideSeam?: number | null
  smvFinishing?: number | null
  remarks?: string | null
  isActive?: boolean
  itemUom?: "Pcs" | "Set" | string | null
  productFamily?: string | null
  styleToColorMaps?: StyleToColorMapRecord[]
  styleToSizeMaps?: StyleToSizeMapRecord[]
  styleToEmbellishmentMaps?: StyleToEmbellishmentMapRecord[]
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

export type StyleFilterValues = {
  productType: string
  buyerId: string
  styleNo: string
  styleName: string
  itemType: string
  currencyId: string
  isActive: string
}

export type StyleChildOptionValue = {
  id: string
  value: string
  label: string
}

export type StyleFormValues = {
  productType: string
  buyerId: string
  styleNo: string
  styleName: string
  itemType: string
  productDepartment: string
  cmSewing: string
  currencyId: string
  smvSewing: string
  smvSewingSideSeam: string
  smvCutting: string
  smvCuttingSideSeam: string
  smvFinishing: string
  imageId: string
  remarks: string
  isActive: boolean
  itemUom: string
  productFamily: string
  colors: StyleChildOptionValue[]
  sizes: StyleChildOptionValue[]
  embellishments: StyleChildOptionValue[]
}

export type StyleDialogSectionId =
  | "basic-info"
  | "production-smv"
  | "colors"
  | "sizes"
  | "embellishments"
  | "remarks-status"

export type StyleFormError = {
  message: string
  section: StyleDialogSectionId
}
