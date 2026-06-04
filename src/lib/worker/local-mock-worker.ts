import { buildIndicatorStates, isMarketHours } from "@/lib/market/indicators";
import { activeMarketDataProvider, marketData } from "@/lib/market/provider";
import {
  createAlertEvent,
  createNotificationLog,
  createProviderErrorLog,
  countNotificationAttemptsToday,
  getUserNotificationPreferences,
  incrementNotificationChannelCount,
  getReplayDataset,
  listEnabledNotificationChannels,
  listPendingAlertEvents,
  listActiveWorkerRules,
  listActiveWorkerRulesForUser,
  recordWorkerTickStatus,
  setAlertNotificationStatus,
  updateAlertPerformance,
  updateWorkerStatus,
  type WorkerRule,
} from "@/lib/db/repositories";
import {
  buildAlertNotification,
  globalDailyNotificationLimit,
  maskNotificationDestination,
  notifications,
} from "@/lib/notifications/notification-service";
import { evaluateRule } from "@/lib/rules/evaluate";
import { previewRule } from "@/lib/rules/preview";
import type { IndicatorState, SupportedSymbol } from "@/lib/rules/types";
import type { Candle } from "@/lib/rules/types";
import {
  alreadyTriggeredCandle,
  groupActiveRules,
  loadClosedCandleStateWithRetry,
  nextProviderBackoffMs,
  outsideCooldown,
  type ProviderDataError,
} from "./live-monitor";
import { sanitizeWorkerError, type WorkerRuntimeMode } from "./status";

export type WorkerTickResult = {
  evaluatedSymbols: number;
  evaluatedRules: number;
  triggeredRules: number;
  skippedCooldown: number;
  updatedPerformance: number;
  providerErrors: number;
  notificationAttempts: number;
  lastCandleAt?: string;
  eventIds: string[];
};

export type WorkerReplayResult = WorkerTickResult & {
  replayCandles: number;
};

const horizons = [5, 15, 30, 60] as const;
const workerMode = activeMarketDataProvider === "alpaca" ? "live" : "mock";
const providerBackoffBySymbol = new Map<
  SupportedSymbol,
  { failures: number; nextRetryAt: string; lastError: string }
>();

export function calculateAvailablePerformance(
  candles: Candle[],
  event: { triggeredAt: string; triggerPrice: number },
) {
  const triggerTime = new Date(event.triggeredAt).getTime();
  const available = candles.filter(
    (candle) => new Date(candle.timestamp).getTime() > triggerTime,
  );
  return Object.fromEntries(
    horizons.flatMap((horizon) => {
      const candle = available[horizon - 1];
      return candle
        ? [[String(horizon), Number((((candle.close - event.triggerPrice) / event.triggerPrice) * 100).toFixed(2))]]
        : [];
    }),
  );
}

async function updatePendingPerformance() {
  let updated = 0;
  const pendingEvents = await listPendingAlertEvents();
  const pendingBySymbol = pendingEvents.reduce(
    (groups, event) => {
      groups[event.symbol] = [...(groups[event.symbol] ?? []), event];
      return groups;
    },
    {} as Record<SupportedSymbol, typeof pendingEvents>,
  );

  for (const [symbol, events] of Object.entries(pendingBySymbol) as Array<
    [SupportedSymbol, typeof pendingEvents]
  >) {
    try {
      const candles = await marketData.getHistoricalCandles(symbol, 120);
      for (const event of events) {
        const performance = calculateAvailablePerformance(candles, event);
        if (Object.keys(performance).length) {
          await updateAlertPerformance(event.id, performance);
          updated += 1;
        }
      }
    } catch {
      // Forward-return updates are opportunistic; live alert evaluation records
      // provider health separately below.
    }
  }
  return updated;
}

export async function sendRuleNotifications(rule: WorkerRule, state: IndicatorState, eventId: string) {
  if (!rule.smsEnabled) {
    await setAlertNotificationStatus(eventId, "not_sent");
    return 0;
  }

  const preferences = await getUserNotificationPreferences(rule.userId);
  if (preferences.notificationsPaused) {
    await setAlertNotificationStatus(
      eventId,
      "skipped_account_paused",
      "Account notification pause is enabled.",
    );
    return 0;
  }

  const channels = await listEnabledNotificationChannels(rule.userId);
  if (!channels.length) {
    await setAlertNotificationStatus(eventId, "skipped_no_verified_channel");
    return 0;
  }

  const message = buildAlertNotification({
    symbol: rule.symbol,
    ruleName: rule.name,
    triggerPrice: state.price,
    conditionSummary: previewRule(rule),
  });
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const channel of channels) {
    if ((await countNotificationAttemptsToday()) >= globalDailyNotificationLimit()) {
      await createNotificationLog({
        userId: rule.userId,
        alertEventId: eventId,
        channelId: channel.id,
        provider: "notification-cap",
        channelType: channel.type,
        destination: maskNotificationDestination(channel.type, channel.destination),
        status: "skipped_global_limit",
        message: message.body,
        error: "Global daily notification limit reached.",
      });
      skipped += 1;
      continue;
    }

    const result = await notifications.send({ channel, ...message });
    await createNotificationLog({
      userId: rule.userId,
      alertEventId: eventId,
      channelId: channel.id,
      provider: result.provider,
      channelType: channel.type,
      destination: maskNotificationDestination(channel.type, channel.destination),
      status: result.status,
      message: message.body,
      error: result.error,
    });
    if (result.status === "sent") {
      sent += 1;
      await incrementNotificationChannelCount(channel.id);
    } else {
      failed += 1;
    }
  }

  await setAlertNotificationStatus(
    eventId,
    sent > 0 ? "sent" : skipped > 0 && failed === 0 ? "skipped_global_limit" : "failed",
    failed ? "One or more mock deliveries failed." : skipped ? "Global daily notification limit reached." : undefined,
  );
  return channels.length;
}

function minutesBetween(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function skippedByProviderBackoff(symbol: SupportedSymbol, now = new Date()) {
  const backoff = providerBackoffBySymbol.get(symbol);
  return Boolean(backoff && new Date(backoff.nextRetryAt).getTime() > now.getTime());
}

function rememberProviderFailure(symbol: SupportedSymbol, error: unknown, now = new Date()) {
  const previous = providerBackoffBySymbol.get(symbol);
  const failures = (previous?.failures ?? 0) + 1;
  const message = sanitizeWorkerError(error);
  const nextRetryAt = new Date(now.getTime() + nextProviderBackoffMs(failures)).toISOString();
  providerBackoffBySymbol.set(symbol, { failures, nextRetryAt, lastError: message });
  return { failures, nextRetryAt, lastError: message };
}

function rememberProviderSuccess(symbol: SupportedSymbol) {
  providerBackoffBySymbol.delete(symbol);
}

function nextProviderRetryAt() {
  const retryTimes = [...providerBackoffBySymbol.values()].map((item) => item.nextRetryAt);
  return retryTimes.sort()[0] ?? null;
}

export function resetLiveWorkerBackoff() {
  providerBackoffBySymbol.clear();
}

export function getLiveWorkerBackoffStatus() {
  return Object.fromEntries(providerBackoffBySymbol.entries());
}

export async function runLocalMockWorkerTick(input?: {
  continuous?: boolean;
  runtimeMode?: WorkerRuntimeMode;
  workerId?: string;
  workerName?: string;
}): Promise<WorkerTickResult> {
  const rules = await listActiveWorkerRules();
  const grouped = groupActiveRules(rules);
  const eventIds: string[] = [];
  let skippedCooldown = 0;
  let providerErrors = 0;
  let evaluatedSymbols = 0;
  let evaluatedRules = 0;
  let notificationAttempts = 0;
  let lastCandleAt: string | undefined;
  let lastError: string | null = null;

  try {
    const updatedPerformance = await updatePendingPerformance();
    for (const [key, symbolRules] of Object.entries(grouped)) {
      const symbol = key.split(":")[0] as SupportedSymbol;
      const now = new Date();
      if (skippedByProviderBackoff(symbol, now)) {
        providerErrors += 1;
        lastError = `${symbol} provider is in backoff.`;
        continue;
      }

      let current: IndicatorState;
      let previous: IndicatorState;
      try {
        ({ current, previous } = await loadClosedCandleStateWithRetry(marketData, symbol, now));
        rememberProviderSuccess(symbol);
        evaluatedSymbols += 1;
        lastCandleAt = !lastCandleAt || current.timestamp > lastCandleAt ? current.timestamp : lastCandleAt;
      } catch (error) {
        const backoff = rememberProviderFailure(symbol, error, now);
        providerErrors += 1;
        lastError =
          error instanceof Error
            ? `${symbol}: ${error.message}`
            : `${symbol}: Unknown provider error.`;
        if ((error as ProviderDataError | undefined)?.issue === "stale") {
          lastError = `${symbol}: provider data is stale; retrying at ${backoff.nextRetryAt}.`;
        }
        lastError = sanitizeWorkerError(lastError);
        await createProviderErrorLog({
          provider: activeMarketDataProvider,
          symbol,
          context: "worker-tick",
          message: lastError,
        });
        continue;
      }

      for (const rule of symbolRules as WorkerRule[]) {
        evaluatedRules += 1;
        if (rule.marketHoursOnly && !isMarketHours(current.timestamp)) continue;
        if (!evaluateRule(rule, current, previous)) continue;
        if (alreadyTriggeredCandle(rule, current)) continue;
        if (!outsideCooldown(rule, current)) {
          skippedCooldown += 1;
          continue;
        }
        const eventId = await createAlertEvent(rule, current, previewRule(rule));
        if (!eventId) continue;
        notificationAttempts += await sendRuleNotifications(rule, current, eventId);
        eventIds.push(eventId);
      }
    }
    await recordWorkerTickStatus({
      status: input?.continuous ? "running" : "idle",
      mode: workerMode,
      runtimeMode: input?.runtimeMode ?? "in-process",
      workerId: input?.workerId,
      workerName: input?.workerName,
      lastCandleAt,
      symbolsEvaluated: evaluatedSymbols,
      rulesEvaluated: evaluatedRules,
      triggersCreated: eventIds.length,
      cooldownSkips: skippedCooldown,
      providerErrors,
      notificationAttempts,
      isRunning: Boolean(input?.continuous),
      nextRetryAt: nextProviderRetryAt(),
      lastError,
    });
    return {
      evaluatedSymbols,
      evaluatedRules,
      triggeredRules: eventIds.length,
      skippedCooldown,
      updatedPerformance,
      providerErrors,
      notificationAttempts,
      lastCandleAt,
      eventIds,
    };
  } catch (error) {
    await updateWorkerStatus("error", sanitizeWorkerError(error));
    throw error;
  }
}

async function replayCandlesForRules(
  userId: string,
  candlesBySymbol: Map<SupportedSymbol, Candle[]>,
  replayCandles: number,
) {
  const rules = await listActiveWorkerRulesForUser(userId);
  const replaySymbols = new Set(candlesBySymbol.keys());
  const grouped = Object.fromEntries(
    Object.entries(groupActiveRules(rules)).filter(([key]) =>
      replaySymbols.has(key.split(":")[0] as SupportedSymbol),
    ),
  );
  const eventIds: string[] = [];
  const lastTriggeredByRule = new Map(
    rules.map((rule) => [rule.id, rule.lastTriggeredAt] as const),
  );
  let skippedCooldown = 0;
  let evaluatedSymbols = 0;
  let evaluatedRules = 0;

  try {
    const updatedPerformance = await updatePendingPerformance();
    for (const [key, symbolRules] of Object.entries(grouped)) {
      const symbol = key.split(":")[0] as SupportedSymbol;
      const candles = candlesBySymbol.get(symbol) ?? [];
      const states = buildIndicatorStates(candles);
      evaluatedSymbols += 1;

      for (let index = 20; index < states.length; index += 1) {
        const current = states[index];
        const previous = states[index - 1];
        if (!current || !previous) continue;

        for (const rule of symbolRules as WorkerRule[]) {
          evaluatedRules += 1;
          if (rule.marketHoursOnly && !isMarketHours(current.timestamp)) continue;
          if (!evaluateRule(rule, current, previous)) continue;

          const lastTriggeredAt = lastTriggeredByRule.get(rule.id);
          if (
            lastTriggeredAt &&
            minutesBetween(current.timestamp, lastTriggeredAt) < rule.cooldownMinutes * 60_000
          ) {
            skippedCooldown += 1;
            continue;
          }

          const eventId = await createAlertEvent(rule, current, previewRule(rule));
          if (!eventId) continue;
          const performance = calculateAvailablePerformance(candles, {
            triggeredAt: current.timestamp,
            triggerPrice: current.price,
          });
          if (Object.keys(performance).length) await updateAlertPerformance(eventId, performance);
          await sendRuleNotifications(rule, current, eventId);
          eventIds.push(eventId);
          lastTriggeredByRule.set(rule.id, current.timestamp);
        }
      }
    }

    await updateWorkerStatus("idle");
    return {
      evaluatedSymbols,
      evaluatedRules,
      triggeredRules: eventIds.length,
      skippedCooldown,
      updatedPerformance,
      providerErrors: 0,
      notificationAttempts: 0,
      eventIds,
      replayCandles,
    };
  } catch (error) {
    await updateWorkerStatus("error", sanitizeWorkerError(error));
    throw error;
  }
}

export async function runLocalReplay(userId: string, candleCount = 390): Promise<WorkerReplayResult> {
  const rules = await listActiveWorkerRulesForUser(userId);
  const symbols = new Set(rules.map((rule) => rule.symbol));
  const candlesBySymbol = new Map<SupportedSymbol, Candle[]>();
  for (const symbol of symbols) {
    candlesBySymbol.set(symbol, await marketData.getHistoricalCandles(symbol, candleCount));
  }
  return replayCandlesForRules(userId, candlesBySymbol, candleCount);
}

export async function runReplayDataset(userId: string, datasetId: string) {
  const dataset = await getReplayDataset(userId, datasetId);
  if (!dataset) throw new Error("Replay dataset not found.");
  return replayCandlesForRules(
    userId,
    new Map([[dataset.symbol, dataset.candles]]),
    dataset.candleCount,
  );
}
