"use client";

import { useState } from "react";
import type { CleanupResult } from "@/lib/maintenance/cleanup";

const labels: Record<keyof CleanupResult, string> = {
  expiredSessions: "Expired sessions",
  phoneVerifications: "Phone verification codes",
  providerErrorLogs: "Provider error logs",
  notificationLogs: "Notification logs",
  cachedBacktestResults: "Cached backtest summaries",
  suggestedRuleCandidates: "Suggested-rule candidates",
};

export function MaintenanceCleanupCard() {
  const [deleted, setDeleted] = useState<CleanupResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function runCleanup() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/maintenance/cleanup", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Cleanup failed.");
      setDeleted(payload.deleted);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cleanup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ marginTop: "1rem" }}>
      <div className="card-header">
        <h2>Local maintenance</h2>
        <span className="small">Manual cleanup only</span>
      </div>
      <p className="small">
        Remove expired sessions, stale verification codes, old provider and notification logs, cached backtest summaries, and expired suggested-rule candidates.
      </p>
      <button className="button button-secondary" disabled={busy} onClick={runCleanup}>
        Run cleanup
      </button>
      {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
      {deleted && (
        <div className="results compact-stats">
          {(Object.entries(labels) as Array<[keyof CleanupResult, string]>).map(([key, label]) => (
            <div className="result" key={key}>
              <span className="small">{label}</span>
              <strong>{deleted[key]}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
