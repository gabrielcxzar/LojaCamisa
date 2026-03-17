import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { registerShipmentTracking } from "@/lib/tracking";
import {
  allocateInternalStockToSaleOrder,
  type CreateOrderItemInput,
  createOrder,
  deleteOrder,
  getImportPackageById,
  getProductBySlug,
  linkOrderToImportPackage,
  logAction,
  recalculateImportPackageAllocations,
  upsertImportPackage,
} from "@/lib/db/queries";

function normalizeNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

type QuickItemRow = {
  team: string;
  model: string;
  description: string;
  size: string;
  quantity: number;
};

function readFormString(formData: FormData, key: string, fallback = "") {
  return String(formData.get(key) ?? fallback).trim();
}

function readFormNumberField(formData: FormData, key: string, fallback = 0) {
  return normalizeNumber(formData.get(key), fallback);
}

function readFormCheckbox(formData: FormData, key: string) {
  return formData.get(key) !== null;
}

function collectQuickItems(formData: FormData): QuickItemRow[] {
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

function buildItemsWithPrice(items: CreateOrderItemInput[], distributedUnitPrice: number) {
  return items.map((item) => {
    const quantity = item.quantity > 0 ? item.quantity : 1;
    const unitPrice = distributedUnitPrice;
    return {
      ...item,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity,
    };
  });
}

type AmountPaidParams = {
  paymentType: string;
  total: number;
  amountPaidInput: number;
  amountPaidPercentInput: number;
  amountPaidSource: string;
  isStockOrder: number;
};

function determineAmountPaid({
  paymentType,
  total,
  amountPaidInput,
  amountPaidPercentInput,
  amountPaidSource,
  isStockOrder,
}: AmountPaidParams) {
  let amountPaid =
    paymentType === "FULL" ? total : paymentType === "DEPOSIT_50" ? total * 0.5 : 0;
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

export async function createOrderManual(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const entryMode = readFormString(formData, "entryMode", "quick") as "quick" | "advanced";
  const productMode = readFormString(formData, "productMode", "custom") as "custom" | "existing";
  const productSlug = readFormString(formData, "productSlug");
  const customName = readFormString(formData, "customName");
  const customTeam = readFormString(formData, "customTeam");
  const customModel = readFormString(formData, "customModel");
  const customDescription = readFormString(formData, "customDescription");

  const size = readFormString(formData, "size");
  const quantity = readFormNumberField(formData, "quantity", 1);
  const orderTotalInput = readFormNumberField(formData, "orderTotal", 0);
  const unitPriceInput = readFormNumberField(formData, "unitPrice", 0);
  const paymentType = readFormString(formData, "paymentType", "NONE");
  const amountPaidInput = readFormNumberField(formData, "amountPaid", -1);
  const amountPaidPercentInput = readFormNumberField(formData, "amountPaidPercent", -1);
  const amountPaidSource = readFormString(formData, "amountPaidSource");
  const afterSubmit = readFormString(formData, "afterSubmit", "open");
  const notes = readFormString(formData, "notes");
  const isPersonalUseRaw = readFormCheckbox(formData, "isPersonalUse") ? 1 : 0;
  const isStockOrderRaw = readFormCheckbox(formData, "isStockOrder") ? 1 : 0;
  const isPersonalUse = isPersonalUseRaw;
  const isStockOrder = isPersonalUseRaw ? 0 : isStockOrderRaw;

  const packageMode = readFormString(formData, "packageMode", "new");
  const existingPackageId = readFormString(formData, "existingPackageId");
  const stockSourceOrderId = readFormString(formData, "stockSourceOrderId");
  const supplierId = readFormString(formData, "supplierId");
  const packageQuantityInput = readFormNumberField(formData, "packageQuantity", 0);
  const productCostInput = readFormNumberField(formData, "productCost", 0);
  const extraFeesInput = readFormNumberField(formData, "extraFees", 0);
  const internalShippingInput = readFormNumberField(formData, "internalShipping", 0);
  const paidAt = readFormString(formData, "paidAt");
  const packageNotes = readFormString(formData, "packageNotes");

  const trackingCode = readFormString(formData, "trackingCode");
  const carrier = readFormString(formData, "carrier");
  const originCountry = readFormString(formData, "originCountry", "China");

  const name = readFormString(formData, "name");
  const emailInput = readFormString(formData, "email").toLowerCase();
  const phone = readFormString(formData, "phone");
  const line1 = readFormString(formData, "line1");
  const line2 = readFormString(formData, "line2");
  const city = readFormString(formData, "city");
  const state = readFormString(formData, "state");
  const postalCode = readFormString(formData, "postalCode");
  const country = readFormString(formData, "country", "Brasil");

  const email = emailInput || `cliente-${Date.now()}@local.invalid`;
  const quickItems = collectQuickItems(formData);
  const isQuickMultiItem = entryMode === "quick" && quickItems.length > 0;

  if (!name || !line1 || !city || !state || (!isQuickMultiItem && !size)) {
    throw new Error("Dados incompletos para criar pedido.");
  }

  const allowedPayment = ["NONE", "DEPOSIT_50", "FULL"];
  if (!allowedPayment.includes(paymentType)) {
    throw new Error("Tipo de pagamento invalido.");
  }

  const qty = quantity > 0 ? quantity : 1;
  const defaultItemName = customName || "Camisa de time sob encomenda";
  let items: CreateOrderItemInput[] = [];
  let finalUnitPrice = unitPriceInput;
  let finalNotes = notes || null;

  if (productMode === "existing") {
    if (!productSlug) {
      throw new Error("Selecione um produto do catalogo.");
    }

    const product = await getProductBySlug(productSlug);
    if (!product) {
      throw new Error("Produto selecionado invalido.");
    }

    items = [
      {
        productId: product.id,
        itemName: product.name,
        itemDescription: product.description,
        size,
        quantity: qty,
        unitPrice: 0,
      },
    ];

    if (finalUnitPrice <= 0) {
      finalUnitPrice = orderTotalInput > 0 ? orderTotalInput / qty : Number(product.base_price);
    }
  } else if (isQuickMultiItem) {
    items = quickItems.map((item) => ({
      itemName: defaultItemName,
      itemDescription: [item.team || "Time nao informado", item.model || "Sem modelo", item.description]
        .filter(Boolean)
        .join(" | "),
      size: item.size,
      quantity: item.quantity,
      unitPrice: 0,
    }));

    const quickDetails = quickItems
      .map((item, index) => {
        const itemParts = [
          `${index + 1}) Time: ${item.team || "Time nao informado"}`,
          `Modelo: ${item.model || "Sem modelo"}`,
          `Tam: ${item.size}`,
          `Qtd: ${item.quantity}`,
          item.description ? `Descricao: ${item.description}` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        return itemParts;
      })
      .join("\n");
    const quickNote = `[Pedido rapido multiplo]\n${quickDetails}`;
    finalNotes = finalNotes ? `${finalNotes}\n\n${quickNote}` : quickNote;
  } else {
    const finalName = customName || "Camisa de time sob encomenda";
    const finalTeam = customTeam || "Time nao informado";
    const finalModel = customModel || "Sem modelo";

    items = [
      {
        itemName: finalName,
        itemDescription: [finalTeam, finalModel, customDescription].filter(Boolean).join(" | "),
        size,
        quantity: qty,
        unitPrice: 0,
      },
    ];

    if (finalUnitPrice <= 0 && orderTotalInput > 0) {
      finalUnitPrice = orderTotalInput / qty;
    }

    const quickDetails = [
      `Item: ${finalName}`,
      `Time: ${finalTeam}`,
      `Modelo: ${finalModel}`,
      customDescription ? `Descricao: ${customDescription}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    finalNotes = finalNotes
      ? `${finalNotes}\n\n[Pedido rapido] ${quickDetails}`
      : `[Pedido rapido] ${quickDetails}`;
  }

  if (items.length === 0) {
    throw new Error("Nenhum item valido encontrado para o pedido.");
  }

  const totalQuantity = Math.max(
    0,
    items.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 0), 0),
  );

  if (totalQuantity <= 0) {
    throw new Error("Informe pelo menos uma camisa com quantidade valida.");
  }

  if (finalUnitPrice <= 0 && orderTotalInput > 0) {
    finalUnitPrice = orderTotalInput / totalQuantity;
  }

  const distributedUnitPrice =
    orderTotalInput > 0 ? orderTotalInput / totalQuantity : finalUnitPrice;
  const itemsWithPrice = buildItemsWithPrice(items, distributedUnitPrice);

  let total =
    orderTotalInput > 0
      ? orderTotalInput
      : itemsWithPrice.reduce((sum, item) => sum + item.totalPrice, 0);
  if (isPersonalUse && orderTotalInput <= 0) {
    finalUnitPrice = 0;
    for (const item of itemsWithPrice) {
      item.unitPrice = 0;
      item.totalPrice = 0;
    }
    total = 0;
  }

  if (!isPersonalUse && !isStockOrder && finalUnitPrice <= 0) {
    throw new Error("Informe o valor vendido total para calcular o pedido.");
  }
  if (!isPersonalUse && !isStockOrder && total <= 0) {
    throw new Error("Valor vendido invalido.");
  }

  if (!["new", "existing", "none", "internal_stock"].includes(packageMode)) {
    throw new Error("Modo de pacote invalido.");
  }
  if (packageMode === "internal_stock" && (isPersonalUse || isStockOrder)) {
    throw new Error("Baixa de estoque interno so pode ser usada em pedido comercial.");
  }
  if (packageMode === "internal_stock" && !stockSourceOrderId) {
    throw new Error("Selecione um pedido de estoque para dar baixa.");
  }
  if (packageMode === "none" && !isPersonalUse) {
    throw new Error("Pedido comercial deve ser vinculado a um pacote.");
  }
  if (packageMode === "new") {
    if (!isPersonalUse && productCostInput <= 0) {
      throw new Error("Informe o valor pago ao fornecedor para pedido comercial.");
    }
    if (!supplierId && !isPersonalUse) {
      throw new Error("Selecione um fornecedor para o novo pacote.");
    }
  }
  if (packageMode === "existing" && !existingPackageId) {
    throw new Error("Selecione um pacote existente.");
  }

  const amountPaid = determineAmountPaid({
    paymentType,
    total,
    amountPaidInput,
    amountPaidPercentInput,
    amountPaidSource,
    isStockOrder,
  });

  const { orderId } = await createOrder({
    items: itemsWithPrice,
    total,
    paymentType: isStockOrder ? "NONE" : paymentType,
    amountPaid,
    isPersonalUse,
    isStockOrder,
    notes: finalNotes,
    customer: { name, email, phone: phone || null },
    address: {
      line1,
      line2: line2 || null,
      city,
      state,
      postalCode: postalCode || null,
      country,
    },
  });

  let internalStockSummary: {
    sourceOrderCode: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  } | null = null;

  if (packageMode === "internal_stock") {
    try {
      internalStockSummary = await allocateInternalStockToSaleOrder({
        sourceOrderId: stockSourceOrderId,
        saleOrderId: orderId,
        quantity: totalQuantity,
      });
    } catch (error) {
      await deleteOrder(orderId);
      throw error;
    }
  }

  let packageIdToLink: string | null = null;
  if (packageMode === "new") {
    const packageQuantity = Math.max(1, Math.round(packageQuantityInput || totalQuantity));
    packageIdToLink = await upsertImportPackage({
      supplierId: supplierId || null,
      packageQuantity,
      productCost: productCostInput,
      extraFees: extraFeesInput,
      internalShipping: internalShippingInput,
      trackingCode: trackingCode || null,
      carrier: carrier || null,
      originCountry: originCountry || "China",
      paidAt: paidAt || null,
      notes: packageNotes || null,
    });

    if (trackingCode) {
      try {
        await registerShipmentTracking(trackingCode, carrier || "other");
      } catch {
        // Keep saved tracking even when external provider is unavailable.
      }
    }
  }

  if (packageMode === "existing") {
    const importPackage = await getImportPackageById(existingPackageId);
    if (!importPackage) {
      throw new Error("Pacote selecionado nao encontrado.");
    }
    packageIdToLink = importPackage.id;
  }

  if (packageIdToLink) {
    await linkOrderToImportPackage(orderId, packageIdToLink);
    await recalculateImportPackageAllocations(packageIdToLink);
  }

  await logAction({
    userEmail: session.user.email ?? "admin",
    action: internalStockSummary
      ? `Criou pedido manual com baixa de estoque ${internalStockSummary.sourceOrderCode} (${internalStockSummary.quantity} camisa(s))`
      : "Criou pedido manual",
    orderId,
  });

  if (afterSubmit === "new") {
    redirect("/admin/pedidos/novo");
  }

  redirect(`/admin/pedidos/${orderId}`);
}
