import { getSafeConfigDiagnostics } from "@/lib/config/env";
import { getDatabaseProviderDiagnostics } from "@/lib/db/provider";
import { getWorkerStatus } from "@/lib/db/repositories";
import { activeMarketDataProvider, configuredMarketDataProvider, marketData } from "@/lib/market/provider";
import { getAppVersion } from "@/lib/version";
import { isRecentWorkerHeartbeat } from "@/lib/worker/status";

export async function getBasicHealth() {
  const config = getSafeConfigDiagnostics();
  const database = getDatabaseProviderDiagnostics();
  return {
    status: config.valid ? "ok" : "degraded",
    service: "signaldesk",
    timestamp: new Date().toISOString(),
    version: getAppVersion(),
    database: {
      configuredProvider: database.configuredProvider,
      activeProvider: database.activeProvider,
      repositoryAdapter: database.repositoryAdapter,
      configValid: database.configValid,
    },
    marketData: {
      configuredProvider: configuredMarketDataProvider,
      activeProvider: activeMarketDataProvider,
    },
    notifications: {
      realDiscordEnabled: config.discordRealNotificationSafety === "real-enabled",
      globalDailyNotificationLimit: config.globalDailyNotificationLimit,
    },
    warnings: config.warnings,
  };
}

export async function getDeepHealth() {
  const basic = await getBasicHealth();
  const worker = await getWorkerStatus();
  const provider = await marketData.getMarketStatus();
  const workerHeartbeatFresh = isRecentWorkerHeartbeat(worker);

  return {
    ...basic,
    status:
      basic.status === "ok" && (!worker.is_running || workerHeartbeatFresh) && provider.health === "ok"
        ? "ok"
        : "degraded",
    worker: {
      workerId: worker.worker_id,
      workerName: worker.worker_name,
      runtimeMode: worker.runtime_mode,
      mode: worker.mode,
      running: Boolean(worker.is_running),
      heartbeatFresh: workerHeartbeatFresh,
      heartbeatAt: worker.heartbeat_at,
      lastTickAt: worker.last_tick_at,
      lastCandleAt: worker.last_candle_at,
      providerErrors: worker.provider_errors,
      notificationAttempts: worker.notification_attempts,
      lastError: worker.last_error,
    },
    provider: {
      health: provider.health,
      provider: provider.provider,
      feed: provider.feed,
      warning: provider.warning,
    },
  };
}
