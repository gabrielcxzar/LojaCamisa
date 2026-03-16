"use client";

import { useMemo, useState } from "react";

import type { CustomerPresetRow } from "@/lib/db/queries";

type Props = {
  presets: CustomerPresetRow[];
};

const fieldClassName =
  "w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]";

function presetLabel(preset: CustomerPresetRow) {
  const contact = preset.phone || preset.email || "sem contato";
  return `${preset.name} - ${contact}`;
}

export function NewOrderCustomerFields({ presets }: Props) {
  const [selectedPresetLabel, setSelectedPresetLabel] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("Brasil");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const presetMap = useMemo(() => {
    const map = new Map<string, CustomerPresetRow>();
    for (const preset of presets) {
      map.set(presetLabel(preset), preset);
    }
    return map;
  }, [presets]);

  function applyPreset(label: string) {
    const preset = presetMap.get(label);
    if (!preset) return;

    setName(preset.name);
    setEmail(preset.email ?? "");
    setPhone(preset.phone ?? "");
    setLine1(preset.line1);
    setLine2(preset.line2 ?? "");
    setCity(preset.city);
    setState(preset.state);
    setPostalCode(preset.postal_code ?? "");
    setCountry(preset.country || "Brasil");
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold">Cliente</h2>
        <div className="mt-4 grid gap-3">
          <input
            list="customer-presets"
            value={selectedPresetLabel}
            onChange={(event) => {
              const next = event.target.value;
              setSelectedPresetLabel(next);
              applyPreset(next);
            }}
            placeholder="Buscar cliente salvo"
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]"
          />
          <datalist id="customer-presets">
            {presets.map((preset) => {
              const label = presetLabel(preset);
              return <option key={`${preset.name}-${preset.phone}-${preset.last_order_at}`} value={label} />;
            })}
          </datalist>

          <input
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome completo"
            className={fieldClassName}
          />
          <input
            name="phone"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Telefone / WhatsApp"
            className={fieldClassName}
          />

          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(event) => setShowAdvanced(event.target.checked)}
            />
            Mostrar campos extras (email / complemento / CEP)
          </label>

          {showAdvanced && (
            <>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email (opcional)"
                className={fieldClassName}
              />
              <input
                name="line2"
                value={line2}
                onChange={(event) => setLine2(event.target.value)}
                placeholder="Complemento (opcional)"
                className={fieldClassName}
              />
              <input
                name="postalCode"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder="CEP (opcional)"
                className={fieldClassName}
              />
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Destino</h2>
        <div className="mt-4 grid gap-4">
          <input
            name="line1"
            required
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            placeholder="Rua e numero"
            className={fieldClassName}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <input
              name="city"
              required
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Cidade"
              className={fieldClassName}
            />
            <input
              name="state"
              required
              value={state}
              onChange={(event) => setState(event.target.value)}
              placeholder="Estado"
              className={fieldClassName}
            />
          </div>
          <input
            name="country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="Pais"
            className={fieldClassName}
          />
        </div>
      </section>
    </div>
  );
}
