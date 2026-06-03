"use client";

import { useState } from "react";

export function RunWorkerButton() {
  const [loading, setLoading] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [message, setMessage] = useState<string>();

  async function runTick() {
    setLoading(true);
    setMessage(undefined);
    const response = await fetch("/api/worker/tick", { method: "POST" });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Could not run the local worker.");
      return;
    }
    setMessage(
      `Checked ${payload.evaluatedRules} rules across ${payload.evaluatedSymbols} symbols. Recorded ${payload.triggeredRules} alerts and updated ${payload.updatedPerformance} outcomes.`,
    );
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function runReplay() {
    setReplaying(true);
    setMessage(undefined);
    const response = await fetch("/api/worker/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ candles: 390 }),
    });
    const payload = await response.json();
    setReplaying(false);
    if (!response.ok) {
      setMessage(payload.error ?? "Could not run the local replay.");
      return;
    }
    setMessage(
      `Replayed ${payload.replayCandles} candles across ${payload.evaluatedSymbols} symbols. Recorded ${payload.triggeredRules} alerts and skipped ${payload.skippedCooldown} cooldown matches.`,
    );
    window.setTimeout(() => window.location.reload(), 900);
  }

  async function setLoopState(action: "start" | "stop") {
    setLooping(true);
    setMessage(undefined);
    const response = await fetch(`/api/worker/${action}`, { method: "POST" });
    const payload = await response.json();
    setLooping(false);
    if (!response.ok) {
      setMessage(payload.error ?? `Could not ${action} the local worker.`);
      return;
    }
    setMessage(action === "start" ? "Local monitor is running." : "Local monitor stopped.");
    window.setTimeout(() => window.location.reload(), 700);
  }

  return (
    <div className="worker-control">
      <button className="button button-secondary" disabled={loading || replaying || looping} onClick={runTick}>
        {loading ? "Running tick..." : "Run local worker tick"}
      </button>
      <button className="button button-secondary" disabled={loading || replaying || looping} onClick={runReplay}>
        {replaying ? "Replaying..." : "Replay 1 mock day"}
      </button>
      <button className="button button-secondary" disabled={loading || replaying || looping} onClick={() => setLoopState("start")}>
        {looping ? "Updating..." : "Start monitor"}
      </button>
      <button className="button button-secondary" disabled={loading || replaying || looping} onClick={() => setLoopState("stop")}>
        Stop monitor
      </button>
      {message && <span className="small">{message}</span>}
    </div>
  );
}
