import type { Candle, SupportedSymbol } from "@/lib/rules/types";
import type { MarketStatus } from "./types";

export function isUsMarketHours(timestamp: string) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
    timeZone: "America/New_York",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  if (weekday === "Sat" || weekday === "Sun") return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 9 * 60 + 30 && totalMinutes <= 16 * 60;
}

export function buildMarketStatus(input: {
  mode: MarketStatus["mode"];
  provider: MarketStatus["provider"];
  feed?: string;
  latestCandle?: Candle;
  referenceSymbol?: SupportedSymbol;
  warning?: string;
}) {
  const now = new Date();
  const latestBarAt = input.latestCandle?.timestamp;
  const lagMinutes = latestBarAt
    ? Math.max(0, Math.round((now.getTime() - new Date(latestBarAt).getTime()) / 60_000))
    : undefined;
  const marketOpen = isUsMarketHours(now.toISOString());

  let health: MarketStatus["health"] = "ok";
  let warning = input.warning;

  if (!latestBarAt) {
    health = "degraded";
    warning ??= "No latest reference bar is available from the provider.";
  } else if (marketOpen && lagMinutes !== undefined && lagMinutes > 20) {
    health = "stale";
    warning ??= `Latest ${input.referenceSymbol ?? "reference"} bar is ${lagMinutes} minutes old during market hours.`;
  } else if (!marketOpen && lagMinutes !== undefined && lagMinutes > 20) {
    warning ??= "Market is outside regular hours; latest intraday bar may be from the prior session close.";
  }

  return {
    mode: input.mode,
    provider: input.provider,
    feed: input.feed,
    lastUpdateAt: now.toISOString(),
    latestBarAt,
    lagMinutes,
    referenceSymbol: input.referenceSymbol,
    health,
    warning,
  } satisfies MarketStatus;
}
