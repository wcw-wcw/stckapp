"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SupportedSymbol, SymbolLevelType } from "@/lib/rules/types";
import type { SavedSymbolLevel } from "@/lib/symbol-levels";

const levelTypes: SymbolLevelType[] = ["support", "resistance", "watch", "other"];
const changedEvent = "signaldesk:symbol-levels-changed";

type LevelForm = {
  name: string;
  price: string;
  levelType: SymbolLevelType;
  notes: string;
  expiresAt: string;
};

const blankForm: LevelForm = {
  name: "",
  price: "",
  levelType: "watch",
  notes: "",
  expiresAt: "",
};

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

const toLocalDateTimeValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function levelToForm(level: SavedSymbolLevel): LevelForm {
  return {
    name: level.name,
    price: String(level.price),
    levelType: level.levelType,
    notes: level.notes ?? "",
    expiresAt: toLocalDateTimeValue(level.expiresAt),
  };
}

export function SymbolLevelsPanel({ symbol }: { symbol: SupportedSymbol }) {
  const [levels, setLevels] = useState<SavedSymbolLevel[]>([]);
  const [form, setForm] = useState<LevelForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const sortedLevels = useMemo(
    () => [...levels].sort((left, right) => right.price - left.price),
    [levels],
  );

  async function loadLevels() {
    setStatus((current) => (current === "saving" ? current : "loading"));
    setMessage(null);
    try {
      const response = await fetch(`/api/symbol-levels?symbol=${symbol}`);
      const payload = await readJson<{ levels?: SavedSymbolLevel[]; error?: string }>(response);
      if (!response.ok) throw new Error(payload?.error ?? "Saved levels failed to load.");
      setLevels(payload?.levels ?? []);
      setStatus("ready");
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error && caught.message ? caught.message : "Saved levels failed to load.");
    }
  }

  useEffect(() => {
    loadLevels();
  }, [symbol]);

  function notifyChanged() {
    window.dispatchEvent(new CustomEvent(changedEvent, { detail: { symbol } }));
  }

  async function submitLevel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setMessage(null);
    try {
      const endpoint = editingId ? `/api/symbol-levels/${editingId}` : "/api/symbol-levels";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          name: form.name,
          price: form.price,
          levelType: form.levelType,
          notes: form.notes || undefined,
          expiresAt: form.expiresAt || null,
        }),
      });
      const payload = await readJson<{ level?: SavedSymbolLevel; error?: string }>(response);
      if (!response.ok) throw new Error(payload?.error ?? "Saved level could not be saved.");
      setForm(blankForm);
      setEditingId(null);
      await loadLevels();
      notifyChanged();
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error ? caught.message : "Saved level could not be saved.");
    }
  }

  async function deleteLevel(id: string) {
    setStatus("saving");
    setMessage(null);
    try {
      const response = await fetch(`/api/symbol-levels/${id}`, { method: "DELETE" });
      const payload = await readJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload?.error ?? "Saved level could not be deleted.");
      await loadLevels();
      notifyChanged();
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error ? caught.message : "Saved level could not be deleted.");
    }
  }

  return (
    <section className="card levels-card">
      <div className="card-header">
        <h2>Saved levels</h2>
        <span className="small">{levels.length} total</span>
      </div>
      <form className="levels-form" onSubmit={submitLevel}>
        <div className="form-grid">
          <label className="field">
            Name
            <input
              maxLength={80}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              value={form.name}
            />
          </label>
          <label className="field">
            Price
            <input
              min="0.01"
              onChange={(event) => setForm({ ...form, price: event.target.value })}
              required
              step="0.01"
              type="number"
              value={form.price}
            />
          </label>
          <label className="field">
            Type
            <select
              onChange={(event) => setForm({ ...form, levelType: event.target.value as SymbolLevelType })}
              value={form.levelType}
            >
              {levelTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Expires
            <input
              onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
              type="datetime-local"
              value={form.expiresAt}
            />
          </label>
          <label className="field field-wide">
            Notes
            <textarea
              className="levels-notes"
              maxLength={500}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              value={form.notes}
            />
          </label>
        </div>
        <div className="action-row">
          <button className="button" disabled={status === "saving"} type="submit">
            {editingId ? "Save level" : "Add level"}
          </button>
          {editingId && (
            <button
              className="mini-button"
              onClick={() => {
                setEditingId(null);
                setForm(blankForm);
              }}
              type="button"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      {message && <p className="notice">{message}</p>}
      <div className="levels-list">
        {status === "loading" && <p className="empty-state">Loading saved levels...</p>}
        {status !== "loading" && sortedLevels.length === 0 && (
          <p className="empty-state">No saved planning levels for {symbol} yet.</p>
        )}
        {sortedLevels.map((level) => (
          <div className={level.isExpired ? "level-row level-row-expired" : "level-row"} key={level.id}>
            <div>
              <div className="level-row-title">
                <strong>{level.name}</strong>
                <span className={`pill level-type-${level.levelType}`}>{level.levelType}</span>
              </div>
              <p className="rule-copy">
                ${level.price.toFixed(2)}
                {level.expiresAt ? ` · expires ${new Date(level.expiresAt).toLocaleDateString()}` : ""}
              </p>
              {level.notes && <p className="level-notes">{level.notes}</p>}
            </div>
            <div className="rule-actions">
              <button
                className="mini-button"
                onClick={() => {
                  setEditingId(level.id);
                  setForm(levelToForm(level));
                }}
                type="button"
              >
                Edit
              </button>
              <button
                className="mini-button mini-button-danger"
                disabled={status === "saving"}
                onClick={() => deleteLevel(level.id)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
