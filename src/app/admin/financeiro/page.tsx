export const dynamic = "force-dynamic";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

type StatusCount = {
  status: string;
  count: number;
};

type RecentPayment = {
  id: string;
  direction: string;
  amount: number;
  created_at: string;
  order_code: string;
};

type FinanceSummaryRow = {
  total_sales: number;
  total_received: number;
  total_paid_supplier: number;
  incoming_count: number;
  monthly_total_sales: number;
  monthly_total_paid_supplier: number;
  monthly_total_incoming: number;
  monthly_incoming_count: number;
};

type SettingRow = {
  key: string;
  value: string;
};

export default async function FinanceiroPage() {
  await requireAdmin();

  const month = new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01T00:00:00.000Z`;
  const monthEndDate = new Date(monthStart);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  const monthEnd = monthEndDate.toISOString();

  const [summary, statusCounts, recentPayments, settingRows] = await Promise.all([
    db
      .prepare<FinanceSummaryRow>(
        `
        SELECT
          COALESCE(SUM(o.total_amount), 0) as total_sales,
          COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            WHERE p.direction = 'INCOMING'
          ), 0) as total_received,
          COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            WHERE p.direction = 'OUTGOING'
          ), 0) as total_paid_supplier,
          COALESCE((
            SELECT COUNT(*)
            FROM payments p
            WHERE p.direction = 'INCOMING'
          ), 0) as incoming_count,
          COALESCE(SUM(CASE WHEN o.created_at >= ? AND o.created_at < ? THEN o.total_amount ELSE 0 END), 0) as monthly_total_sales,
          COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            WHERE p.direction = 'OUTGOING'
              AND p.created_at >= ?
              AND p.created_at < ?
          ), 0) as monthly_total_paid_supplier,
          COALESCE((
            SELECT SUM(p.amount)
            FROM payments p
            WHERE p.direction = 'INCOMING'
              AND p.created_at >= ?
              AND p.created_at < ?
          ), 0) as monthly_total_incoming,
          COALESCE((
            SELECT COUNT(*)
            FROM payments p
            WHERE p.direction = 'INCOMING'
              AND p.created_at >= ?
              AND p.created_at < ?
          ), 0) as monthly_incoming_count
        FROM orders o
        `,
      )
      .get(
        monthStart,
        monthEnd,
        monthStart,
        monthEnd,
        monthStart,
        monthEnd,
        monthStart,
        monthEnd,
      ),
    db
      .prepare<StatusCount>("SELECT status, COUNT(*) as count FROM orders GROUP BY status")
      .all(),
    db
      .prepare<RecentPayment>(
        "SELECT p.id, p.direction, p.amount, p.created_at, o.code as order_code FROM payments p JOIN orders o ON o.id = p.order_id ORDER BY p.created_at DESC LIMIT 8",
      )
      .all(),
    db
      .prepare<SettingRow>(
        "SELECT key, value FROM settings WHERE key IN ('payment_fee_percent', 'payment_fee_fixed')",
      )
      .all(),
  ]);

  const settings = Object.fromEntries(settingRows.map((item) => [item.key, item.value]));

  const totalSales = Number(summary?.total_sales ?? 0);
  const totalReceived = Number(summary?.total_received ?? 0);
  const totalPaidSupplier = Number(summary?.total_paid_supplier ?? 0);
  const incomingCount = Number(summary?.incoming_count ?? 0);
  const totalPending = totalSales - totalReceived;

  const profit = totalSales - totalPaidSupplier;
  const margin = totalSales ? (profit / totalSales) * 100 : 0;

  const feePercent = Number(settings.payment_fee_percent ?? 0);
  const feeFixed = Number(settings.payment_fee_fixed ?? 0);
  const estimatedFees = totalReceived * (feePercent / 100) + incomingCount * feeFixed;
  const profitAfterFees = profit - estimatedFees;

  const monthlyTotalSales = Number(summary?.monthly_total_sales ?? 0);
  const monthlyPaidSupplier = Number(summary?.monthly_total_paid_supplier ?? 0);
  const monthlyTotalIncoming = Number(summary?.monthly_total_incoming ?? 0);
  const monthlyIncomingCount = Number(summary?.monthly_incoming_count ?? 0);
  const monthlyProfit = monthlyTotalSales - monthlyPaidSupplier;
  const monthlyMargin = monthlyTotalSales ? (monthlyProfit / monthlyTotalSales) * 100 : 0;
  const monthlyEstimatedFees =
    monthlyTotalIncoming * (feePercent / 100) + monthlyIncomingCount * feeFixed;
  const monthlyProfitAfterFees = monthlyProfit - monthlyEstimatedFees;

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Financeiro
        </p>
        <h1 className="text-2xl font-semibold">Resumo financeiro</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total vendido", value: formatCurrency(totalSales) },
          { label: "Total recebido", value: formatCurrency(totalReceived) },
          { label: "Valor pendente", value: formatCurrency(totalPending) },
          { label: "Pago fornecedor", value: formatCurrency(totalPaidSupplier) },
          { label: "Lucro bruto", value: formatCurrency(profit) },
          { label: "Taxas estimadas", value: formatCurrency(estimatedFees) },
          { label: "Lucro apos taxas", value: formatCurrency(profitAfterFees) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-neutral-200 bg-white p-5"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Margem</h2>
          <p className="mt-2 text-3xl font-semibold">{margin.toFixed(1)}%</p>
          <p className="text-sm text-neutral-500">Lucro bruto / total vendido.</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">Resumo do mes</h2>
          <div className="mt-4 space-y-3 text-sm text-neutral-600">
            <div className="flex justify-between">
              <span>Faturamento</span>
              <span className="font-semibold">{formatCurrency(monthlyTotalSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Lucro bruto</span>
              <span className="font-semibold">{formatCurrency(monthlyProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Taxas estimadas</span>
              <span className="font-semibold">{formatCurrency(monthlyEstimatedFees)}</span>
            </div>
            <div className="flex justify-between">
              <span>Lucro apos taxas</span>
              <span className="font-semibold">{formatCurrency(monthlyProfitAfterFees)}</span>
            </div>
            <div className="flex justify-between">
              <span>Margem media</span>
              <span className="font-semibold">{monthlyMargin.toFixed(1)}%</span>
            </div>
            <p className="pt-2 text-xs text-neutral-500">
              Taxa configurada: {feePercent.toFixed(2)}% + {formatCurrency(feeFixed)} por
              pagamento.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Pedidos por status</h2>
        <div className="mt-4 space-y-3 text-sm text-neutral-600">
          {statusCounts.map((item) => (
            <div key={item.status} className="flex justify-between">
              <span>{item.status}</span>
              <span className="font-semibold">{Number(item.count)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ultimos pagamentos</h2>
          <Badge tone="muted">Entrada / Saida</Badge>
        </div>
        <div className="mt-4 space-y-3 text-sm text-neutral-600">
          {recentPayments.length === 0 && (
            <p className="text-sm text-neutral-500">Nenhum pagamento registrado.</p>
          )}
          {recentPayments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3"
            >
              <div>
                <p className="font-semibold">
                  {payment.direction === "INCOMING" ? "Recebido" : "Pago"} -{" "}
                  {payment.order_code}
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(payment.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <span className="font-semibold">
                {formatCurrency(Number(payment.amount))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}
