"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

type ProductOption = {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
};

type Props = {
  products: ProductOption[];
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

export function NewOrderDetails({ products }: Props) {
  const [productMode, setProductMode] = useState<"custom" | "existing">("custom");
  const [productSlug, setProductSlug] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderTotalInput, setOrderTotalInput] = useState("");
  const [paymentType, setPaymentType] = useState("DEPOSIT_50");
  const [amountPaidPercentInput, setAmountPaidPercentInput] = useState("50.00");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [syncSource, setSyncSource] = useState<"percent" | "amount">("percent");

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

    if (productMode === "custom") {
      const custom = parseNumber(customPrice);
      if (custom > 0) return custom;
      return parseNumber(unitPrice);
    }

    const selectedPrice = productPriceMap.get(productSlug) ?? 0;
    const customUnit = parseNumber(unitPrice);
    return customUnit > 0 ? customUnit : selectedPrice;
  }, [customPrice, orderTotalInput, productMode, productPriceMap, productSlug, quantityValue, unitPrice]);

  const totalOrder = useMemo(() => {
    const totalInput = parseNumber(orderTotalInput);
    if (totalInput > 0) return totalInput;
    return quantityValue * effectiveUnitPrice;
  }, [effectiveUnitPrice, orderTotalInput, quantityValue]);

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
            <input
              name="customPrice"
              type="number"
              step="0.01"
              placeholder="Preco unitario"
              value={customPrice}
              onChange={(event) => setCustomPrice(event.target.value)}
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
            placeholder="Valor total do pedido (opcional)"
            value={orderTotalInput}
            onChange={(event) => setOrderTotalInput(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            placeholder="Preco unitario (opcional, se nao informar total)"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          />
          <input type="hidden" name="amountPaidSource" value={syncSource} />
          <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Custo final do produto:{" "}
            <span className="font-semibold">R$ {formatMoney(totalOrder)}</span>
            <br />
            Custo medio por camisa:{" "}
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
          <select
            name="status"
            defaultValue="AWAITING_SUPPLIER"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
          >
            <option value="AWAITING_PAYMENT">Aguardando pagamento</option>
            <option value="AWAITING_SUPPLIER">Aguardando fornecedor</option>
            <option value="PREPARING">Em preparacao</option>
            <option value="SHIPPED">Enviado</option>
            <option value="DELIVERED">Entregue</option>
          </select>
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
        </div>
      </section>

      <Button type="submit" className="w-full">
        Criar pedido
      </Button>
    </div>
  );
}
