// GMT Booking, as O2S's /{companyId}/merchandising/gmt-booking serves it (GmtBookingDto). Names are the
// API's verbatim. The rows are never typed in: they come whole from the budget (refresh-from-budget) or the
// saved booking. Every row also has a `clientId`, the screen's row identity, dropped before a save.

/** A fabric (or other item) row: MER_MATERIAL_ORDE_MAS_DET_FABRIC_VIEW. */
export type BookingFabricRow = {
  clientId: string
  id: number
  masterId: number
  fabricOrMtlId: number
  fabricItem: string
  gmtColorId: number | null
  gmtColor: string
  gmtSizeId: number | null
  gmtSize: string
  mtlColorId: number | null
  materialColor: string
  poQty: number
  bomQty: number
  totalBomReqQty: number
  costingConPerPcs: number
  extraPer: number
  bookingConPerPcs: number
  fabricBookingConPerPcs: number
  totalBookingQty: number
  totalFabricBookingQty: number
  uomId: number | null
  uom: string
  totalPricePerPcs: number
  useAreaId: number | null
  gmtParts: string
  comBomParentMtlConPerPcs: number
  factoryPricePerUnitMtl: number
  totalComBomProcessWastage: number
  factoryGmtWastagePer: number
  customConsumptionPerPcs: number
  finishDia: string
  fabricGsm: string
  fabricForm: string
  yarnTableAddIds: number
  pcsQty: number
  sampleFabricQty: number
  fabricReqQtyPerPcsGmtInitial: number
  fabricReqQtyPerDznGmtInitial: number
  remarks: string
  knitMcDia: string
  totalFabricBookingQtyLength: number
  /** Display only: whether the row is a fabric or an other item. */
  materialGroup: string
}

/** A yarn row: MER_MATERIAL_ORDE_MAS_DET_VIEW. */
export type BookingYarnRow = {
  clientId: string
  id: number
  masterId: number
  materialId: number
  yarn: string
  comBomParentsMtlId: number | null
  fabricItem: string
  gmtColorId: number | null
  gmtColor: string
  gmtSizeId: number | null
  gmtSize: string
  mtlColorId: number | null
  materialColor: string
  poQty: number
  bomQty: number
  totalBomReqQty: number
  costingConPerPcs: number
  extraPer: number
  bookingConPerPcs: number
  fabricBookingConPerPcs: number
  totalBookingQty: number
  totalFabricBookingQty: number
  uomId: number | null
  uom: string
  totalPricePerPcs: number
  useAreaId: number | null
  gmtParts: string
  comBomParentMtlConPerPcs: number
  factoryPricePerUnitMtl: number
  totalComBomProcessWastage: number
  factoryGmtWastagePer: number
  customConsumptionPerPcs: number
  finishDia: string
  fabricGsm: string
  fabricForm: string
  yarnTableAddId: number
  yarnDyeingColorId: number | null
  yarnDyeingColor: string
  budgetTotalGreyQtyPerPcsGmt: number
  factoryTotalGreyBookingConPerpcsGmt: number
  factoryTotalGreyBookingQuantity: number
  budgetTotalDyedYarnQtyPerPcsGmt: number
  factoryTotalDyedYarnBookingConPerpcsGmt: number
  factoryTotalDyedYarnBookingQuantity: number
  stripMeasurement: string
}

export type BookingWastage = {
  clientId: string
  id: number
  masterId: number
  parentsMtlId: number | null
  fabricItem: string
  colorGroupId: number | null
  gmtColor: string
  useAreaId: number | null
  gmtParts: string
  costId: number | null
  costName: string
  factoryWastagePercentage: number
  momWastage: number
  finishDia: string
  finishGsm: string
  gmtSizeId: number | null
  wastageType: string
  isWastageDouble: boolean
  materialColorId: number | null
  materialColor: string
}

export type BookingComment = { clientId: string; id: number; masterId: number; comments: string }
export type BookingSpecialTreatment = { clientId: string; id: number; masterId: number; specialTreatmId: number; treatment: string }
export type BookingRevise = {
  clientId: string
  id: number
  masterId: number
  reviceNo: number
  reviceDate: string
  reviceReason: string
  revisedByName: string
}

export type GmtBooking = {
  id: number
  bomNo: string
  buyerId: number
  buyer: string
  poId: number
  poNo: string
  styleId: number
  style: string
  styleName: string
  budgetId: number | null
  budgetName: string
  fabricSourceId: number | null
  fabricSource: string
  isApproved: boolean
  isOpenDia: boolean
  revisedNo: number
  bookingReleaseDate: string | null
  details: BookingYarnRow[]
  fabricDetails: BookingFabricRow[]
  wastages: BookingWastage[]
  comments: BookingComment[]
  specialTreatments: BookingSpecialTreatment[]
  revises: BookingRevise[]
  createdByName?: string | null
  createdDate?: string | null
  updatedByName?: string | null
  updatedDate?: string | null
}

/** A PO + style with a budget (GET budgeted-po-styles), and its booking if it has one. */
export type BudgetedPoStyle = {
  budgetId: number
  buyerId: number
  buyer: string
  poId: number
  poNo: string
  styleId: number
  style: string
  styleName: string
  bookingId: number
  isApproved: boolean
}

export type BookingListItem = Pick<
  GmtBooking,
  | "id"
  | "bomNo"
  | "buyer"
  | "poNo"
  | "style"
  | "styleName"
  | "budgetName"
  | "fabricSource"
  | "isApproved"
  | "isOpenDia"
  | "revisedNo"
  | "bookingReleaseDate"
  | "createdByName"
  | "createdDate"
  | "updatedByName"
  | "updatedDate"
>
