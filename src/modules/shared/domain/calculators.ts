import { PaymentType, type PaymentType as PaymentTypeValue } from "./enums.ts";

type OrderPricingInput = {
  totalAmount: number;
  fallbackUnitPrice: number;
  quantity: number;
};

type PackageCostInput = {
  packageQuantity: number;
  productCost: number;
  extraFees?: number;
  internalShipping?: number;
  orderQuantity?: number;
};

type MarginInput = {
  revenue: number;
  cost: number;
  noRevenueMode?: boolean;
};

type PackageAllocationInput = {
  packageBaseQuantity: number;
  productCost: number;
  extraFees: number;
  linkedQuantity: number;
};

type AmountPaidInput = {
  paymentType: PaymentTypeValue | string;
  total: number;
  amountPaidInput: number;
  amountPaidPercentInput: number;
  amountPaidSource: string;
  isStockOrder: number;
};

export function getDefaultPaymentPercent(paymentType: PaymentTypeValue | string) {
  if (paymentType === PaymentType.Full) return 100;
  if (paymentType === PaymentType.Deposit50) return 50;
  return 0;
}

export function calculateOrderPricing({
  totalAmount,
  fallbackUnitPrice,
  quantity,
}: OrderPricingInput) {
  const safeQuantity = quantity > 0 ? quantity : 0;

  if (totalAmount > 0) {
    return {
      unitPrice: safeQuantity > 0 ? totalAmount / safeQuantity : 0,
      total: totalAmount,
    };
  }

  return {
    unitPrice: fallbackUnitPrice,
    total: safeQuantity * fallbackUnitPrice,
  };
}

export function calculatePackageCosts({
  packageQuantity,
  productCost,
  extraFees = 0,
  internalShipping = 0,
  orderQuantity = 0,
}: PackageCostInput) {
  const safePackageQuantity = Math.max(1, packageQuantity);
  const safeOrderQuantity = Math.max(0, orderQuantity);
  const packageFinalCost = productCost + extraFees + internalShipping;
  const averageUnitCost = packageFinalCost / safePackageQuantity;
  const allocatedCost = averageUnitCost * safeOrderQuantity;

  return {
    packageQuantity: safePackageQuantity,
    packageFinalCost,
    averageUnitCost,
    allocatedCost,
  };
}

export function calculateMargin({ revenue, cost, noRevenueMode = false }: MarginInput) {
  if (noRevenueMode) {
    return { profit: 0, margin: 0 };
  }

  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return { profit, margin };
}

export function calculatePackageAllocation({
  packageBaseQuantity,
  productCost,
  extraFees,
  linkedQuantity,
}: PackageAllocationInput) {
  const safePackageBaseQuantity = Math.max(1, packageBaseQuantity);
  const packageFinalCost = productCost + extraFees;
  const averageUnitCost = packageFinalCost / safePackageBaseQuantity;
  const ratio = linkedQuantity / safePackageBaseQuantity;
  const allocatedProductCost = productCost * ratio;
  const allocatedExtraFees = extraFees * ratio;
  const allocatedTotalCost = averageUnitCost * linkedQuantity;

  return {
    packageBaseQuantity: safePackageBaseQuantity,
    packageFinalCost,
    averageUnitCost,
    ratio,
    allocatedProductCost,
    allocatedExtraFees,
    allocatedTotalCost,
  };
}

export function determineAmountPaid({
  paymentType,
  total,
  amountPaidInput,
  amountPaidPercentInput,
  amountPaidSource,
  isStockOrder,
}: AmountPaidInput) {
  let amountPaid =
    paymentType === PaymentType.Full
      ? total
      : paymentType === PaymentType.Deposit50
        ? total * 0.5
        : 0;

  if (isStockOrder) {
    amountPaid = 0;
  }

  if (amountPaidSource === "percent" && amountPaidPercentInput >= 0) {
    amountPaid = total * (amountPaidPercentInput / 100);
  } else if (amountPaidInput >= 0) {
    amountPaid = amountPaidInput;
  } else if (amountPaidPercentInput >= 0) {
    amountPaid = total * (amountPaidPercentInput / 100);
  }

  if (isStockOrder) {
    amountPaid = 0;
  }

  if (amountPaid < 0) {
    throw new Error("Valor pago invalido.");
  }

  return amountPaid;
}
