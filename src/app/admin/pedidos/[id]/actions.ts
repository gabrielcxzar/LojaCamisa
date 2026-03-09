import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  deleteOrder,
  getImportPackageByOrderId,
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

function parseNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function updateOrderStatusAction(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!orderId || !status) return;
  const allowed = [
    "AWAITING_PAYMENT",
    "AWAITING_SUPPLIER",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELED",
  ];
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
  const orderId = String(formData.get("orderId") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");
  const totalSold = parseNumber(formData.get("totalSold"), 0);
  const isPersonalUse = formData.get("isPersonalUse") ? 1 : 0;
  const legacyUnitCost = parseNumber(formData.get("unitCost"), 0);
  const legacyTotalCost = parseNumber(formData.get("totalCost"), 0);
  const packageQuantityInput = parseNumber(formData.get("packageQuantity"), 0);
  const productCostInput = parseNumber(formData.get("productCost"), 0);
  const extraFeesInput = parseNumber(formData.get("extraFees"), 0);
  const paidAt = String(formData.get("paidAt") ?? "");

  if (!orderId) return;

  try {
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
    if (!isPersonalUse && totalSold <= 0) {
      throw new Error("Informe o valor vendido total do pedido.");
    }
    if (!isPersonalUse && productCostInput <= 0) {
      throw new Error("Pedido comercial exige valor pago ao fornecedor.");
    }

    await updateOrderSaleData({
      orderId,
      totalAmount: totalSold,
      isPersonalUse,
    });

    const linkedImportPackage = await getImportPackageByOrderId(orderId);
    if (linkedImportPackage) {
      if (!supplierId && !isPersonalUse) {
        throw new Error("Selecione um fornecedor para pedido comercial.");
      }

      const packageQuantity = Math.max(1, Math.round(packageQuantityInput || Number(linkedImportPackage.package_quantity) || 1));
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

    const hasPackageData =
      formData.get("packageQuantity") !== null ||
      formData.get("productCost") !== null ||
      formData.get("extraFees") !== null;

    let packageQuantity = orderQuantity;
    let productCost = legacyTotalCost;
    let extraFees = 0;
    let unitCost = legacyUnitCost;
    let totalCost = legacyTotalCost;

    if (hasPackageData) {
      packageQuantity = Math.max(1, Math.round(packageQuantityInput || orderQuantity));
      productCost = productCostInput;
      extraFees = extraFeesInput;

      const packageFinalCost = productCost + extraFees;
      unitCost = packageFinalCost / packageQuantity;
      totalCost = unitCost * orderQuantity;
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
        const packageFinalCost = productCostInput + extraFeesInput;
        const averageUnitCost = packageFinalCost / packageBaseQuantity;

        for (const linkedOrder of validLinkedOrders) {
          const linkedQuantity = Number(linkedOrder.quantity);
          const ratio = linkedQuantity / packageBaseQuantity;
          const allocatedProductCost = productCostInput * ratio;
          const allocatedExtraFees = extraFeesInput * ratio;
          const allocatedTotalCost = averageUnitCost * linkedQuantity;

          await upsertSupplierOrder({
            orderId: linkedOrder.order_id,
            supplierId,
            productCost: allocatedProductCost,
            extraFees: allocatedExtraFees,
            packageQuantity: packageBaseQuantity,
            unitCost: averageUnitCost,
            totalCost: allocatedTotalCost,
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
  }

  await logAction({
    userEmail: session.user.email ?? "admin",
    action: `Excluiu pedido ${order?.code ?? orderId}`,
    orderId: null,
  });

  revalidatePath(`/admin/pedidos`);
  redirect("/admin/pedidos");
}
