import assert from "node:assert/strict";

import {
  calculateMargin,
  calculateOrderPricing,
  calculatePackageAllocation,
  calculatePackageCosts,
  determineAmountPaid,
  getDefaultPaymentPercent,
} from "./calculators.ts";
import { PaymentType } from "./enums.ts";

{
  const result = calculateOrderPricing({
    totalAmount: 180,
    fallbackUnitPrice: 50,
    quantity: 3,
  });

  assert.equal(result.unitPrice, 60);
  assert.equal(result.total, 180);
}

{
  const result = calculatePackageCosts({
    packageQuantity: 10,
    productCost: 200,
    extraFees: 50,
    internalShipping: 20,
    orderQuantity: 3,
  });

  assert.equal(result.packageFinalCost, 270);
  assert.equal(result.averageUnitCost, 27);
  assert.equal(result.allocatedCost, 81);
}

{
  const result = calculateMargin({
    revenue: 300,
    cost: 120,
    noRevenueMode: true,
  });

  assert.deepEqual(result, { profit: 0, margin: 0 });
}

{
  const result = calculatePackageAllocation({
    packageBaseQuantity: 10,
    productCost: 200,
    extraFees: 50,
    linkedQuantity: 4,
  });

  assert.equal(result.averageUnitCost, 25);
  assert.equal(result.allocatedProductCost, 80);
  assert.equal(result.allocatedExtraFees, 20);
  assert.equal(result.allocatedTotalCost, 100);
}

{
  assert.equal(getDefaultPaymentPercent(PaymentType.Full), 100);
  assert.equal(getDefaultPaymentPercent(PaymentType.Deposit50), 50);
  assert.equal(getDefaultPaymentPercent(PaymentType.None), 0);

  const amountPaid = determineAmountPaid({
    paymentType: PaymentType.Deposit50,
    total: 240,
    amountPaidInput: -1,
    amountPaidPercentInput: -1,
    amountPaidSource: "",
    isStockOrder: 0,
  });

  assert.equal(amountPaid, 120);
}

console.log("Shared calculator tests passed");
