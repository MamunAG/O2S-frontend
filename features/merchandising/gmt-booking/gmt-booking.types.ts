// GMT Booking, as O2S's /{organizationId}/merchandising/gmt-booking serves it (GmtBookingDto). Names are the
// API's verbatim. The rows are never typed in: they come whole from the budget (refresh-from-budget) or the
// saved booking. Every row also has a `clientId`, the screen's row identity, dropped before a save.

/** A fabric (or other item) row: MER_MATERIAL_ORDE_MAS_DET_FABRIC_VIEW. */
export type BookingFabricRow = {
  clientId: string
  id: string
  masterId: string
  fabricOrMtlId: string
  fabricItem: string
  gmtColorId: string | null
  gmtColor: string
  gmtSizeId: string | null
  gmtSize: string
  mtlColorId: string | null
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
  uomId: string | null
  uom: string
  totalPricePerPcs: number
  useAreaId: string | null
  gmtParts: string
  comBomParentMtlConPerPcs: number
  factoryPricePerUnitMtl: number
  totalComBomProcessWastage: number
  factoryGmtWastagePer: number
  customConsumptionPerPcs: number
  finishDia: string
  fabricGsm: string
  fabricForm: string
  yarnTableAddIds: string
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
  id: string
  masterId: string
  materialId: string
  yarn: string
  comBomParentsMtlId: string | null
  fabricItem: string
  gmtColorId: string | null
  gmtColor: string
  gmtSizeId: string | null
  gmtSize: string
  mtlColorId: string | null
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
  uomId: string | null
  uom: string
  totalPricePerPcs: number
  useAreaId: string | null
  gmtParts: string
  comBomParentMtlConPerPcs: number
  factoryPricePerUnitMtl: number
  totalComBomProcessWastage: number
  factoryGmtWastagePer: number
  customConsumptionPerPcs: number
  finishDia: string
  fabricGsm: string
  fabricForm: string
  yarnTableAddId: string
  yarnDyeingColorId: string | null
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
  id: string
  masterId: string
  parentsMtlId: string | null
  fabricItem: string
  colorGroupId: string | null
  gmtColor: string
  useAreaId: string | null
  gmtParts: string
  costId: string | null
  costName: string
  factoryWastagePercentage: number
  momWastage: number
  finishDia: string
  finishGsm: string
  gmtSizeId: string | null
  wastageType: string
  isWastageDouble: boolean
  materialColorId: string | null
  materialColor: string
}

export type BookingComment = { clientId: string; id: string; masterId: string; comments: string }
export type BookingSpecialTreatment = { clientId: string; id: string; masterId: string; specialTreatmId: string; treatment: string }
export type BookingRevise = {
  clientId: string
  id: string
  masterId: string
  reviceNo: number
  reviceDate: string
  reviceReason: string
  revisedByName: string
}

export type GmtBooking = {
  id: string
  bomNo: string
  buyerId: string
  buyer: string
  poId: string
  poNo: string
  styleId: string
  style: string
  styleName: string
  budgetId: string | null
  budgetName: string
  fabricSourceId: string | null
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
  budgetId: string
  buyerId: string
  buyer: string
  poId: string
  poNo: string
  styleId: string
  style: string
  styleName: string
  bookingId: string
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
