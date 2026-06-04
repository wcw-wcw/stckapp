import { buildIndicatorStates } from "@/lib/market/indicators";
import type { MarketDataService } from "@/lib/market/types";
import { evaluateRule } from "@/lib/rules/evaluate";
import type { AlertRule, IndicatorState, RuleEvaluationContext, SupportedSymbol } from "@/lib/rules/types";

export type RuleMatch = {
  rule: AlertRule;
  triggerPrice: number;
  triggeredAt: string;
};

export type ClosedCandleState = {
  current: IndicatorState;
  previous: IndicatorState;
};

export type ProviderDataIssue = "empty" | "insufficient" | "stale" | "failed";

export class ProviderDataError extends Error {
  readonly issue: ProviderDataIssue;

  constructor(issue: ProviderDataIssue, message: string) {
    super(message);
    this.name = "ProviderDataError";
    this.issue = issue;
  }
}

export const liveWorkerConfig = {
  candleLookback: 80,
  maxMarketHoursLagMinutes: 3,
  retryAttempts: 3,
  retryDelayMs: 250,
  maxBackoffMs: 60_000,
};

export function groupActiveRules(rules: AlertRule[]) {
  return rules
    .filter((rule) => rule.isActive)
    .reduce<Record<string, AlertRule[]>>((groups, rule) => {
      const key = `${rule.symbol}:${rule.timeframe}`;
      groups[key] = [...(groups[key] ?? []), rule];
      return groups;
    }, {});
}

function isMarketHours(timestamp: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function outsideCooldown(
  rule: { lastTriggeredAt?: string | null; cooldownMinutes: number },
  state: IndicatorState,
) {
  if (!rule.lastTriggeredAt) return true;
  return (
    new Date(state.timestamp).getTime() - new Date(rule.lastTriggeredAt).getTime() >=
    rule.cooldownMinutes * 60_000
  );
}

export function alreadyTriggeredCandle(
  rule: { lastTriggeredAt?: string | null },
  state: IndicatorState,
) {
  return Boolean(rule.lastTriggeredAt && rule.lastTriggeredAt === state.timestamp);
}

export function selectClosedCandleState(
  states: IndicatorState[],
  now = new Date(),
): ClosedCandleState | null {
  const closedBefore = now.getTime() - 60_000;
  const currentIndex = states.findLastIndex(
    (state) => new Date(state.timestamp).getTime() <= closedBefore,
  );
  if (currentIndex < 1) return null;
  return {
    current: states[currentIndex],
    previous: states[currentIndex - 1],
  };
}

export function isProviderCandleStale(
  latestCandleAt: string,
  now = new Date(),
  maxLagMinutes = liveWorkerConfig.maxMarketHoursLagMinutes,
) {
  if (!isMarketHours(now.toISOString())) return false;
  const lagMs = now.getTime() - new Date(latestCandleAt).getTime();
  return lagMs > maxLagMinutes * 60_000;
}

export function nextProviderBackoffMs(failureCount: number) {
  return Math.min(
    liveWorkerConfig.maxBackoffMs,
    liveWorkerConfig.retryDelayMs * 2 ** Math.max(failureCount - 1, 0),
  );
}

export async function waitForProviderRetry(delayMs: number) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function loadClosedCandleState(
  marketData: MarketDataService,
  symbol: SupportedSymbol,
  now = new Date(),
): Promise<ClosedCandleState> {
  const candles = await marketData.getHistoricalCandles(symbol, liveWorkerConfig.candleLookback);
  if (!candles.length) {
    throw new ProviderDataError("empty", `${symbol} returned no candles.`);
  }

  const states = buildIndicatorStates(candles);
  const closed = selectClosedCandleState(states, now);
  if (!closed) {
    throw new ProviderDataError("insufficient", `${symbol} did not return enough closed candles.`);
  }
  if (isProviderCandleStale(closed.current.timestamp, now)) {
    throw new ProviderDataError("stale", `${symbol} latest candle is stale.`);
  }

  return closed;
}

export async function loadClosedCandleStateWithRetry(
  marketData: MarketDataService,
  symbol: SupportedSymbol,
  now = new Date(),
  wait = waitForProviderRetry,
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= liveWorkerConfig.retryAttempts; attempt += 1) {
    try {
      return await loadClosedCandleState(marketData, symbol, now);
    } catch (error) {
      lastError = error;
      if (attempt < liveWorkerConfig.retryAttempts) {
        await wait(nextProviderBackoffMs(attempt));
      }
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new ProviderDataError("failed", `${symbol} provider request failed.`);
}

export async function evaluateSymbolOnce(
  marketData: MarketDataService,
  symbol: SupportedSymbol,
  rules: AlertRule[],
  contexts?: Map<AlertRule, RuleEvaluationContext>,
) {
  const { current, previous } = await loadClosedCandleState(marketData, symbol);

  return rules
    .filter((rule) => rule.symbol === symbol && rule.isActive)
    .filter((rule) => evaluateRule(rule, current, previous, contexts?.get(rule)))
    .map<RuleMatch>((rule) => ({
      rule,
      triggerPrice: current.price,
      triggeredAt: current.timestamp,
    }));
}
