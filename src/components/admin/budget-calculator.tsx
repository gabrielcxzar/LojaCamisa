"use client";

import { useMemo, useState } from "react";

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function BudgetCalculator() {
  const [packageQuantityInput, setPackageQuantityInput] = useState("1");
  const [productCostInput, setProductCostInput] = useState("0.00");
  const [extraFeesInput, setExtraFeesInput] = useState("0.00");
  const [internalShippingInput, setInternalShippingInput] = useState("0.00");
  const [markupInput, setMarkupInput] = useState("12");
  const [roundStepInput, setRoundStepInput] = useState("5");

  const summary = useMemo(() => {
    const packageQuantity = Math.max(1, Math.round(parseNumber(packageQuantityInput) || 1));
    const productCost = Math.max(0, parseNumber(productCostInput));
    const extraFees = Math.max(0, parseNumber(extraFeesInput));
    const internalShipping = Math.max(0, parseNumber(internalShippingInput));
    const markup = Math.min(100, Math.max(0, parseNumber(markupInput)));
    const roundStep = Math.max(0, parseNumber(roundStepInput));

    const packageFinalCost = productCost + extraFees + internalShipping;
    const unitCost = packageFinalCost / packageQuantity;
    const saleWithoutRound = unitCost * (1 + markup / 100);
    const suggestedSale =
      roundStep > 0 ? Math.ceil(saleWithoutRound / roundStep) * roundStep : saleWithoutRound;
    const profitPerShirt = Math.max(0, suggestedSale - unitCost);
    const realMargin = suggestedSale > 0 ? (profitPerShirt / suggestedSale) * 100 : 0;
    const minimumSale = unitCost;

    return {
      packageQuantity,
      packageFinalCost,
      unitCost,
      markup,
      minimumSale,
      suggestedSale,
      profitPerShirt,
      realMargin,
      deposit50: suggestedSale * 0.5,
    };
  }, [
    extraFeesInput,
    internalShippingInput,
    markupInput,
    packageQuantityInput,
    productCostInput,
    roundStepInput,
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Entradas do calculo</h2>
        <div className="grid gap-3 text-sm text-neutral-600">
          <input
            type="number"
            min={1}
            step="1"
            value={packageQuantityInput}
            onChange={(event) => setPackageQuantityInput(event.target.value)}
            placeholder="Qtd total de camisas no pacote"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={productCostInput}
            onChange={(event) => setProductCostInput(event.target.value)}
            placeholder="Custo do fornecedor (R$)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={extraFeesInput}
            onChange={(event) => setExtraFeesInput(event.target.value)}
            placeholder="Taxas de importacao (R$)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={internalShippingInput}
            onChange={(event) => setInternalShippingInput(event.target.value)}
            placeholder="Frete interno (R$)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
          />
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={markupInput}
            onChange={(event) => setMarkupInput(event.target.value)}
            placeholder="Acrescimo sobre custo (%) - editavel"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
          />
          <input
            type="number"
            min={0}
            step="0.5"
            value={roundStepInput}
            onChange={(event) => setRoundStepInput(event.target.value)}
            placeholder="Arredondar preco para (R$)"
            className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Resultado</h2>
        <div className="space-y-3 text-sm text-neutral-600">
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Custo final do pacote</span>
            <span className="font-semibold text-neutral-900">
              {formatMoney(summary.packageFinalCost)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Qtd base do pacote</span>
            <span className="font-semibold text-neutral-900">{summary.packageQuantity} un.</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Custo medio por camisa</span>
            <span className="font-semibold text-neutral-900">{formatMoney(summary.unitCost)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Preco minimo (empate)</span>
            <span className="font-semibold text-neutral-900">
              {formatMoney(summary.minimumSale)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span>Preco sugerido por camisa</span>
            <span className="font-semibold text-emerald-700">
              {formatMoney(summary.suggestedSale)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Acrescimo aplicado no custo</span>
            <span className="font-semibold text-neutral-900">{formatPercent(summary.markup)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Lucro estimado por camisa</span>
            <span className="font-semibold text-neutral-900">
              {formatMoney(summary.profitPerShirt)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Margem obtida</span>
            <span className="font-semibold text-neutral-900">{formatPercent(summary.realMargin)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <span>Entrada 50% sugerida</span>
            <span className="font-semibold text-neutral-900">{formatMoney(summary.deposit50)}</span>
          </div>
          <p className="text-xs text-neutral-500">
            Formula usada: preco = custo medio x (1 + acrescimo). Exemplo inicial: 12%.
          </p>
          <p className="text-xs text-neutral-500">
            Se o custo real ficar menor que o estimado, o lucro final fica maior.
          </p>
        </div>
      </section>
    </div>
  );
}
