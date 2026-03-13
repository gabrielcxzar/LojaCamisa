"use client";

import { useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

type SupplierOption = {
  id: string;
  name: string;
};

type SupplierCostInitialValues = {
  supplierId?: string | null;
  packageQuantity?: number | null;
  productCost?: number | null;
  extraFees?: number | null;
  unitCost?: number | null;
  totalCost?: number | null;
  paidAt?: string | null;
};

type SupplierCostFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  orderId: string;
  orderQuantity: number;
  totalSold: number;
  isPersonalUse: boolean;
  packageInfo?: {
    code: string;
    linkedOrders: number;
    totalQuantity: number;
  } | null;
  suppliers: SupplierOption[];
  initial?: SupplierCostInitialValues;
};

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

export function SupplierCostForm({
  action,
  orderId,
  orderQuantity,
  totalSold,
  isPersonalUse,
  packageInfo,
  suppliers,
  initial,
}: SupplierCostFormProps) {
  const defaultPackageQuantity =
    String(
      Math.max(
        packageInfo?.totalQuantity ?? 0,
        initial?.packageQuantity ?? 0,
        orderQuantity > 0 ? orderQuantity : 1,
      ),
    );
  const defaultProductCost =
    initial?.productCost && initial.productCost > 0
      ? toMoney(initial.productCost)
      : initial?.totalCost && initial.totalCost > 0
        ? toMoney(initial.totalCost)
        : "";
  const defaultExtraFees =
    initial?.extraFees && initial.extraFees > 0 ? toMoney(initial.extraFees) : "0.00";

  const [totalSoldInput, setTotalSoldInput] = useState(toMoney(totalSold));
  const [personalUseChecked, setPersonalUseChecked] = useState(isPersonalUse);
  const [packageQuantityInput, setPackageQuantityInput] = useState(defaultPackageQuantity);
  const [productCostInput, setProductCostInput] = useState(defaultProductCost);
  const [extraFeesInput, setExtraFeesInput] = useState(defaultExtraFees);

  const summary = useMemo(() => {
    const sold = Math.max(0, toNumber(totalSoldInput));
    const minimumPackageQuantity = Math.max(
      packageInfo?.totalQuantity ?? 0,
      orderQuantity > 0 ? orderQuantity : 1,
    );
    const packageQuantity = Math.max(
      minimumPackageQuantity,
      Math.round(toNumber(packageQuantityInput)),
    );
    const productCost = Math.max(0, toNumber(productCostInput));
    const extraFees = Math.max(0, toNumber(extraFeesInput));
    const packageFinalCost = productCost + extraFees;
    const averageUnitCost = packageFinalCost / packageQuantity;
    const totalOrderCost = averageUnitCost * Math.max(1, orderQuantity);
    const estimatedProfit = personalUseChecked ? 0 : sold - totalOrderCost;
    const margin = !personalUseChecked && sold > 0 ? (estimatedProfit / sold) * 100 : 0;

    return {
      sold,
      packageQuantity,
      packageFinalCost,
      averageUnitCost,
      totalOrderCost,
      estimatedProfit,
      margin,
    };
  }, [
    extraFeesInput,
    orderQuantity,
    packageInfo?.totalQuantity,
    packageQuantityInput,
    personalUseChecked,
    productCostInput,
    totalSoldInput,
  ]);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="unitCost" value={toMoney(summary.averageUnitCost)} />
      <input type="hidden" name="totalCost" value={toMoney(summary.totalOrderCost)} />
      <input
        name="totalSold"
        type="number"
        min={0}
        step="0.01"
        value={totalSoldInput}
        onChange={(event) => setTotalSoldInput(event.target.value)}
        placeholder="Valor vendido total (R$)"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-700">
        <input
          name="isPersonalUse"
          type="checkbox"
          checked={personalUseChecked}
          onChange={(event) => setPersonalUseChecked(event.target.checked)}
        />
        Uso pessoal (nao entra no faturamento/lucro)
      </label>
      {suppliers.length > 0 ? (
        <select
          name="supplierId"
          defaultValue={initial?.supplierId ?? suppliers[0]?.id}
          className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
        >
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Cadastre um fornecedor para salvar custo de compra.
        </div>
      )}
      <input
        name="packageQuantity"
        type="number"
        min={1}
        step="1"
        value={packageQuantityInput}
        onChange={(event) => setPackageQuantityInput(event.target.value)}
        placeholder="Qtd de camisas no pacote"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <input
        name="productCost"
        type="number"
        min={0}
        step="0.01"
        value={productCostInput}
        onChange={(event) => setProductCostInput(event.target.value)}
        placeholder="Valor pago ao fornecedor (R$)"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <input
        name="extraFees"
        type="number"
        min={0}
        step="0.01"
        value={extraFeesInput}
        onChange={(event) => setExtraFeesInput(event.target.value)}
        placeholder="Taxa paga (R$)"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <p>Qtd do pedido: {Math.max(1, orderQuantity)} camisa(s)</p>
        {packageInfo && (
          <p>
            Pacote {packageInfo.code}: {packageInfo.linkedOrders} pedido(s) vinculado(s)
          </p>
        )}
        {packageInfo && <p>Qtd total do pacote: {summary.packageQuantity} camisa(s)</p>}
        <p>Custo final do pacote: R$ {toMoney(summary.packageFinalCost)}</p>
        <p>Custo medio por camisa: R$ {toMoney(summary.averageUnitCost)}</p>
        <p>Custo alocado neste pedido: R$ {toMoney(summary.totalOrderCost)}</p>
        <p>
          Lucro estimado do pedido: R$ {toMoney(summary.estimatedProfit)}
          {personalUseChecked ? " (uso pessoal)" : ""}
        </p>
        <p>Margem estimada: {summary.margin.toFixed(1)}%</p>
        <p className="pt-1">
          Pedido comercial exige valor pago ao fornecedor.
          {packageInfo
            ? " Esta edicao atualiza o pacote inteiro e recalcula todos os pedidos vinculados."
            : " A taxa pode ser editada depois."}
        </p>
      </div>
      <input
        name="paidAt"
        type="date"
        defaultValue={initial?.paidAt ?? ""}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <SubmitButton pendingLabel="Salvando financeiro..." className="w-full py-2">
        Salvar financeiro
      </SubmitButton>
    </form>
  );
}
