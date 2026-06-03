"use client";

import { useMemo, useState } from "react";
import type { ReplayDatasetSummary } from "@/lib/db/repositories";
import type { Candle } from "@/lib/rules/types";

const exampleStart = new Date("2026-06-02T13:30:00.000Z").getTime();

function exampleCandles(): Candle[] {
  return Array.from({ length: 80 }, (_, index) => {
    const open = 532 + Math.sin(index / 8) * 0.6 + index * 0.015;
    const close = open + Math.sin(index / 3) * 0.12;
    return {
      timestamp: new Date(exampleStart + index * 60_000).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number((Math.max(open, close) + 0.22).toFixed(2)),
      low: Number((Math.min(open, close) - 0.22).toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(120000 + index * 700 + Math.abs(Math.sin(index)) * 40000),
    };
  });
}

const examplePayload = JSON.stringify(
  {
    name: "SPY generated replay sample",
    symbol: "SPY",
    source: "chatgpt_json",
    candles: exampleCandles(),
  },
  null,
  2,
);

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export function ReplayLab({
  initialDatasets,
}: {
  initialDatasets: ReplayDatasetSummary[];
}) {
  const [datasets, setDatasets] = useState(initialDatasets);
  const [payloadText, setPayloadText] = useState(examplePayload);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const parsedPreview = useMemo(() => {
    try {
      const parsed = JSON.parse(payloadText) as { candles?: unknown[]; symbol?: string; name?: string };
      return {
        name: parsed.name ?? "Untitled",
        symbol: parsed.symbol ?? "unknown",
        candles: Array.isArray(parsed.candles) ? parsed.candles.length : 0,
      };
    } catch {
      return null;
    }
  }, [payloadText]);

  async function requestJson(path: string, init: RequestInit) {
    setError(undefined);
    setMessage(undefined);
    const response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Request failed.");
    return payload;
  }

  async function saveDataset() {
    setBusy("save");
    try {
      const parsed = JSON.parse(payloadText);
      const payload = await requestJson("/api/replay/datasets", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      setDatasets((current) => [payload.dataset, ...current.filter((item) => item.id !== payload.dataset.id)]);
      setMessage(`Saved ${payload.dataset.name} with ${payload.dataset.candleCount} candles.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save that dataset.");
    } finally {
      setBusy(undefined);
    }
  }

  async function runDataset(dataset: ReplayDatasetSummary) {
    setBusy(dataset.id);
    try {
      const payload = await requestJson("/api/worker/replay", {
        method: "POST",
        body: JSON.stringify({ datasetId: dataset.id }),
      });
      setMessage(
        `Replayed ${dataset.name}: ${payload.triggeredRules} alerts, ${payload.skippedCooldown} cooldown skips, ${payload.evaluatedRules} rule checks.`,
      );
      window.setTimeout(() => window.location.reload(), 1100);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not run that replay.");
    } finally {
      setBusy(undefined);
    }
  }

  async function deleteDataset(dataset: ReplayDatasetSummary) {
    setBusy(dataset.id);
    try {
      await requestJson(`/api/replay/datasets/${dataset.id}`, { method: "DELETE" });
      setDatasets((current) => current.filter((item) => item.id !== dataset.id));
      setMessage(`Deleted ${dataset.name}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete that dataset.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="grid replay-grid">
      <section className="card">
        <div className="card-header">
          <h2>Paste candle dataset</h2>
          {parsedPreview && <span className="pill pill-muted">{parsedPreview.candles} candles</span>}
        </div>
        <div className="field">
          <label htmlFor="dataset-json">Dataset JSON</label>
          <textarea
            id="dataset-json"
            spellCheck={false}
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
          />
        </div>
        <div className="action-row">
          <button className="button" disabled={busy === "save"} onClick={saveDataset}>
            {busy === "save" ? "Saving..." : "Save dataset"}
          </button>
          <button className="button button-secondary" onClick={() => setPayloadText(examplePayload)}>
            Reset example
          </button>
        </div>
        <div className="notice" style={{ marginTop: "1rem" }}>
          Expected shape: name, symbol, source, and at least 80 one-minute candles with timestamp, open, high, low, close, and volume.
        </div>
        {message && <p className="success-notice">{message}</p>}
        {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Saved replay datasets</h2>
          <span className="small">{datasets.length} total</span>
        </div>
        <div className="rules-list">
          {datasets.length === 0 && <p className="empty-state">No datasets saved yet.</p>}
          {datasets.map((dataset) => (
            <article className="rule-line rule-management-line" key={dataset.id}>
              <div>
                <div className="rule-title">
                  <span className="symbol">{dataset.symbol}</span>
                  <strong>{dataset.name}</strong>
                  <span className="pill pill-muted">{dataset.source}</span>
                </div>
                <p className="small">
                  {dataset.candleCount} candles · {timeLabel(dataset.startsAt)} to {timeLabel(dataset.endsAt)}
                </p>
              </div>
              <div className="rule-actions">
                <button className="mini-button" disabled={busy === dataset.id} onClick={() => runDataset(dataset)}>
                  Run replay
                </button>
                <button className="mini-button mini-button-danger" disabled={busy === dataset.id} onClick={() => deleteDataset(dataset)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
