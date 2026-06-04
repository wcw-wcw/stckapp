import { NextResponse } from "next/server";
import { z } from "zod";
import { buildChartBarsWarning, CHART_INTERVALS, CHART_RANGES } from "@/lib/market/chart-bars";
import { activeMarketDataProvider, marketData, marketDataProviderMode } from "@/lib/market/provider";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";

const querySchema = z.object({
  range: z.enum(CHART_RANGES).default("1D"),
  interval: z.enum(CHART_INTERVALS).default("1m"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const symbol = (await params).symbol.toUpperCase();
  if (!SUPPORTED_SYMBOLS.includes(symbol as SupportedSymbol)) {
    return NextResponse.json({ error: "Unsupported symbol." }, { status: 404 });
  }

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) {
    return NextResponse.json(
      {
        error: "Unsupported chart range or interval.",
        supportedRanges: CHART_RANGES,
        supportedIntervals: CHART_INTERVALS,
      },
      { status: 400 },
    );
  }

  const result = await marketData.getChartBars(symbol as SupportedSymbol, query.data);
  const firstBar = result.bars.at(0);
  const lastBar = result.bars.at(-1);
  const warning = buildChartBarsWarning({
    provider: activeMarketDataProvider,
    symbol: symbol as SupportedSymbol,
    bars: result.bars,
    range: query.data.range,
    interval: query.data.interval,
    providerWarning: result.warning,
  });

  return NextResponse.json({
    bars: result.bars,
    meta: {
      provider: marketDataProviderMode.configuredProvider,
      activeProvider: marketDataProviderMode.activeProvider,
      feed: marketDataProviderMode.feed,
      fallbackReason: marketDataProviderMode.fallbackReason,
      requestedRange: query.data.range,
      requestedInterval: query.data.interval,
      firstBarTime: firstBar?.time ?? null,
      lastBarTime: lastBar?.time ?? null,
      barCount: result.bars.length,
      warning,
    },
  });
}
