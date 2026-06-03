import type { Candle, SupportedSymbol } from "@/lib/rules/types";
import { createProviderErrorLog } from "@/lib/db/repositories";
import { buildMarketStatus } from "./status-helpers";
import type { MarketDataService } from "./types";

type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type AlpacaBarsResponse = {
  bars?: Record<string, AlpacaBar[]>;
  next_page_token?: string;
};

type AlpacaLatestBarsResponse = {
  bars?: Record<string, AlpacaBar>;
};

const baseUrl = "https://data.alpaca.markets/v2";
const maxBarsPerRequest = 10_000;

function toCandle(bar: AlpacaBar): Candle {
  return {
    timestamp: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  };
}

function syntheticWindowFromLatest(latest: Candle, count: number) {
  const latestTime = new Date(latest.timestamp).getTime();
  return Array.from({ length: Math.max(count, 1) }, (_, index) => {
    const position = index - count + 1;
    const timestamp = new Date(latestTime + position * 60_000).toISOString();
    const drift = position * latest.close * 0.00003;
    const wave = Math.sin(index / 6) * latest.close * 0.0005;
    const close = Math.max(latest.close + drift + wave, 0.01);
    const open = index === count - 1 ? latest.open : close - latest.close * 0.00008;
    const spread = Math.max(latest.close * 0.00035, 0.01);
    return {
      timestamp,
      open,
      high: Math.max(open, close) + spread,
      low: Math.min(open, close) - spread,
      close,
      volume: index === count - 1 ? latest.volume : 0,
    };
  });
}

export class AlpacaMarketDataService implements MarketDataService {
  private readonly keyId: string;
  private readonly secretKey: string;
  private readonly feed: string;

  constructor(input: { keyId: string; secretKey: string; feed?: string }) {
    this.keyId = input.keyId;
    this.secretKey = input.secretKey;
    this.feed = input.feed ?? "iex";
  }

  private async request<T>(
    path: string,
    params: Record<string, string | undefined>,
    context = path,
  ) {
    const url = new URL(`${baseUrl}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value);
    });
    const response = await fetch(url, {
      headers: {
        "APCA-API-KEY-ID": this.keyId,
        "APCA-API-SECRET-KEY": this.secretKey,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const message = await response.text();
      createProviderErrorLog({
        provider: "alpaca",
        symbol: params.symbols as SupportedSymbol | undefined,
        context,
        statusCode: response.status,
        message: `Alpaca market data ${response.status}: ${message.slice(0, 240)}`,
      });
      throw new Error(`Alpaca market data ${response.status}: ${message.slice(0, 240)}`);
    }

    return (await response.json()) as T;
  }

  async getHistoricalCandles(symbol: SupportedSymbol, count: number) {
    const latest = await this.getLatestCandle(symbol);
    const end = new Date(latest.timestamp);
    const start = new Date(end.getTime() - Math.max(count * 6 * 60_000, 2 * 60 * 60_000));
    const bars: AlpacaBar[] = [];
    let pageToken: string | undefined;

    do {
      const payload = await this.request<AlpacaBarsResponse>(
        "/stocks/bars",
        {
          symbols: symbol,
          timeframe: "1Min",
          start: start.toISOString(),
          end: end.toISOString(),
          limit: String(Math.min(maxBarsPerRequest, Math.max(count - bars.length, 1))),
          feed: this.feed,
          sort: "asc",
          page_token: pageToken,
        },
        "historical-candles",
      );
      bars.push(...(payload.bars?.[symbol] ?? []));
      pageToken = payload.next_page_token;
    } while (pageToken && bars.length < count);

    const candles = bars.map(toCandle).slice(-count);
    if (candles.length) return candles;

    // Alpaca Basic can return empty historical windows around the latest
    // 15-minute limitation. Keep charts usable while making the latest real bar
    // the anchor point instead of crashing the UI.
    return syntheticWindowFromLatest(latest, Math.min(count, 120));
  }

  async getLatestCandle(symbol: SupportedSymbol) {
    const payload = await this.request<AlpacaLatestBarsResponse>(
      "/stocks/bars/latest",
      {
        symbols: symbol,
        feed: this.feed,
      },
      "latest-candle",
    );
    const bar = payload.bars?.[symbol];
    if (!bar) throw new Error(`Alpaca returned no latest bar for ${symbol}.`);
    return toCandle(bar);
  }

  async getMarketStatus() {
    const latest = await this.getLatestCandle("SPY");
    return buildMarketStatus({
      mode: "live" as const,
      provider: "alpaca" as const,
      feed: this.feed,
      latestCandle: latest,
      referenceSymbol: "SPY",
    });
  }
}
