"use client";

import { useEffect, useMemo, useState } from "react";
import { previewRule } from "@/lib/rules/preview";
import {
  INDICATORS,
  OPERATORS,
  SUPPORTED_SYMBOLS,
  type AlertRule,
  type BacktestResult,
  type Indicator,
  type RuleTarget,
  type RuleCondition,
  type RuleOperator,
  type SavedLevelTarget,
} from "@/lib/rules/types";
import type { SavedSymbolLevel } from "@/lib/symbol-levels";

const indicatorLabels: Record<Indicator, string> = {
  price: "Price",
  volume: "Volume",
  vwap: "VWAP",
  ema_9: "EMA 9",
  ema_20: "EMA 20",
  previous_day_high: "Previous day high",
  previous_day_low: "Previous day low",
  opening_range_high: "Opening range high",
  opening_range_low: "Opening range low",
  premarket_high: "Premarket high",
  premarket_low: "Premarket low",
  high_of_day: "High of day",
  low_of_day: "Low of day",
  average_volume: "Average volume",
};

const operatorLabels: Record<RuleOperator, string> = {
  crosses_above: "Crosses above",
  crosses_below: "Crosses below",
  ">": "Greater than",
  "<": "Less than",
  ">=": "At least",
  "<=": "At most",
  touches: "Touches",
  within_percent: "Within percent",
  within_dollars: "Within dollars",
  breaks_above: "Breaks above",
  breaks_below: "Breaks below",
};

const initialRule: AlertRule = {
  name: "SPY VWAP Reclaim",
  symbol: "SPY",
  timeframe: "1m",
  logic: "AND",
  conditions: [{ left: "price", operator: "crosses_above", right: "vwap" }],
  cooldownMinutes: 30,
  smsEnabled: false,
  isActive: true,
  marketHoursOnly: true,
};

export default function RuleBuilder() {
  const [rule, setRule] = useState(initialRule);
  const [levels, setLevels] = useState<SavedSymbolLevel[]>([]);
  const [results, setResults] = useState<BacktestResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string>();
  const preview = useMemo(() => previewRule(rule), [rule]);
  const priceIndicators = useMemo(
    () => INDICATORS.filter((indicator) => indicator !== "volume" && indicator !== "average_volume") as Indicator[],
    [],
  );
  const activeLevels = useMemo(() => levels.filter((level) => !level.isExpired), [levels]);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => {
      if (response.status === 401) window.location.href = "/login";
    });
  }, []);

  useEffect(() => {
    fetch(`/api/symbol-levels?symbol=${rule.symbol}`)
      .then((response) => (response.ok ? response.json() : { levels: [] }))
      .then((payload: { levels?: SavedSymbolLevel[] }) => setLevels(payload.levels ?? []))
      .catch(() => setLevels([]));
  }, [rule.symbol]);

  const targetValue = (right: RuleCondition["right"]) =>
    typeof right === "string" ? right : right.type === "indicator" ? right.indicator : right.type;

  const rightFromValue = (value: string): RuleCondition["right"] => {
    if (value === "custom_price") return { type: "custom_price", price: 1 };
    if (value === "saved_level") {
      const level = activeLevels[0];
      return {
        type: "saved_level",
        levelId: level?.id ?? "00000000-0000-0000-0000-000000000000",
        levelName: level?.name,
        price: level?.price,
      } satisfies SavedLevelTarget;
    }
    return value as Indicator;
  };

  const isPriceLike = (indicator: Indicator) => priceIndicators.includes(indicator);

  const compatibleRightOptions = (condition: RuleCondition) => {
    if (condition.left === "volume") return ["average_volume"] as const;
    if (condition.left === "average_volume") return ["volume"] as const;
    return [...priceIndicators, "custom_price", "saved_level"];
  };

  const compatibleOperators = (condition: RuleCondition) => {
    if (!isPriceLike(condition.left)) {
      return OPERATORS.filter((operator) => operator !== "within_dollars") as RuleOperator[];
    }
    return [...OPERATORS] as RuleOperator[];
  };

  const updateCondition = (index: number, patch: Partial<RuleCondition>) =>
    setRule((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? normalizeCondition({ ...condition, ...patch }) : condition,
      ),
    }));

  const updateParams = (index: number, patch: NonNullable<RuleCondition["params"]>) =>
    setRule((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) =>
        conditionIndex === index
          ? { ...condition, params: { ...condition.params, ...patch } }
          : condition,
      ),
    }));

  const addCondition = () =>
    setRule((current) => ({
      ...current,
      conditions: [
        ...current.conditions,
        { left: "volume", operator: ">=", right: "average_volume", params: { multiplier: 1.5, lookback: 20 } },
      ],
    }));

  const normalizeCondition = (condition: RuleCondition): RuleCondition => {
    const options = compatibleRightOptions(condition);
    let right = condition.right;
    if (!options.includes(targetValue(right) as never)) right = options[0] as Indicator;
    let operator = condition.operator;
    if (!compatibleOperators(condition).includes(operator)) operator = ">=";
    const params = { ...condition.params };
    if (operator !== "within_percent") delete params.percent;
    if (operator !== "within_dollars") delete params.dollars;
    if (targetValue(right) !== "average_volume") {
      delete params.multiplier;
      delete params.lookback;
    }
    return { ...condition, right, operator, params };
  };

  const removeCondition = (index: number) =>
    setRule((current) => ({
      ...current,
      conditions: current.conditions.filter((_, conditionIndex) => conditionIndex !== index),
    }));

  async function runBacktest() {
    setLoading(true);
    setError(undefined);
    setResults(undefined);
    const response = await fetch("/api/rules/backtest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rule),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not run the backtest.");
      return;
    }
    setResults(payload);
  }

  async function saveRule() {
    setSaving(true);
    setError(undefined);
    setSaved(undefined);
    const response = await fetch("/api/rules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rule),
    });
    const payload = await response.json();
    setSaving(false);
    if (!response.ok) {
      if (response.status === 401) window.location.href = "/login";
      setError(payload.error ?? "Could not save the rule.");
      return;
    }
    setSaved("Rule saved locally.");
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Rule builder</p>
          <h1>Build one clear signal.</h1>
          <p className="subhead">
            Combine up to four closed-candle conditions. Every condition must
            be true on the same candle before the rule triggers.
          </p>
        </div>
      </div>
      <div className="builder">
        <section className="card">
          <div className="card-header"><h2>Signal definition</h2><span className="pill">1-minute candle</span></div>
          <div className="form-grid">
            <div className="field field-wide">
              <label htmlFor="name">Rule name</label>
              <input id="name" value={rule.name} onChange={(event) => setRule({ ...rule, name: event.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="symbol">Symbol</label>
              <select id="symbol" value={rule.symbol} onChange={(event) => setRule({ ...rule, symbol: event.target.value as AlertRule["symbol"] })}>
                {SUPPORTED_SYMBOLS.map((symbol) => <option key={symbol}>{symbol}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="cooldown">Cooldown minutes</label>
              <input id="cooldown" type="number" min="1" value={rule.cooldownMinutes} onChange={(event) => setRule({ ...rule, cooldownMinutes: Number(event.target.value) })} />
            </div>
            <div className="field field-wide">
              <label>Conditions</label>
              <div className="conditions-list">
                {rule.conditions.map((condition, index) => (
                  <div className="condition-wrap" key={index}>
                    {index > 0 && <div className="logic-divider">AND</div>}
                    <div className="condition-header">
                      <span className="small">Condition {index + 1}</span>
                      {rule.conditions.length > 1 && <button className="condition-remove" onClick={() => removeCondition(index)} type="button">Remove</button>}
                    </div>
                    <div className="condition">
                      <select aria-label={`Condition ${index + 1} left value`} value={condition.left} onChange={(event) => updateCondition(index, { left: event.target.value as Indicator })}>
                        {INDICATORS.map((indicator) => <option key={indicator} value={indicator}>{indicatorLabels[indicator]}</option>)}
                      </select>
                      <select aria-label={`Condition ${index + 1} operator`} value={condition.operator} onChange={(event) => updateCondition(index, { operator: event.target.value as RuleOperator })}>
                        {compatibleOperators(condition).map((operator) => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
                      </select>
                      <select aria-label={`Condition ${index + 1} right value`} value={targetValue(condition.right)} onChange={(event) => updateCondition(index, { right: rightFromValue(event.target.value) })}>
                        {compatibleRightOptions(condition).map((option) => (
                          <option key={option} value={option}>
                            {option === "custom_price" ? "Custom price" : option === "saved_level" ? "Saved level" : indicatorLabels[option as Indicator]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {targetValue(condition.right) === "custom_price" && (
                      <div className="condition-params">
                        <div className="field">
                          <label htmlFor={`custom-price-${index}`}>Custom price</label>
                          <input id={`custom-price-${index}`} min="0.01" step="0.01" type="number" value={(condition.right as RuleTarget & { price?: number }).price ?? 1} onChange={(event) => updateCondition(index, { right: { type: "custom_price", price: Number(event.target.value) } })} />
                        </div>
                      </div>
                    )}
                    {targetValue(condition.right) === "saved_level" && (
                      <div className="condition-params">
                        <div className="field">
                          <label htmlFor={`saved-level-${index}`}>Saved level</label>
                          <select
                            id={`saved-level-${index}`}
                            value={(condition.right as SavedLevelTarget).levelId}
                            onChange={(event) => {
                              const level = activeLevels.find((item) => item.id === event.target.value);
                              if (!level) return;
                              updateCondition(index, { right: { type: "saved_level", levelId: level.id, levelName: level.name, price: level.price } });
                            }}
                          >
                            {activeLevels.length === 0 && <option value="00000000-0000-0000-0000-000000000000">No active saved levels</option>}
                            {activeLevels.map((level) => <option key={level.id} value={level.id}>{level.name} (${level.price.toFixed(2)})</option>)}
                          </select>
                        </div>
                      </div>
                    )}
                    {targetValue(condition.right) === "average_volume" && (
                      <div className="condition-params">
                        <div className="field">
                          <label htmlFor={`multiplier-${index}`}>Average-volume multiplier</label>
                          <input id={`multiplier-${index}`} min="0.1" step="0.1" type="number" value={condition.params?.multiplier ?? 1.5} onChange={(event) => updateParams(index, { multiplier: Number(event.target.value) })} />
                        </div>
                        <div className="field">
                          <label htmlFor={`lookback-${index}`}>Lookback candles</label>
                          <input id={`lookback-${index}`} min="2" step="1" type="number" value={condition.params?.lookback ?? 20} onChange={(event) => updateParams(index, { lookback: Number(event.target.value) })} />
                        </div>
                      </div>
                    )}
                    {condition.operator === "within_percent" && (
                      <div className="condition-params">
                        <div className="field">
                          <label htmlFor={`percent-${index}`}>Within percent</label>
                          <input id={`percent-${index}`} min="0.01" step="0.1" type="number" value={condition.params?.percent ?? 1} onChange={(event) => updateParams(index, { percent: Number(event.target.value) })} />
                        </div>
                      </div>
                    )}
                    {condition.operator === "within_dollars" && (
                      <div className="condition-params">
                        <div className="field">
                          <label htmlFor={`dollars-${index}`}>Within dollars</label>
                          <input id={`dollars-${index}`} min="0.01" step="0.01" type="number" value={condition.params?.dollars ?? 0.25} onChange={(event) => updateParams(index, { dollars: Number(event.target.value) })} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {rule.conditions.length < 4 && <button className="mini-button" onClick={addCondition} type="button">Add AND condition</button>}
            </div>
            <label className="checkbox-row"><input type="checkbox" checked={rule.marketHoursOnly} onChange={(event) => setRule({ ...rule, marketHoursOnly: event.target.checked })} /> Market hours only</label>
            <label className="checkbox-row"><input type="checkbox" checked={rule.smsEnabled} onChange={(event) => setRule({ ...rule, smsEnabled: event.target.checked })} /> Send notifications</label>
          </div>
          <div className="action-row">
            <button className="button" disabled={loading} onClick={runBacktest}>{loading ? "Running..." : "Run mock backtest"}</button>
            <button className="button button-secondary" disabled={saving} onClick={saveRule} type="button">{saving ? "Saving..." : "Save rule"}</button>
          </div>
        </section>
        <aside className="card">
          <div className="card-header"><h2>Plain-English preview</h2></div>
          <p className="preview">{preview}</p>
          <div className="notice">Historical results use deterministic mock candles. Notification delivery stays local until a real provider is configured.</div>
          {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
          {saved && <p className="success-notice">{saved}</p>}
          {results && (
            <>
              <div className="results">
                <div className="result"><span className="small">Triggers</span><strong>{results.triggerCount}</strong></div>
                <div className="result"><span className="small">Average +15m</span><strong>{results.forward["15"].averageMove}%</strong></div>
                <div className="result"><span className="small">Positive +15m</span><strong>{results.forward["15"].percentPositive}%</strong></div>
                <div className="result"><span className="small">Best +60m</span><strong>{results.bestResult}%</strong></div>
                <div className="result"><span className="small">Worst +60m</span><strong>{results.worstResult}%</strong></div>
                <div className="result"><span className="small">Avg. favorable</span><strong>{results.averageMaxFavorableMove}%</strong></div>
              </div>
              {results.warning && <p className="notice" style={{ marginTop: "0.8rem" }}>{results.warning}</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
