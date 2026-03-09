import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { registerShipmentTracking } from "@/lib/tracking";
import {
  createOrder,
  getProductBySlug,
  logAction,
  updateOrderStatus,
  upsertProduct,
  upsertShipment,
} from "@/lib/db/queries";

function normalizeNumber(value: FormDataEntryValue | null, fallback = 0) {
  if (value === null || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createOrderManual(formData: FormData) {
  "use server";

  const session = await requireAdmin();
  const productMode = String(formData.get("productMode") ?? "custom");
  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const customName = String(formData.get("customName") ?? "").trim();
  const customTeam = String(formData.get("customTeam") ?? "").trim();
  const customModel = String(formData.get("customModel") ?? "").trim();
  const customDescription = String(formData.get("customDescription") ?? "").trim();
  const customPrice = normalizeNumber(formData.get("customPrice"), 0);

  const size = String(formData.get("size") ?? "").trim();
  const quantity = normalizeNumber(formData.get("quantity"), 1);
  const unitPrice = normalizeNumber(formData.get("unitPrice"), 0);
  const paymentType = String(formData.get("paymentType") ?? "NONE");
  const amountPaidInput = normalizeNumber(formData.get("amountPaid"), -1);
  const amountPaidPercentInput = normalizeNumber(formData.get("amountPaidPercent"), -1);
  const amountPaidSource = String(formData.get("amountPaidSource") ?? "").trim();
  const status = String(formData.get("status") ?? "AWAITING_SUPPLIER");
  const notes = String(formData.get("notes") ?? "").trim();

  const trackingCode = String(formData.get("trackingCode") ?? "").trim();
  const carrier = String(formData.get("carrier") ?? "").trim();
  const originCountry = String(formData.get("originCountry") ?? "China").trim();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const postalCode = String(formData.get("postalCode") ?? "").trim();
  const country = String(formData.get("country") ?? "Brasil").trim();

  if (!name || !email || !line1 || !city || !state || !size) {
    throw new Error("Dados incompletos para criar pedido.");
  }

  const allowedPayment = ["NONE", "DEPOSIT_50", "FULL"];
  if (!allowedPayment.includes(paymentType)) {
    throw new Error("Tipo de pagamento invalido.");
  }
  const allowedStatus = [
    "AWAITING_PAYMENT",
    "AWAITING_SUPPLIER",
    "PREPARING",
    "SHIPPED",
    "DELIVERED",
    "CANCELED",
  ];
  if (!allowedStatus.includes(status)) {
    throw new Error("Status invalido.");
  }

  let productId = "";
  let finalUnitPrice = unitPrice;

  if (productMode === "existing") {
    if (!productSlug) {
      throw new Error("Selecione um produto do catalogo.");
    }
    const product = await getProductBySlug(productSlug);
    if (!product) {
      throw new Error("Produto selecionado invalido.");
    }
    productId = product.id;
    if (!finalUnitPrice || finalUnitPrice <= 0) {
      finalUnitPrice = Number(product.base_price);
    }
  } else {
    const finalName = customName || "Camisa de time sob encomenda";
    const finalTeam = customTeam || "Time nao informado";
    const finalModel = customModel || "Sem modelo";
    const finalDescription = customDescription || "Pedido rapido criado no painel.";
    finalUnitPrice = customPrice > 0 ? customPrice : finalUnitPrice;

    if (finalUnitPrice <= 0) {
      throw new Error("Informe o preco unitario da camisa.");
    }

    const slugBase = slugify(`${finalTeam}-${finalModel}-${finalName}`) || "camisa";
    productId = await upsertProduct({
      name: finalName,
      team: finalTeam,
      model: finalModel,
      description: finalDescription,
      slug: `${slugBase}-${randomUUID().slice(0, 8)}`,
      basePrice: finalUnitPrice,
    });
  }

  const qty = quantity > 0 ? quantity : 1;
  const total = finalUnitPrice * qty;
  if (finalUnitPrice <= 0) {
    throw new Error("Preco unitario invalido.");
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
    productId,
    size,
    quantity: qty,
    unitPrice: finalUnitPrice,
    total,
    paymentType,
    amountPaid,
    status,
    notes: notes || null,
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

  if (trackingCode) {
    await upsertShipment({
      orderId,
      trackingCode,
      carrier: carrier || "other",
      originCountry,
    });
    await updateOrderStatus(orderId, "SHIPPED", "Rastreamento registrado na criacao");

    try {
      await registerShipmentTracking(trackingCode, carrier || "other");
    } catch {
      // Keep saved tracking even when external provider is unavailable.
    }
  }

  await logAction({
    userEmail: session.user.email ?? "admin",
    action: "Criou pedido manual",
    orderId,
  });

  redirect(`/admin/pedidos/${orderId}`);
}
