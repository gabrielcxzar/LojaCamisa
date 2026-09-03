"use client";

import { useEffect, useMemo, useState } from "react";

import {
  calculateOrderPricing,
  calculatePackageCosts,
  getDefaultPaymentPercent,
} from "@/modules/shared/domain/calculators";
import { PackageMode, PaymentType } from "@/modules/shared/domain/enums";
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

type InternalStockOrderOption = {
  id: string;
  code: string;
  customerName: string;
  supplierName: string;
  availableQuantity: number;
  unitCost: number;
  packageCode: string | null;
};

type Props = {
  products: ProductOption[];
  suppliers: SupplierOption[];
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

function sanitizeNumericInput(value: string) {
  return value.replace(/\D/g, "");
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function formatPercent(value: number) {
  return value.toFixed(2);
}

const SHIRT_SIZES = ["PP", "P", "M", "G", "GG"];
const fieldClassName =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]";
const compactFieldClassName =
  "w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]";
const sectionCardClassName =
  "rounded-[26px] border border-neutral-200 bg-white/90 p-4 shadow-sm shadow-neutral-100";
const sectionTitleClassName = "text-base font-semibold text-neutral-900";
const helperBadgeClassName =
  "text-[0.65rem] uppercase tracking-[0.3em] text-neutral-500";
const summaryStatCardClassName =
  "rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600";

function paymentTypeLabel(paymentType: PaymentType) {
  if (paymentType === PaymentType.Full) return "Pagamento integral";
  if (paymentType === PaymentType.Deposit50) return "Entrada de 50%";
  return "Sem pagamento inicial";
}

export function NewOrderDetails({
  products,
  suppliers,
}: Props) {
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
        PP: "0",
        P: "0",
        M: "1",
        G: "0",
        GG: "0",
      },
    },
  ]);
  const [nextQuickItemId, setNextQuickItemId] = useState(2);
  const [orderTotalInput, setOrderTotalInput] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.Deposit50);
  const [amountPaidPercentInput, setAmountPaidPercentInput] = useState("50.00");
  const [amountPaidInput, setAmountPaidInput] = useState("");
  const [syncSource, setSyncSource] = useState<"percent" | "amount">("percent");
  const [isPersonalUse, setIsPersonalUse] = useState(false);
  const [isStockOrder, setIsStockOrder] = useState(false);

  const [packageMode, setPackageMode] = useState<PackageMode>(PackageMode.New);
  const [existingPackageId, setExistingPackageId] = useState("");
  const [stockSourceOrderId, setStockSourceOrderId] = useState("");
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [packageQuantityInput, setPackageQuantityInput] = useState("1");
  const [productCostInput, setProductCostInput] = useState("");
  const [extraFeesInput, setExtraFeesInput] = useState("0.00");
  const [internalShippingInput, setInternalShippingInput] = useState("0.00");
  const [showPackageAdvanced, setShowPackageAdvanced] = useState(false);
  const [packages, setPackages] = useState<ImportPackageOption[]>([]);
  const [packagesLoaded, setPackagesLoaded] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [internalStockOrders, setInternalStockOrders] = useState<InternalStockOrderOption[]>([]);
  const [internalStockLoaded, setInternalStockLoaded] = useState(false);
  const [internalStockLoading, setInternalStockLoading] = useState(false);

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
    return calculateOrderPricing({
      totalAmount: parseNumber(orderTotalInput),
      fallbackUnitPrice: productMode === "existing" ? (productPriceMap.get(productSlug) ?? 0) : 0,
      quantity: quantityValue,
    }).unitPrice;
  }, [orderTotalInput, productMode, productPriceMap, productSlug, quantityValue]);

  const totalOrder = useMemo(() => {
    return calculateOrderPricing({
      totalAmount: parseNumber(orderTotalInput),
      fallbackUnitPrice: effectiveUnitPrice,
      quantity: quantityValue,
    }).total;
  }, [effectiveUnitPrice, orderTotalInput, quantityValue]);

  const packageSummary = useMemo(() => {
    return calculatePackageCosts({
      packageQuantity: Math.max(1, Math.round(parseNumber(packageQuantityInput) || quantityValue)),
      productCost: Math.max(0, parseNumber(productCostInput)),
      extraFees: Math.max(0, parseNumber(extraFeesInput)),
      internalShipping: Math.max(0, parseNumber(internalShippingInput)),
      orderQuantity: quantityValue,
    });
  }, [
    extraFeesInput,
    internalShippingInput,
    packageQuantityInput,
    productCostInput,
    quantityValue,
  ]);

  const selectedInternalStockOrder = useMemo(
    () => internalStockOrders.find((stockOrder) => stockOrder.id === stockSourceOrderId) ?? null,
    [internalStockOrders, stockSourceOrderId],
  );

  async function ensurePackagesLoaded() {
    if (packagesLoaded || packagesLoading) return;

    setPackagesLoading(true);
    try {
      const response = await fetch("/api/admin/new-order-options?kind=packages", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = (await response.json()) as { packages?: ImportPackageOption[] };
      const nextPackages = data.packages ?? [];
      setPackages(nextPackages);
      setPackagesLoaded(true);
      if (!existingPackageId && nextPackages[0]?.id) {
        setExistingPackageId(nextPackages[0].id);
      }
    } finally {
      setPackagesLoading(false);
    }
  }

  async function ensureInternalStockLoaded() {
    if (internalStockLoaded || internalStockLoading) return;

    setInternalStockLoading(true);
    try {
      const response = await fetch("/api/admin/new-order-options?kind=internal-stock", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = (await response.json()) as { internalStockOrders?: InternalStockOrderOption[] };
      const nextOrders = data.internalStockOrders ?? [];
      setInternalStockOrders(nextOrders);
      setInternalStockLoaded(true);
      if (!stockSourceOrderId && nextOrders[0]?.id) {
        setStockSourceOrderId(nextOrders[0].id);
      }
    } finally {
      setInternalStockLoading(false);
    }
  }

  useEffect(() => {
    if (packageMode === PackageMode.Existing) {
      void ensurePackagesLoaded();
      return;
    }

    if (packageMode === PackageMode.InternalStock) {
      void ensureInternalStockLoaded();
    }
  }, [packageMode]);

  const auxiliaryOptionsLoading =
    (packageMode === PackageMode.Existing && packagesLoading) ||
    (packageMode === PackageMode.InternalStock && internalStockLoading);

  const stockAllocationAvailable =
    packageMode !== PackageMode.InternalStock ||
    (selectedInternalStockOrder !== null &&
      quantityValue > 0 &&
      selectedInternalStockOrder.availableQuantity >= quantityValue);

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

  const effectiveFlowSummary = useMemo(() => {
    const orderType = isPersonalUse
      ? "Uso pessoal"
      : isStockOrder
        ? "Entrada para estoque"
        : "Pedido comercial";

    const revenueMode = isPersonalUse
      ? "Fora de faturamento e lucro"
      : isStockOrder
        ? "Sem venda registrada agora"
        : `Faturamento ativo com ${paymentTypeLabel(paymentType)}`;

    const packageModeLabel =
      packageMode === PackageMode.New
        ? "Novo pacote"
        : packageMode === PackageMode.Existing
          ? "Pacote existente"
          : packageMode === PackageMode.InternalStock
            ? "Baixa de estoque interno"
            : "Sem pacote";

    const packageDetail =
      packageMode === PackageMode.New
        ? supplierId
          ? "Novo pacote com fornecedor selecionado"
          : "Novo pacote sem fornecedor selecionado"
        : packageMode === PackageMode.Existing
          ? packagesLoading
            ? "Carregando pacotes..."
            : packages.find((item) => item.id === existingPackageId)?.code ?? "Pacote nao selecionado"
          : packageMode === PackageMode.InternalStock
            ? internalStockLoading
              ? "Carregando estoque interno..."
              : selectedInternalStockOrder
              ? `${selectedInternalStockOrder.code} com saldo de ${selectedInternalStockOrder.availableQuantity} camisa(s)`
              : "Origem de estoque nao selecionada"
            : isPersonalUse
              ? "Permitido para uso pessoal"
              : "Pedido comercial sem pacote";

    const primaryWarning =
      entryMode === "quick" && quantityValue <= 0
        ? "Adicione pelo menos uma camisa com quantidade valida."
        : !stockAllocationAvailable
          ? "A quantidade do pedido esta maior que o saldo disponivel no estoque interno."
          : !isPersonalUse && !isStockOrder && totalOrder <= 0
            ? "Informe o valor vendido total antes de criar o pedido."
            : packageMode === PackageMode.None && !isPersonalUse
              ? "Pedido comercial precisa de pacote ou baixa de estoque."
              : null;

    return {
      orderType,
      revenueMode,
      packageModeLabel,
      packageDetail,
      primaryWarning,
    };
  }, [
    existingPackageId,
    isPersonalUse,
    isStockOrder,
    packageMode,
    packages,
    paymentType,
    quantityValue,
    selectedInternalStockOrder,
    stockAllocationAvailable,
    supplierId,
    totalOrder,
    entryMode,
  ]);

  function syncAmountFromPercent(percentText: string) {
    setSyncSource("percent");
    setAmountPaidPercentInput(percentText);
  }

  function syncPercentFromAmount(amountText: string) {
    setSyncSource("amount");
    setAmountPaidInput(amountText);
  }

  function handlePaymentTypeChange(value: string) {
    setPaymentType(value as PaymentType);
    const defaultPercent = getDefaultPaymentPercent(value);
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
          PP: "0",
          P: "0",
          M: "1",
          G: "0",
          GG: "0",
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
    <div className="space-y-4 lg:space-y-5">
      <input type="hidden" name="entryMode" value={entryMode} />
      <section className={sectionCardClassName}>
        <div className="flex items-center justify-between">
          <h2 className={sectionTitleClassName}>Modo de cadastro</h2>
          <span className={helperBadgeClassName}>Entrada</span>
        </div>
        <div className="mt-3 grid gap-2.5 rounded-2xl border border-neutral-200 p-3 text-sm text-neutral-600 sm:grid-cols-2">
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(270px,0.78fr)] 2xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="space-y-5">
          <section className={sectionCardClassName}>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitleClassName}>Camisa</h2>
              <span className={helperBadgeClassName}>Produto</span>
            </div>
            <input
              type="hidden"
              name="productMode"
              value={entryMode === "quick" ? "custom" : productMode}
            />

            {entryMode === "quick" ? (
              <div className="mt-3 space-y-2.5 rounded-2xl border border-neutral-200 p-3 text-sm text-neutral-600">
                <input type="hidden" name="customName" value="Camisa de time sob encomenda" />
                {quickItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="space-y-2.5 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
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
                    <div className="grid gap-2.5 md:grid-cols-2">
                      <input
                        placeholder="Time (ex: Vitoria)"
                        value={item.team}
                        onChange={(event) => updateQuickItem(item.id, "team", event.target.value)}
                        className={fieldClassName}
                      />
                      <input
                        placeholder="Modelo (ex: 2025 torcedor)"
                        value={item.model}
                        onChange={(event) => updateQuickItem(item.id, "model", event.target.value)}
                        className={fieldClassName}
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {SHIRT_SIZES.map((shirtSize) => (
                        <label
                          key={shirtSize}
                          className="rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-600"
                        >
                          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                            {shirtSize}
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.sizeQuantities[shirtSize] ?? ""}
                            onChange={(event) =>
                              updateQuickItemSize(
                                item.id,
                                shirtSize,
                                sanitizeNumericInput(event.target.value),
                              )
                            }
                            className={`${compactFieldClassName} text-center`}
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
                      className={fieldClassName}
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={addQuickItem}
                    className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-700 hover:border-neutral-500"
                  >
                    Adicionar modelo
                  </button>
                  <p className="text-xs text-neutral-500">
                    Varios modelos e tamanhos no mesmo pedido, sem criar item no catalogo.
                  </p>
                </div>
              </div>
            ) : (
                <div className="mt-3 space-y-2.5 text-sm text-neutral-600">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={productMode === "custom"}
                    onChange={() => setProductMode("custom")}
                  />
                  Pedido rapido (sem cadastro previo)
                </label>
                <div className="grid gap-2.5 rounded-2xl border border-neutral-200 p-3 md:grid-cols-2">
                  <input
                    name="customName"
                    placeholder="Nome da camisa"
                    defaultValue="Camisa de time sob encomenda"
                    className={fieldClassName}
                  />
                  <input
                    name="customTeam"
                    placeholder="Time (opcional)"
                    className={fieldClassName}
                  />
                  <input
                    name="customModel"
                    placeholder="Modelo (opcional)"
                    className={fieldClassName}
                  />
                  <input
                    name="customDescription"
                    placeholder="Descricao (opcional)"
                    className={fieldClassName}
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
                  className={fieldClassName}
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

          <section className={sectionCardClassName}>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitleClassName}>Pedido</h2>
              <span className={helperBadgeClassName}>Financeiro</span>
            </div>
            <div className="mt-3 grid gap-3">
          {entryMode === "quick" ? (
            <>
              <input type="hidden" name="size" value="M" />
              <input type="hidden" name="quantity" value={String(quantityValue)} />
                  <div className="grid gap-2.5 md:grid-cols-3">
                    <p className={summaryStatCardClassName}>
                      Modelos no pedido
                      <br />
                      <span className="text-sm font-semibold text-neutral-950">{quickItems.length}</span>
                    </p>
                    <p className={summaryStatCardClassName}>
                      Modelos validos
                      <br />
                      <span className="text-sm font-semibold text-neutral-950">
                        {validQuickModels.length}
                      </span>
                    </p>
                    <p className={summaryStatCardClassName}>
                      Quantidade total
                      <br />
                      <span className="text-sm font-semibold text-neutral-950">
                        {quantityValue} camisa(s)
                      </span>
                    </p>
                  </div>
            </>
          ) : (
                <div className="grid gap-2.5 md:grid-cols-2">
              <select
                name="size"
                defaultValue="M"
                className={fieldClassName}
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
                className={fieldClassName}
              />
                </div>
          )}
              <div className="grid gap-2.5 md:grid-cols-3">
                <input
                  name="orderTotal"
                  type="number"
                  step="0.01"
                  placeholder="Valor vendido total (R$)"
                  value={orderTotalInput}
                  onChange={(event) => setOrderTotalInput(event.target.value)}
                  className="md:col-span-2 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]"
                />
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
                  Valor medio
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    R$ {formatMoney(effectiveUnitPrice)}
                  </span>
                </div>
              </div>
              <input type="hidden" name="unitPrice" value={formatMoney(effectiveUnitPrice)} />
              <input type="hidden" name="amountPaidSource" value={syncSource} />
              <div className="grid gap-2.5 md:grid-cols-3">
                <p className={summaryStatCardClassName}>
                  Valor vendido
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    R$ {formatMoney(totalOrder)}
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Valor medio por camisa
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    R$ {formatMoney(effectiveUnitPrice)}
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Quantidade calculada
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">{quantityValue}</span>
                </p>
              </div>
          {!isPersonalUse && !isStockOrder ? (
                <div className="grid gap-2.5 md:grid-cols-3">
              <select
                name="paymentType"
                value={paymentType}
                onChange={(event) => handlePaymentTypeChange(event.target.value)}
                className={fieldClassName}
              >
                <option value={PaymentType.Deposit50}>50% do valor</option>
                <option value={PaymentType.Full}>100% do valor</option>
                <option value={PaymentType.None}>Apenas reserva</option>
              </select>
              <input
                name="amountPaidPercent"
                type="number"
                step="0.01"
                placeholder="% pago"
                value={syncSource === "percent" ? amountPaidPercentInput : syncedPaid.percent}
                onChange={(event) => syncAmountFromPercent(event.target.value)}
                className={fieldClassName}
              />
              <input
                name="amountPaid"
                type="number"
                step="0.01"
                placeholder="Valor pago"
                value={syncSource === "amount" ? amountPaidInput : syncedPaid.amount}
                onChange={(event) => syncPercentFromAmount(event.target.value)}
                className={fieldClassName}
              />
                </div>
          ) : (
            <>
              <input type="hidden" name="paymentType" value={PaymentType.None} />
              <input type="hidden" name="amountPaidPercent" value="0" />
              <input type="hidden" name="amountPaid" value="0" />
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                {isPersonalUse
                  ? "Uso pessoal ativo: pedido fica fora de faturamento e lucro."
                  : "Pedido para estoque: sem venda registrada no momento."}
              </p>
            </>
          )}
              <textarea
                name="notes"
                placeholder="Observacoes internas"
                className="min-h-[72px] w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]"
              />
              <div className="grid gap-2.5 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-600">
            <input
              name="isPersonalUse"
              type="checkbox"
              checked={isPersonalUse}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsPersonalUse(checked);
                if (checked) setIsStockOrder(false);
                if (checked && packageMode === PackageMode.InternalStock) {
                  setPackageMode(PackageMode.None);
                }
              }}
            />
            Uso pessoal (nao entra em faturamento e lucro)
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-600">
            <input
              name="isStockOrder"
              type="checkbox"
              checked={isStockOrder}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsStockOrder(checked);
                if (checked) setIsPersonalUse(false);
                if (checked && packageMode === PackageMode.InternalStock) {
                  setPackageMode(PackageMode.New);
                }
              }}
            />
            Pedido para estoque (sem venda ao cliente)
                </label>
              </div>
            </div>
          </section>

          <section className={sectionCardClassName}>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitleClassName}>Pacote de importacao</h2>
              <span className={helperBadgeClassName}>Logistica</span>
            </div>
            <div className="mt-3 space-y-3">
          <input type="hidden" name="packageMode" value={packageMode} />
          <input type="hidden" name="stockSourceOrderId" value={stockSourceOrderId} />
              <div className="grid gap-2.5 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-600 transition hover:border-neutral-300">
            <input
              type="radio"
              name="packageModeOption"
              value={PackageMode.New}
              checked={packageMode === PackageMode.New}
              onChange={() => setPackageMode(PackageMode.New)}
            />
            Criar novo pacote para este pedido
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-600 transition hover:border-neutral-300">
            <input
              type="radio"
              name="packageModeOption"
              value={PackageMode.Existing}
              checked={packageMode === PackageMode.Existing}
              onChange={() => setPackageMode(PackageMode.Existing)}
            />
            Vincular a pacote existente
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-600 transition hover:border-neutral-300">
            <input
              type="radio"
              name="packageModeOption"
              value={PackageMode.InternalStock}
              checked={packageMode === PackageMode.InternalStock}
              onChange={() => {
                setPackageMode(PackageMode.InternalStock);
                setIsPersonalUse(false);
                setIsStockOrder(false);
              }}
            />
            Baixar do estoque interno
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-600 transition hover:border-neutral-300">
            <input
              type="radio"
              name="packageModeOption"
              value={PackageMode.None}
              checked={packageMode === PackageMode.None}
              onChange={() => setPackageMode(PackageMode.None)}
            />
            Sem pacote (pedido isolado)
          </label>
              </div>

          {packageMode === PackageMode.InternalStock && (
            <div className="grid gap-2.5 rounded-2xl border border-neutral-200 p-3">
              {internalStockLoading ? (
                <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
                  Carregando pedidos de estoque...
                </p>
              ) : internalStockOrders.length === 0 ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  Nenhum pedido de estoque com saldo e custo unitario disponivel.
                </p>
              ) : (
                <>
                  <select
                    value={stockSourceOrderId}
                    onChange={(event) => setStockSourceOrderId(event.target.value)}
                    className={fieldClassName}
                  >
                    {internalStockOrders.map((stockOrder) => (
                      <option key={stockOrder.id} value={stockOrder.id}>
                        {stockOrder.code} - {stockOrder.customerName} - saldo{" "}
                        {stockOrder.availableQuantity} camisa(s)
                      </option>
                    ))}
                  </select>
                  {selectedInternalStockOrder && (
                        <div className="grid gap-2.5 md:grid-cols-3">
                          <p className={summaryStatCardClassName}>
                            Fornecedor
                            <br />
                            <span className="text-sm font-semibold text-neutral-950">
                              {selectedInternalStockOrder.supplierName}
                            </span>
                          </p>
                          <p className={summaryStatCardClassName}>
                            Custo unitario herdado
                            <br />
                            <span className="text-sm font-semibold text-neutral-950">
                              R$ {formatMoney(selectedInternalStockOrder.unitCost)}
                            </span>
                          </p>
                          <p className={summaryStatCardClassName}>
                            Saldo disponivel
                            <br />
                            <span className="text-sm font-semibold text-neutral-950">
                              {selectedInternalStockOrder.availableQuantity} camisa(s)
                            </span>
                          </p>
                        </div>
                  )}
                      {selectedInternalStockOrder && (
                        <p className="text-xs text-neutral-500">
                          {selectedInternalStockOrder.packageCode
                            ? `Origem: pacote ${selectedInternalStockOrder.packageCode}`
                            : "Origem: pedido de estoque sem pacote vinculado"}
                        </p>
                      )}
                  {selectedInternalStockOrder &&
                    selectedInternalStockOrder.availableQuantity < quantityValue && (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                        Quantidade do pedido ({quantityValue}) maior que o saldo disponivel (
                        {selectedInternalStockOrder.availableQuantity}).
                      </p>
                    )}
                </>
              )}
              <p className="text-xs text-neutral-500">
                O pedido de venda herda o custo unitario do estoque e nao altera as quantidades do
                pacote original.
              </p>
            </div>
          )}

          {packageMode === PackageMode.Existing && (
            <div className="grid gap-2.5 rounded-2xl border border-neutral-200 p-3">
              <select
                name="existingPackageId"
                value={existingPackageId}
                disabled={packagesLoading}
                onChange={(event) => setExistingPackageId(event.target.value)}
                className={fieldClassName}
              >
                {packagesLoading && <option value="">Carregando pacotes...</option>}
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
              {packagesLoading && (
                <p className="text-xs text-neutral-500">Carregando pacotes existentes...</p>
              )}
              <p className="text-xs text-neutral-500">
                Ao vincular, o custo por camisa e o rastreio serao herdados automaticamente.
              </p>
            </div>
          )}

          {packageMode === PackageMode.New && (
            <div className="grid gap-2.5 rounded-2xl border border-neutral-200 p-3">
              <div className="grid gap-2.5 md:grid-cols-2">
              <select
                name="supplierId"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className={fieldClassName}
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
                className={fieldClassName}
              />
              <input
                name="productCost"
                type="number"
                min={0}
                step="0.01"
                value={productCostInput}
                onChange={(event) => setProductCostInput(event.target.value)}
                placeholder="Valor pago ao fornecedor (R$)"
                className={fieldClassName}
              />
              <input
                name="trackingCode"
                placeholder="Codigo de rastreio (opcional)"
                className={fieldClassName}
              />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input
                  type="checkbox"
                  checked={showPackageAdvanced || entryMode === "advanced"}
                  onChange={(event) => setShowPackageAdvanced(event.target.checked)}
                />
                Mostrar campos avancados (taxa, frete interno, carrier, data, observacoes)
              </label>

              {(showPackageAdvanced || entryMode === "advanced") && (
                <div className="grid gap-2.5 md:grid-cols-2">
                  <input
                    name="extraFees"
                    type="number"
                    min={0}
                    step="0.01"
                    value={extraFeesInput}
                    onChange={(event) => setExtraFeesInput(event.target.value)}
                    placeholder="Taxa de importacao (R$)"
                    className={fieldClassName}
                  />
                  <input
                    name="internalShipping"
                    type="number"
                    min={0}
                    step="0.01"
                    value={internalShippingInput}
                    onChange={(event) => setInternalShippingInput(event.target.value)}
                    placeholder="Frete interno (R$)"
                    className={fieldClassName}
                  />
                  <input
                    name="carrier"
                    placeholder="Transportadora (17track, opcional)"
                    className={fieldClassName}
                  />
                  <input
                    name="originCountry"
                    defaultValue="China"
                    placeholder="Pais de origem"
                    className={fieldClassName}
                  />
                  <input
                    name="paidAt"
                    type="date"
                    className={fieldClassName}
                  />
                  <textarea
                    name="packageNotes"
                    placeholder="Observacoes do pacote"
                    className="min-h-[72px] md:col-span-2 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]"
                  />
                </div>
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
                  <div className="grid gap-2.5 md:grid-cols-3">
                    <p className={summaryStatCardClassName}>
                      Custo final do pacote
                      <br />
                      <span className="text-sm font-semibold text-neutral-950">
                        R$ {formatMoney(packageSummary.packageFinalCost)}
                      </span>
                    </p>
                    <p className={summaryStatCardClassName}>
                      Custo medio por camisa
                      <br />
                      <span className="text-sm font-semibold text-neutral-950">
                        R$ {formatMoney(packageSummary.averageUnitCost)}
                      </span>
                    </p>
                    <p className={summaryStatCardClassName}>
                      Custo alocado neste pedido
                      <br />
                      <span className="text-sm font-semibold text-neutral-950">
                        R$ {formatMoney(packageSummary.allocatedCost)}
                      </span>
                    </p>
                  </div>
            </div>
          )}
            </div>
          </section>
        </div>

        <div className="space-y-4 self-start xl:sticky xl:top-4">
          <section className={sectionCardClassName}>
            <div className="flex items-center justify-between">
              <h2 className={sectionTitleClassName}>Resumo Final</h2>
              <span className={helperBadgeClassName}>Checklist</span>
            </div>
            <div className="mt-3 grid gap-2.5">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                <p className={summaryStatCardClassName}>
                  Tipo efetivo do pedido
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    {effectiveFlowSummary.orderType}
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Regra financeira
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    {effectiveFlowSummary.revenueMode}
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Origem do custo
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    {effectiveFlowSummary.packageModeLabel}
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Fonte selecionada
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    {effectiveFlowSummary.packageDetail}
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Quantidade final
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    {quantityValue} camisa(s)
                  </span>
                </p>
                <p className={summaryStatCardClassName}>
                  Total previsto
                  <br />
                  <span className="text-sm font-semibold text-neutral-950">
                    R$ {formatMoney(totalOrder)}
                  </span>
                </p>
                {!isPersonalUse && !isStockOrder && (
                  <p className={summaryStatCardClassName}>
                    Valor de entrada
                    <br />
                    <span className="text-sm font-semibold text-neutral-950">
                      R$ {syncedPaid.amount} ({syncedPaid.percent}%)
                    </span>
                  </p>
                )}
              </div>
              {effectiveFlowSummary.primaryWarning ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  Revise antes de criar: {effectiveFlowSummary.primaryWarning}
                </p>
              ) : (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                  Fluxo consistente: o pedido esta pronto para ser criado com as regras acima.
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-2.5">
        <SubmitButton
          pendingLabel="Criando pedido..."
          className="w-full"
          name="afterSubmit"
          value="open"
          disabled={
            (entryMode === "quick" && quantityValue <= 0) ||
            !stockAllocationAvailable ||
            auxiliaryOptionsLoading
          }
        >
          Criar e abrir pedido
        </SubmitButton>
        <SubmitButton
          pendingLabel="Criando pedido..."
          className="w-full"
          variant="outline"
          name="afterSubmit"
          value="new"
          disabled={
            (entryMode === "quick" && quantityValue <= 0) ||
            !stockAllocationAvailable ||
            auxiliaryOptionsLoading
          }
        >
          Criar e novo
        </SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
}
