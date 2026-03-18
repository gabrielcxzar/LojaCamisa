import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { listOrders } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";
import { translateTrackingStatus } from "@/lib/tracking/status-map";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  AWAITING_SUPPLIER: "Aguardando fornecedor",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

type OrdersPageProps = {
  searchParams?: {
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  };
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requireAdmin();
  const status = searchParams?.status;
  const query = searchParams?.q?.trim();
  const from = searchParams?.from ? new Date(searchParams.from) : undefined;
  const to = searchParams?.to ? new Date(searchParams.to) : undefined;

  const orders = await listOrders({
    status,
    query,
    from: from ? from.toISOString() : undefined,
    to: to ? to.toISOString() : undefined,
  });

  return (
    <Container className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
            Pedidos
          </p>
          <h1 className="text-2xl font-semibold">Gerenciar pedidos</h1>
        </div>
        <Link
          href="/admin/pedidos/novo"
          className="inline-flex items-center rounded-full bg-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
        >
          Novo pedido
        </Link>
      </div>
      <form className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg md:grid-cols-4">
        <input
          name="q"
          placeholder="Buscar por cliente"
          defaultValue={query}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? "ALL"}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        >
          <option value="ALL">Todos status</option>
          <option value="AWAITING_PAYMENT">Aguardando pagamento</option>
          <option value="AWAITING_SUPPLIER">Aguardando fornecedor</option>
          <option value="PREPARING">Em preparação</option>
          <option value="SHIPPED">Enviado</option>
          <option value="DELIVERED">Entregue</option>
          <option value="CANCELED">Cancelado</option>
        </select>
        <input
          name="from"
          type="date"
          defaultValue={searchParams?.from}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
        <input
          name="to"
          type="date"
          defaultValue={searchParams?.to}
          className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        />
        <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white md:col-span-4">
          Aplicar filtros
        </button>
      </form>
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg">
        {orders.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum pedido encontrado.
          </p>
        )}
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/admin/pedidos/${order.id}`}
            className="block w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm transition hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <div className="pointer-events-none grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
              <p className="font-semibold">
                {order.code} • {order.customer_name}
              </p>
              <p className="text-neutral-500">
                {new Date(order.created_at).toLocaleDateString("pt-BR")} • Total
                R$ {Number(order.total_amount).toFixed(2)}
              </p>
              {order.package_code && (
                <p className="text-xs text-neutral-500">Pacote: {order.package_code}</p>
              )}
              {order.tracking_last_status && (
                <p className="text-xs text-neutral-500">
                  Rastreio: {translateTrackingStatus(order.tracking_last_status)}
                </p>
              )}
              {order.is_personal_use === 1 && (
                <p className="text-xs text-amber-700">Uso pessoal (fora do financeiro)</p>
              )}
              </div>
              <Badge
                tone="muted"
                className="shrink-0 justify-self-start md:justify-self-end"
              >
                {statusLabel[order.status]}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  );
}

