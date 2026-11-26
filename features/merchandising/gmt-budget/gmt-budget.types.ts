// GMT Budget, as O2S's /{companyId}/merchandising/gmt-budget serves it (GmtBudgetDto and its children).
// Property names are the API's verbatim; most figures come in pairs, the costing's value and its budgeted
// copy (`...Budget`; the fabric costing's processes spell it `...Buget`, as ClickERP's columns do). Ids are
// numbers; every list row also has a `clientId` (the screen's row identity), dropped before a save.

export type BudgetColor = { clientId: string; id: number; detailsId: number; colorGroupName: string; gmtColorId: number; gmtColorName: string }
export type BudgetSize = { clientId: string; id: number; detailsId: number; sizeGroupName: string; gmtSizeId: number; gmtSizeName: string }

export type BudgetWastage = {
  clientId: string
  id: number
  detailsId: number
  gmtProcessId: number
  gmtProcessName: string
  gmtWastagePercentage: number
  gmtWastagePercentageBudget: number
  isWastageDouble: boolean
}

export type BudgetFabricProcess = {
  clientId: string
  id: number
  fabricCostMstId: number
  processId: number
  processName: string
  processRatePerKgFabric: number
  processRatePerKgFabricBuget: number
  wastagePercentage: number
  wastagePercentageBuget: number
}

export type BudgetYarnProcess = Omit<BudgetFabricProcess, "fabricCostMstId"> & { detailsFcYarnsTableId: number }

export type BudgetYarn = {
  clientId: string
  id: number
  fabricCostMstId: number
  yarnId: number
  yarnName: string
  uomId: number | null
  uomName: string
  yarnReqQtyPerKgFabric: number
  rowYarnPricePerKg: number
  rowYarnPricePerKgBudget: number
  yarnPricePerKgBudget: number
  importChargePercentagePerKgYarn: number
  importChargePercentagePerKgYarnBudget: number
  importChargePerKgYarn: number
  importChargePerKgYarnBudget: number
  totalYarnPricePerKg: number
  totalYarnPricePerKgBudget: number
  totalYarnReqQtyPerKgFabric: number
  totalYarnPricePerKgFabric: number
  totalYarnPricePerKgFabricBudget: number
  yarnDyeingColorId: number | null
  yarnDyeingColorName: string
  totalGreyReqQtyPerKgFabric: number
  totalDyedYarnReqQtyPerKgFabric: number
  stripMeasurement: string
  yarnDyeingCost: number | null
  yarnWiseProcesses: BudgetYarnProcess[]
}

export type BudgetFabricCost = {
  id: number
  detailsId: number
  costTemplateName: string
  fabricId: number
  fabricName: string
  totalFabricCost: number
  totalFabricCostBudget: number
  fabricWastagePercentage: number | null
  processes: BudgetFabricProcess[]
  yarns: BudgetYarn[]
}

export type BudgetDetail = {
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
  colorGroupName: string
  sizeGroupName: string
  fabricGsm: string
  finishDia: string
  knitMcDia: string
  fabricCostPerKg: number
  fabricCostPerKgBudget: number
  /** The working consumption the totals use; a typed Total Req. Qty rewrites it. */
  fabricReqQtyPerPcsGmt: number
  fabricReqQtyPerDznGmt: number
  /** The consumption the grid shows and the user types (desktop ucGmtBudget). */
  fabricReqQtyPerPcsGmtInitial: number
  fabricReqQtyPerDznGmtInitial: number
  fabricReqQtyPerPcsGmtLength: number
  fabricReqQtyPerDznGmtLength: number
  gmtWastagePercentage: number
  gmtWastagePercentageBudget: number
  cadWastagePercentage: number
  totalFabricItemQtyPerPcsGmt: number
  totalFabricItemQtyPerDznGmt: number
  totalFabricItemQtyPerPcsGmtBudget: number
  totalFabricItemQtyPerDznGmtBudget: number
  totalFabricItemQtyPerPcsGmtBudgetLength: number
  totalFabricItemQtyPerDznGmtBudgetLength: number
  fabricItemPricePerUnitKg: number
  fabricItemPricePerUnitKgBudget: number
  fabricItemPricePerDzn: number
  fabricItemPricePerDznBudget: number
  additionalPrice: number
  additionalPriceBudget: number
  totalFabricPricePerPcsGmt: number
  totalFabricPricePerDznGmt: number
  totalFabricPricePerPcsGmtBudget: number
  totalFabricPricePerDznGmtBudget: number
  importChargePercentage: number
  importChargePercentageBudget: number
  poQty: number
  sampleFabricQty: number
  totalRequiredQty: number
  totalRequiredQtyLength: number
  isColorWise: boolean
  isShowCostInBudget: boolean
  fabricForm: string
  remarks: string
  collarPercentage: number
  collarQty: number
  isDoubleInPcsQty: boolean
  colors: BudgetColor[]
  sizes: BudgetSize[]
  wastages: BudgetWastage[]
  /** One fabric costing per row (the API keeps a list: fabricCosts). */
  fabricCost: BudgetFabricCost | null
}

export type BudgetOtherCostColor = { clientId: string; id: number; otherCostDtlsId: number; gmtColorId: number; gmtColorName: string }

export type BudgetOtherCost = {
  clientId: string
  id: number
  masterId: number
  costId: number
  costName: string
  costPerPcsGmt: number
  costPerDznGmt: number
  costPerPcsGmtBudget: number
  costPerDznGmtBudget: number
  lstColors: BudgetOtherCostColor[]
}

export type BudgetCommission = {
  clientId: string
  id: number
  masterId: number
  commissionId: number
  commissionName: string
  commissionPercentage: number
  commissionPercentageBudget: number
  commissionValue: number
  commissionValueBudget: number
}

export type BudgetCostPerPcs = {
  clientId: string
  id: number
  masterId: number
  colorGroupName: string
  sizeGroupName: string
  costingPricePerPcs: number
  confirmPricePerPcs: number
}

export type BudgetRevise = {
  clientId: string
  id: number
  masterId: number
  reviceNo: number
  reviceDate: string
  reviceReason: string
  revisedByName: string
}

export type BudgetComment = { clientId: string; id: number; masterId: number; comments: string }
export type BudgetFile = { clientId: string; id: number; masterId: number; fileAttachmentId: number; fileName: string }
export type BudgetSpecialTreatment = { clientId: string; id: number; masterId: number; specialTreatmentId: number; treatment: string }

export type GmtBudget = {
  id: number
  budgetName: string
  budgetDate: string
  buyerId: number
  buyer: string
  styleId: number
  style: string
  styleName: string
  poId: number
  po: string
  costId: number
  costingNo: string
  totalFob: number
  buyingCommission: number
  balanceValue: number
  techSheetId: number | null
  techSheet: string
  fabricSourceId: number | null
  fabricSource: string
  commercialFactoryId: number | null
  commercialFactory: string
  details: BudgetDetail[]
  specialTreatments: BudgetSpecialTreatment[]
  revises: BudgetRevise[]
  otherCosts: BudgetOtherCost[]
  mstFiles: BudgetFile[]
  costPerPcs: BudgetCostPerPcs[]
  commissions: BudgetCommission[]
  bookingComments: BudgetComment[]
  budgetComments: BudgetComment[]
  createdByName?: string | null
  createdDate?: string | null
  updatedByName?: string | null
  updatedDate?: string | null
}

/** One row of GET /po-style-list: a PO + style of the company's jobs, with its budget if it has one. */
export type PoStyleRow = {
  budgetId: number
  poId: number
  po: string
  buyerId: number
  buyer: string
  styleId: number
  style: string
  styleName: string
  firstDeliveryDate: string | null
  budgetName: string
  budgetDate: string | null
  costId: number
  costingNo: string
  totalFob: number
  buyingCommission: number
  balanceValue: number
  status: "DONE" | "NOT DONE" | string
  createdBy: string | null
  updatedBy: string | null
}

/** The PO's job lines of the budget's style: what PO qty, colours and Total FOB come from. */
export type PoStyleContext = {
  lines: Array<{ colorId: number; colorName: string; sizeId: number; sizeName: string; qty: number; fob: number }>
  colors: Array<{ id: number; name: string }>
  sizes: Array<{ id: number; name: string }>
}
