import { randomUUID } from "node:crypto";
import { activeMarketDataProvider, configuredMarketDataProvider } from "@/lib/market/provider";
import { getRepositoryProvider, getWorkerStatus, setWorkerLoopRunning } from "@/lib/db/repositories";
import { loadServerEnv } from "@/lib/config/env";
import { runLocalMockWorkerTick, type WorkerTickResult } from "@/lib/worker/local-mock-worker";
import { activeWorkerWarning, sanitizeWorkerError } from "@/lib/worker/status";

export type StandaloneWorkerOptions = {
  once?: boolean;
  intervalMs?: number;
  workerId?: string;
  workerName?: string;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

export type StandaloneWorkerHandle = {
  workerId: string;
  workerName: string;
  stop: () => Promise<void>;
  stopped: Promise<void>;
};

const defaultIntervalMs = Number(process.env.STANDALONE_WORKER_INTERVAL_MS ?? process.env.LOCAL_WORKER_INTERVAL_MS ?? 60_000);
const workerMode = activeMarketDataProvider === "alpaca" ? "live" : "mock";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function safeIntervalMs(intervalMs?: number) {
  const value = intervalMs ?? defaultIntervalMs;
  return Number.isFinite(value) && value > 0 ? value : 60_000;
}

function summarizeTick(result: WorkerTickResult) {
  return [
    `symbols=${result.evaluatedSymbols}`,
    `rules=${result.evaluatedRules}`,
    `triggers=${result.triggeredRules}`,
    `providerErrors=${result.providerErrors}`,
    `notifications=${result.notificationAttempts}`,
    result.lastCandleAt ? `lastCandle=${result.lastCandleAt}` : "lastCandle=n/a",
  ].join(" ");
}

async function runStandaloneTick(workerId: string, workerName: string, continuous: boolean) {
  return runLocalMockWorkerTick({
    continuous,
    runtimeMode: "standalone",
    workerId,
    workerName,
  });
}

export async function runStandaloneWorkerOnce(options: StandaloneWorkerOptions = {}) {
  loadServerEnv();
  const workerId = options.workerId ?? `standalone-${randomUUID()}`;
  const workerName = options.workerName ?? "Standalone worker";
  const logger = options.logger ?? console;
  const status = await getWorkerStatus();
  const warning = activeWorkerWarning(status, workerId);
  if (warning) logger.warn(`[worker] ${warning}`);
  const result = await runStandaloneTick(workerId, workerName, false);
  logger.info(`[worker] one-shot complete ${summarizeTick(result)}`);
  return result;
}

export async function startStandaloneWorker(
  options: StandaloneWorkerOptions = {},
): Promise<StandaloneWorkerHandle> {
  loadServerEnv();
  const workerId = options.workerId ?? `standalone-${randomUUID()}`;
  const workerName = options.workerName ?? "Standalone worker";
  const logger = options.logger ?? console;
  const intervalMs = safeIntervalMs(options.intervalMs);
  let stopping = false;
  let stopResolve: (() => void) | undefined;
  const stopped = new Promise<void>((resolve) => {
    stopResolve = resolve;
  });

  const status = await getWorkerStatus();
  const warning = activeWorkerWarning(status, workerId);
  if (warning) logger.warn(`[worker] ${warning}`);

  logger.info(
    `[worker] starting id=${workerId} mode=${workerMode} runtime=standalone db=${getRepositoryProvider()} market=${activeMarketDataProvider} configuredMarket=${configuredMarketDataProvider} intervalMs=${intervalMs}`,
  );

  await setWorkerLoopRunning(true, workerMode, "running", "standalone", workerId, workerName);

  async function loop() {
    try {
      while (!stopping) {
        try {
          const result = await runStandaloneTick(workerId, workerName, true);
          logger.info(`[worker] tick ${summarizeTick(result)}`);
        } catch (error) {
          logger.error(`[worker] tick failed ${sanitizeWorkerError(error)}`);
        }
        if (!stopping) await wait(intervalMs);
      }
    } finally {
      await setWorkerLoopRunning(false, workerMode, "idle", "standalone", workerId, workerName);
      logger.info(`[worker] stopped id=${workerId}`);
      stopResolve?.();
    }
  }

  void loop();

  return {
    workerId,
    workerName,
    stop: async () => {
      stopping = true;
      await stopped;
    },
    stopped,
  };
}
