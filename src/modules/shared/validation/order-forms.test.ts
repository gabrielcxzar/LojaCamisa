import assert from "node:assert/strict";

import { PackageMode, PaymentType } from "../domain/enums.ts";
import {
  parseCreateManualOrderFormData,
  parseUpdateOrderFinanceFormData,
} from "./order-forms.ts";

{
  const formData = new FormData();
  formData.set("name", "Dan");
  formData.set("line1", "Rua 1");
  formData.set("city", "Salvador");
  formData.set("state", "BA");
  formData.set("size", "G");
  formData.set("quantity", "2");
  formData.set("paymentType", PaymentType.Deposit50);
  formData.set("packageMode", PackageMode.New);
  formData.set("country", "Brasil");

  const parsed = parseCreateManualOrderFormData(formData);

  assert.equal(parsed.entryMode, "quick");
  assert.equal(parsed.productMode, "custom");
  assert.equal(parsed.paymentType, PaymentType.Deposit50);
  assert.equal(parsed.packageMode, PackageMode.New);
  assert.equal(parsed.quantity, 2);
  assert.equal(parsed.country, "Brasil");
  assert.deepEqual(parsed.quickItems, []);
}

{
  const formData = new FormData();
  formData.set("entryMode", "invalid");
  formData.set("productMode", "weird");
  formData.set("paymentType", "PIX");
  formData.set("amountPaidSource", "manual");
  formData.set("afterSubmit", "continue");
  formData.set("packageMode", "legacy");
  formData.set("quantity", "abc");
  formData.set("amountPaid", "nan");
  formData.set("amountPaidPercent", "nan");
  formData.set("name", "Dan");
  formData.set("line1", "Rua 1");
  formData.set("city", "Salvador");
  formData.set("state", "BA");

  const parsed = parseCreateManualOrderFormData(formData);

  assert.equal(parsed.entryMode, "quick");
  assert.equal(parsed.productMode, "custom");
  assert.equal(parsed.paymentType, PaymentType.None);
  assert.equal(parsed.amountPaidSource, "");
  assert.equal(parsed.afterSubmit, "open");
  assert.equal(parsed.packageMode, PackageMode.New);
  assert.equal(parsed.quantity, 1);
  assert.equal(parsed.amountPaidInput, -1);
  assert.equal(parsed.amountPaidPercentInput, -1);
}

{
  const formData = new FormData();
  formData.set("entryMode", "quick");
  formData.append("quickItemTeam", "Bahia");
  formData.append("quickItemModel", "2025");
  formData.append("quickItemDescription", "Torcedor");
  formData.append("quickItemSize", "M");
  formData.append("quickItemQuantity", "3");
  formData.set("name", "Dan");
  formData.set("line1", "Rua 1");
  formData.set("city", "Salvador");
  formData.set("state", "BA");

  const parsed = parseCreateManualOrderFormData(formData);

  assert.equal(parsed.quickItems.length, 1);
  assert.equal(parsed.quickItems[0]?.team, "Bahia");
  assert.equal(parsed.quickItems[0]?.quantity, 3);
  assert.equal(parsed.quickItems[0]?.size, "M");
}

{
  const formData = new FormData();
  formData.set("entryMode", "quick");
  formData.append("quickItemTeam", "Bahia");
  formData.append("quickItemModel", "2025");
  formData.append("quickItemDescription", "");
  formData.append("quickItemSize", "");
  formData.append("quickItemQuantity", "2");
  formData.append("quickItemTeam", "");
  formData.append("quickItemModel", "");
  formData.append("quickItemDescription", "Linha sem identificacao");
  formData.append("quickItemSize", "G");
  formData.append("quickItemQuantity", "0");
  formData.set("name", "Dan");
  formData.set("line1", "Rua 1");
  formData.set("city", "Salvador");
  formData.set("state", "BA");

  const parsed = parseCreateManualOrderFormData(formData);

  assert.equal(parsed.quickItems.length, 1);
  assert.equal(parsed.quickItems[0]?.size, "M");
  assert.equal(parsed.quickItems[0]?.quantity, 2);
}

{
  const formData = new FormData();
  formData.set("orderId", "abc");
  formData.set("supplierId", "sup-1");
  formData.set("totalSold", "150");
  formData.set("unitCost", "20");
  formData.set("totalCost", "60");
  formData.set("packageQuantity", "5");
  formData.set("productCost", "80");
  formData.set("extraFees", "10");
  formData.set("paidAt", "2026-03-17");

  const parsed = parseUpdateOrderFinanceFormData(formData);

  assert.equal(parsed.orderId, "abc");
  assert.equal(parsed.supplierId, "sup-1");
  assert.equal(parsed.totalSold, 150);
  assert.equal(parsed.packageQuantityInput, 5);
  assert.equal(parsed.productCostInput, 80);
  assert.equal(parsed.extraFeesInput, 10);
  assert.equal(parsed.hasPackageQuantityField, true);
}

{
  const formData = new FormData();
  formData.set("orderId", "abc");
  formData.set("supplierId", "sup-1");
  formData.set("totalSold", "x");
  formData.set("unitCost", "");
  formData.set("totalCost", "foo");

  const parsed = parseUpdateOrderFinanceFormData(formData);

  assert.equal(parsed.totalSold, 0);
  assert.equal(parsed.legacyUnitCost, 0);
  assert.equal(parsed.legacyTotalCost, 0);
  assert.equal(parsed.packageQuantityInput, 0);
  assert.equal(parsed.productCostInput, 0);
  assert.equal(parsed.extraFeesInput, 0);
  assert.equal(parsed.hasPackageQuantityField, false);
  assert.equal(parsed.hasProductCostField, false);
  assert.equal(parsed.hasExtraFeesField, false);
}

console.log("Shared form parser tests passed");
