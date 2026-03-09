export const dynamic = "force-dynamic";

import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { getSetting, getStalledOrders } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";
import { isTrackingTaxPending } from "@/lib/tracking/status-map";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  AWAITING_SUPPLIER: "Aguardando fornecedor",
  PREPARING: "Em preparacao",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

type DashboardSummaryRow = {
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

type RecentOrder = {
  id: string;
  code: string;
  customer_name: string;
  total_amount: number;
  status: string;
  updated_at: string;
};

type TaxPendingOrder = {
  id: string;
  code: string;
  customer_name: string;
  last_status: string | null;
};

export default async function AdminDashboard() {
  const session = await requireAdmin();

  const month = new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01T00:00:00.000Z`;
  const monthEndDate = new Date(monthStart);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  const monthEnd = monthEndDate.toISOString();

  const [summary, stalledSetting, shippingOverview, taxPendingOrders] = await Promise.all([
    db
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
            WHERE p.direction = 'OUTGOING'
              AND o2.is_personal_use = 0
              AND p.created_at >= ?
              AND p.created_at < ?
          ), 0) as monthly_total_paid_supplier
        FROM orders
        `,
      )
      .get(monthStart, monthEnd, monthStart, monthEnd),
    getSetting("stalled_days"),
    db
      .prepare<{ without_tracking: number; shipping_with_tracking: number }>(
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
      .get(),
    db
      .prepare<TaxPendingOrder>(
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
        LIMIT 40
        `,
      )
      .all(),
  ]);

  const totalOrders = Number(summary?.total_orders ?? 0);
  const deliveredOrders = Number(summary?.delivered_orders ?? 0);
  const awaitingPayment = Number(summary?.awaiting_payment ?? 0);
  const awaiting = Number(summary?.awaiting_supplier ?? 0);
  const preparing = Number(summary?.preparing ?? 0);
  const shipped = Number(summary?.shipped ?? 0);
  const personalOrders = Number(summary?.personal_orders ?? 0);

  const monthlyTotalSales = Number(summary?.monthly_total_sales ?? 0);
  const monthlyPaidSupplier = Number(summary?.monthly_total_paid_supplier ?? 0);
  const monthlyProfit = monthlyTotalSales - monthlyPaidSupplier;
  const monthlyMargin = monthlyTotalSales ? (monthlyProfit / monthlyTotalSales) * 100 : 0;

  const stalledDays = stalledSetting ? Number(stalledSetting.value) : 7;
  const stalledOrders = await getStalledOrders(stalledDays);
  const withoutTracking = Number(shippingOverview?.without_tracking ?? 0);
  const shippingWithTracking = Number(shippingOverview?.shipping_with_tracking ?? 0);
  const taxPendingList = taxPendingOrders.filter((order) =>
    isTrackingTaxPending(order.last_status),
  );

  const recentOrders = await db
    .prepare<RecentOrder>(
      "SELECT o.id, o.code, o.status, o.total_amount, o.updated_at, c.name as customer_name FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.created_at DESC LIMIT 6",
    )
    .all();

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Dashboard
        </p>
        <h1 className="text-2xl font-semibold">Resumo operacional</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pedidos ativos", value: totalOrders - deliveredOrders },
          { label: "Aguardando pagamento", value: awaitingPayment },
          { label: "Aguardando fornecedor", value: awaiting },
          { label: "Em preparacao", value: preparing },
          { label: "Enviados", value: shipped },
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
            Pedidos atrasados ({stalledDays}+ dias)
          </p>
          <p className="mt-3 text-2xl font-semibold">{stalledOrders.length}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
            Pedidos uso pessoal
          </p>
          <p className="mt-3 text-2xl font-semibold">{personalOrders}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
            Faturamento do mes
          </p>
          <p className="mt-3 text-2xl font-semibold">
            R$ {monthlyTotalSales.toFixed(2)}
          </p>
        </div>
        {session.user.role === "ADMIN" && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              Lucro do mes
            </p>
            <p className="mt-3 text-2xl font-semibold">
              R$ {monthlyProfit.toFixed(2)}
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
            Margem media
          </p>
          <p className="mt-3 text-2xl font-semibold">{monthlyMargin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pedidos recentes</h2>
          <Link
            href="/admin/pedidos"
            className="text-sm text-neutral-500 hover:text-black"
          >
            Ver todos
          </Link>
        </div>
        <div className="mt-4">
          <Link
            href="/admin/pedidos/novo"
            className="inline-flex items-center rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-700 hover:border-neutral-400"
          >
            Criar pedido
          </Link>
        </div>
        <div className="mt-6 space-y-4">
          {recentOrders.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nenhum pedido registrado ainda.
            </p>
          )}
          {recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/pedidos/${order.id}`}
              className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm hover:border-neutral-400"
            >
              <div>
                <p className="font-semibold">
                  {order.code} - {order.customer_name}
                </p>
                <p className="text-neutral-500">
                  Total R$ {Number(order.total_amount).toFixed(2)}
                </p>
              </div>
              <Badge tone="muted">{statusLabel[order.status]}</Badge>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pedidos atrasados</h2>
          <span className="text-sm text-neutral-500">
            {stalledDays}+ dias sem movimentacao
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm text-neutral-600">
          {stalledOrders.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nenhum pedido atrasado.
            </p>
          )}
          {stalledOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/pedidos/${order.id}`}
              className="flex items-center justify-between rounded-2xl border border-neutral-200 px-4 py-3 text-sm hover:border-neutral-400"
            >
              <div>
                <p className="font-semibold">{order.code}</p>
                <p className="text-xs text-neutral-500">
                  Status: {statusLabel[order.status]}
                </p>
              </div>
              <span className="text-xs text-neutral-500">
                {new Date(order.updated_at).toLocaleDateString("pt-BR")}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Pendencias operacionais</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              Aguardando pagamento
            </p>
            <p className="mt-2 text-xl font-semibold">{awaitingPayment}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              Sem rastreio
            </p>
            <p className="mt-2 text-xl font-semibold">{withoutTracking}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              Em transito
            </p>
            <p className="mt-2 text-xl font-semibold">{shippingWithTracking}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">
              Possivel taxa
            </p>
            <p className="mt-2 text-xl font-semibold">{taxPendingList.length}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {taxPendingList.slice(0, 5).map((order) => (
            <Link
              key={order.id}
              href={`/admin/pedidos/${order.id}`}
              className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm hover:border-neutral-400"
            >
              <div>
                <p className="font-semibold">
                  {order.code} - {order.customer_name}
                </p>
                <p className="text-xs text-neutral-500">
                  Status rastreio: {order.last_status ?? "Sem status"}
                </p>
              </div>
              <Badge tone="muted">Ver pedido</Badge>
            </Link>
          ))}
          {taxPendingList.length === 0 && (
            <p className="text-sm text-neutral-500">
              Nenhuma pendencia de taxa identificada no rastreio.
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}
