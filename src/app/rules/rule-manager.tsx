"use client";

import Link from "next/link";
import { useState } from "react";
import { previewRule } from "@/lib/rules/preview";
import type { SavedRule } from "@/lib/db/repositories";

export function RuleManager({ initialRules }: { initialRules: SavedRule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  async function setActive(rule: SavedRule) {
    setBusyId(rule.id);
    setError(undefined);
    const response = await fetch(`/api/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    setBusyId(undefined);
    if (!response.ok) {
      setError("Could not update the rule.");
      return;
    }
    setRules((current) =>
      current.map((item) =>
        item.id === rule.id ? { ...item, isActive: !item.isActive } : item,
      ),
    );
  }

  async function remove(rule: SavedRule) {
    if (!window.confirm(`Delete "${rule.name}"? This cannot be undone.`)) return;
    setBusyId(rule.id);
    setError(undefined);
    const response = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
    setBusyId(undefined);
    if (!response.ok) {
      setError("Could not delete the rule.");
      return;
    }
    setRules((current) => current.filter((item) => item.id !== rule.id));
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Saved rules</h2>
        <span className="small">{rules.length} total</span>
      </div>
      {rules.length === 0 && <p className="empty-state">No saved rules. Create a signal and run its mock backtest first.</p>}
      <div className="rules-list">
        {rules.map((rule) => (
          <article className="rule-line rule-management-line" key={rule.id}>
            <div>
              <div className="rule-title">
                <span className="symbol">{rule.symbol}</span>
                <strong>{rule.name}</strong>
                <span className={`pill ${rule.isActive ? "" : "pill-muted"}`}>{rule.isActive ? "active" : "paused"}</span>
              </div>
              <p className="rule-copy">{previewRule(rule)}</p>
              <p className="small">Cooldown: {rule.cooldownMinutes} minutes · Notifications: {rule.smsEnabled ? "enabled" : "off"}</p>
            </div>
            <div className="rule-actions">
              <Link className="mini-button" href={`/rules/${rule.id}`}>
                Details
              </Link>
              <button className="mini-button" disabled={busyId === rule.id} onClick={() => setActive(rule)}>
                {rule.isActive ? "Pause" : "Resume"}
              </button>
              <button className="mini-button mini-button-danger" disabled={busyId === rule.id} onClick={() => remove(rule)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
      {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
    </section>
  );
}
