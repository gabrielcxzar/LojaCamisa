import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  calculatePackageAllocation,
  calculatePackageCosts,
} from "@/modules/shared/domain/calculators";
import { OrderStatus, PaymentDirection } from "@/modules/shared/domain/enums";
import { parseUpdateOrderFinanceFormData } from "@/modules/shared/validation/order-forms";
import {
  type CreateOrderItemInput,
  createOrder,
  deleteImportPackageIfOrphan,
  deleteOrder,
  getInternalStockAllocationBySaleOrderId,
  getOrderDetail,
  getImportPackageByOrderId,
  getLinkedOrdersForImportPackage,
  logAction,
  recalculateImportPackageAllocations,
  updateOrderSaleData,
  updateOrderStatus,
  upsertImportPackage,
  upsertShipment,
  upsertSupplierOrder,
} from "@/lib/db/queries";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { registerShipmentTracking } from "@/lib/tracking";

export async function updateOrderStatusAction(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!orderId || !status) return;
  const allowed = Object.values(OrderStatus);
  if (!allowed.includes(status)) {
    throw new Error("Status invalido.");
  }

  await updateOrderStatus(orderId, status, note || null);
  await logAction({
    userEmail: session.user.email ?? "admin",
    action: `Alterou status para ${status}`,
    orderId,
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function updateSupplierInfo(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const parsed = parseUpdateOrderFinanceFormData(formData);
  const {
    orderId,
    supplierId,
    totalSold,
    isPersonalUseRaw,
    isStockOrderRaw,
    legacyUnitCost,
    legacyTotalCost,
    packageQuantityInput,
    productCostInput,
    extraFeesInput,
    paidAt,
    hasPackageQuantityField,
    hasProductCostField,
    hasExtraFeesField,
  } = parsed;
  const isPersonalUse = isPersonalUseRaw;
  const isStockOrder = isPersonalUseRaw ? 0 : isStockOrderRaw;

  if (!orderId) return;

  try {
    const stockAllocation = await getInternalStockAllocationBySaleOrderId(orderId);

    if (
      totalSold < 0 ||
      legacyUnitCost < 0 ||
      legacyTotalCost < 0 ||
      packageQuantityInput < 0 ||
      productCostInput < 0 ||
      extraFeesInput < 0
    ) {
      throw new Error("Valores financeiros invalidos.");
    }
    if (!isPersonalUse && !isStockOrder && totalSold <= 0) {
      throw new Error("Informe o valor vendido total do pedido.");
    }
    if (stockAllocation && (isPersonalUse || isStockOrder)) {
      throw new Error(
        "Pedido com baixa de estoque interno nao pode ser alterado para uso pessoal/estoque.",
      );
    }
    if (!stockAllocation && !isPersonalUse && productCostInput <= 0) {
      throw new Error("Pedido comercial exige valor pago ao fornecedor.");
    }

    await updateOrderSaleData({
      orderId,
      totalAmount: totalSold,
      isPersonalUse,
      isStockOrder,
    });

    if (stockAllocation) {
      await upsertSupplierOrder({
        orderId,
        supplierId: stockAllocation.supplier_id,
        productCost: Number(stockAllocation.total_cost),
        extraFees: 0,
        packageQuantity: Number(stockAllocation.quantity),
        unitCost: Number(stockAllocation.unit_cost),
        totalCost: Number(stockAllocation.total_cost),
        paidAt: null,
      });

      await db
        .prepare(
          "DELETE FROM payments WHERE order_id = ? AND direction = ? AND method = ?",
        )
        .run(orderId, PaymentDirection.Outgoing, "Fornecedor");

      await logAction({
        userEmail: session.user.email ?? "admin",
        action: `Atualizou venda com custo travado do estoque ${stockAllocation.source_order_code}`,
        orderId,
      });

      revalidatePath(`/admin/pedidos/${orderId}`);
      revalidatePath("/admin/pedidos");
      revalidatePath("/admin/financeiro");
      return;
    }

    const linkedImportPackage = await getImportPackageByOrderId(orderId);
    if (linkedImportPackage) {
      if (!supplierId && !isPersonalUse) {
        throw new Error("Selecione um fornecedor para pedido comercial.");
      }

      const linkedOrders = await getLinkedOrdersForImportPackage(linkedImportPackage.id);
      const linkedTotalQuantity = linkedOrders.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
        0,
      );
      const packageQuantity = Math.max(
        linkedTotalQuantity,
        Math.round(packageQuantityInput || Number(linkedImportPackage.package_quantity) || 1),
        1,
      );
      await upsertImportPackage({
        packageId: linkedImportPackage.id,
        supplierId: supplierId || linkedImportPackage.supplier_id || null,
        packageQuantity,
        productCost: productCostInput,
        extraFees: extraFeesInput,
        internalShipping: Number(linkedImportPackage.internal_shipping ?? 0),
        trackingCode: linkedImportPackage.tracking_code ?? null,
        carrier: linkedImportPackage.carrier ?? null,
        originCountry: linkedImportPackage.origin_country ?? null,
        paidAt: paidAt || null,
        notes: linkedImportPackage.notes ?? null,
      });

      await recalculateImportPackageAllocations(linkedImportPackage.id);
      await logAction({
        userEmail: session.user.email ?? "admin",
        action: `Atualizou pacote ${linkedImportPackage.code} e recalculou rateio`,
        orderId,
      });

      revalidatePath(`/admin/pedidos/${orderId}`);
      revalidatePath("/admin/pedidos");
      revalidatePath("/admin/financeiro");
      return;
    }

    if (!supplierId) {
      if (!isPersonalUse) {
        throw new Error("Selecione um fornecedor para pedido comercial.");
      }

      await logAction({
        userEmail: session.user.email ?? "admin",
        action: "Atualizou financeiro (uso pessoal)",
        orderId,
      });

      revalidatePath(`/admin/pedidos/${orderId}`);
      revalidatePath("/admin/pedidos");
      revalidatePath("/admin/financeiro");
      return;
    }

    const quantityRow = await db
      .prepare<{ quantity: number }>(
        "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM order_items WHERE order_id = ?",
      )
      .get(orderId);
    const orderQuantity = Number(quantityRow?.quantity ?? 0);
    if (orderQuantity <= 0) {
      throw new Error("Pedido sem quantidade valida para calcular custo medio.");
    }

    const hasPackageData = hasPackageQuantityField || hasProductCostField || hasExtraFeesField;

    let packageQuantity = orderQuantity;
    let productCost = legacyTotalCost;
    let extraFees = 0;
    let unitCost = legacyUnitCost;
    let totalCost = legacyTotalCost;

    if (hasPackageData) {
      packageQuantity = Math.max(1, Math.round(packageQuantityInput || orderQuantity));
      productCost = productCostInput;
      extraFees = extraFeesInput;

      const packageCosts = calculatePackageCosts({
        packageQuantity,
        productCost,
        extraFees,
        orderQuantity,
      });
      unitCost = packageCosts.averageUnitCost;
      totalCost = packageCosts.allocatedCost;
    } else if (unitCost <= 0 && totalCost > 0) {
      unitCost = totalCost / orderQuantity;
      packageQuantity = orderQuantity;
      productCost = totalCost;
    }

    const shipment = await db
      .prepare<{ tracking_code: string | null }>(
        "SELECT tracking_code FROM shipments WHERE order_id = ?",
      )
      .get(orderId);

    if (hasPackageData && shipment?.tracking_code) {
      const linkedOrders = await db
        .prepare<{ order_id: string; quantity: number }>(
          `
          SELECT s.order_id, COALESCE(SUM(oi.quantity), 0) AS quantity
          FROM shipments s
          LEFT JOIN order_items oi ON oi.order_id = s.order_id
          WHERE s.tracking_code = ?
          GROUP BY s.order_id
          `,
        )
        .all(shipment.tracking_code);

      const validLinkedOrders = linkedOrders.filter((item) => Number(item.quantity) > 0);
      if (validLinkedOrders.length > 1) {
        const linkedTotalQuantity = validLinkedOrders.reduce(
          (sum, item) => sum + Number(item.quantity),
          0,
        );
        const packageBaseQuantity = Math.max(
          1,
          Math.round(packageQuantityInput || linkedTotalQuantity),
        );
        for (const linkedOrder of validLinkedOrders) {
          const allocation = calculatePackageAllocation({
            packageBaseQuantity,
            productCost: productCostInput,
            extraFees: extraFeesInput,
            linkedQuantity: Number(linkedOrder.quantity),
          });

          await upsertSupplierOrder({
            orderId: linkedOrder.order_id,
            supplierId,
            productCost: allocation.allocatedProductCost,
            extraFees: allocation.allocatedExtraFees,
            packageQuantity: packageBaseQuantity,
            unitCost: allocation.averageUnitCost,
            totalCost: allocation.allocatedTotalCost,
            paidAt: linkedOrder.order_id === orderId ? paidAt || null : null,
          });

          revalidatePath(`/admin/pedidos/${linkedOrder.order_id}`);
        }

        await logAction({
          userEmail: session.user.email ?? "admin",
          action: `Rateou custos do pacote ${shipment.tracking_code} em ${validLinkedOrders.length} pedidos`,
          orderId,
        });

        revalidatePath("/admin/pedidos");
        revalidatePath("/admin/financeiro");
        return;
      }
    }

    await upsertSupplierOrder({
      orderId,
      supplierId,
      productCost,
      extraFees,
      packageQuantity,
      unitCost,
      totalCost,
      paidAt: paidAt || null,
    });
    await logAction({
      userEmail: session.user.email ?? "admin",
      action: "Atualizou financeiro do pedido",
      orderId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao salvar financeiro";
    console.error("Falha em updateSupplierInfo", {
      orderId,
      supplierId,
      isPersonalUse,
      isStockOrder,
      totalSold,
      message,
    });
    await logAction({
      userEmail: session.user.email ?? "admin",
      action: `Falha ao atualizar financeiro: ${message}`,
      orderId,
    });
  }

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/financeiro");
}

export async function updateShipmentInfo(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const trackingCode = String(formData.get("trackingCode") ?? "");
  const carrier = String(formData.get("carrier") ?? "");
  const originCountry = String(formData.get("originCountry") ?? "Tailandia");

  if (!orderId || !trackingCode) return;

  await upsertShipment({
    orderId,
    trackingCode,
    carrier,
    originCountry,
  });

  try {
    await registerShipmentTracking(trackingCode, carrier);
  } catch {
    // Mantem o rastreio salvo mesmo sem chave externa configurada
  }

  await updateOrderStatus(orderId, "SHIPPED", "Rastreamento registrado");
  await logAction({
    userEmail: session.user.email ?? "admin",
    action: "Registrou rastreamento",
    orderId,
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
}

export async function cancelOrder(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  await updateOrderStatus(orderId, "CANCELED", "Pedido cancelado");
  await logAction({
    userEmail: session.user.email ?? "admin",
    action: "Cancelou pedido",
    orderId,
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath(`/admin/pedidos`);
}

export async function duplicateOrderAction(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  const data = await getOrderDetail(orderId);
  if (!data || data.items.length === 0) {
    throw new Error("Pedido nao encontrado para duplicar.");
  }

  const { order, customer, address, items } = data;
  const fallbackEmail = `cliente-${Date.now()}@local.invalid`;
  const duplicatedItems: CreateOrderItemInput[] = items.map((item) => ({
    productId: item.product_id ?? null,
    itemName: item.item_name ?? item.name ?? "Camisa de time sob encomenda",
    itemDescription: item.item_description ?? null,
    size: item.size,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    totalPrice:
      Number(item.total_price) > 0
        ? Number(item.total_price)
        : Number(item.quantity) * Number(item.unit_price),
  }));

  const duplicated = await createOrder({
    items: duplicatedItems,
    total: Number(order.total_amount),
    paymentType: order.payment_type,
    amountPaid: 0,
    isPersonalUse: order.is_personal_use,
    isStockOrder: order.is_stock_order,
    notes: order.notes
      ? `[Duplicado de ${order.code}]\n${order.notes}`
      : `[Duplicado de ${order.code}]`,
    customer: {
      name: customer?.name ?? "Cliente",
      email: customer?.email || fallbackEmail,
      phone: customer?.phone ?? null,
    },
    address: {
      line1: address?.line1 ?? "Endereco nao informado",
      line2: address?.line2 ?? null,
      city: address?.city ?? "Cidade",
      state: address?.state ?? "Estado",
      postalCode: address?.postal_code ?? null,
      country: address?.country ?? "Brasil",
    },
  });

  await logAction({
    userEmail: session.user.email ?? "admin",
    action: `Duplicou pedido ${order.code}`,
    orderId: duplicated.orderId,
  });

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${duplicated.orderId}`);
}

export async function deleteOrderAction(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;

  const { db } = await import("@/lib/db");
  const order = await db
    .prepare("SELECT code FROM orders WHERE id = ?")
    .get(orderId) as { code: string } | undefined;
  const linkedImportPackage = await getImportPackageByOrderId(orderId);

  await deleteOrder(orderId);

  if (linkedImportPackage) {
    await recalculateImportPackageAllocations(linkedImportPackage.id);
    const deletedPackageCode = await deleteImportPackageIfOrphan(linkedImportPackage.id);
    if (deletedPackageCode) {
      await logAction({
        userEmail: session.user.email ?? "admin",
        action: `Removeu pacote sem pedidos ${deletedPackageCode}`,
        orderId: null,
      });
    }
  }

  await logAction({
    userEmail: session.user.email ?? "admin",
    action: `Excluiu pedido ${order?.code ?? orderId}`,
    orderId: null,
  });

  revalidatePath(`/admin/pedidos`);
  revalidatePath("/admin/pedidos/novo");
  revalidatePath("/admin/financeiro");
  redirect("/admin/pedidos");
}
