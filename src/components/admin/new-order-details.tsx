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

type QuickItemInput = {
  id: number;
  team: string;
  model: string;
  description: string;
  sizeQuantities: Record<string, string>;
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

const SHIRT_SIZES = ["PP", "P", "M", "G", "GG"];

export function NewOrderDetails({ products, suppliers, packages }: Props) {
  const [entryMode, setEntryMode] = useState<"quick" | "advanced">("quick");
  const [productMode, setProductMode] = useState<"custom" | "existing">("custom");
  const [productSlug, setProductSlug] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [quickItems, setQuickItems] = useState<QuickItemInput[]>([
    {
      id: 1,
      team: "",
      model: "",
      description: "",
      sizeQuantities: {
        PP: "",
        P: "",
        M: "1",
        G: "",
        GG: "",
      },
    },
  ]);
  const [nextQuickItemId, setNextQuickItemId] = useState(2);
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
    if (entryMode === "quick") {
      const total = quickItems.reduce((sum, item) => {
        const itemTotal = SHIRT_SIZES.reduce((itemSum, shirtSize) => {
          const qty = parseNumber(item.sizeQuantities[shirtSize] ?? "");
          return itemSum + (qty > 0 ? qty : 0);
        }, 0);
        return sum + itemTotal;
      }, 0);
      return total;
    }

    const qty = parseNumber(quantity);
    return qty > 0 ? qty : 1;
  }, [entryMode, quantity, quickItems]);

  const validQuickModels = useMemo(() => {
    return quickItems.filter((item) => {
      const hasDetails = Boolean(item.team || item.model || item.description);
      const totalBySize = SHIRT_SIZES.reduce((sum, shirtSize) => {
        const qty = parseNumber(item.sizeQuantities[shirtSize] ?? "");
        return sum + (qty > 0 ? qty : 0);
      }, 0);
      return hasDetails && totalBySize > 0;
    });
  }, [quickItems]);

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

  function updateQuickItem(
    id: number,
    field: keyof Omit<QuickItemInput, "id">,
    value: string | Record<string, string>,
  ) {
    setQuickItems((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  function updateQuickItemSize(id: number, size: string, value: string) {
    setQuickItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              sizeQuantities: {
                ...item.sizeQuantities,
                [size]: value,
              },
            }
          : item,
      ),
    );
  }

  function addQuickItem() {
    setQuickItems((current) => [
      ...current,
      {
        id: nextQuickItemId,
        team: "",
        model: "",
        description: "",
        sizeQuantities: {
          PP: "",
          P: "",
          M: "1",
          G: "",
          GG: "",
        },
      },
    ]);
    setNextQuickItemId((current) => current + 1);
  }

  function removeQuickItem(id: number) {
    setQuickItems((current) => {
      if (current.length === 1) return current;
      return current.filter((item) => item.id !== id);
    });
  }

  return (
    <div className="space-y-8">
      <input type="hidden" name="entryMode" value={entryMode} />
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
          <div className="mt-4 space-y-3 rounded-2xl border border-neutral-200 p-4 text-sm text-neutral-600">
            <input type="hidden" name="customName" value="Camisa de time sob encomenda" />
            {quickItems.map((item, index) => (
              <div
                key={item.id}
                className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
                    Modelo {index + 1}
                  </p>
                  {quickItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuickItem(item.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <input
                  placeholder="Time (ex: Vitoria)"
                  value={item.team}
                  onChange={(event) => updateQuickItem(item.id, "team", event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                />
                <input
                  placeholder="Modelo (ex: 2025 torcedor)"
                  value={item.model}
                  onChange={(event) => updateQuickItem(item.id, "model", event.target.value)}
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                />
                <div className="grid gap-3 sm:grid-cols-5">
                  {SHIRT_SIZES.map((shirtSize) => (
                    <label
                      key={shirtSize}
                      className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-600"
                    >
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                        {shirtSize}
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={item.sizeQuantities[shirtSize] ?? ""}
                        onChange={(event) =>
                          updateQuickItemSize(item.id, shirtSize, event.target.value)
                        }
                        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                      />
                    </label>
                  ))}
                </div>
                <input
                  placeholder="Descricao curta (opcional)"
                  value={item.description}
                  onChange={(event) =>
                    updateQuickItem(item.id, "description", event.target.value)
                  }
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
                />
                {SHIRT_SIZES.map((shirtSize) => {
                  const itemQuantity = parseNumber(item.sizeQuantities[shirtSize] ?? "");
                  if (itemQuantity <= 0) return null;

                  return (
                    <div key={`${item.id}-${shirtSize}`}>
                      <input type="hidden" name="quickItemTeam" value={item.team} />
                      <input type="hidden" name="quickItemModel" value={item.model} />
                      <input type="hidden" name="quickItemDescription" value={item.description} />
                      <input type="hidden" name="quickItemSize" value={shirtSize} />
                      <input type="hidden" name="quickItemQuantity" value={String(itemQuantity)} />
                    </div>
                  );
                })}
              </div>
            ))}
            <button
              type="button"
              onClick={addQuickItem}
              className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-700 hover:border-neutral-500"
            >
              Adicionar modelo
            </button>
            <p className="text-xs text-neutral-500">
              Um unico pedido pode conter varios modelos, e cada modelo pode ter varios tamanhos
              com quantidades diferentes. O sistema salva sem criar produto no catalogo.
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
          {entryMode === "quick" ? (
            <>
              <input type="hidden" name="size" value="M" />
              <input type="hidden" name="quantity" value={String(quantityValue)} />
              <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
                Modelos no pedido: <span className="font-semibold">{quickItems.length}</span>
                <br />
                Modelos validos: <span className="font-semibold">{validQuickModels.length}</span>
                <br />
                Quantidade total: <span className="font-semibold">{quantityValue} camisa(s)</span>
              </p>
            </>
          ) : (
            <>
              <select
                name="size"
                defaultValue="M"
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 text-sm"
              >
                {SHIRT_SIZES.map((shirtSize) => (
                  <option key={shirtSize} value={shirtSize}>
                    Tamanho {shirtSize}
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
            </>
          )}
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
        <SubmitButton
          pendingLabel="Criando pedido..."
          className="w-full"
          name="afterSubmit"
          value="open"
          disabled={entryMode === "quick" && quantityValue <= 0}
        >
          Criar e abrir pedido
        </SubmitButton>
        <SubmitButton
          pendingLabel="Criando pedido..."
          className="w-full"
          variant="outline"
          name="afterSubmit"
          value="new"
          disabled={entryMode === "quick" && quantityValue <= 0}
        >
          Criar e novo
        </SubmitButton>
      </div>
    </div>
  );
}
