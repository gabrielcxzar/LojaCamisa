"use client";

import { useMemo, useState } from "react";

type CustomerPresetOption = {
  name: string;
  email: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  last_order_at: string;
};

const fieldClassName =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]";

function presetLabel(preset: CustomerPresetOption) {
  const contact = preset.phone || preset.email || "sem contato";
  return `${preset.name} - ${contact}`;
}

export function NewOrderCustomerFields() {
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
  const [presets, setPresets] = useState<CustomerPresetOption[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(false);

  const presetMap = useMemo(() => {
    const map = new Map<string, CustomerPresetOption>();
    for (const preset of presets) {
      map.set(presetLabel(preset), preset);
    }
    return map;
  }, [presets]);

  async function ensurePresetsLoaded() {
    if (presetsLoaded || loadingPresets) return;

    setLoadingPresets(true);
    try {
      const response = await fetch("/api/admin/new-order-options?kind=customer-presets", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = (await response.json()) as { presets?: CustomerPresetOption[] };
      setPresets(data.presets ?? []);
      setPresetsLoaded(true);
    } finally {
      setLoadingPresets(false);
    }
  }

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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Cliente</h2>
        <div className="grid gap-2.5">
          <input
            list="customer-presets"
            value={selectedPresetLabel}
            onFocus={() => {
              void ensurePresetsLoaded();
            }}
            onChange={(event) => {
              const next = event.target.value;
              if (!presetsLoaded && !loadingPresets) {
                void ensurePresetsLoaded();
              }
              setSelectedPresetLabel(next);
              applyPreset(next);
            }}
            placeholder="Buscar cliente salvo"
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 [color-scheme:light]"
          />
          <datalist id="customer-presets">
            {presets.map((preset) => {
              const label = presetLabel(preset);
              return <option key={`${preset.name}-${preset.phone}-${preset.last_order_at}`} value={label} />;
            })}
          </datalist>
          {(loadingPresets || presetsLoaded) && (
            <p className="text-xs text-neutral-500">
              {loadingPresets
                ? "Carregando clientes salvos..."
                : `${presets.length} cliente(s) salvo(s) disponiveis para preenchimento rapido.`}
            </p>
          )}

          <div className="grid gap-2.5 md:grid-cols-2">
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
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(event) => setShowAdvanced(event.target.checked)}
            />
            Mostrar campos extras (email / complemento / CEP)
          </label>

          {showAdvanced && (
            <div className="grid gap-2.5 md:grid-cols-3">
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
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Destino</h2>
        <div className="grid gap-2.5">
          <input
            name="line1"
            required
            value={line1}
            onChange={(event) => setLine1(event.target.value)}
            placeholder="Rua e numero"
            className={fieldClassName}
          />
          <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
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
