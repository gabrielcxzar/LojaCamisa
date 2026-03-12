import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { registerShipmentTracking } from "@/lib/tracking";
import {
  type CreateOrderItemInput,
  createOrder,
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

export async function createOrderManual(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const entryMode = String(formData.get("entryMode") ?? "quick").trim();
  const productMode = String(formData.get("productMode") ?? "custom");
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const customName = String(formData.get("customName") ?? "").trim();
  const customTeam = String(formData.get("customTeam") ?? "").trim();
  const customModel = String(formData.get("customModel") ?? "").trim();
  const customDescription = String(formData.get("customDescription") ?? "").trim();

  const size = String(formData.get("size") ?? "").trim();
  const quantity = normalizeNumber(formData.get("quantity"), 1);
  const orderTotalInput = normalizeNumber(formData.get("orderTotal"), 0);
  const unitPriceInput = normalizeNumber(formData.get("unitPrice"), 0);
  const paymentType = String(formData.get("paymentType") ?? "NONE");
  const amountPaidInput = normalizeNumber(formData.get("amountPaid"), -1);
  const amountPaidPercentInput = normalizeNumber(formData.get("amountPaidPercent"), -1);
  const amountPaidSource = String(formData.get("amountPaidSource") ?? "").trim();
  const afterSubmit = String(formData.get("afterSubmit") ?? "open").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const isPersonalUse = formData.get("isPersonalUse") ? 1 : 0;

  const packageMode = String(formData.get("packageMode") ?? "new").trim();
  const existingPackageId = String(formData.get("existingPackageId") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const packageQuantityInput = normalizeNumber(formData.get("packageQuantity"), 0);
  const productCostInput = normalizeNumber(formData.get("productCost"), 0);
  const extraFeesInput = normalizeNumber(formData.get("extraFees"), 0);
  const internalShippingInput = normalizeNumber(formData.get("internalShipping"), 0);
  const paidAt = String(formData.get("paidAt") ?? "").trim();
  const packageNotes = String(formData.get("packageNotes") ?? "").trim();

  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  const originCountry = String(formData.get("originCountry") ?? "China").trim();

  const name = String(formData.get("name") ?? "").trim();
  const emailInput = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const country = String(formData.get("country") ?? "Brasil").trim();
  const quickTeams = formData.getAll("quickItemTeam");
  const quickModels = formData.getAll("quickItemModel");
  const quickDescriptions = formData.getAll("quickItemDescription");
  const quickSizes = formData.getAll("quickItemSize");
  const quickQuantities = formData.getAll("quickItemQuantity");

  const email = emailInput || `cliente-${Date.now()}@local.invalid`;

  const quickRowsCount = Math.max(
    quickTeams.length,
    quickModels.length,
    quickDescriptions.length,
    quickSizes.length,
    quickQuantities.length,
  );
  const quickItems = Array.from({ length: quickRowsCount }, (_, index) => {
    const team = normalizeText(quickTeams[index]);
    const model = normalizeText(quickModels[index]);
    const description = normalizeText(quickDescriptions[index]);
    const itemSize = normalizeText(quickSizes[index]) || "M";
    const itemQty = normalizeNumber(quickQuantities[index] ?? null, 1);

    return {
      team,
      model,
      description,
      size: itemSize,
      quantity: itemQty > 0 ? itemQty : 1,
    };
  }).filter((item, index) =>
    index === 0 || Boolean(item.team || item.model || item.description),
  );
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
    1,
    items.reduce((sum, item) => sum + (item.quantity > 0 ? item.quantity : 1), 0),
  );

  if (finalUnitPrice <= 0 && orderTotalInput > 0) {
    finalUnitPrice = orderTotalInput / totalQuantity;
  }

  const distributedUnitPrice =
    orderTotalInput > 0 ? orderTotalInput / totalQuantity : finalUnitPrice;
  const itemsWithPrice = items.map((item) => ({
    ...item,
    quantity: item.quantity > 0 ? item.quantity : 1,
    unitPrice: distributedUnitPrice,
    totalPrice: distributedUnitPrice * (item.quantity > 0 ? item.quantity : 1),
  }));

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

  if (!isPersonalUse && finalUnitPrice <= 0) {
    throw new Error("Informe o valor vendido total para calcular o pedido.");
  }
  if (!isPersonalUse && total <= 0) {
    throw new Error("Valor vendido invalido.");
  }

  if (!["new", "existing", "none"].includes(packageMode)) {
    throw new Error("Modo de pacote invalido.");
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

  let amountPaid =
    paymentType === "FULL" ? total : paymentType === "DEPOSIT_50" ? total * 0.5 : 0;
  if (amountPaidSource === "percent" && amountPaidPercentInput >= 0) {
    amountPaid = total * (amountPaidPercentInput / 100);
  } else if (amountPaidInput >= 0) {
    amountPaid = amountPaidInput;
  } else if (amountPaidPercentInput >= 0) {
    amountPaid = total * (amountPaidPercentInput / 100);
  }

  if (amountPaid < 0) {
    throw new Error("Valor pago invalido.");
  }

  const { orderId } = await createOrder({
    items: itemsWithPrice,
    total,
    paymentType,
    amountPaid,
    isPersonalUse,
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
    action: "Criou pedido manual",
    orderId,
  });

  if (afterSubmit === "new") {
    redirect("/admin/pedidos/novo");
  }

  redirect(`/admin/pedidos/${orderId}`);
}
