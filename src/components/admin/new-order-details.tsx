"use client";

import { useMemo, useState } from "react";

import { SubmitButton } from "@/components/ui/submit-button";

type ProductOption = {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
};

type SupplierOption = {
  id: string;
  name: string;
};

type Props = {
  products: ProductOption[];
  suppliers: SupplierOption[];
};

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function formatPercent(value: number) {
  return value.toFixed(2);
}

function defaultPercentByPaymentType(paymentType: string) {
  if (paymentType === "FULL") return 100;
  if (paymentType === "DEPOSIT_50") return 50;
  return 0;
}

export function NewOrderDetails({ products, suppliers }: Props) {
  const [productMode, setProductMode] = useState<"custom" | "existing">("custom");
  const [productSlug, setProductSlug] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderTotalInput, setOrderTotalInput] = useState("");
  const [paymentType, setPaymentType] = useState("DEPOSIT_50");
  const [amountPaidPercentInput, setAmountPaidPercentInput] = useState("50.00");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [syncSource, setSyncSource] = useState<"percent" | "amount">("percent");
  const [isPersonalUse, setIsPersonalUse] = useState(false);

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [packageQuantityInput, setPackageQuantityInput] = useState("1");
  const [productCostInput, setProductCostInput] = useState("");
  const [extraFeesInput, setExtraFeesInput] = useState("0.00");

  const productPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      map.set(product.slug, product.basePrice);
    }
    return map;
  }, [products]);

  const quantityValue = useMemo(() => {
    const qty = parseNumber(quantity);
    return qty > 0 ? qty : 1;
  }, [quantity]);

  const effectiveUnitPrice = useMemo(() => {
    const totalInput = parseNumber(orderTotalInput);
    if (totalInput > 0 && quantityValue > 0) {
      return totalInput / quantityValue;
    }

    if (productMode === "existing") {
      return productPriceMap.get(productSlug) ?? 0;
    }

    return 0;
  }, [orderTotalInput, productMode, productPriceMap, productSlug, quantityValue]);

  const totalOrder = useMemo(() => {
    const totalInput = parseNumber(orderTotalInput);
    if (totalInput > 0) return totalInput;
    return quantityValue * effectiveUnitPrice;
  }, [effectiveUnitPrice, orderTotalInput, quantityValue]);

  const supplierSummary = useMemo(() => {
    const packageQuantity = Math.max(
      1,
      Math.round(parseNumber(packageQuantityInput) || quantityValue),
    );
    const productCost = Math.max(0, parseNumber(productCostInput));
    const extraFees = Math.max(0, parseNumber(extraFeesInput));
    const packageFinalCost = productCost + extraFees;
    const averageUnitCost = packageFinalCost / packageQuantity;
    const allocatedCost = averageUnitCost * quantityValue;

    return {
      packageQuantity,
      productCost,
      extraFees,
      packageFinalCost,
      averageUnitCost,
      allocatedCost,
    };
  }, [extraFeesInput, packageQuantityInput, productCostInput, quantityValue]);

  const syncedPaid = useMemo(() => {
    if (syncSource === "percent") {
      const percent = Math.max(0, parseNumber(amountPaidPercentInput));
      return {
        percent: formatPercent(percent),
        amount: formatMoney(totalOrder * (percent / 100)),
      };
    }

    const amount = Math.max(0, parseNumber(amountPaidInput));
    const computedPercent = totalOrder > 0 ? (amount / totalOrder) * 100 : 0;
    return {
      percent: formatPercent(computedPercent),
      amount: formatMoney(amount),
    };
  }, [amountPaidInput, amountPaidPercentInput, syncSource, totalOrder]);

  function syncAmountFromPercent(percentText: string) {
    setSyncSource("percent");
    setAmountPaidPercentInput(percentText);
  }

  function syncPercentFromAmount(amountText: string) {
    setSyncSource("amount");
    setAmountPaidInput(amountText);
  }

  function handlePaymentTypeChange(value: string) {
    setPaymentType(value);
    const defaultPercent = defaultPercentByPaymentType(value);
    setSyncSource("percent");
    setAmountPaidPercentInput(formatPercent(defaultPercent));
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Camisa</h2>
        <div className="mt-4 space-y-3 text-sm text-neutral-600">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="productMode"
              value="custom"
              checked={productMode === "custom"}
              onChange={() => setProductMode("custom")}
            />
            Pedido rapido (sem cadastro previo)
          </label>
          <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
            <input
              name="customName"
              placeholder="Nome da camisa"
              defaultValue="Camisa de time sob encomenda"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="customTeam"
              placeholder="Time (opcional)"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="customModel"
              placeholder="Modelo (opcional)"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="customDescription"
              placeholder="Descricao (opcional)"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="productMode"
              value="existing"
              checked={productMode === "existing"}
              onChange={() => setProductMode("existing")}
            />
            Usar produto do catalogo
          </label>
          <select
            name="productSlug"
            value={productSlug}
            onChange={(event) => setProductSlug(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          >
            <option value="">Selecione (opcional)</option>
            {products.map((product) => (
              <option key={product.id} value={product.slug}>
                {product.name} - R$ {product.basePrice.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Pedido</h2>
        <div className="mt-4 grid gap-4">
          <select
            name="size"
            defaultValue="M"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          >
            {["PP", "P", "M", "G", "GG"].map((size) => (
              <option key={size} value={size}>
                Tamanho {size}
              </option>
            ))}
          </select>
          <input
            name="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="orderTotal"
            type="number"
            step="0.01"
            placeholder="Valor vendido total (R$)"
            value={orderTotalInput}
            onChange={(event) => setOrderTotalInput(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input type="hidden" name="unitPrice" value={formatMoney(effectiveUnitPrice)} />
          <input type="hidden" name="amountPaidSource" value={syncSource} />
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Valor vendido total:{" "}
            <span className="font-semibold">R$ {formatMoney(totalOrder)}</span>
            <br />
            Valor medio por camisa:{" "}
            <span className="font-semibold">R$ {formatMoney(effectiveUnitPrice)}</span>
          </p>
          <select
            name="paymentType"
            value={paymentType}
            onChange={(event) => handlePaymentTypeChange(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          >
            <option value="DEPOSIT_50">50% do valor</option>
            <option value="FULL">100% do valor</option>
            <option value="NONE">Apenas reserva</option>
          </select>
          <input
            name="amountPaidPercent"
            type="number"
            step="0.01"
            placeholder="% pago"
            value={syncSource === "percent" ? amountPaidPercentInput : syncedPaid.percent}
            onChange={(event) => syncAmountFromPercent(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="amountPaid"
            type="number"
            step="0.01"
            placeholder="Valor pago"
            value={syncSource === "amount" ? amountPaidInput : syncedPaid.amount}
            onChange={(event) => syncPercentFromAmount(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Status e automatico: sem rastreio fica em aguardando, com rastreio vai para enviado e
            depois atualiza sozinho pelo rastreamento.
          </p>
          <input
            name="trackingCode"
            placeholder="Codigo de rastreio (opcional)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="carrier"
            placeholder="Transportadora (opcional)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="originCountry"
            defaultValue="China"
            placeholder="Pais de origem"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <textarea
            name="notes"
            placeholder="Observacoes internas"
            className="min-h-[96px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-600">
            <input
              name="isPersonalUse"
              type="checkbox"
              checked={isPersonalUse}
              onChange={(event) => setIsPersonalUse(event.target.checked)}
            />
            Uso pessoal (nao entra em faturamento e lucro)
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Compra com fornecedor</h2>
        <div className="mt-4 grid gap-4">
          <select
            name="supplierId"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          >
            {suppliers.length === 0 && <option value="">Sem fornecedor cadastrado</option>}
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
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="productCost"
            type="number"
            min={0}
            step="0.01"
            value={productCostInput}
            onChange={(event) => setProductCostInput(event.target.value)}
            placeholder="Valor pago ao fornecedor (R$)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="extraFees"
            type="number"
            min={0}
            step="0.01"
            value={extraFeesInput}
            onChange={(event) => setExtraFeesInput(event.target.value)}
            placeholder="Taxa paga (R$)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="paidAt"
            type="date"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Custo final do pacote:{" "}
            <span className="font-semibold">
              R$ {formatMoney(supplierSummary.packageFinalCost)}
            </span>
            <br />
            Custo medio por camisa:{" "}
            <span className="font-semibold">
              R$ {formatMoney(supplierSummary.averageUnitCost)}
            </span>
            <br />
            Custo alocado neste pedido:{" "}
            <span className="font-semibold">
              R$ {formatMoney(supplierSummary.allocatedCost)}
            </span>
          </p>
          <p className="text-xs text-neutral-500">
            Pedido comercial exige valor pago ao fornecedor. Em uso pessoal, esse campo pode ficar
            zerado.
          </p>
        </div>
      </section>

      <SubmitButton pendingLabel="Criando pedido..." className="w-full">
        Criar pedido
      </SubmitButton>
    </div>
  );
}
