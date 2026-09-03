import { z } from "zod";

import { PackageMode, PaymentType } from "../domain/enums.ts";

const entryModeSchema = z.enum(["quick", "advanced"]);
const productModeSchema = z.enum(["custom", "existing"]);
const amountPaidSourceSchema = z.enum(["", "percent", "amount"]);
const afterSubmitSchema = z.enum(["open", "new"]);
const paymentTypeSchema = z.enum([PaymentType.None, PaymentType.Deposit50, PaymentType.Full]);
const packageModeSchema = z.enum([
  PackageMode.New,
  PackageMode.Existing,
  PackageMode.None,
  PackageMode.InternalStock,
]);

const quickItemSchema = z.object({
  team: z.string(),
  model: z.string(),
  description: z.string(),
  size: z.string(),
  quantity: z.number(),
});

const createManualOrderFormSchema = z.object({
  entryMode: entryModeSchema,
  productMode: productModeSchema,
  productSlug: z.string(),
  customName: z.string(),
  customTeam: z.string(),
  customModel: z.string(),
  customDescription: z.string(),
  size: z.string(),
  quantity: z.number(),
  orderTotalInput: z.number(),
  unitPriceInput: z.number(),
  paymentType: paymentTypeSchema,
  amountPaidInput: z.number(),
  amountPaidPercentInput: z.number(),
  amountPaidSource: amountPaidSourceSchema,
  afterSubmit: afterSubmitSchema,
  notes: z.string(),
  isPersonalUseRaw: z.number(),
  isStockOrderRaw: z.number(),
  packageMode: packageModeSchema,
  existingPackageId: z.string(),
  stockSourceOrderId: z.string(),
  supplierId: z.string(),
  packageQuantityInput: z.number(),
  productCostInput: z.number(),
  extraFeesInput: z.number(),
  internalShippingInput: z.number(),
  paidAt: z.string(),
  packageNotes: z.string(),
  trackingCode: z.string(),
  carrier: z.string(),
  originCountry: z.string(),
  name: z.string(),
  emailInput: z.string(),
  phone: z.string(),
  line1: z.string(),
  line2: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  country: z.string(),
  quickItems: z.array(quickItemSchema),
});

const updateOrderFinanceFormSchema = z.object({
  orderId: z.string(),
  supplierId: z.string(),
  totalSold: z.number(),
  isPersonalUseRaw: z.number(),
  isStockOrderRaw: z.number(),
  legacyUnitCost: z.number(),
  legacyTotalCost: z.number(),
  packageQuantityInput: z.number(),
  productCostInput: z.number(),
  extraFeesInput: z.number(),
  paidAt: z.string(),
  hasPackageQuantityField: z.boolean(),
  hasProductCostField: z.boolean(),
  hasExtraFeesField: z.boolean(),
});

function normalizeNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function readFormString(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function normalizeEnumValue<const T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
) {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function readFormNumberField(formData: FormData, key: string, fallback = 0) {
  return normalizeNumber(formData.get(key), fallback);
}

function readFormCheckbox(formData: FormData, key: string) {
  return formData.get(key) !== null;
}

function collectQuickItems(formData: FormData) {
  const quickTeams = formData.getAll("quickItemTeam");
  const quickModels = formData.getAll("quickItemModel");
  const quickDescriptions = formData.getAll("quickItemDescription");
  const quickSizes = formData.getAll("quickItemSize");
  const quickQuantities = formData.getAll("quickItemQuantity");
  const rows = Math.max(
    quickTeams.length,
    quickModels.length,
    quickDescriptions.length,
    quickSizes.length,
    quickQuantities.length,
  );

  return Array.from({ length: rows }, (_, index) => {
    const team = normalizeText(quickTeams[index]);
    const model = normalizeText(quickModels[index]);
    const description = normalizeText(quickDescriptions[index]);
    const size = normalizeText(quickSizes[index]) || "M";
    const quantity = normalizeNumber(quickQuantities[index] ?? null, 1);

    return {
      team,
      model,
      description,
      size,
      quantity: quantity > 0 ? quantity : 0,
    };
  }).filter((item) => item.quantity > 0 && Boolean(item.team || item.model || item.description));
}

export function parseCreateManualOrderFormData(formData: FormData) {
  const rawEntryMode = readFormString(formData, "entryMode", "quick");
  const rawProductMode = readFormString(formData, "productMode", "custom");
  const rawPaymentType = readFormString(formData, "paymentType", PaymentType.None);
  const rawAmountPaidSource = readFormString(formData, "amountPaidSource");
  const rawAfterSubmit = readFormString(formData, "afterSubmit", "open");
  const rawPackageMode = readFormString(formData, "packageMode", PackageMode.New);

  return createManualOrderFormSchema.parse({
    entryMode: normalizeEnumValue(rawEntryMode, ["quick", "advanced"], "quick"),
    productMode: normalizeEnumValue(rawProductMode, ["custom", "existing"], "custom"),
    productSlug: readFormString(formData, "productSlug"),
    customName: readFormString(formData, "customName"),
    customTeam: readFormString(formData, "customTeam"),
    customModel: readFormString(formData, "customModel"),
    customDescription: readFormString(formData, "customDescription"),
    size: readFormString(formData, "size"),
    quantity: readFormNumberField(formData, "quantity", 1),
    orderTotalInput: readFormNumberField(formData, "orderTotal", 0),
    unitPriceInput: readFormNumberField(formData, "unitPrice", 0),
    paymentType: normalizeEnumValue(
      rawPaymentType,
      [PaymentType.None, PaymentType.Deposit50, PaymentType.Full],
      PaymentType.None,
    ),
    amountPaidInput: readFormNumberField(formData, "amountPaid", -1),
    amountPaidPercentInput: readFormNumberField(formData, "amountPaidPercent", -1),
    amountPaidSource: normalizeEnumValue(rawAmountPaidSource, ["", "percent", "amount"], ""),
    afterSubmit: normalizeEnumValue(rawAfterSubmit, ["open", "new"], "open"),
    notes: readFormString(formData, "notes"),
    isPersonalUseRaw: readFormCheckbox(formData, "isPersonalUse") ? 1 : 0,
    isStockOrderRaw: readFormCheckbox(formData, "isStockOrder") ? 1 : 0,
    packageMode: normalizeEnumValue(
      rawPackageMode,
      [PackageMode.New, PackageMode.Existing, PackageMode.None, PackageMode.InternalStock],
      PackageMode.New,
    ),
    existingPackageId: readFormString(formData, "existingPackageId"),
    stockSourceOrderId: readFormString(formData, "stockSourceOrderId"),
    supplierId: readFormString(formData, "supplierId"),
    packageQuantityInput: readFormNumberField(formData, "packageQuantity", 0),
    productCostInput: readFormNumberField(formData, "productCost", 0),
    extraFeesInput: readFormNumberField(formData, "extraFees", 0),
    internalShippingInput: readFormNumberField(formData, "internalShipping", 0),
    paidAt: readFormString(formData, "paidAt"),
    packageNotes: readFormString(formData, "packageNotes"),
    trackingCode: readFormString(formData, "trackingCode"),
    carrier: readFormString(formData, "carrier"),
    originCountry: readFormString(formData, "originCountry", "China"),
    name: readFormString(formData, "name"),
    emailInput: readFormString(formData, "email").toLowerCase(),
    phone: readFormString(formData, "phone"),
    line1: readFormString(formData, "line1"),
    line2: readFormString(formData, "line2"),
    city: readFormString(formData, "city"),
    state: readFormString(formData, "state"),
    postalCode: readFormString(formData, "postalCode"),
    country: readFormString(formData, "country", "Brasil"),
    quickItems: collectQuickItems(formData),
  });
}

export function parseUpdateOrderFinanceFormData(formData: FormData) {
  return updateOrderFinanceFormSchema.parse({
    orderId: String(formData.get("orderId") ?? ""),
    supplierId: String(formData.get("supplierId") ?? ""),
    totalSold: readFormNumberField(formData, "totalSold", 0),
    isPersonalUseRaw: formData.get("isPersonalUse") ? 1 : 0,
    isStockOrderRaw: formData.get("isStockOrder") ? 1 : 0,
    legacyUnitCost: readFormNumberField(formData, "unitCost", 0),
    legacyTotalCost: readFormNumberField(formData, "totalCost", 0),
    packageQuantityInput: readFormNumberField(formData, "packageQuantity", 0),
    productCostInput: readFormNumberField(formData, "productCost", 0),
    extraFeesInput: readFormNumberField(formData, "extraFees", 0),
    paidAt: String(formData.get("paidAt") ?? ""),
    hasPackageQuantityField: formData.get("packageQuantity") !== null,
    hasProductCostField: formData.get("productCost") !== null,
    hasExtraFeesField: formData.get("extraFees") !== null,
  });
}

export type CreateManualOrderFormInput = ReturnType<typeof parseCreateManualOrderFormData>;
export type UpdateOrderFinanceFormInput = ReturnType<typeof parseUpdateOrderFinanceFormData>;
