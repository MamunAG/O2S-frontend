// GMT Costing, as O2S's /{organizationId}/merchandising/gmt-costing serves it (GmtCostingDto and its children).
// Property names are the API's, verbatim (ClickERP's: lstDetails, FabricCost, lastYarnDtls,
// totalFaricPricePerPcsGmt, ...). Ids are the API's GUID strings ("" for a new row, until it is saved). Every list row also carries a `clientId`, the screen's own
// row identity; it is dropped before a save.

export type GmtFabricCostYarnProcess = {
  clientId: string
  id: string
  detailsFcYarnsTableId: string
  processId: string
  processName: string
  processRatePerKgFabric: number
  wastagePercentage: number
}

export type GmtFabricCostYarn = {
  clientId: string
  id: string
  fabricCostMstId: string
  yarnId: string
  yarnName: string
  uomId: string | null
  uomName: string
  yarnReqQtyPerKgFabric: number
  rowYarnPricePerKg: number
  importChargePercentagePerKgYarn: number
  importChargePerKgYarn: number | null
  totalYarnPricePerKg: number
  totalYarnReqQtyPerKgFabric: number
  totalYarnPricePerKgFabric: number
  yarnDyeingColorId: string | null
  yarnDyeingColorName: string
  totalGreyReqQtyPerKgFabric: number
  totalDyedYarnReqQtyPerKgFabric: number
  stripMeasurement: string
  yarnDyeingCost: number | null
  lstYarnWiseProcessDtls: GmtFabricCostYarnProcess[]
}

export type GmtFabricCostProcess = {
  clientId: string
  id: string
  fabricCostMstId: string
  processId: string
  processName: string
  processRatePerKgFabric: number
  wastagePercentage: number
}

export type GmtFabricCost = {
  id: string
  detailsId: string
  costTemplateName: string
  fabricId: string | null
  fabricName: string
  totalFabricCost: number
  fabricWastagePercentage: number | null
  lastYarnDtls: GmtFabricCostYarn[]
  lstProcessDtls: GmtFabricCostProcess[]
}

export type GmtDetailsSize = {
  clientId: string
  id: string
  detailsId: string
  sizeGroupName: string
  gmtSizeId: string
  gmtSizeName: string
}

export type GmtDetailsColor = {
  clientId: string
  id: string
  detailsId: string
  colorGroupName: string
  gmtColorId: string
  gmtColorName: string
}

export type GmtDetailsWastage = {
  clientId: string
  id: string
  detailsId: string
  gmtProcessId: string
  gmtProcessName: string
  gmtWastagePercentage: number
}

export type GmtCostingDetail = {
  clientId: string
  id: string
  masterId: string
  fabricItemId: string
  fabricItemName: string
  uomId: string | null
  uomName: string
  gmtPartsId: string | null
  gmtPartsName: string
  fabricColorId: string | null
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
  id: string
  masterId: string
  colorGroupName: string
  sizeGroupName: string
  costingPricePerPcs: number
  confirmPricePerPcs: number
}

export type GmtOtherCostColor = {
  clientId: string
  id: string
  otherCostDtlsId: string
  gmtColorId: string
  gmtColorName: string
}

export type GmtOtherCost = {
  clientId: string
  id: string
  masterId: string
  costId: string
  costName: string
  costPerPcsGmt: number
  costPerDznGmt: number
  lstColors: GmtOtherCostColor[]
}

export type GmtCommission = {
  clientId: string
  id: string
  masterId: string
  commissionId: string
  commissionName: string
  commissionPercentage: number
  commissionValue: number
}

export type GmtCostingFile = {
  clientId: string
  id: string
  masterId: string
  fileAttachmentId: string
  fileName: string
}

export type GmtSupplierDetail = {
  clientId: string
  id: string
  itemWiseSupplierMasterId: string
  supplierId: string
  supplierName: string
}

export type GmtItemSupplier = {
  clientId: string
  id: string
  masterId: string
  itemId: string
  itemName: string
  lstSupplierDetails: GmtSupplierDetail[]
}

export type GmtCosting = {
  id: string
  costName: string
  buyerId: string
  buyerName: string
  styleId: string
  styleNo: string
  styleName: string
  costDate: string
  shipDate: string
  confirmDate: string
  leadTime: number
  techSheetId: string | null
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
  id: string
  name: string
  isProcessCost: boolean
  isGmtProcess: boolean
  isOtherTypeCost: boolean
  isCommission: boolean
  isCommissionPercentage: boolean
  isActive: boolean
}

export type MaterialInfo = {
  id: string
  name: string
  unitId: string | null
  unitName: string
  materialGroupName: string
}

export type StyleInfo = {
  id: string
  styleNo: string
  styleName: string
  buyerId: string
  colors: Array<{ id: string; name: string }>
  sizes: Array<{ id: string; name: string }>
}

export type FabricCostSearchItem = {
  gmtCostingId: string
  costName: string
  buyerName: string
  styleNo: string
  fabricCost: GmtFabricCost | null
}

export type GmtCostingSheet = {
  costId: string
  costName: string
  costDate: string
  buyer: string
  styleNo: string
  styleName: string
  technicalSheetNo: string
  gsm: string
  sizes: Array<{ sizeId: string; sizeName: string }>
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
