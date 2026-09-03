import { randomUUID } from "node:crypto";

import {
  calculateMargin,
  calculatePackageAllocation,
} from "@/modules/shared/domain/calculators";
import { PaymentDirection } from "@/modules/shared/domain/enums";
import { db } from "@/lib/db";
import {
  mapTrackingStatusToOrderStatus,
  shouldAdvanceOrderStatus,
} from "@/lib/tracking/status-map";

function now() {
  return new Date().toISOString();
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  if (!Number.isInteger(parsed)) return 0;
  return parsed > 0 ? parsed : 0;
}

function generateOrderCodeCandidate() {
  const timestampPart = Date.now().toString(36).toUpperCase();
  const entropyPart = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `LC-${timestampPart}-${entropyPart}`;
}

function isOrderCodeUniqueViolation(error: unknown) {
  const candidate = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
    message?: string;
  };

  if (candidate?.code !== "23505") return false;
  const constraintName = (candidate.constraint_name ?? candidate.constraint ?? "").toLowerCase();
  const message = (candidate.message ?? "").toLowerCase();

  return (
    constraintName.includes("orders_code") ||
    message.includes("orders_code_key") ||
    message.includes("orders.code")
  );
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
  is_stock_order: number;
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

export type CustomerPresetRow = {
  name: string;
  email: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  last_order_at: string;
};

type ImportPackageRow = {
  id: string;
  code: string;
  supplier_id: string | null;
  package_quantity: number;
  product_cost: number;
  extra_fees: number;
  internal_shipping: number;
  tracking_code: string | null;
  carrier: string | null;
  origin_country: string | null;
  paid_at: string | null;
  notes: string | null;
  last_status: string | null;
  last_update_at: string | null;
  eta_date: string | null;
  created_at: string;
  updated_at: string;
};

type ImportPackageSummaryRow = ImportPackageRow & {
  supplier_name: string | null;
  linked_orders: number;
};

export type ImportPackageOrderRow = {
  order_id: string;
  code: string;
  status: string;
  customer_name: string;
  quantity: number;
  total_amount: number;
  total_cost: number;
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

type InternalStockAllocationRow = {
  id: string;
  source_order_id: string;
  sale_order_id: string;
  supplier_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
};

type InternalStockAllocationDetailRow = InternalStockAllocationRow & {
  source_order_code: string;
  source_customer_name: string;
  supplier_name: string;
};

export type AvailableInternalStockRow = {
  source_order_id: string;
  source_order_code: string;
  source_customer_name: string;
  created_at: string;
  supplier_id: string;
  supplier_name: string;
  package_code: string | null;
  total_quantity: number;
  allocated_quantity: number;
  available_quantity: number;
  unit_cost: number;
};

export type InternalStockAvailabilityRow = {
  source_order_id: string;
  source_order_code: string;
  total_quantity: number;
  allocated_quantity: number;
  available_quantity: number;
  unit_cost: number;
  supplier_id: string | null;
  supplier_paid_at: string | null;
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
  package_code: string | null;
  tracking_last_status: string | null;
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
      `
      SELECT
        o.*,
        c.name as customer_name,
        p.code as package_code,
        s.last_status as tracking_last_status
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_packages op ON op.order_id = o.id
      LEFT JOIN import_packages p ON p.id = op.package_id
      LEFT JOIN shipments s ON s.order_id = o.id
      ${whereClause}
      ORDER BY o.created_at DESC
      `,
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

export async function listCustomerPresets(limit = 80) {
  return db
    .prepare<CustomerPresetRow>(
      `
      SELECT DISTINCT ON (LOWER(c.name), COALESCE(c.phone, ''))
        c.name,
        NULLIF(c.email, '') as email,
        c.phone,
        a.line1,
        a.line2,
        a.city,
        a.state,
        a.postal_code,
        a.country,
        o.created_at as last_order_at
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN addresses a ON a.id = o.address_id
      ORDER BY LOWER(c.name), COALESCE(c.phone, ''), o.created_at DESC
      LIMIT ?
      `,
    )
    .all(limit);
}

export async function listImportPackages() {
  return db
    .prepare<ImportPackageSummaryRow>(
      `
      SELECT
        p.*,
        s.name as supplier_name,
        COUNT(op.order_id) as linked_orders
      FROM import_packages p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN order_packages op ON op.package_id = p.id
      GROUP BY p.id, s.name
      ORDER BY p.created_at DESC
      LIMIT 100
      `,
    )
    .all();
}

export async function getImportPackageById(packageId: string) {
  return db
    .prepare<ImportPackageSummaryRow>(
      `
      SELECT
        p.*,
        s.name as supplier_name,
        COUNT(op.order_id) as linked_orders
      FROM import_packages p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN order_packages op ON op.package_id = p.id
      WHERE p.id = ?
      GROUP BY p.id, s.name
      `,
    )
    .get(packageId);
}

export async function getImportPackageByOrderId(orderId: string) {
  return db
    .prepare<ImportPackageSummaryRow>(
      `
      SELECT
        p.*,
        s.name as supplier_name,
        COUNT(op2.order_id) as linked_orders
      FROM order_packages op
      JOIN import_packages p ON p.id = op.package_id
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN order_packages op2 ON op2.package_id = p.id
      WHERE op.order_id = ?
      GROUP BY p.id, s.name
      LIMIT 1
      `,
    )
    .get(orderId);
}

export async function listAvailableInternalStockOrders(limit = 100) {
  return db
    .prepare<AvailableInternalStockRow>(
      `
      SELECT
        o.id as source_order_id,
        o.code as source_order_code,
        c.name as source_customer_name,
        o.created_at,
        so.supplier_id,
        s.name as supplier_name,
        p.code as package_code,
        COALESCE(item_qty.total_quantity, 0) as total_quantity,
        COALESCE(alloc_qty.allocated_quantity, 0) as allocated_quantity,
        GREATEST(
          COALESCE(item_qty.total_quantity, 0) - COALESCE(alloc_qty.allocated_quantity, 0),
          0
        ) as available_quantity,
        COALESCE(so.unit_cost, 0) as unit_cost
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN supplier_orders so ON so.order_id = o.id
      LEFT JOIN suppliers s ON s.id = so.supplier_id
      LEFT JOIN order_packages op ON op.order_id = o.id
      LEFT JOIN import_packages p ON p.id = op.package_id
      LEFT JOIN (
        SELECT order_id, COALESCE(SUM(quantity), 0) as total_quantity
        FROM order_items
        GROUP BY order_id
      ) item_qty ON item_qty.order_id = o.id
      LEFT JOIN (
        SELECT source_order_id, COALESCE(SUM(quantity), 0) as allocated_quantity
        FROM internal_stock_allocations
        GROUP BY source_order_id
      ) alloc_qty ON alloc_qty.source_order_id = o.id
      WHERE o.is_stock_order = 1
      AND o.is_personal_use = 0
      AND o.status <> 'CANCELED'
      AND so.supplier_id IS NOT NULL
      AND COALESCE(so.unit_cost, 0) > 0
      AND GREATEST(
        COALESCE(item_qty.total_quantity, 0) - COALESCE(alloc_qty.allocated_quantity, 0),
        0
      ) > 0
      ORDER BY o.created_at DESC
      LIMIT ?
      `,
    )
    .all(limit);
}

export async function getInternalStockAvailabilityBySourceOrderId(sourceOrderId: string) {
  return db
    .prepare<InternalStockAvailabilityRow>(
      `
      SELECT
        o.id as source_order_id,
        o.code as source_order_code,
        COALESCE(item_qty.total_quantity, 0) as total_quantity,
        COALESCE(alloc_qty.allocated_quantity, 0) as allocated_quantity,
        GREATEST(
          COALESCE(item_qty.total_quantity, 0) - COALESCE(alloc_qty.allocated_quantity, 0),
          0
        ) as available_quantity,
        COALESCE(so.unit_cost, 0) as unit_cost,
        so.supplier_id,
        so.paid_at as supplier_paid_at
      FROM orders o
      LEFT JOIN supplier_orders so ON so.order_id = o.id
      LEFT JOIN (
        SELECT order_id, COALESCE(SUM(quantity), 0) as total_quantity
        FROM order_items
        GROUP BY order_id
      ) item_qty ON item_qty.order_id = o.id
      LEFT JOIN (
        SELECT source_order_id, COALESCE(SUM(quantity), 0) as allocated_quantity
        FROM internal_stock_allocations
        GROUP BY source_order_id
      ) alloc_qty ON alloc_qty.source_order_id = o.id
      WHERE o.id = ?
      LIMIT 1
      `,
    )
    .get(sourceOrderId);
}

export async function getInternalStockAllocationBySaleOrderId(saleOrderId: string) {
  return db
    .prepare<InternalStockAllocationDetailRow>(
      `
      SELECT
        isa.*,
        src.code as source_order_code,
        c.name as source_customer_name,
        s.name as supplier_name
      FROM internal_stock_allocations isa
      JOIN orders src ON src.id = isa.source_order_id
      JOIN customers c ON c.id = src.customer_id
      JOIN suppliers s ON s.id = isa.supplier_id
      WHERE isa.sale_order_id = ?
      LIMIT 1
      `,
    )
    .get(saleOrderId);
}

export async function allocateInternalStockToSaleOrder(data: {
  sourceOrderId: string;
  saleOrderId: string;
  quantity: number;
}) {
  const tx = db.transaction(async () => {
    const safeQuantity = Math.max(1, Math.round(Number(data.quantity) || 0));
    if (safeQuantity <= 0) {
      throw new Error("Quantidade invalida para baixa de estoque.");
    }

    await db
      .prepare("SELECT pg_advisory_xact_lock(hashtext(?))")
      .run(`internal-stock-source:${data.sourceOrderId}`);
    await db
      .prepare("SELECT pg_advisory_xact_lock(hashtext(?))")
      .run(`internal-stock-sale:${data.saleOrderId}`);

    const sourceOrder = await db
      .prepare<{
        id: string;
        code: string;
        is_stock_order: number;
        is_personal_use: number;
        status: string;
      }>(
        "SELECT id, code, is_stock_order, is_personal_use, status FROM orders WHERE id = ? LIMIT 1",
      )
      .get(data.sourceOrderId);
    if (!sourceOrder) {
      throw new Error("Pedido de estoque selecionado nao existe.");
    }
    if (sourceOrder.is_stock_order !== 1 || sourceOrder.is_personal_use === 1) {
      throw new Error("Origem invalida: selecione um pedido marcado como estoque.");
    }
    if (sourceOrder.status === "CANCELED") {
      throw new Error("Nao e possivel baixar de um pedido de estoque cancelado.");
    }

    const saleOrder = await db
      .prepare<{
        id: string;
        code: string;
        is_stock_order: number;
        is_personal_use: number;
      }>(
        "SELECT id, code, is_stock_order, is_personal_use FROM orders WHERE id = ? LIMIT 1",
      )
      .get(data.saleOrderId);
    if (!saleOrder) {
      throw new Error("Pedido de venda nao encontrado para baixa de estoque.");
    }
    if (saleOrder.is_stock_order === 1 || saleOrder.is_personal_use === 1) {
      throw new Error("A baixa de estoque so pode ser feita em pedido comercial.");
    }

    const saleAllocation = await db
      .prepare<InternalStockAllocationRow>(
        "SELECT * FROM internal_stock_allocations WHERE sale_order_id = ? LIMIT 1",
      )
      .get(data.saleOrderId);
    if (saleAllocation) {
      throw new Error("Este pedido de venda ja possui uma baixa de estoque registrada.");
    }

    const sourceAvailability = await getInternalStockAvailabilityBySourceOrderId(data.sourceOrderId);
    if (!sourceAvailability) {
      throw new Error("Nao foi possivel ler o saldo do pedido de estoque.");
    }

    if (!sourceAvailability.supplier_id || Number(sourceAvailability.unit_cost) <= 0) {
      throw new Error(
        "O pedido de estoque selecionado nao possui custo unitario/supplier valido.",
      );
    }

    const availableQuantity = Number(sourceAvailability.available_quantity ?? 0);
    if (availableQuantity < safeQuantity) {
      throw new Error(
        `Estoque insuficiente. Disponivel: ${availableQuantity} camisa(s). Solicitado: ${safeQuantity}.`,
      );
    }

    const unitCost = Number(sourceAvailability.unit_cost);
    const totalCost = unitCost * safeQuantity;
    const nowIso = now();

    await db
      .prepare(
        `
        INSERT INTO internal_stock_allocations (
          id, source_order_id, sale_order_id, supplier_id, quantity, unit_cost, total_cost, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        randomUUID(),
        data.sourceOrderId,
        data.saleOrderId,
        sourceAvailability.supplier_id,
        safeQuantity,
        unitCost,
        totalCost,
        nowIso,
      );

    const existingSupplierOrder = await db
      .prepare<{ id: string }>("SELECT id FROM supplier_orders WHERE order_id = ?")
      .get(data.saleOrderId);

    if (existingSupplierOrder) {
      await db
        .prepare(
          "UPDATE supplier_orders SET supplier_id = ?, product_cost = ?, extra_fees = ?, package_quantity = ?, unit_cost = ?, total_cost = ?, paid_at = ?, updated_at = ? WHERE order_id = ?",
        )
        .run(
          sourceAvailability.supplier_id,
          totalCost,
          0,
          safeQuantity,
          unitCost,
          totalCost,
          null,
          nowIso,
          data.saleOrderId,
        );
    } else {
      await db
        .prepare(
          "INSERT INTO supplier_orders (id, order_id, supplier_id, product_cost, extra_fees, package_quantity, unit_cost, total_cost, paid_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          data.saleOrderId,
          sourceAvailability.supplier_id,
          totalCost,
          0,
          safeQuantity,
          unitCost,
          totalCost,
          null,
          nowIso,
          nowIso,
        );
    }

    // Stock entry payment is already registered at purchase time, so this sale should not create an extra outgoing payment.
    await db
      .prepare(
        "DELETE FROM payments WHERE order_id = ? AND direction = ? AND method = ?",
      )
      .run(data.saleOrderId, PaymentDirection.Outgoing, "Fornecedor");

    return {
      sourceOrderCode: sourceOrder.code,
      quantity: safeQuantity,
      unitCost,
      totalCost,
    };
  });

  return tx();
}

export async function listImportPackageOrders(packageId: string) {
  return db
    .prepare<ImportPackageOrderRow>(
      `
      SELECT
        o.id as order_id,
        o.code,
        o.status,
        c.name as customer_name,
        COALESCE(SUM(oi.quantity), 0) as quantity,
        o.total_amount,
        COALESCE(so.total_cost, 0) as total_cost
      FROM order_packages op
      JOIN orders o ON o.id = op.order_id
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN supplier_orders so ON so.order_id = o.id
      WHERE op.package_id = ?
      GROUP BY o.id, o.code, o.status, c.name, o.total_amount, so.total_cost
      ORDER BY o.created_at DESC
      `,
    )
    .all(packageId);
}

export async function upsertImportPackage(data: {
  packageId?: string;
  supplierId?: string | null;
  packageQuantity: number;
  productCost: number;
  extraFees: number;
  internalShipping?: number;
  trackingCode?: string | null;
  carrier?: string | null;
  originCountry?: string | null;
  paidAt?: string | null;
  notes?: string | null;
}) {
  const nowIso = now();
  const safePackageQuantity = Math.max(1, Math.round(Number(data.packageQuantity) || 1));
  const packageId = data.packageId ?? randomUUID();
  const packageCode = `PK-${packageId.slice(0, 8).toUpperCase()}`;

  const existing = data.packageId
    ? await db.prepare<{ id: string }>("SELECT id FROM import_packages WHERE id = ?").get(data.packageId)
    : undefined;

  if (existing) {
    await db
      .prepare(
        `
        UPDATE import_packages
        SET
          supplier_id = ?,
          package_quantity = ?,
          product_cost = ?,
          extra_fees = ?,
          internal_shipping = ?,
          tracking_code = ?,
          carrier = ?,
          origin_country = ?,
          paid_at = ?,
          notes = ?,
          updated_at = ?
        WHERE id = ?
        `,
      )
      .run(
        data.supplierId ?? null,
        safePackageQuantity,
        data.productCost,
        data.extraFees,
        data.internalShipping ?? 0,
        data.trackingCode ?? null,
        data.carrier ?? null,
        data.originCountry ?? null,
        data.paidAt ?? null,
        data.notes ?? null,
        nowIso,
        data.packageId,
      );

    return existing.id;
  }

  await db
    .prepare(
      `
      INSERT INTO import_packages (
        id, code, supplier_id, package_quantity, product_cost, extra_fees, internal_shipping,
        tracking_code, carrier, origin_country, paid_at, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      packageId,
      packageCode,
      data.supplierId ?? null,
      safePackageQuantity,
      data.productCost,
      data.extraFees,
      data.internalShipping ?? 0,
      data.trackingCode ?? null,
      data.carrier ?? null,
      data.originCountry ?? null,
      data.paidAt ?? null,
      data.notes ?? null,
      nowIso,
      nowIso,
    );

  return packageId;
}

export async function linkOrderToImportPackage(orderId: string, packageId: string) {
  const nowIso = now();
  const existing = await db
    .prepare<{ id: string }>("SELECT id FROM order_packages WHERE order_id = ?")
    .get(orderId);

  if (existing) {
    await db
      .prepare("UPDATE order_packages SET package_id = ? WHERE order_id = ?")
      .run(packageId, orderId);
    return;
  }

  await db
    .prepare("INSERT INTO order_packages (id, order_id, package_id, created_at) VALUES (?, ?, ?, ?)")
    .run(randomUUID(), orderId, packageId, nowIso);
}

export async function unlinkOrderFromImportPackage(orderId: string) {
  await db.prepare("DELETE FROM order_packages WHERE order_id = ?").run(orderId);
}

export async function deleteImportPackageIfOrphan(packageId: string) {
  const tx = db.transaction(async () => {
    await db
      .prepare("SELECT pg_advisory_xact_lock(hashtext(?))")
      .run(`import-package:${packageId}`);

    const importPackage = await db
      .prepare<{ id: string; code: string }>(
        "SELECT id, code FROM import_packages WHERE id = ? LIMIT 1",
      )
      .get(packageId);
    if (!importPackage) return null;

    const linkedRow = await db
      .prepare<{ count: number }>(
        "SELECT COUNT(*)::int as count FROM order_packages WHERE package_id = ?",
      )
      .get(packageId);
    const linkedCount = Number(linkedRow?.count ?? 0);
    if (linkedCount > 0) return null;

    await db.prepare("DELETE FROM import_packages WHERE id = ?").run(packageId);
    return importPackage.code;
  });

  return tx();
}

export async function getLinkedOrdersForImportPackage(packageId: string) {
  return db
    .prepare<{ order_id: string; order_status: string; quantity: number }>(
      `
      SELECT
        o.id as order_id,
        o.status as order_status,
        COALESCE(SUM(oi.quantity), 0) as quantity
      FROM order_packages op
      JOIN orders o ON o.id = op.order_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE op.package_id = ?
      GROUP BY o.id, o.status
      `,
    )
    .all(packageId);
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

export type CreateOrderItemInput = {
  productId?: string | null;
  itemName: string;
  itemDescription?: string | null;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
};

export async function createOrder(data: {
  items?: CreateOrderItemInput[];
  productId?: string | null;
  itemName?: string;
  itemDescription?: string | null;
  size?: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
  paymentType: string;
  amountPaid: number;
  isPersonalUse?: number;
  isStockOrder?: number;
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
    const safeTotal = Number(data.total);
    const safeAmountPaid = Number(data.amountPaid);
    if (!Number.isFinite(safeTotal) || safeTotal < 0) {
      throw new Error("Total do pedido invalido.");
    }
    if (!Number.isFinite(safeAmountPaid) || safeAmountPaid < 0) {
      throw new Error("Valor pago invalido.");
    }

    const itemsInput = data.items ?? [];
    const hasItemsInput = itemsInput.length > 0;
    const normalizedItems =
      hasItemsInput
        ? itemsInput
            .map((item) => {
              const quantity = toPositiveInteger(item.quantity);
              if (quantity <= 0) return null;

              const unitPrice = Number(item.unitPrice);
              if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                throw new Error("Preco unitario invalido no item do pedido.");
              }

              const totalPriceInput = Number(item.totalPrice);
              const totalPrice =
                Number.isFinite(totalPriceInput) && totalPriceInput >= 0
                  ? totalPriceInput
                  : quantity * unitPrice;

              return {
                productId: item.productId ?? null,
                itemName: item.itemName?.trim() || "Camisa de time sob encomenda",
                itemDescription: item.itemDescription?.trim() || null,
                size: item.size?.trim() || "M",
                quantity,
                unitPrice,
                totalPrice,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .filter((item) => item.quantity > 0)
        : [];

    if (hasItemsInput && normalizedItems.length === 0) {
      throw new Error("Pedido sem itens validos.");
    }

    if (normalizedItems.length === 0) {
      const fallbackQuantity = toPositiveInteger(data.quantity);
      if (fallbackQuantity <= 0) {
        throw new Error("Pedido sem quantidade valida.");
      }

      const fallbackUnitPriceInput = Number(data.unitPrice);
      const fallbackUnitPrice =
        Number.isFinite(fallbackUnitPriceInput) && fallbackUnitPriceInput >= 0
          ? fallbackUnitPriceInput
          : safeTotal / fallbackQuantity;

      if (!Number.isFinite(fallbackUnitPrice) || fallbackUnitPrice < 0) {
        throw new Error("Preco unitario invalido para item de fallback.");
      }

      normalizedItems.push({
        productId: data.productId ?? null,
        itemName: data.itemName?.trim() || "Camisa de time sob encomenda",
        itemDescription: data.itemDescription?.trim() || null,
        size: data.size?.trim() || "M",
        quantity: fallbackQuantity,
        unitPrice: fallbackUnitPrice,
        totalPrice: safeTotal,
      });
    }

    const orderId = randomUUID();
    const customerId = randomUUID();
    const addressId = randomUUID();
    let orderCode = "";
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
      (safeAmountPaid < safeTotal ? "AWAITING_PAYMENT" : "AWAITING_SUPPLIER");

    let insertedOrder = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      orderCode = generateOrderCodeCandidate();
      try {
        await db
          .prepare(
            "INSERT INTO orders (id, code, customer_id, address_id, status, payment_type, total_amount, amount_paid, is_personal_use, is_stock_order, currency, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            orderId,
            orderCode,
            customerId,
            addressId,
            statusValue,
            data.paymentType,
            safeTotal,
            safeAmountPaid,
            data.isPersonalUse ?? 0,
            data.isStockOrder ?? 0,
            "BRL",
            data.notes ?? null,
            nowIso,
            nowIso,
          );
        insertedOrder = true;
        break;
      } catch (error) {
        if (!isOrderCodeUniqueViolation(error) || attempt === 7) {
          throw error;
        }
      }
    }

    if (!insertedOrder || !orderCode) {
      throw new Error("Falha ao gerar codigo unico do pedido.");
    }

    for (const item of normalizedItems) {
      await db
        .prepare(
          "INSERT INTO order_items (id, order_id, product_id, item_name, item_description, size, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          orderId,
          item.productId ?? null,
          item.itemName,
          item.itemDescription ?? null,
          item.size,
          item.quantity,
          item.unitPrice,
          item.totalPrice ?? item.quantity * item.unitPrice,
        );
    }

    await db
      .prepare(
        "INSERT INTO order_status_history (id, order_id, status, note, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(randomUUID(), orderId, statusValue, null, nowIso);

    if (safeAmountPaid > 0) {
      await db
        .prepare(
          "INSERT INTO payments (id, order_id, direction, amount, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          randomUUID(),
          orderId,
          PaymentDirection.Incoming,
          safeAmountPaid,
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
  isStockOrder: number;
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
      "UPDATE orders SET total_amount = ?, is_personal_use = ?, is_stock_order = ?, updated_at = ? WHERE id = ?",
    )
    .run(data.totalAmount, data.isPersonalUse, data.isStockOrder, nowIso, data.orderId);

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
    await db
      .prepare(
        "DELETE FROM internal_stock_allocations WHERE sale_order_id = ? OR source_order_id = ?",
      )
      .run(orderId, orderId);
    await db.prepare("DELETE FROM payments WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM order_status_history WHERE order_id = ?").run(orderId);
    await db.prepare("DELETE FROM order_packages WHERE order_id = ?").run(orderId);
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
      .get(PaymentDirection.Outgoing, start, end),
    db
      .prepare<{ total: number; count: number }>(
        "SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM payments WHERE direction = ? AND created_at >= ? AND created_at < ?",
      )
      .get(PaymentDirection.Incoming, start, end),
  ]);

  const totalSales = toNumber(salesRow?.total);
  const totalPaidSupplier = toNumber(paidSupplierRow?.total);
  const totalIncoming = toNumber(incomingRow?.total);
  const incomingCount = toNumber(incomingRow?.count);

  const { profit, margin } = calculateMargin({
    revenue: totalSales,
    cost: totalPaidSupplier,
  });

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
      SELECT DISTINCT ON (s.tracking_code)
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
      ORDER BY s.tracking_code ASC, COALESCE(s.last_update_at, o.updated_at) ASC
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
  const tx = db.transaction(async () => {
    // Serialize writes per order to avoid duplicate payment rows on concurrent submits.
    await db
      .prepare("SELECT pg_advisory_xact_lock(hashtext(?))")
      .run(data.orderId);

    const safePackageQuantity = Math.max(1, Math.round(Number(data.packageQuantity) || 1));
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
          safePackageQuantity,
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
          safePackageQuantity,
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
        .get(data.orderId, PaymentDirection.Outgoing, "Fornecedor");
      if (!exists) {
        await db
          .prepare(
            "INSERT INTO payments (id, order_id, direction, amount, method, paid_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            randomUUID(),
            data.orderId,
            PaymentDirection.Outgoing,
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
        .run(data.orderId, PaymentDirection.Outgoing, "Fornecedor");
    }
  });

  await tx();
}

export async function recalculateImportPackageAllocations(packageId: string) {
  const importPackage = await db
    .prepare<ImportPackageRow>("SELECT * FROM import_packages WHERE id = ?")
    .get(packageId);
  if (!importPackage) return;

  const linkedOrders = await getLinkedOrdersForImportPackage(packageId);
  const validLinkedOrders = linkedOrders.filter((item) => Number(item.quantity) > 0);
  if (validLinkedOrders.length === 0) return;

  const linkedTotalQuantity = validLinkedOrders.reduce(
    (sum, item) => sum + Number(item.quantity),
    0,
  );
  const packageBaseQuantity = Math.max(
    1,
    Math.round(Number(importPackage.package_quantity) || linkedTotalQuantity),
  );
  const packageProductCost = Number(importPackage.product_cost ?? 0);
  const packageExtraFees =
    Number(importPackage.extra_fees ?? 0) + Number(importPackage.internal_shipping ?? 0);
  for (const linkedOrder of validLinkedOrders) {
    const allocation = calculatePackageAllocation({
      packageBaseQuantity,
      productCost: packageProductCost,
      extraFees: packageExtraFees,
      linkedQuantity: Number(linkedOrder.quantity),
    });

    if (importPackage.supplier_id) {
      await upsertSupplierOrder({
        orderId: linkedOrder.order_id,
        supplierId: importPackage.supplier_id,
        productCost: allocation.allocatedProductCost,
        extraFees: allocation.allocatedExtraFees,
        packageQuantity: packageBaseQuantity,
        unitCost: allocation.averageUnitCost,
        totalCost: allocation.allocatedTotalCost,
        paidAt: importPackage.paid_at ?? null,
      });
    }

    if (importPackage.tracking_code) {
      await upsertShipment({
        orderId: linkedOrder.order_id,
        trackingCode: importPackage.tracking_code,
        carrier: importPackage.carrier ?? "other",
        originCountry: importPackage.origin_country ?? "China",
      });

      const trackingMappedStatus = mapTrackingStatusToOrderStatus(
        importPackage.last_status ?? "",
      );
      if (trackingMappedStatus) {
        if (
          shouldAdvanceOrderStatus(linkedOrder.order_status, trackingMappedStatus)
        ) {
          await updateOrderStatus(
            linkedOrder.order_id,
            trackingMappedStatus,
            `Status sincronizado pelo pacote ${importPackage.code}: ${importPackage.last_status ?? "sem status"}`,
          );
        }
      } else if (shouldAdvanceOrderStatus(linkedOrder.order_status, "SHIPPED")) {
        await updateOrderStatus(
          linkedOrder.order_id,
          "SHIPPED",
          `Rastreamento vinculado ao pacote ${importPackage.code}`,
        );
      }
    }
  }
}

export async function syncImportPackageForOrder(packageId: string, orderId: string) {
  const importPackage = await db
    .prepare<ImportPackageRow>("SELECT * FROM import_packages WHERE id = ?")
    .get(packageId);
  if (!importPackage) return;

  const linkedOrders = await getLinkedOrdersForImportPackage(packageId);
  const linkedOrder = linkedOrders.find((item) => item.order_id === orderId);
  if (!linkedOrder || Number(linkedOrder.quantity) <= 0) return;

  const linkedTotalQuantity = linkedOrders
    .filter((item) => Number(item.quantity) > 0)
    .reduce((sum, item) => sum + Number(item.quantity), 0);

  const packageBaseQuantity = Math.max(
    1,
    Math.round(Number(importPackage.package_quantity) || linkedTotalQuantity),
  );
  const packageProductCost = Number(importPackage.product_cost ?? 0);
  const packageExtraFees =
    Number(importPackage.extra_fees ?? 0) + Number(importPackage.internal_shipping ?? 0);

  const allocation = calculatePackageAllocation({
    packageBaseQuantity,
    productCost: packageProductCost,
    extraFees: packageExtraFees,
    linkedQuantity: Number(linkedOrder.quantity),
  });

  if (importPackage.supplier_id) {
    await upsertSupplierOrder({
      orderId: linkedOrder.order_id,
      supplierId: importPackage.supplier_id,
      productCost: allocation.allocatedProductCost,
      extraFees: allocation.allocatedExtraFees,
      packageQuantity: packageBaseQuantity,
      unitCost: allocation.averageUnitCost,
      totalCost: allocation.allocatedTotalCost,
      paidAt: importPackage.paid_at ?? null,
    });
  }

  if (importPackage.tracking_code) {
    await upsertShipment({
      orderId: linkedOrder.order_id,
      trackingCode: importPackage.tracking_code,
      carrier: importPackage.carrier ?? "other",
      originCountry: importPackage.origin_country ?? "China",
    });

    const trackingMappedStatus = mapTrackingStatusToOrderStatus(
      importPackage.last_status ?? "",
    );
    if (trackingMappedStatus) {
      if (shouldAdvanceOrderStatus(linkedOrder.order_status, trackingMappedStatus)) {
        await updateOrderStatus(
          linkedOrder.order_id,
          trackingMappedStatus,
          `Status sincronizado pelo pacote ${importPackage.code}: ${importPackage.last_status ?? "sem status"}`,
        );
      }
    } else if (shouldAdvanceOrderStatus(linkedOrder.order_status, "SHIPPED")) {
      await updateOrderStatus(
        linkedOrder.order_id,
        "SHIPPED",
        `Rastreamento vinculado ao pacote ${importPackage.code}`,
      );
    }
  }
}

export async function updateImportPackageTrackingByCode(
  trackingCode: string,
  data: {
    lastStatus?: string | null;
    lastUpdateAt?: string | null;
    etaDate?: string | null;
  },
) {
  await db
    .prepare(
      "UPDATE import_packages SET last_status = ?, last_update_at = ?, eta_date = ?, updated_at = ? WHERE tracking_code = ?",
    )
    .run(
      data.lastStatus ?? null,
      data.lastUpdateAt ?? null,
      data.etaDate ?? null,
      now(),
      trackingCode,
    );

  const linkedPackages = await db
    .prepare<{ id: string }>("SELECT id FROM import_packages WHERE tracking_code = ?")
    .all(trackingCode);

  for (const importPackage of linkedPackages) {
    await recalculateImportPackageAllocations(importPackage.id);
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
