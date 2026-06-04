import { activeMarketDataProvider } from "@/lib/market/provider";
import {
  getWorkerStatus,
  setWorkerLoopRunning,
  type WorkerStatus,
} from "@/lib/db/repositories";
import {
  getLiveWorkerBackoffStatus,
  runLocalMockWorkerTick,
  type WorkerTickResult,
} from "./local-mock-worker";
import { activeWorkerWarning } from "./status";

type LocalWorkerRuntime = {
  timer?: NodeJS.Timeout;
  currentTick?: Promise<WorkerTickResult | undefined>;
  startedAt?: string;
  intervalMs: number;
};

declare global {
  var signalDeskWorkerRuntime: LocalWorkerRuntime | undefined;
}

const defaultIntervalMs = Number(process.env.LOCAL_WORKER_INTERVAL_MS ?? 60_000);
const workerMode = activeMarketDataProvider === "alpaca" ? "live" : "mock";
const inProcessWorkerId = "next-local-worker";
const inProcessWorkerName = "Next.js in-process worker";

function runtime() {
  global.signalDeskWorkerRuntime ??= {
    intervalMs: Number.isFinite(defaultIntervalMs) && defaultIntervalMs > 0 ? defaultIntervalMs : 60_000,
  };
  return global.signalDeskWorkerRuntime;
}

function isRunning() {
  return Boolean(runtime().timer);
}

async function runLoopTick() {
  const state = runtime();
  if (state.currentTick) return state.currentTick;
  state.currentTick = runLocalMockWorkerTick({
    continuous: true,
    runtimeMode: "in-process",
    workerId: inProcessWorkerId,
    workerName: inProcessWorkerName,
  })
    .catch((error) => {
      console.error("[local-worker]", error);
      return undefined;
    })
    .finally(() => {
      state.currentTick = undefined;
    });
  return state.currentTick;
}

export async function startLocalWorkerLoop(intervalMs?: number) {
  const state = runtime();
  if (intervalMs && Number.isFinite(intervalMs) && intervalMs > 0) {
    state.intervalMs = intervalMs;
  }

  if (!state.timer) {
    const currentStatus = await getWorkerStatus();
    const warning = activeWorkerWarning(currentStatus, inProcessWorkerId);
    if (warning) console.warn(`[local-worker] ${warning}`);
    state.startedAt = new Date().toISOString();
    await setWorkerLoopRunning(
      true,
      workerMode,
      "running",
      "in-process",
      inProcessWorkerId,
      inProcessWorkerName,
    );
    void runLoopTick();
    state.timer = setInterval(() => {
      void runLoopTick();
    }, state.intervalMs);
  }

  return getLocalWorkerStatus();
}

export async function stopLocalWorkerLoop() {
  const state = runtime();
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = undefined;
  }
  state.startedAt = undefined;
  await setWorkerLoopRunning(
    false,
    workerMode,
    "idle",
    "in-process",
    inProcessWorkerId,
    inProcessWorkerName,
  );
  return getLocalWorkerStatus();
}

export async function getLocalWorkerStatus(): Promise<WorkerStatus & {
  isRunning: boolean;
  startedAt?: string;
  intervalMs: number;
  providerBackoff: ReturnType<typeof getLiveWorkerBackoffStatus>;
}> {
  const state = runtime();
  return {
    ...(await getWorkerStatus()),
    isRunning: isRunning(),
    startedAt: state.startedAt,
    intervalMs: state.intervalMs,
    providerBackoff: getLiveWorkerBackoffStatus(),
  };
}
