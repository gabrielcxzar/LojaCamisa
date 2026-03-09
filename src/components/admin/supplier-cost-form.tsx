"use client";

import { useMemo, useState } from "react";

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
  suppliers,
  initial,
}: SupplierCostFormProps) {
  const defaultPackageQuantity =
    initial?.packageQuantity && initial.packageQuantity > 0
      ? String(initial.packageQuantity)
      : String(orderQuantity > 0 ? orderQuantity : 1);
  const defaultProductCost =
    initial?.productCost && initial.productCost > 0
      ? toMoney(initial.productCost)
      : initial?.totalCost && initial.totalCost > 0
        ? toMoney(initial.totalCost)
        : "";
  const defaultExtraFees =
    initial?.extraFees && initial.extraFees > 0 ? toMoney(initial.extraFees) : "0.00";

  const [packageQuantityInput, setPackageQuantityInput] = useState(defaultPackageQuantity);
  const [productCostInput, setProductCostInput] = useState(defaultProductCost);
  const [extraFeesInput, setExtraFeesInput] = useState(defaultExtraFees);

  const summary = useMemo(() => {
    const packageQuantity = Math.max(1, Math.round(toNumber(packageQuantityInput)));
    const productCost = Math.max(0, toNumber(productCostInput));
    const extraFees = Math.max(0, toNumber(extraFeesInput));
    const packageFinalCost = productCost + extraFees;
    const averageUnitCost = packageFinalCost / packageQuantity;
    const totalOrderCost = averageUnitCost * Math.max(1, orderQuantity);

    return {
      packageQuantity,
      productCost,
      extraFees,
      packageFinalCost,
      averageUnitCost,
      totalOrderCost,
    };
  }, [extraFeesInput, orderQuantity, packageQuantityInput, productCostInput]);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="unitCost" value={toMoney(summary.averageUnitCost)} />
      <input type="hidden" name="totalCost" value={toMoney(summary.totalOrderCost)} />
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
        placeholder="Valor pago no pacote (R$)"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <input
        name="extraFees"
        type="number"
        min={0}
        step="0.01"
        value={extraFeesInput}
        onChange={(event) => setExtraFeesInput(event.target.value)}
        placeholder="Taxas do pacote (R$)"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <p>Qtd do pedido: {Math.max(1, orderQuantity)} camisa(s)</p>
        <p>Custo final do pacote: R$ {toMoney(summary.packageFinalCost)}</p>
        <p>Custo medio por camisa: R$ {toMoney(summary.averageUnitCost)}</p>
        <p>Custo alocado neste pedido: R$ {toMoney(summary.totalOrderCost)}</p>
        <p className="pt-1">
          Se houver outros pedidos com o mesmo rastreio, o sistema faz rateio automatico.
        </p>
      </div>
      <input
        name="paidAt"
        type="date"
        defaultValue={initial?.paidAt ?? ""}
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
      />
      <button className="w-full rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
        Salvar fornecedor
      </button>
    </form>
  );
}
