import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";

function now() {
  return new Date().toISOString();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export type ProductRow = {
  id: string;
  name: string;
  team: string;
  model: string;
  slug: string;
  description: string;
  base_price: number;
  active: number;
};

export type OrderRow = {
  id: string;
  code: string;
  customer_id: string;
  address_id: string;
  status: string;
  payment_type: string;
  total_amount: number;
  amount_paid: number;
  is_personal_use: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

type AddressRow = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
};

type SupplierRow = {
  id: string;
  name: string;
  country: string;
  active: number;
  created_at: string;
  updated_at: string;
};

type SupplierOrderRow = {
  id: string;
  order_id: string;
  supplier_id: string;
  supplier_name: string;
  product_cost: number;
  extra_fees: number;
  package_quantity: number;
  unit_cost: number;
  total_cost: number;
  paid_at: string | null;
};

type ShipmentRow = {
  id: string;
  order_id: string;
  tracking_code: string;
  carrier: string;
  origin_country: string;
  eta_date: string | null;
  last_status: string | null;
  last_update_at: string | null;
  created_at: string;
  updated_at: string;
};

type OrderStatusHistoryRow = {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  order_id: string;
  direction: string;
  amount: number;
  method: string | null;
  paid_at: string | null;
  created_at: string;
};

type ActionLogRow = {
  id: string;
  user_email: string;
  action: string;
  order_id: string | null;
  created_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  item_name: string | null;
  item_description: string | null;
  size: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  name: string;
  description?: string;
};

type ListedOrderRow = OrderRow & {
  customer_name: string;
};

type StalledOrderRow = {
  id: string;
  code: string;
  status: string;
  updated_at: string;
  last_update_at: string | null;
};

export type TrackableShipmentRow = {
  order_id: string;
  order_code: string;
  order_status: string;
  tracking_code: string;
  carrier: string;
  last_update_at: string | null;
};

export async function listProducts() {
  return db
    .prepare<ProductRow>("SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC")
    .all();
}

export async function listAllProducts() {
  return db
    .prepare<ProductRow>("SELECT * FROM products ORDER BY created_at DESC")
    .all();
}

export async function getProductBySlug(slug: string) {
  return db
    .prepare<ProductRow>("SELECT * FROM products WHERE slug = ? LIMIT 1")
    .get(slug);
}

export async function getProductById(id: string) {
  return db
    .prepare<ProductRow>("SELECT * FROM products WHERE id = ? LIMIT 1")
    .get(id);
}

export async function getOrderByCode(code: string) {
  const order = await db
    .prepare<OrderRow>("SELECT * FROM orders WHERE code = ? LIMIT 1")
    .get(code);
  if (!order) return null;

  const [customer, address, items, statusHistory] = await Promise.all([
    db.prepare<CustomerRow>("SELECT * FROM customers WHERE id = ?").get(order.customer_id),
    db.prepare<AddressRow>("SELECT * FROM addresses WHERE id = ?").get(order.address_id),
    db
      .prepare<OrderItemRow>(
        `
        SELECT
          oi.*,
          COALESCE(oi.item_name, p.name, 'Item sem nome') as name,
          COALESCE(oi.item_description, p.description) as description
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        `,
      )
      .all(order.id),
    db
      .prepare<OrderStatusHistoryRow>(
        "SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC",
      )
      .all(order.id),
  ]);

  return { order, customer, address, items, statusHistory };
}

export async function listOrders(filters: {
  status?: string;
  query?: string;
  from?: string;
  to?: string;
}) {
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (filters.status && filters.status !== "ALL") {
    conditions.push("o.status = ?");
    params.push(filters.status);
  }

  if (filters.query) {
    conditions.push("LOWER(c.name) LIKE LOWER(?)");
    params.push(`%${filters.query}%`);
  }

  if (filters.from) {
    conditions.push("o.created_at >= ?");
    params.push(filters.from);
  }

  if (filters.to) {
    conditions.push("o.created_at <= ?");
    params.push(filters.to);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return db
    .prepare<ListedOrderRow>(
      `SELECT o.*, c.name as customer_name FROM orders o JOIN customers c ON c.id = o.customer_id ${whereClause} ORDER BY o.created_at DESC`,
    )
    .all(...params);
}

export async function getOrderDetail(orderId: string) {
  const order = await db
    .prepare<OrderRow>("SELECT * FROM orders WHERE id = ?")
    .get(orderId);
  if (!order) return null;

  const [customer, address, items, supplierOrder, shipment, statusHistory, payments] =
    await Promise.all([
      db.prepare<CustomerRow>("SELECT * FROM customers WHERE id = ?").get(order.customer_id),
      db.prepare<AddressRow>("SELECT * FROM addresses WHERE id = ?").get(order.address_id),
      db
        .prepare<OrderItemRow>(
          `
          SELECT
            oi.*,
            COALESCE(oi.item_name, p.name, 'Item sem nome') as name
          FROM order_items oi
          LEFT JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ?
          `,
        )
        .all(order.id),
      db
        .prepare<SupplierOrderRow>(
          "SELECT so.*, s.name as supplier_name FROM supplier_orders so JOIN suppliers s ON s.id = so.supplier_id WHERE so.order_id = ?",
        )
        .get(order.id),
      db.prepare<ShipmentRow>("SELECT * FROM shipments WHERE order_id = ?").get(order.id),
      db
        .prepare<OrderStatusHistoryRow>(
          "SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC",
        )
        .all(order.id),
      db.prepare<PaymentRow>("SELECT * FROM payments WHERE order_id = ?").all(order.id),
    ]);

  return {
    order,
    customer,
    address,
    items,
    supplierOrder,
    shipment,
    statusHistory,
    payments,
  };
}

export async function listSuppliers() {
  return db
    .prepare<SupplierRow>("SELECT * FROM suppliers WHERE active = 1 ORDER BY created_at ASC")
    .all();
}

export async function listAllSuppliers() {
  return db.prepare<SupplierRow>("SELECT * FROM suppliers ORDER BY created_at ASC").all();
}

export async function getSupplierById(id: string) {
  return db
    .prepare<SupplierRow>("SELECT * FROM suppliers WHERE id = ?")
    .get(id);
}

export async function upsertSupplier(data: {
  supplierId?: string;
  name: string;
  country: string;
  active?: number;
}) {
  const nowIso = now();
  if (data.supplierId) {
    await db
      .prepare(
        "UPDATE suppliers SET name = ?, country = ?, active = ?, updated_at = ? WHERE id = ?",
      )
      .run(data.name, data.country, data.active ?? 1, nowIso, data.supplierId);
    return data.supplierId;
  }

  const id = randomUUID();
  await db
    .prepare(
      "INSERT INTO suppliers (id, name, country, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, data.name, data.country, data.active ?? 1, nowIso, nowIso);
  return id;
}

export async function createOrder(data: {
  productId?: string | null;
  itemName: string;
  itemDescription?: string | null;
  size: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentType: string;
  amountPaid: number;
  isPersonalUse?: number;
  status?: string;
  notes?: string | null;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
  };
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode?: string | null;
    country: string;
  };
}) {
  const tx = db.transaction(async () => {
    const orderId = randomUUID();
    const customerId = randomUUID();
    const addressId = randomUUID();
    const orderCode = `LC-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = now();

    await db
      .prepare(
        "INSERT INTO customers (id, name, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        customerId,
        data.customer.name,
        data.customer.email,
        data.customer.phone ?? null,
        nowIso,
        nowIso,
      );

    await db
      .prepare(
        "INSERT INTO addresses (id, customer_id, line1, line2, city, state, postal_code, country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        addressId,
        customerId,
        data.address.line1,
        data.address.line2 ?? null,
        data.address.city,
        data.address.state,
        data.address.postalCode ?? null,
        data.address.country,
        nowIso,
        nowIso,
      );

    const statusValue =
      data.status ??
      (data.amountPaid < data.total ? "AWAITING_PAYMENT" : "AWAITING_SUPPLIER");

    await db
      .prepare(
        "INSERT INTO orders (id, code, customer_id, address_id, status, payment_type, total_amount, amount_paid, is_personal_use, currency, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        orderId,
        orderCode,
        customerId,
        addressId,
        statusValue,
        data.paymentType,
        data.total,
        data.amountPaid,
        data.isPersonalUse ?? 0,
        "BRL",
        data.notes ?? null,
        nowIso,
        nowIso,
      );

    await db
      .prepare(
        "INSERT INTO order_items (id, order_id, product_id, item_name, item_description, size, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        orderId,
        data.productId ?? null,
        data.itemName,
        data.itemDescription ?? null,
        data.size,
        data.quantity,
        data.unitPrice,
        data.total,
      );

    await db
      .prepare(
        "INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), orderId, statusValue, null, nowIso);

    if (data.amountPaid > 0) {
      await db
        .prepare(
          "INSERT INTO payments (id, order_id, direction, amount, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          orderId,
          "INCOMING",
          data.amountPaid,
          "Reserva online",
          nowIso,
          nowIso,
        );
    }

    return { orderId, orderCode };
  });

  return tx();
}

export async function updateOrderSaleData(data: {
  orderId: string;
  totalAmount: number;
  isPersonalUse: number;
}) {
  const quantityRow = await db
    .prepare<{ quantity: number }>(
      "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM order_items WHERE order_id = ?",
    )
    .get(data.orderId);
  const totalQuantity = Number(quantityRow?.quantity ?? 0);

  if (totalQuantity <= 0) {
    throw new Error("Pedido sem quantidade valida.");
  }

  const unitPrice = data.totalAmount / totalQuantity;
  const nowIso = now();

  await db
    .prepare(
      "UPDATE orders SET total_amount = ?, is_personal_use = ?, updated_at = ? WHERE id = ?",
    )
    .run(data.totalAmount, data.isPersonalUse, nowIso, data.orderId);

  await db
    .prepare(
      "UPDATE order_items SET unit_price = ?, total_price = quantity * ? WHERE order_id = ?",
    )
    .run(unitPrice, unitPrice, data.orderId);
}

export async function updateOrderStatus(orderId: string, status: string, note?: string | null) {
  const nowIso = now();
  await db
    .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
    .run(status, nowIso, orderId);
  await db
    .prepare(
      "INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), orderId, status, note ?? null, nowIso);
}

export async function deleteOrder(orderId: string) {
  const tx = db.transaction(async () => {
    await db.prepare("DELETE FROM payments WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM order_status_history WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM shipments WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM supplier_orders WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM action_logs WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);
  });

  await tx();
}

export async function logAction(data: {
  userEmail: string;
  action: string;
  orderId?: string | null;
}) {
  await db
    .prepare(
      "INSERT INTO action_logs (id, user_email, action, order_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), data.userEmail, data.action, data.orderId ?? null, now());
}

export async function listActionLogs(orderId?: string) {
  if (orderId) {
    return db
      .prepare<ActionLogRow>(
        "SELECT * FROM action_logs WHERE order_id = ? ORDER BY created_at DESC",
      )
      .all(orderId);
  }

  return db
    .prepare<ActionLogRow>("SELECT * FROM action_logs ORDER BY created_at DESC LIMIT 50")
    .all();
}

export async function getSetting(key: string) {
  return db
    .prepare<{ value: string }>("SELECT value FROM settings WHERE key = ?")
    .get(key);
}

export async function setSetting(key: string, value: string) {
  const nowIso = now();
  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .run(key, value, nowIso);
}

export async function getMonthlyFinance(month: string) {
  const start = `${month}-01T00:00:00.000Z`;
  const endDate = new Date(`${month}-01T00:00:00.000Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = endDate.toISOString();

  const [salesRow, paidSupplierRow, incomingRow] = await Promise.all([
    db
      .prepare<{ total: number }>(
        "SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE created_at >= ? AND created_at < ?",
      )
      .get(start, end),
    db
      .prepare<{ total: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE direction = ? AND created_at >= ? AND created_at < ?",
      )
      .get("OUTGOING", start, end),
    db
      .prepare<{ total: number; count: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM payments WHERE direction = ? AND created_at >= ? AND created_at < ?",
      )
      .get("INCOMING", start, end),
  ]);

  const totalSales = toNumber(salesRow?.total);
  const totalPaidSupplier = toNumber(paidSupplierRow?.total);
  const totalIncoming = toNumber(incomingRow?.total);
  const incomingCount = toNumber(incomingRow?.count);

  const profit = totalSales - totalPaidSupplier;
  const margin = totalSales ? (profit / totalSales) * 100 : 0;

  return {
    totalSales,
    totalPaidSupplier,
    totalIncoming,
    incomingCount,
    profit,
    margin,
  };
}

export async function getStalledOrders(days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  return db
    .prepare<StalledOrderRow>(
      `
      SELECT o.id, o.code, o.status, o.updated_at, s.last_update_at
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.id
      WHERE o.status IN ('AWAITING_SUPPLIER', 'PREPARING', 'SHIPPED')
      AND (
        (s.last_update_at IS NOT NULL AND s.last_update_at < ?)
        OR (s.last_update_at IS NULL AND o.updated_at < ?)
      )
      ORDER BY o.updated_at ASC
      `,
    )
    .all(sinceIso, sinceIso);
}

export async function listTrackableShipments(options?: {
  refreshIntervalHours?: number;
  limit?: number;
}) {
  const refreshIntervalHours =
    Number.isFinite(options?.refreshIntervalHours) && (options?.refreshIntervalHours ?? 0) > 0
      ? Number(options?.refreshIntervalHours)
      : 6;
  const limit =
    Number.isFinite(options?.limit) && (options?.limit ?? 0) > 0
      ? Number(options?.limit)
      : 20;
  const threshold = new Date(
    Date.now() - refreshIntervalHours * 60 * 60 * 1000,
  ).toISOString();

  return db
    .prepare<TrackableShipmentRow>(
      `
      SELECT
        s.order_id,
        o.code as order_code,
        o.status as order_status,
        s.tracking_code,
        s.carrier,
        s.last_update_at
      FROM shipments s
      JOIN orders o ON o.id = s.order_id
      WHERE o.status IN ('AWAITING_SUPPLIER', 'PREPARING', 'SHIPPED')
      AND (s.last_update_at IS NULL OR s.last_update_at <= ?)
      ORDER BY COALESCE(s.last_update_at, o.updated_at) ASC
      LIMIT ?
      `,
    )
    .all(threshold, limit);
}

export async function upsertSupplierOrder(data: {
  orderId: string;
  supplierId: string;
  productCost: number;
  extraFees: number;
  packageQuantity: number;
  unitCost: number;
  totalCost: number;
  paidAt?: string | null;
}) {
  const existing = await db
    .prepare<{ id: string }>("SELECT id FROM supplier_orders WHERE order_id = ?")
    .get(data.orderId);
  const nowIso = now();

  if (existing) {
    await db
      .prepare(
        "UPDATE supplier_orders SET supplier_id = ?, product_cost = ?, extra_fees = ?, package_quantity = ?, unit_cost = ?, total_cost = ?, paid_at = ?, updated_at = ? WHERE order_id = ?",
      )
      .run(
        data.supplierId,
        data.productCost,
        data.extraFees,
        data.packageQuantity,
        data.unitCost,
        data.totalCost,
        data.paidAt ?? null,
        nowIso,
        data.orderId,
      );
  } else {
    await db
      .prepare(
        "INSERT INTO supplier_orders (id, order_id, supplier_id, product_cost, extra_fees, package_quantity, unit_cost, total_cost, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        data.orderId,
        data.supplierId,
        data.productCost,
        data.extraFees,
        data.packageQuantity,
        data.unitCost,
        data.totalCost,
        data.paidAt ?? null,
        nowIso,
        nowIso,
      );
  }

  if (data.paidAt && data.totalCost > 0) {
    const exists = await db
      .prepare<{ id: string }>(
        "SELECT id FROM payments WHERE order_id = ? AND direction = ? AND method = ? LIMIT 1",
      )
      .get(data.orderId, "OUTGOING", "Fornecedor");
    if (!exists) {
      await db
        .prepare(
          "INSERT INTO payments (id, order_id, direction, amount, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          data.orderId,
          "OUTGOING",
          data.totalCost,
          "Fornecedor",
          data.paidAt,
          nowIso,
        );
    } else {
      await db
        .prepare(
          "UPDATE payments SET amount = ?, paid_at = ?, created_at = ? WHERE id = ?",
        )
        .run(data.totalCost, data.paidAt, nowIso, exists.id);
    }
  } else {
    await db
      .prepare(
        "DELETE FROM payments WHERE order_id = ? AND direction = ? AND method = ?",
      )
      .run(data.orderId, "OUTGOING", "Fornecedor");
  }
}

export async function upsertShipment(data: {
  orderId: string;
  trackingCode: string;
  carrier: string;
  originCountry: string;
}) {
  const existing = await db
    .prepare<{ id: string }>("SELECT id FROM shipments WHERE order_id = ?")
    .get(data.orderId);
  const nowIso = now();

  if (existing) {
    await db
      .prepare(
        "UPDATE shipments SET tracking_code = ?, carrier = ?, origin_country = ?, updated_at = ? WHERE order_id = ?",
      )
      .run(
        data.trackingCode,
        data.carrier,
        data.originCountry,
        nowIso,
        data.orderId,
      );
  } else {
    await db
      .prepare(
        "INSERT INTO shipments (id, order_id, tracking_code, carrier, origin_country, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        randomUUID(),
        data.orderId,
        data.trackingCode,
        data.carrier,
        data.originCountry,
        nowIso,
        nowIso,
      );
  }
}

export async function updateShipmentStatus(orderId: string, data: {
  lastStatus?: string | null;
  lastUpdateAt?: string | null;
  etaDate?: string | null;
}) {
  await db
    .prepare(
      "UPDATE shipments SET last_status = ?, last_update_at = ?, eta_date = ? WHERE order_id = ?",
    )
    .run(data.lastStatus ?? null, data.lastUpdateAt ?? null, data.etaDate ?? null, orderId);
}

export async function ensureAdminUser(data: { name: string; email: string; passwordHash: string }) {
  const existing = await db
    .prepare<{ id: string }>("SELECT id FROM users WHERE email = ?")
    .get(data.email);
  const nowIso = now();

  if (existing) {
    await db
      .prepare(
        "UPDATE users SET name = ?, password_hash = ?, updated_at = ? WHERE email = ?",
      )
      .run(data.name, data.passwordHash, nowIso, data.email);
  } else {
    await db
      .prepare(
        "INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), data.name, data.email, data.passwordHash, "ADMIN", nowIso, nowIso);
  }
}

export async function ensureSupplier(data: { name: string; country: string }) {
  const existing = await db
    .prepare<{ id: string }>("SELECT id FROM suppliers WHERE name = ?")
    .get(data.name);
  const nowIso = now();

  if (existing) return existing.id;

  const id = randomUUID();
  await db
    .prepare(
      "INSERT INTO suppliers (id, name, country, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, data.name, data.country, 1, nowIso, nowIso);
  return id;
}

export async function upsertProduct(data: {
  name: string;
  team: string;
  model: string;
  slug: string;
  description: string;
  basePrice: number;
  active?: number;
  productId?: string;
}) {
  const existing = data.productId
    ? await db
        .prepare<{ id: string }>("SELECT id FROM products WHERE id = ?")
        .get(data.productId)
    : await db
        .prepare<{ id: string }>("SELECT id FROM products WHERE slug = ?")
        .get(data.slug);
  const nowIso = now();

  if (existing) {
    await db
      .prepare(
        "UPDATE products SET name = ?, team = ?, model = ?, description = ?, base_price = ?, active = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        data.name,
        data.team,
        data.model,
        data.description,
        data.basePrice,
        data.active ?? 1,
        nowIso,
        existing.id,
      );
    return existing.id;
  }

  const id = randomUUID();
  await db
    .prepare(
      "INSERT INTO products (id, name, team, model, slug, description, base_price, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      id,
      data.name,
      data.team,
      data.model,
      data.slug,
      data.description,
      data.basePrice,
      data.active ?? 1,
      nowIso,
      nowIso,
    );
  return id;
}

export async function getUserByEmail(email: string) {
  return db
    .prepare<{ id: string; name: string; email: string; password_hash: string; role: string }>(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
    )
    .get(email);
}
