export const dynamic = "force-dynamic";

import { Container } from "@/components/layout/container";
import { SubmitButton } from "@/components/ui/submit-button";
import { getSetting } from "@/lib/db/queries";
import { requireAdmin } from "@/lib/require-admin";
import { saveSettings } from "@/app/admin/configuracoes/actions";

export default async function ConfiguracoesPage() {
  await requireAdmin();

  const [businessNameSetting, stalledDaysSetting, feePercentSetting, feeFixedSetting] =
    await Promise.all([
      getSetting("business_name"),
      getSetting("stalled_days"),
      getSetting("payment_fee_percent"),
      getSetting("payment_fee_fixed"),
    ]);

  const businessName = businessNameSetting?.value ?? "Loja Camisa";
  const stalledDays = stalledDaysSetting?.value ?? "7";
  const feePercent = feePercentSetting?.value ?? "5";
  const feeFixed = feeFixedSetting?.value ?? "0";

  return (
    <Container className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
          Configuracoes
        </p>
        <h1 className="text-2xl font-semibold">Ajustes do sistema</h1>
      </div>

      <form
        action={saveSettings}
        className="grid gap-6 rounded-3xl border border-neutral-200 bg-white p-8"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <input
            name="businessName"
            defaultValue={businessName}
            placeholder="Nome da loja"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="stalledDays"
            defaultValue={stalledDays}
            placeholder="Dias para alerta de atraso"
            type="number"
            min={1}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="paymentFeePercent"
            defaultValue={feePercent}
            placeholder="Taxa percentual (%)"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="paymentFeeFixed"
            defaultValue={feeFixed}
            placeholder="Taxa fixa por pagamento (R$)"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
        </div>
        <SubmitButton pendingLabel="Salvando configuracoes..." className="w-full">
          Salvar configuracoes
        </SubmitButton>
      </form>
    </Container>
  );
}
