import {
  getFinanceSummary,
  listFinanceRecentPayments,
  listFinanceSettings,
  listFinanceStatusCounts,
} from "@/modules/finance/infrastructure/finance-read-repository";
import { calculateMargin } from "@/modules/shared/domain/calculators";
import { PaymentDirection } from "@/modules/shared/domain/enums";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/require-admin";

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

export default async function FinanceiroPage() {
  await requireAdmin();

  const month = new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01T00:00:00.000Z`;
  const monthEndDate = new Date(monthStart);
  monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1);
  const monthEnd = monthEndDate.toISOString();

  const [summary, statusCounts, recentPayments, settingRows] = await Promise.all([
    getFinanceSummary({ monthStart, monthEnd }),
    listFinanceStatusCounts(),
    listFinanceRecentPayments(),
    listFinanceSettings(),
  ]);

  const settings = Object.fromEntries(settingRows.map((item) => [item.key, item.value]));

  const totalSales = Number(summary?.total_sales ?? 0);
  const totalReceived = Number(summary?.total_received ?? 0);
  const totalPaidSupplier = Number(summary?.total_paid_supplier ?? 0);
  const incomingCount = Number(summary?.incoming_count ?? 0);
  const totalPending = totalSales - totalReceived;

  const { profit, margin } = calculateMargin({
    revenue: totalSales,
    cost: totalPaidSupplier,
  });

  const feePercent = Number(settings.payment_fee_percent ?? 0);
  const feeFixed = Number(settings.payment_fee_fixed ?? 0);
  const estimatedFees = totalReceived * (feePercent / 100) + incomingCount * feeFixed;
  const profitAfterFees = profit - estimatedFees;

  const monthlyTotalSales = Number(summary?.monthly_total_sales ?? 0);
  const monthlyPaidSupplier = Number(summary?.monthly_total_paid_supplier ?? 0);
  const monthlyTotalIncoming = Number(summary?.monthly_total_incoming ?? 0);
  const monthlyIncomingCount = Number(summary?.monthly_incoming_count ?? 0);
  const { profit: monthlyProfit, margin: monthlyMargin } = calculateMargin({
    revenue: monthlyTotalSales,
    cost: monthlyPaidSupplier,
  });
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
                  {payment.direction === PaymentDirection.Incoming ? "Recebido" : "Pago"} -{" "}
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
