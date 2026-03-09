import { revalidatePath } from "next/cache";

import {
  deleteOrder,
  logAction,
  updateOrderStatus,
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
  const legacyUnitCost = parseNumber(formData.get("unitCost"), 0);
  const legacyTotalCost = parseNumber(formData.get("totalCost"), 0);
  const packageQuantityInput = parseNumber(formData.get("packageQuantity"), 0);
  const productCostInput = parseNumber(formData.get("productCost"), 0);
  const extraFeesInput = parseNumber(formData.get("extraFees"), 0);
  const paidAt = String(formData.get("paidAt") ?? "");

  if (!orderId || !supplierId) return;
  if (
    legacyUnitCost < 0 ||
    legacyTotalCost < 0 ||
    packageQuantityInput < 0 ||
    productCostInput < 0 ||
    extraFeesInput < 0
  ) {
    throw new Error("Valores de custo invalidos.");
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
    action: "Atualizou custos do fornecedor",
    orderId,
  });

  revalidatePath(`/admin/pedidos/${orderId}`);
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

  await deleteOrder(orderId);
  await logAction({
    userEmail: session.user.email ?? "admin",
    action: `Excluiu pedido ${order?.code ?? orderId}`,
    orderId: null,
  });

  revalidatePath(`/admin/pedidos`);
}
