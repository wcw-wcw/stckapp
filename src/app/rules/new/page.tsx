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
  type RuleCondition,
  type RuleOperator,
} from "@/lib/rules/types";

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
  const [results, setResults] = useState<BacktestResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string>();
  const preview = useMemo(() => previewRule(rule), [rule]);

  useEffect(() => {
    fetch("/api/auth/me").then((response) => {
      if (response.status === 401) window.location.href = "/login";
    });
  }, []);

  const updateCondition = (index: number, patch: Partial<RuleCondition>) =>
    setRule((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, ...patch } : condition,
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
                        {OPERATORS.map((operator) => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}
                      </select>
                      <select aria-label={`Condition ${index + 1} right value`} value={condition.right} onChange={(event) => updateCondition(index, { right: event.target.value as Indicator })}>
                        {INDICATORS.map((indicator) => <option key={indicator} value={indicator}>{indicatorLabels[indicator]}</option>)}
                      </select>
                    </div>
                    {condition.right === "average_volume" && (
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
