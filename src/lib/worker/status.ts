import type { WorkerStatus } from "@/lib/db/repositories";

export type WorkerRuntimeMode = "in-process" | "standalone";

export const workerHeartbeatStaleMs = 2 * 60_000;

export function sanitizeWorkerError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/https?:\/\/discord(?:app)?\.com\/api\/webhooks\/\S+/gi, "[redacted-discord-webhook]")
    .replace(/password=[^\s]+/gi, "password=[redacted]")
    .replace(/(ALPACA_API_SECRET_KEY=)[^\s]+/gi, "$1[redacted]")
    .replace(/(ALPACA_API_KEY_ID=)[^\s]+/gi, "$1[redacted]")
    .slice(0, 300);
}

export function isRecentWorkerHeartbeat(
  status: Pick<WorkerStatus, "heartbeat_at" | "last_update_at" | "is_running">,
  now = new Date(),
) {
  if (!status.is_running) return false;
  const heartbeat = status.heartbeat_at ?? status.last_update_at;
  if (!heartbeat) return false;
  return now.getTime() - new Date(heartbeat).getTime() <= workerHeartbeatStaleMs;
}

export function activeWorkerWarning(
  status: Pick<WorkerStatus, "worker_id" | "worker_name" | "runtime_mode" | "heartbeat_at" | "last_update_at" | "is_running">,
  currentWorkerId: string,
  now = new Date(),
) {
  if (!isRecentWorkerHeartbeat(status, now)) return null;
  if (!status.worker_id || status.worker_id === currentWorkerId) return null;
  const name = status.worker_name ?? status.worker_id;
  const mode = status.runtime_mode ?? "unknown";
  return `Another worker appears active: ${name} (${mode}).`;
}
