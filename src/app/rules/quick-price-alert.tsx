"use client";

import { useEffect, useMemo, useState } from "react";
import {
  SUPPORTED_SYMBOLS,
  type AlertRule,
  type RuleOperator,
  type SupportedSymbol,
} from "@/lib/rules/types";
import type { SavedSymbolLevel } from "@/lib/symbol-levels";

const alertTypes: Array<{ operator: RuleOperator; label: string }> = [
  { operator: "touches", label: "Touches price" },
  { operator: "crosses_above", label: "Crosses above price" },
  { operator: "crosses_below", label: "Crosses below price" },
  { operator: "breaks_above", label: "Breaks above price" },
  { operator: "breaks_below", label: "Breaks below price" },
  { operator: "within_percent", label: "Within percent of price" },
  { operator: "within_dollars", label: "Within dollars of price" },
];

export function QuickPriceAlert() {
  const [symbol, setSymbol] = useState<SupportedSymbol>("SPY");
  const [name, setName] = useState("Quick price alert");
  const [operator, setOperator] = useState<RuleOperator>("touches");
  const [source, setSource] = useState<"custom_price" | "saved_level">("custom_price");
  const [price, setPrice] = useState("500");
  const [percent, setPercent] = useState("0.15");
  const [dollars, setDollars] = useState("0.25");
  const [cooldown, setCooldown] = useState("30");
  const [marketHoursOnly, setMarketHoursOnly] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [levels, setLevels] = useState<SavedSymbolLevel[]>([]);
  const [levelId, setLevelId] = useState("");
  const [status, setStatus] = useState<string>();

  const activeLevels = useMemo(() => levels.filter((level) => !level.isExpired), [levels]);

  useEffect(() => {
    fetch(`/api/symbol-levels?symbol=${symbol}`)
      .then((response) => (response.ok ? response.json() : { levels: [] }))
      .then((payload: { levels?: SavedSymbolLevel[] }) => {
        const nextLevels = payload.levels ?? [];
        setLevels(nextLevels);
        setLevelId(nextLevels.find((level) => !level.isExpired)?.id ?? "");
      })
      .catch(() => {
        setLevels([]);
        setLevelId("");
      });
  }, [symbol]);

  async function createQuickAlert() {
    setStatus(undefined);
    const selectedLevel = activeLevels.find((level) => level.id === levelId);
    const rule: AlertRule = {
      name: name.trim() || "Quick price alert",
      symbol,
      timeframe: "1m",
      logic: "AND",
      conditions: [
        {
          left: "price",
          operator,
          right:
            source === "saved_level" && selectedLevel
              ? {
                  type: "saved_level",
                  levelId: selectedLevel.id,
                  levelName: selectedLevel.name,
                  price: selectedLevel.price,
                }
              : { type: "custom_price", price: Number(price) },
          params: {
            ...(operator === "within_percent" ? { percent: Number(percent) } : {}),
            ...(operator === "within_dollars" ? { dollars: Number(dollars) } : {}),
          },
        },
      ],
      cooldownMinutes: Number(cooldown),
      smsEnabled,
      isActive: true,
      marketHoursOnly,
    };

    const response = await fetch("/api/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rule),
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus(payload.error ?? "Could not create quick alert.");
      return;
    }
    setStatus("Quick alert saved as a normal rule.");
    window.location.reload();
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Quick price alert</h2>
        <span className="pill">normal rule</span>
      </div>
      <div className="form-grid">
        <label className="field">
          Symbol
          <select value={symbol} onChange={(event) => setSymbol(event.target.value as SupportedSymbol)}>
            {SUPPORTED_SYMBOLS.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field field-wide">
          Alert label
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          Alert type
          <select value={operator} onChange={(event) => setOperator(event.target.value as RuleOperator)}>
            {alertTypes.map((type) => <option key={type.operator} value={type.operator}>{type.label}</option>)}
          </select>
        </label>
        <label className="field">
          Target source
          <select value={source} onChange={(event) => setSource(event.target.value as "custom_price" | "saved_level")}>
            <option value="custom_price">Custom price</option>
            <option value="saved_level">Saved level</option>
          </select>
        </label>
        {source === "custom_price" ? (
          <label className="field">
            Price
            <input min="0.01" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
        ) : (
          <label className="field">
            Saved level
            <select value={levelId} onChange={(event) => setLevelId(event.target.value)}>
              {activeLevels.length === 0 && <option value="">No active saved levels</option>}
              {activeLevels.map((level) => <option key={level.id} value={level.id}>{level.name} (${level.price.toFixed(2)})</option>)}
            </select>
          </label>
        )}
        {operator === "within_percent" && (
          <label className="field">
            Percent
            <input min="0.01" step="0.01" type="number" value={percent} onChange={(event) => setPercent(event.target.value)} />
          </label>
        )}
        {operator === "within_dollars" && (
          <label className="field">
            Dollars
            <input min="0.01" step="0.01" type="number" value={dollars} onChange={(event) => setDollars(event.target.value)} />
          </label>
        )}
        <label className="field">
          Cooldown
          <input min="1" step="1" type="number" value={cooldown} onChange={(event) => setCooldown(event.target.value)} />
        </label>
        <label className="checkbox-row"><input checked={marketHoursOnly} onChange={(event) => setMarketHoursOnly(event.target.checked)} type="checkbox" /> Market hours only</label>
        <label className="checkbox-row"><input checked={smsEnabled} onChange={(event) => setSmsEnabled(event.target.checked)} type="checkbox" /> Send notifications</label>
      </div>
      <div className="action-row">
        <button className="button" disabled={source === "saved_level" && !levelId} onClick={createQuickAlert} type="button">
          Create quick alert
        </button>
      </div>
      {status && <p className={status.includes("saved") ? "success-notice" : "notice"}>{status}</p>}
    </section>
  );
}
