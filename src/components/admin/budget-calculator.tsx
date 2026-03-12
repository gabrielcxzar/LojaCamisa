"use client";

import { useMemo, useState } from "react";

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return `R$ ${value.toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function normalizeIntegerInput(value: string, options: { min: number; max?: number; fallback: number }) {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return String(options.fallback);
  let next = Math.round(parsed);
  next = Math.max(options.min, next);
  if (typeof options.max === "number") next = Math.min(options.max, next);
  return String(next);
}

function normalizeDecimalInput(value: string, options: { min: number; max?: number; fallback: number }) {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return String(options.fallback);
  let next = parsed;
  next = Math.max(options.min, next);
  if (typeof options.max === "number") next = Math.min(options.max, next);
  return String(next);
}

export function BudgetCalculator() {
  const [packageQuantityInput, setPackageQuantityInput] = useState("1");
  const [productCostInput, setProductCostInput] = useState("0.00");
  const [extraFeesInput, setExtraFeesInput] = useState("0.00");
  const [internalShippingInput, setInternalShippingInput] = useState("0.00");
  const [markupInput, setMarkupInput] = useState("12");
  const [targetSaleInput, setTargetSaleInput] = useState("");
  const [roundStepInput, setRoundStepInput] = useState("5");

  const summary = useMemo(() => {
    const packageQuantity = Math.max(1, Math.round(parseNumber(packageQuantityInput) || 1));
    const productCost = Math.max(0, parseNumber(productCostInput));
    const extraFees = Math.max(0, parseNumber(extraFeesInput));
    const internalShipping = Math.max(0, parseNumber(internalShippingInput));
    const markup = Math.max(0, parseNumber(markupInput));
    const targetSale = Math.max(0, parseNumber(targetSaleInput));
    const roundStep = Math.max(0, parseNumber(roundStepInput));

    const packageFinalCost = productCost + extraFees + internalShipping;
    const unitCost = packageFinalCost / packageQuantity;
    const saleWithoutRound = unitCost * (1 + markup / 100);
    const suggestedSale =
      roundStep > 0 ? Math.ceil(saleWithoutRound / roundStep) * roundStep : saleWithoutRound;
    const profitPerShirt = Math.max(0, suggestedSale - unitCost);
    const realMargin = suggestedSale > 0 ? (profitPerShirt / suggestedSale) * 100 : 0;
    const minimumSale = unitCost;
    const reverseMarkup = unitCost > 0 ? ((targetSale / unitCost) - 1) * 100 : 0;
    const reverseProfitPerShirt = targetSale - unitCost;
    const reverseMargin = targetSale > 0 ? (reverseProfitPerShirt / targetSale) * 100 : 0;

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
      targetSale,
      reverseMarkup,
      reverseProfitPerShirt,
      reverseMargin,
    };
  }, [
    extraFeesInput,
    internalShippingInput,
    markupInput,
    packageQuantityInput,
    productCostInput,
    roundStepInput,
    targetSaleInput,
  ]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Entradas do calculo</h2>
        <div className="grid gap-3 text-sm text-neutral-600">
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">Qtd total de camisas no pacote</span>
            <input
              type="number"
              min={1}
              step="1"
              value={packageQuantityInput}
              onChange={(event) => setPackageQuantityInput(event.target.value)}
              onBlur={(event) =>
                setPackageQuantityInput(
                  normalizeIntegerInput(event.target.value, { min: 1, fallback: 1 }),
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">Custo do fornecedor (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={productCostInput}
              onChange={(event) => setProductCostInput(event.target.value)}
              onBlur={(event) =>
                setProductCostInput(
                  normalizeDecimalInput(event.target.value, { min: 0, fallback: 0 }),
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">Taxas de importacao (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={extraFeesInput}
              onChange={(event) => setExtraFeesInput(event.target.value)}
              onBlur={(event) =>
                setExtraFeesInput(
                  normalizeDecimalInput(event.target.value, { min: 0, fallback: 0 }),
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">Frete interno (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={internalShippingInput}
              onChange={(event) => setInternalShippingInput(event.target.value)}
              onBlur={(event) =>
                setInternalShippingInput(
                  normalizeDecimalInput(event.target.value, { min: 0, fallback: 0 }),
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">Acrescimo sobre custo (%)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={markupInput}
              onChange={(event) => {
                const next = event.target.value;
                if (next === "") {
                  setMarkupInput("");
                  return;
                }
                setMarkupInput(
                  normalizeDecimalInput(next, { min: 0, fallback: 12 }),
                );
              }}
              onBlur={(event) =>
                setMarkupInput(
                  normalizeDecimalInput(event.target.value, { min: 0, fallback: 12 }),
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">
              Preco de venda por camisa (calculo inverso, opcional)
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={targetSaleInput}
              onChange={(event) => setTargetSaleInput(event.target.value)}
              onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  setTargetSaleInput("");
                  return;
                }
                setTargetSaleInput(
                  normalizeDecimalInput(raw, { min: 0, fallback: 0 }),
                );
              }}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
            {summary.targetSale > 0 && (
              <span className="text-xs text-blue-700">
                Acrescimo equivalente: {formatPercent(summary.reverseMarkup)}
              </span>
            )}
          </label>
          <label className="grid gap-1">
            <span className="text-xs text-neutral-500">Arredondar preco para (R$)</span>
            <input
              type="number"
              min={0}
              step="0.5"
              value={roundStepInput}
              onChange={(event) => setRoundStepInput(event.target.value)}
              onBlur={(event) =>
                setRoundStepInput(
                  normalizeDecimalInput(event.target.value, { min: 0, fallback: 0 }),
                )
              }
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3"
            />
          </label>
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
          {summary.targetSale > 0 && (
            <>
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <span>Calculo inverso: acrescimo equivalente</span>
                <span className="font-semibold text-blue-700">
                  {formatPercent(summary.reverseMarkup)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <span>Calculo inverso: lucro por camisa</span>
                <span className="font-semibold text-blue-700">
                  {formatMoney(summary.reverseProfitPerShirt)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <span>Calculo inverso: margem equivalente</span>
                <span className="font-semibold text-blue-700">
                  {formatPercent(summary.reverseMargin)}
                </span>
              </div>
            </>
          )}
          <p className="text-xs text-neutral-500">
            Formula direta: preco = custo medio x (1 + acrescimo). Exemplo inicial: 12%.
          </p>
          <p className="text-xs text-neutral-500">
            Formula inversa: acrescimo = ((preco desejado / custo medio) - 1) x 100.
          </p>
        </div>
      </section>
    </div>
  );
}
