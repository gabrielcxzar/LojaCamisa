import { db } from "@/lib/db";
import { PaymentDirection } from "@/modules/shared/domain/enums";

export type FinanceSummaryRow = {
  total_sales: number;
  total_received: number;
  total_paid_supplier: number;
  incoming_count: number;
  monthly_total_sales: number;
  monthly_total_paid_supplier: number;
  monthly_total_incoming: number;
  monthly_incoming_count: number;
};

export type FinanceStatusCountRow = {
  status: string;
  count: number;
};

export type FinanceRecentPaymentRow = {
  id: string;
  direction: string;
  amount: number;
  created_at: string;
  order_code: string;
};

export type FinanceSettingRow = {
  key: string;
  value: string;
};

export async function getFinanceSummary(params: { monthStart: string; monthEnd: string }) {
  return db
    .prepare<FinanceSummaryRow>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN o.is_personal_use = 0 THEN o.total_amount ELSE 0 END), 0) as total_sales,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
        ), 0) as total_received,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
        ), 0) as total_paid_supplier,
        COALESCE((
          SELECT COUNT(*)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
        ), 0) as incoming_count,
        COALESCE(SUM(CASE WHEN o.is_personal_use = 0 AND o.created_at >= ? AND o.created_at < ? THEN o.total_amount ELSE 0 END), 0) as monthly_total_sales,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
            AND p.created_at >= ?
            AND p.created_at < ?
        ), 0) as monthly_total_paid_supplier,
        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
            AND p.created_at >= ?
            AND p.created_at < ?
        ), 0) as monthly_total_incoming,
        COALESCE((
          SELECT COUNT(*)
          FROM payments p
          JOIN orders o2 ON o2.id = p.order_id
          WHERE p.direction = ?
            AND o2.is_personal_use = 0
            AND p.created_at >= ?
            AND p.created_at < ?
        ), 0) as monthly_incoming_count
      FROM orders o
      `,
    )
    .get(
      PaymentDirection.Incoming,
      PaymentDirection.Outgoing,
      PaymentDirection.Incoming,
      params.monthStart,
      params.monthEnd,
      PaymentDirection.Outgoing,
      params.monthStart,
      params.monthEnd,
      PaymentDirection.Incoming,
      params.monthStart,
      params.monthEnd,
      PaymentDirection.Incoming,
      params.monthStart,
      params.monthEnd,
    );
}

export async function listFinanceStatusCounts() {
  return db
    .prepare<FinanceStatusCountRow>("SELECT status, COUNT(*) as count FROM orders GROUP BY status")
    .all();
}

export async function listFinanceRecentPayments(limit = 8) {
  return db
    .prepare<FinanceRecentPaymentRow>(
      `
      SELECT
        p.id,
        p.direction,
        p.amount,
        p.created_at,
        o.code as order_code
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      ORDER BY p.created_at DESC
      LIMIT ?
      `,
    )
    .all(limit);
}

export async function listFinanceSettings() {
  return db
    .prepare<FinanceSettingRow>(
      "SELECT key, value FROM settings WHERE key IN ('payment_fee_percent', 'payment_fee_fixed')",
    )
    .all();
}
