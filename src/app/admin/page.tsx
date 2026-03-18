import Link from "next/link";

import {
  getDashboardShippingOverview,
  getDashboardSummary,
  listDashboardRecentOrders,
  listDashboardTaxPendingOrders,
} from "@/modules/dashboard/infrastructure/dashboard-read-repository";
import { calculateMargin } from "@/modules/shared/domain/calculators";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
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

export default async function AdminDashboard() {
  const session = await requireAdmin();

  const month = new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01T00:00:00.000Z`;
  const monthEndDate = new Date(monthStart);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  const monthEnd = monthEndDate.toISOString();

  const [summary, stalledSetting, shippingOverview, taxPendingOrders] = await Promise.all([
    getDashboardSummary({ monthStart, monthEnd }),
    getSetting("stalled_days"),
    getDashboardShippingOverview(),
    listDashboardTaxPendingOrders(),
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
  const { profit: monthlyProfit, margin: monthlyMargin } = calculateMargin({
    revenue: monthlyTotalSales,
    cost: monthlyPaidSupplier,
  });

  const stalledDays = stalledSetting ? Number(stalledSetting.value) : 7;
  const stalledOrders = await getStalledOrders(stalledDays);
  const withoutTracking = Number(shippingOverview?.without_tracking ?? 0);
  const shippingWithTracking = Number(shippingOverview?.shipping_with_tracking ?? 0);
  const taxPendingList = taxPendingOrders.filter((order) =>
    isTrackingTaxPending(order.last_status),
  );

  const recentOrders = await listDashboardRecentOrders();

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
