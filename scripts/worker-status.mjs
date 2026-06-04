import { register } from "node:module";

register(new URL("./ts-path-loader.mjs", import.meta.url));

const { getWorkerStatus, getRepositoryProvider } = await import("../src/lib/db/repositories.ts");
const { isRecentWorkerHeartbeat } = await import("../src/lib/worker/status.ts");
const { getPostgresPool } = await import("../src/lib/db/postgres.ts");

const status = await getWorkerStatus();

console.log(JSON.stringify({
  workerId: status.worker_id,
  workerName: status.worker_name,
  runtimeMode: status.runtime_mode,
  status: status.status,
  mode: status.mode,
  running: Boolean(status.is_running),
  heartbeatFresh: isRecentWorkerHeartbeat(status),
  heartbeatAt: status.heartbeat_at,
  lastTickAt: status.last_tick_at,
  lastCandleAt: status.last_candle_at,
  symbolsEvaluated: status.symbols_evaluated,
  rulesEvaluated: status.rules_evaluated,
  triggersCreated: status.triggers_created,
  cooldownSkips: status.cooldown_skips,
  providerErrors: status.provider_errors,
  notificationAttempts: status.notification_attempts,
  nextRetryAt: status.next_retry_at,
  lastError: status.last_error,
}, null, 2));

if (getRepositoryProvider() === "postgres-pool") {
  await getPostgresPool().end();
}
