export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getInternalStockAllocationBySaleOrderId,
  getInternalStockAvailabilityBySourceOrderId,
  getImportPackageByOrderId,
  getOrderDetail,
  getSetting,
  listImportPackageOrders,
  listActionLogs,
  listSuppliers,
} from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";
import {
  cancelOrder,
  deleteOrderAction,
  duplicateOrderAction,
  updateShipmentInfo,
  updateSupplierInfo,
} from "@/app/admin/pedidos/[id]/actions";
import { TrackingRefreshButton } from "@/components/admin/tracking-refresh-button";
import { TrackingAutoRefresh } from "@/components/admin/tracking-auto-refresh";
import { SupplierCostForm } from "@/components/admin/supplier-cost-form";
import { translateTrackingStatus } from "@/lib/tracking/status-map";

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Aguardando pagamento",
  AWAITING_SUPPLIER: "Aguardando fornecedor",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

type OrderDetailProps = {
  params: { id: string } | Promise<{ id: string }>;
};

type TimelineEvent = {
  label: string;
  date: string;
};

export default async function OrderDetailPage({ params }: OrderDetailProps) {
  await requireAdmin();
  const resolvedParams = await Promise.resolve(params);
  const data = await getOrderDetail(resolvedParams.id);
  if (!data) return notFound();

  const { order, customer, address, items, supplierOrder, shipment, statusHistory, payments } = data;

  const [suppliers, logs, stalledSetting, importPackage, internalStockAllocation, stockEntryBalance] =
    await Promise.all([
    listSuppliers(),
    listActionLogs(order.id),
    getSetting("stalled_days"),
    getImportPackageByOrderId(order.id),
    getInternalStockAllocationBySaleOrderId(order.id),
    getInternalStockAvailabilityBySourceOrderId(order.id),
  ]);
  const importPackageOrders = importPackage
    ? await listImportPackageOrders(importPackage.id)
    : [];
  const importPackageTotalQuantity = importPackageOrders.reduce(
    (sum, linkedOrder) => sum + Number(linkedOrder.quantity ?? 0),
    0,
  );
  const stalledDays = stalledSetting ? Number(stalledSetting.value) : 7;
  const orderQuantity = items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const stockEntryAllocated = stockEntryBalance
    ? Number(stockEntryBalance.allocated_quantity ?? 0)
    : 0;
  const stockEntryAvailable = stockEntryBalance
    ? Number(stockEntryBalance.available_quantity ?? 0)
    : 0;
  const supplierProductCost = supplierOrder?.product_cost ? Number(supplierOrder.product_cost) : 0;
  const supplierExtraFees = supplierOrder?.extra_fees ? Number(supplierOrder.extra_fees) : 0;
  const supplierPackageQuantity = supplierOrder?.package_quantity
    ? Number(supplierOrder.package_quantity)
    : orderQuantity;
  const supplierUnitCost = supplierOrder?.unit_cost
    ? Number(supplierOrder.unit_cost)
    : supplierPackageQuantity > 0
      ? (supplierProductCost + supplierExtraFees) / supplierPackageQuantity
      : 0;
  const totalCost = supplierOrder?.total_cost ? Number(supplierOrder.total_cost) : 0;
  const totalAmount = Number(order.total_amount);
  const incoming = payments
    .filter((p) => p.direction === "INCOMING")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const outgoing = payments
    .filter((p) => p.direction === "OUTGOING")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = totalAmount - incoming;
  const profit = totalAmount - totalCost;
  const margin = totalAmount ? (profit / totalAmount) * 100 : 0;
  const noRevenueMode = order.is_personal_use === 1 || order.is_stock_order === 1;
  const displayedProfit = noRevenueMode ? 0 : profit;
  const displayedMargin = noRevenueMode ? 0 : margin;
  const lastUpdate = shipment?.last_update_at ?? order.updated_at;
  const currentTimeMs = Date.parse(new Date().toISOString());
  const daysStalled = lastUpdate
    ? Math.floor(
        (currentTimeMs - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  const timelineEvents = [
    {
      label: "Pedido criado",
      date: order.created_at,
    },
    ...statusHistory.map((entry) => ({
      label: `Status: ${statusLabel[entry.status]}${
        entry.note ? ` - ${entry.note}` : ""
      }`,
      date: entry.created_at,
    })),
    ...payments.map((payment) => ({
      label:
        payment.direction === "INCOMING"
          ? `Pagamento recebido (R$ ${Number(payment.amount).toFixed(2)})`
          : `Pagamento fornecedor (R$ ${Number(payment.amount).toFixed(2)})`,
      date: payment.paid_at ?? payment.created_at,
    })),
    ...(shipment
      ? [
          {
            label: "Rastreamento registrado",
            date: shipment.created_at,
          },
          shipment.last_update_at
            ? {
                label: `Atualizacao rastreio: ${translateTrackingStatus(shipment.last_status)} (${shipment.last_status ?? "sem status"})`,
                date: shipment.last_update_at,
              }
            : null,
        ].filter(Boolean)
      : []),
  ].filter((event): event is TimelineEvent => Boolean(event && event.date));

  timelineEvents.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <Container className="space-y-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Badge tone="accent">{statusLabel[order.status]}</Badge>
          {order.is_personal_use === 1 && <Badge tone="muted">Uso pessoal</Badge>}
          {order.is_stock_order === 1 && <Badge tone="muted">Estoque</Badge>}
          {internalStockAllocation && <Badge tone="muted">Venda de estoque interno</Badge>}
        </div>
        <h1 className="text-2xl font-semibold">
          Pedido {order.code} • {customer.name}
        </h1>
        {order.status !== "DELIVERED" &&
          order.status !== "CANCELED" &&
          daysStalled >= stalledDays && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              Pedido sem movimentacao ha {daysStalled} dias.
            </p>
          )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Detalhes do pedido</h2>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <div>
                    <span>
                      {item.name} • {item.size} • {item.quantity} un.
                    </span>
                    {(item.item_description || item.description) && (
                      <p className="text-xs text-neutral-500">
                        {item.item_description || item.description}
                      </p>
                    )}
                  </div>
                  <span>R$ {Number(item.total_price).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold text-neutral-900">
                <span>Total venda</span>
                <span>R$ {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Valor recebido</span>
                <span>R$ {incoming.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Valor pendente</span>
                <span>R$ {pending.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Tipo de pagamento</span>
                <span>{order.payment_type}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Tipo de pedido</span>
                <span>
                  {order.is_personal_use === 1
                    ? "Uso pessoal"
                    : order.is_stock_order === 1
                      ? "Estoque"
                      : "Comercial"}
                </span>
              </div>
              {internalStockAllocation && (
                <div className="flex justify-between text-neutral-500">
                  <span>Origem do custo</span>
                  <span>
                    Estoque {internalStockAllocation.source_order_code} (
                    {Number(internalStockAllocation.quantity)} camisa(s))
                  </span>
                </div>
              )}
              {order.notes && (
                <div className="text-neutral-500">
                  <span className="font-semibold text-neutral-700">
                    Observacoes:
                  </span>{" "}
                  {order.notes}
                </div>
              )}
              <div className="flex justify-between text-neutral-500">
                <span>Valor pago ao fornecedor</span>
                <span>R$ {outgoing.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Custo produtos (pacote)</span>
                <span>R$ {supplierProductCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Taxas do pacote</span>
                <span>R$ {supplierExtraFees.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Custo medio por camisa</span>
                <span>R$ {supplierUnitCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900">
                <span>Lucro</span>
                <span>R$ {displayedProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span>Margem</span>
                <span>{displayedMargin.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Dados do cliente</h2>
            <div className="mt-3 text-sm text-neutral-600">
              <p>{customer.name}</p>
              <p>{customer.email}</p>
              <p>{customer.phone ?? "Sem telefone"}</p>
              <p className="mt-2">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city} - {address.state}
                <br />
                {address.postal_code} • {address.country}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Linha do tempo</h2>
            <div className="mt-4 space-y-4 text-sm text-neutral-600">
              {timelineEvents.map((event) => (
                <div key={`${event.label}-${event.date}`} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-neutral-400" />
                  <div>
                    <p className="font-semibold text-neutral-900">{event.label}</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(event.date).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Log de acoes</h2>
            <div className="mt-4 space-y-3 text-sm text-neutral-600">
              {logs.length === 0 && (
                <p className="text-sm text-neutral-500">
                  Nenhuma acao registrada.
                </p>
              )}
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{log.action}</p>
                    <p className="text-xs text-neutral-500">{log.user_email}</p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Status do pedido</h2>
            <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
              O status e automatico e atualizado pelo rastreamento.
              <br />
              Sem rastreio: aguardando pagamento/fornecedor. Com rastreio: enviado e atualizacoes
              automaticas.
            </p>
            <div className="mt-4 grid gap-3">
              <form action={duplicateOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton pendingLabel="Duplicando..." variant="outline" className="w-full py-2">
                  Duplicar pedido
                </SubmitButton>
              </form>
              <form action={cancelOrder}>
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton
                  pendingLabel="Cancelando..."
                  variant="outline"
                  className="w-full border-amber-200 bg-amber-50 py-2 text-amber-700 hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800"
                >
                  Cancelar pedido
                </SubmitButton>
              </form>
              <form action={deleteOrderAction}>
                <input type="hidden" name="orderId" value={order.id} />
                <SubmitButton
                  pendingLabel="Excluindo..."
                  variant="outline"
                  className="w-full border-red-200 bg-red-50 py-2 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                >
                  Excluir pedido
                </SubmitButton>
              </form>
            </div>
          </div>

          {importPackage && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold">Pacote vinculado</h2>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>
                  <span className="font-semibold text-neutral-900">{importPackage.code}</span>
                </p>
                {importPackage.supplier_name && (
                  <p>Fornecedor do pacote: {importPackage.supplier_name}</p>
                )}
                <p>Pedidos no pacote: {Number(importPackage.linked_orders)}</p>
                <p>Qtd total pacote: {Number(importPackage.package_quantity)}</p>
                <p>
                  Custo final pacote: R${" "}
                  {(
                    Number(importPackage.product_cost) +
                    Number(importPackage.extra_fees) +
                    Number(importPackage.internal_shipping)
                  ).toFixed(2)}
                </p>
                {importPackage.tracking_code && <p>Rastreio: {importPackage.tracking_code}</p>}
              </div>
              {importPackageOrders.length > 0 && (
                <div className="mt-4 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-900">Clientes no mesmo pacote</p>
                  {importPackageOrders.map((linkedOrder) => {
                    const isCurrent = linkedOrder.order_id === order.id;
                    const linkedProfit =
                      Number(linkedOrder.total_amount) - Number(linkedOrder.total_cost);

                    return (
                      <Link
                        key={linkedOrder.order_id}
                        href={`/admin/pedidos/${linkedOrder.order_id}`}
                        className={`block rounded-lg border px-3 py-2 transition hover:border-neutral-400 ${
                          isCurrent
                            ? "border-neutral-300 bg-white"
                            : "border-neutral-200 bg-white/70"
                        }`}
                      >
                        <p className="font-semibold text-neutral-900">
                          {linkedOrder.customer_name} {isCurrent ? "(pedido atual)" : ""}
                        </p>
                        <p>
                          {linkedOrder.code} - {Number(linkedOrder.quantity)} camisa(s) -{" "}
                          {statusLabel[linkedOrder.status]}
                        </p>
                        <p>
                          Venda R$ {Number(linkedOrder.total_amount).toFixed(2)} | Custo R${" "}
                          {Number(linkedOrder.total_cost).toFixed(2)} | Lucro R${" "}
                          {linkedProfit.toFixed(2)}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {internalStockAllocation && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold">Baixa de estoque interno</h2>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>
                  Pedido origem:{" "}
                  <Link
                    href={`/admin/pedidos/${internalStockAllocation.source_order_id}`}
                    className="font-semibold text-neutral-900 underline underline-offset-4"
                  >
                    {internalStockAllocation.source_order_code}
                  </Link>
                </p>
                <p>Cliente origem: {internalStockAllocation.source_customer_name}</p>
                <p>Fornecedor: {internalStockAllocation.supplier_name}</p>
                <p>Quantidade baixada: {Number(internalStockAllocation.quantity)} camisa(s)</p>
                <p>
                  Custo unitario herdado: R$ {Number(internalStockAllocation.unit_cost).toFixed(2)}
                </p>
                <p>
                  Custo total herdado: R$ {Number(internalStockAllocation.total_cost).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {order.is_stock_order === 1 && stockEntryBalance && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-6">
              <h2 className="text-lg font-semibold">Saldo do estoque interno</h2>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>
                  Quantidade original: {Number(stockEntryBalance.total_quantity)} camisa(s)
                </p>
                <p>Quantidade baixada: {stockEntryAllocated} camisa(s)</p>
                <p>Saldo disponivel: {stockEntryAvailable} camisa(s)</p>
                <p>
                  Custo unitario deste estoque: R$ {Number(stockEntryBalance.unit_cost).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Financeiro do pedido</h2>
            <SupplierCostForm
              action={updateSupplierInfo}
              orderId={order.id}
              orderQuantity={orderQuantity}
              totalSold={totalAmount}
              isPersonalUse={order.is_personal_use === 1}
              isStockOrder={order.is_stock_order === 1}
              packageInfo={
                importPackage
                  ? {
                      code: importPackage.code,
                      linkedOrders: Number(importPackage.linked_orders),
                      totalQuantity: Math.max(
                        Number(importPackage.package_quantity ?? 0),
                        importPackageTotalQuantity,
                        orderQuantity,
                      ),
                    }
                  : null
              }
              internalStockAllocation={
                internalStockAllocation
                  ? {
                      sourceOrderCode: internalStockAllocation.source_order_code,
                      sourceCustomerName: internalStockAllocation.source_customer_name,
                      quantity: Number(internalStockAllocation.quantity),
                      unitCost: Number(internalStockAllocation.unit_cost),
                      totalCost: Number(internalStockAllocation.total_cost),
                    }
                  : null
              }
              suppliers={suppliers.map((supplier) => ({
                id: supplier.id,
                name: supplier.name,
              }))}
              initial={{
                supplierId: supplierOrder?.supplier_id ?? suppliers[0]?.id ?? null,
                packageQuantity: supplierOrder?.package_quantity ?? orderQuantity,
                productCost: supplierOrder?.product_cost ?? supplierOrder?.total_cost ?? 0,
                extraFees: supplierOrder?.extra_fees ?? 0,
                unitCost: supplierOrder?.unit_cost ?? 0,
                totalCost: supplierOrder?.total_cost ?? 0,
                paidAt: supplierOrder?.paid_at
                  ? new Date(supplierOrder.paid_at).toISOString().slice(0, 10)
                  : null,
              }}
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <h2 className="text-lg font-semibold">Rastreamento</h2>
            <form action={updateShipmentInfo} className="mt-4 space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <input
                name="trackingCode"
                defaultValue={shipment?.tracking_code ?? ""}
                placeholder="Código de rastreamento"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                name="carrier"
                defaultValue={shipment?.carrier ?? ""}
                placeholder="Código da transportadora (17track)"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <input
                name="originCountry"
                defaultValue={shipment?.origin_country ?? "Tailandia"}
                placeholder="País de origem"
                className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <SubmitButton pendingLabel="Salvando rastreio..." className="w-full py-2">
                Registrar rastreamento
              </SubmitButton>
            </form>
            {shipment && (
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                <p>Status atual: {translateTrackingStatus(shipment.last_status)}</p>
                {shipment.last_status && (
                  <p className="text-xs text-neutral-500">Status bruto: {shipment.last_status}</p>
                )}
                {shipment.eta_date && (
                  <p>
                    Previsão:{" "}
                    {new Date(shipment.eta_date).toLocaleDateString("pt-BR")}
                  </p>
                )}
                <div className="mt-4">
                  <TrackingRefreshButton orderId={order.id} />
                </div>
                <TrackingAutoRefresh
                  orderId={order.id}
                  lastUpdateAt={shipment.last_update_at}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}



