// GMT Costing, as O2S's /{companyId}/merchandising/gmt-costing serves it (GmtCostingDto and its children).
// Property names are the API's, verbatim (ClickERP's: lstDetails, FabricCost, lastYarnDtls,
// totalFaricPricePerPcsGmt, ...). Ids are numbers here; the O2S bridge turns them into strings on the way
// in, and gmt-costing.api.ts turns them back. Every list row also carries a `clientId`, the screen's own
// row identity (a new row's id is 0 until it is saved); it is dropped before a save.

export type GmtFabricCostYarnProcess = {
  clientId: string
  id: number
  detailsFcYarnsTableId: number
  processId: number
  processName: string
  processRatePerKgFabric: number
  wastagePercentage: number
}

export type GmtFabricCostYarn = {
  clientId: string
  id: number
  fabricCostMstId: number
  yarnId: number
  yarnName: string
  uomId: number | null
  uomName: string
  yarnReqQtyPerKgFabric: number
  rowYarnPricePerKg: number
  importChargePercentagePerKgYarn: number
  importChargePerKgYarn: number | null
  totalYarnPricePerKg: number
  totalYarnReqQtyPerKgFabric: number
  totalYarnPricePerKgFabric: number
  yarnDyeingColorId: number | null
  yarnDyeingColorName: string
  totalGreyReqQtyPerKgFabric: number
  totalDyedYarnReqQtyPerKgFabric: number
  stripMeasurement: string
  yarnDyeingCost: number | null
  lstYarnWiseProcessDtls: GmtFabricCostYarnProcess[]
}

export type GmtFabricCostProcess = {
  clientId: string
  id: number
  fabricCostMstId: number
  processId: number
  processName: string
  processRatePerKgFabric: number
  wastagePercentage: number
}

export type GmtFabricCost = {
  id: number
  detailsId: number
  costTemplateName: string
  fabricId: number | null
  fabricName: string
  totalFabricCost: number
  fabricWastagePercentage: number | null
  lastYarnDtls: GmtFabricCostYarn[]
  lstProcessDtls: GmtFabricCostProcess[]
}

export type GmtDetailsSize = {
  clientId: string
  id: number
  detailsId: number
  sizeGroupName: string
  gmtSizeId: number
  gmtSizeName: string
}

export type GmtDetailsColor = {
  clientId: string
  id: number
  detailsId: number
  colorGroupName: string
  gmtColorId: number
  gmtColorName: string
}

export type GmtDetailsWastage = {
  clientId: string
  id: number
  detailsId: number
  gmtProcessId: number
  gmtProcessName: string
  gmtWastagePercentage: number
}

export type GmtCostingDetail = {
  clientId: string
  id: number
  masterId: number
  fabricItemId: number
  fabricItemName: string
  uomId: number | null
  uomName: string
  gmtPartsId: number | null
  gmtPartsName: string
  fabricColorId: number | null
  fabricColorName: string
  fabricCostPerKg: number
  colorGroupName: string
  sizeGroupName: string
  fabricGsm: string
  finishDia: string
  fabricReqQtyPerPcsGmt: number
  fabricReqQtyPerDznGmt: number
  gmtWastagePercentage: number
  totalFabricItemQtyPerPcsGmt: number
  totalFabricItemQtyPerDznGmt: number
  fabricItemPricePerUnitKg: number
  fabricItemPricePerDzn: number
  additionalPrice: number
  totalFaricPricePerPcsGmt: number
  totalFaricPricePerDznGmt: number
  isColorWise: boolean
  isShowCostInBudget: boolean
  importChargePercentage: number
  fabricForm: string
  remarks: string
  collarPercentage: number
  collarQty: number
  isDoubleInPcsQty: boolean
  lstGMT_SIZEs: GmtDetailsSize[]
  lstGMT_COLORs: GmtDetailsColor[]
  FabricCost: GmtFabricCost | null
  lstGMTWastage: GmtDetailsWastage[]
}

export type GmtCostPerPcs = {
  clientId: string
  id: number
  masterId: number
  colorGroupName: string
  sizeGroupName: string
  costingPricePerPcs: number
  confirmPricePerPcs: number
}

export type GmtOtherCostColor = {
  clientId: string
  id: number
  otherCostDtlsId: number
  gmtColorId: number
  gmtColorName: string
}

export type GmtOtherCost = {
  clientId: string
  id: number
  masterId: number
  costId: number
  costName: string
  costPerPcsGmt: number
  costPerDznGmt: number
  lstColors: GmtOtherCostColor[]
}

export type GmtCommission = {
  clientId: string
  id: number
  masterId: number
  commissionId: number
  commissionName: string
  commissionPercentage: number
  commissionValue: number
}

export type GmtCostingFile = {
  clientId: string
  id: number
  masterId: number
  fileAttachmentId: number
  fileName: string
}

export type GmtSupplierDetail = {
  clientId: string
  id: number
  itemWiseSupplierMasterId: number
  supplierId: number
  supplierName: string
}

export type GmtItemSupplier = {
  clientId: string
  id: number
  masterId: number
  itemId: number
  itemName: string
  lstSupplierDetails: GmtSupplierDetail[]
}

export type GmtCosting = {
  id: number
  costName: string
  buyerId: number
  buyerName: string
  styleId: number
  styleNo: string
  styleName: string
  costDate: string
  shipDate: string
  confirmDate: string
  leadTime: number
  techSheetId: number | null
  technicalSheetNo: string
  gmtTotalCostFob: number
  expectedOrderQty: number
  smv: number
  cpm: number
  operators: number
  helper: number
  ironMan: number
  isActive: boolean
  lstGMTCostPerPcs: GmtCostPerPcs[]
  lstDetails: GmtCostingDetail[]
  lstGMTOtherCost: GmtOtherCost[]
  lstGMTCommission: GmtCommission[]
  lstFile: GmtCostingFile[]
  lstItemWiseSupplier: GmtItemSupplier[]
  createdBy?: string | null
  createdDate?: string | null
  updatedBy?: string | null
  updatedDate?: string | null
  createdByName?: string | null
  updatedByName?: string | null
}

/** One row of the list page (the paginated list returns whole costings; the page reads these). */
export type GmtCostingListItem = Pick<
  GmtCosting,
  | "id"
  | "costName"
  | "buyerId"
  | "buyerName"
  | "styleId"
  | "styleNo"
  | "styleName"
  | "costDate"
  | "shipDate"
  | "confirmDate"
  | "gmtTotalCostFob"
  | "expectedOrderQty"
  | "isActive"
  | "technicalSheetNo"
  | "createdByName"
  | "createdDate"
  | "updatedByName"
  | "updatedDate"
>

export type GmtCostingFilters = {
  costName: string
  buyer: Option | null
  style: Option | null
  isActive: "" | "true" | "false"
  fromCostDate: string
  toCostDate: string
}

export type PageMeta = {
  total: number
  page: number
  limit: number
  totalPages: number
}

export type Option = { value: string; label: string }

/** A cost scope with the role flags that decide which picker it belongs to. */
export type CostScope = {
  id: number
  name: string
  isProcessCost: boolean
  isGmtProcess: boolean
  isOtherTypeCost: boolean
  isCommission: boolean
  isCommissionPercentage: boolean
  isActive: boolean
}

export type MaterialInfo = {
  id: number
  name: string
  unitId: number | null
  unitName: string
  materialGroupName: string
}

export type StyleInfo = {
  id: number
  styleNo: string
  styleName: string
  buyerId: number
  colors: Array<{ id: number; name: string }>
  sizes: Array<{ id: number; name: string }>
}

export type FabricCostSearchItem = {
  gmtCostingId: number
  costName: string
  buyerName: string
  styleNo: string
  fabricCost: GmtFabricCost | null
}

export type GmtCostingSheet = {
  costId: number
  costName: string
  costDate: string
  buyer: string
  styleNo: string
  styleName: string
  technicalSheetNo: string
  gsm: string
  sizes: Array<{ sizeId: number; sizeName: string }>
  colorGroups: Array<{
    colorGroupName: string
    consumptionPerPcs: Array<{ name: string; values: Array<number | null> }>
    pricePerPcs: Array<{ name: string; values: Array<number | null> }>
    pricePerDzn: Array<{ name: string; values: Array<number | null> }>
    totalPricePerDzn: Array<number | null>
    totalPricePerPcs: Array<number | null>
    breakdowns: Array<{
      title: string
      gmtWastagePercentage: number
      materialLines: SheetLine[]
      processLines: SheetLine[]
      total: number
    }>
  }>
}

export type SheetLine = {
  name: string
  uom: string | null
  wastagePercentage: number
  actualQty: number
  qtyWithWastage: number
  unitPrice: number
  amount: number
}

export type AccessRules = {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}
