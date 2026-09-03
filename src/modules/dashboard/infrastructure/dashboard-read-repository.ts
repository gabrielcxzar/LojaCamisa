import { db } from "@/lib/db";
import { PaymentDirection } from "@/modules/shared/domain/enums";

export type DashboardSummaryRow = {
  total_orders: number;
  delivered_orders: number;
  awaiting_payment: number;
  awaiting_supplier: number;
  preparing: number;
  shipped: number;
  personal_orders: number;
  monthly_total_sales: number;
  monthly_total_paid_supplier: number;
};

export type DashboardShippingOverviewRow = {
  without_tracking: number;
  shipping_with_tracking: number;
};

export type DashboardTaxPendingOrderRow = {
  id: string;
  code: string;
  customer_name: string;
  last_status: string | null;
};

export type DashboardRecentOrderRow = {
  id: string;
  code: string;
  customer_name: string;
  total_amount: number;
  status: string;
  updated_at: string;
};

export async function getDashboardSummary(params: { monthStart: string; monthEnd: string }) {
  return db
    .prepare<DashboardSummaryRow>(
      `
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered_orders,
        COUNT(*) FILTER (WHERE status = 'AWAITING_PAYMENT') as awaiting_payment,
        COUNT(*) FILTER (WHERE status = 'AWAITING_SUPPLIER') as awaiting_supplier,
        COUNT(*) FILTER (WHERE status = 'PREPARING') as preparing,
        COUNT(*) FILTER (WHERE status = 'SHIPPED') as shipped,
        COUNT(*) FILTER (WHERE is_personal_use = 1) as personal_orders,
        COALESCE(SUM(CASE WHEN is_personal_use = 0 AND created_at >= ? AND created_at < ? THEN total_amount ELSE 0 END), 0) as monthly_total_sales,
        COALESCE((
          SELECT SUM(amount)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
            AND p.created_at >= ?
            AND p.created_at < ?
        ), 0) as monthly_total_paid_supplier
      FROM orders
      `,
    )
    .get(
      params.monthStart,
      params.monthEnd,
      PaymentDirection.Outgoing,
      params.monthStart,
      params.monthEnd,
    );
}

export async function getDashboardShippingOverview() {
  return db
    .prepare<DashboardShippingOverviewRow>(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE o.status IN ('AWAITING_SUPPLIER', 'PREPARING', 'SHIPPED')
            AND (s.tracking_code IS NULL OR s.tracking_code = '')
        ) as without_tracking,
        COUNT(*) FILTER (
          WHERE o.status IN ('AWAITING_SUPPLIER', 'PREPARING', 'SHIPPED')
            AND s.tracking_code IS NOT NULL
            AND s.tracking_code <> ''
        ) as shipping_with_tracking
      FROM orders o
      LEFT JOIN shipments s ON s.order_id = o.id
      `,
    )
    .get();
}

export async function listDashboardTaxPendingOrders(limit = 40) {
  return db
    .prepare<DashboardTaxPendingOrderRow>(
      `
      SELECT
        o.id,
        o.code,
        c.name as customer_name,
        s.last_status
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN shipments s ON s.order_id = o.id
      WHERE o.status IN ('PREPARING', 'SHIPPED')
      ORDER BY o.updated_at DESC
      LIMIT ?
      `,
    )
    .all(limit);
}

export async function listDashboardRecentOrders(limit = 6) {
  return db
    .prepare<DashboardRecentOrderRow>(
      `
      SELECT
        o.id,
        o.code,
        o.status,
        o.total_amount,
        o.updated_at,
        c.name as customer_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      ORDER BY o.created_at DESC
      LIMIT ?
      `,
    )
    .all(limit);
}
