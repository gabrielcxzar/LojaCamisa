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

type ImportPackageOption = {
  id: string;
  code: string;
  trackingCode: string | null;
  linkedOrders: number;
};

type Props = {
  products: ProductOption[];
  suppliers: SupplierOption[];
  packages: ImportPackageOption[];
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

export function NewOrderDetails({ products, suppliers, packages }: Props) {
  const [entryMode, setEntryMode] = useState<"quick" | "advanced">("quick");
  const [productMode, setProductMode] = useState<"custom" | "existing">("custom");
  const [productSlug, setProductSlug] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderTotalInput, setOrderTotalInput] = useState("");
  const [paymentType, setPaymentType] = useState("DEPOSIT_50");
  const [amountPaidPercentInput, setAmountPaidPercentInput] = useState("50.00");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [syncSource, setSyncSource] = useState<"percent" | "amount">("percent");
  const [isPersonalUse, setIsPersonalUse] = useState(false);

  const [packageMode, setPackageMode] = useState<"new" | "existing" | "none">(
    "new",
  );
  const [existingPackageId, setExistingPackageId] = useState(packages[0]?.id ?? "");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [packageQuantityInput, setPackageQuantityInput] = useState("1");
  const [productCostInput, setProductCostInput] = useState("");
  const [extraFeesInput, setExtraFeesInput] = useState("0.00");
  const [internalShippingInput, setInternalShippingInput] = useState("0.00");
  const [showPackageAdvanced, setShowPackageAdvanced] = useState(false);

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

  const packageSummary = useMemo(() => {
    const packageQuantity = Math.max(
      1,
      Math.round(parseNumber(packageQuantityInput) || quantityValue),
    );
    const productCost = Math.max(0, parseNumber(productCostInput));
    const extraFees = Math.max(0, parseNumber(extraFeesInput));
    const internalShipping = Math.max(0, parseNumber(internalShippingInput));
    const packageFinalCost = productCost + extraFees + internalShipping;
    const averageUnitCost = packageFinalCost / packageQuantity;
    const allocatedCost = averageUnitCost * quantityValue;

    return {
      packageQuantity,
      packageFinalCost,
      averageUnitCost,
      allocatedCost,
    };
  }, [
    extraFeesInput,
    internalShippingInput,
    packageQuantityInput,
    productCostInput,
    quantityValue,
  ]);

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

  function handleEntryMode(next: "quick" | "advanced") {
    setEntryMode(next);
    if (next === "quick") {
      setProductMode("custom");
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Modo de cadastro</h2>
        <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
            <input
              type="radio"
              checked={entryMode === "quick"}
              onChange={() => handleEntryMode("quick")}
            />
            Modo rapido (recomendado)
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
            <input
              type="radio"
              checked={entryMode === "advanced"}
              onChange={() => handleEntryMode("advanced")}
            />
            Modo completo
          </label>
          <p className="sm:col-span-2 text-xs text-neutral-500">
            No modo rapido, voce preenche apenas o essencial para vender e acompanhar.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Camisa</h2>
        <input
          type="hidden"
          name="productMode"
          value={entryMode === "quick" ? "custom" : productMode}
        />

        {entryMode === "quick" ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600">
            <input type="hidden" name="customName" value="Camisa de time sob encomenda" />
            <input
              name="customTeam"
              placeholder="Time (ex: Vitoria)"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="customModel"
              placeholder="Modelo (ex: 2025 torcedor)"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <input
              name="customDescription"
              placeholder="Descricao curta (opcional)"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
            />
            <p className="text-xs text-neutral-500">
              O sistema salva como pedido rapido sem criar produto no catalogo.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-neutral-600">
            <label className="flex items-center gap-2">
              <input
                type="radio"
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
        )}
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
          {!isPersonalUse ? (
            <>
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
            </>
          ) : (
            <>
              <input type="hidden" name="paymentType" value="NONE" />
              <input type="hidden" name="amountPaidPercent" value="0" />
              <input type="hidden" name="amountPaid" value="0" />
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                Uso pessoal ativo: pedido fica fora de faturamento e lucro.
              </p>
            </>
          )}
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
        <h2 className="text-lg font-semibold">Pacote de importacao</h2>
        <div className="mt-4 space-y-4">
          <input type="hidden" name="packageMode" value={packageMode} />
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="radio"
              name="packageModeOption"
              value="new"
              checked={packageMode === "new"}
              onChange={() => setPackageMode("new")}
            />
            Criar novo pacote para este pedido
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="radio"
              name="packageModeOption"
              value="existing"
              checked={packageMode === "existing"}
              onChange={() => setPackageMode("existing")}
            />
            Vincular a pacote existente
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="radio"
              name="packageModeOption"
              value="none"
              checked={packageMode === "none"}
              onChange={() => setPackageMode("none")}
            />
            Sem pacote (pedido isolado)
          </label>

          {packageMode === "existing" && (
            <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
              <select
                name="existingPackageId"
                value={existingPackageId}
                onChange={(event) => setExistingPackageId(event.target.value)}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              >
                {packages.length === 0 && <option value="">Nenhum pacote cadastrado</option>}
                {packages.map((importPackage) => (
                  <option key={importPackage.id} value={importPackage.id}>
                    {importPackage.code}
                    {importPackage.trackingCode
                      ? ` - ${importPackage.trackingCode}`
                      : " - sem rastreio"}{" "}
                    ({importPackage.linkedOrders} pedidos)
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                Ao vincular, o custo por camisa e o rastreio serao herdados automaticamente.
              </p>
            </div>
          )}

          {packageMode === "new" && (
            <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
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
                placeholder="Qtd total de camisas no pacote"
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
                name="trackingCode"
                placeholder="Codigo de rastreio (opcional)"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={showPackageAdvanced || entryMode === "advanced"}
                  onChange={(event) => setShowPackageAdvanced(event.target.checked)}
                />
                Mostrar campos avancados (taxa, frete interno, carrier, data, observacoes)
              </label>

              {(showPackageAdvanced || entryMode === "advanced") && (
                <>
                  <input
                    name="extraFees"
                    type="number"
                    min={0}
                    step="0.01"
                    value={extraFeesInput}
                    onChange={(event) => setExtraFeesInput(event.target.value)}
                    placeholder="Taxa de importacao (R$)"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                  />
                  <input
                    name="internalShipping"
                    type="number"
                    min={0}
                    step="0.01"
                    value={internalShippingInput}
                    onChange={(event) => setInternalShippingInput(event.target.value)}
                    placeholder="Frete interno (R$)"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                  />
                  <input
                    name="carrier"
                    placeholder="Transportadora (17track, opcional)"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                  />
                  <input
                    name="originCountry"
                    defaultValue="China"
                    placeholder="Pais de origem"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                  />
                  <input
                    name="paidAt"
                    type="date"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                  />
                  <textarea
                    name="packageNotes"
                    placeholder="Observacoes do pacote"
                    className="min-h-[80px] w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
                  />
                </>
              )}

              {!showPackageAdvanced && entryMode === "quick" && (
                <>
                  <input type="hidden" name="extraFees" value={extraFeesInput} />
                  <input type="hidden" name="internalShipping" value={internalShippingInput} />
                  <input type="hidden" name="carrier" value="" />
                  <input type="hidden" name="originCountry" value="China" />
                  <input type="hidden" name="paidAt" value="" />
                  <input type="hidden" name="packageNotes" value="" />
                </>
              )}
              <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                Custo final do pacote:{" "}
                <span className="font-semibold">
                  R$ {formatMoney(packageSummary.packageFinalCost)}
                </span>
                <br />
                Custo medio por camisa:{" "}
                <span className="font-semibold">
                  R$ {formatMoney(packageSummary.averageUnitCost)}
                </span>
                <br />
                Custo alocado neste pedido:{" "}
                <span className="font-semibold">
                  R$ {formatMoney(packageSummary.allocatedCost)}
                </span>
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <SubmitButton pendingLabel="Criando pedido..." className="w-full" name="afterSubmit" value="open">
          Criar e abrir pedido
        </SubmitButton>
        <SubmitButton
          pendingLabel="Criando pedido..."
          className="w-full"
          variant="outline"
          name="afterSubmit"
          value="new"
        >
          Criar e novo
        </SubmitButton>
      </div>
    </div>
  );
}
