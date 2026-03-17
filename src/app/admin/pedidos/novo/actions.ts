import { redirect } from "next/navigation";

import {
  calculateOrderPricing,
  determineAmountPaid,
} from "@/modules/shared/domain/calculators";
import {
  PACKAGE_MODE_VALUES,
  PackageMode,
  PaymentType,
} from "@/modules/shared/domain/enums";
import { parseCreateManualOrderFormData } from "@/modules/shared/validation/order-forms";
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

export async function createOrderManual(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const parsed = parseCreateManualOrderFormData(formData);
  const {
    entryMode,
    productMode,
    productSlug,
    customName,
    customTeam,
    customModel,
    customDescription,
    size,
    quantity,
    orderTotalInput,
    unitPriceInput,
    paymentType,
    amountPaidInput,
    amountPaidPercentInput,
    amountPaidSource,
    afterSubmit,
    notes,
    isPersonalUseRaw,
    isStockOrderRaw,
    packageMode,
    existingPackageId,
    stockSourceOrderId,
    supplierId,
    packageQuantityInput,
    productCostInput,
    extraFeesInput,
    internalShippingInput,
    paidAt,
    packageNotes,
    trackingCode,
    carrier,
    originCountry,
    name,
    emailInput,
    phone,
    line1,
    line2,
    city,
    state,
    postalCode,
    country,
    quickItems,
  } = parsed;
  const isPersonalUse = isPersonalUseRaw;
  const isStockOrder = isPersonalUseRaw ? 0 : isStockOrderRaw;

  const email = emailInput || `cliente-${Date.now()}@local.invalid`;
  const isQuickMultiItem = entryMode === "quick" && quickItems.length > 0;

  if (!name || !line1 || !city || !state || (!isQuickMultiItem && !size)) {
    throw new Error("Dados incompletos para criar pedido.");
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

  const pricing = calculateOrderPricing({
    totalAmount: orderTotalInput,
    fallbackUnitPrice: finalUnitPrice,
    quantity: totalQuantity,
  });
  const distributedUnitPrice = pricing.unitPrice;
  const itemsWithPrice = buildItemsWithPrice(items, distributedUnitPrice);

  let total = pricing.total;
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

  if (!PACKAGE_MODE_VALUES.includes(packageMode as PackageMode)) {
    throw new Error("Modo de pacote invalido.");
  }
  if (packageMode === PackageMode.InternalStock && (isPersonalUse || isStockOrder)) {
    throw new Error("Baixa de estoque interno so pode ser usada em pedido comercial.");
  }
  if (packageMode === PackageMode.InternalStock && !stockSourceOrderId) {
    throw new Error("Selecione um pedido de estoque para dar baixa.");
  }
  if (packageMode === PackageMode.None && !isPersonalUse) {
    throw new Error("Pedido comercial deve ser vinculado a um pacote.");
  }
  if (packageMode === PackageMode.New) {
    if (!isPersonalUse && productCostInput <= 0) {
      throw new Error("Informe o valor pago ao fornecedor para pedido comercial.");
    }
    if (!supplierId && !isPersonalUse) {
      throw new Error("Selecione um fornecedor para o novo pacote.");
    }
  }
  if (packageMode === PackageMode.Existing && !existingPackageId) {
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
    paymentType: isStockOrder ? PaymentType.None : paymentType,
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

  if (packageMode === PackageMode.InternalStock) {
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
  if (packageMode === PackageMode.New) {
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

  if (packageMode === PackageMode.Existing) {
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
