"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartBar, ChartInterval, ChartRange } from "@/lib/market/types";
import type { SupportedSymbol } from "@/lib/rules/types";

type BarsResponse = {
  bars: ChartBar[];
  meta: {
    provider: string;
    activeProvider: string;
    feed?: string;
    requestedRange: ChartRange;
    requestedInterval: ChartInterval;
    firstBarTime: string | null;
    lastBarTime: string | null;
    barCount: number;
    warning?: string;
  };
};

const ranges: ChartRange[] = ["1D", "5D", "1M"];
const intervals: ChartInterval[] = ["1m", "5m", "15m", "1h"];

const formatDateTime = (timestamp: string | null) => {
  if (!timestamp) return "n/a";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
};

const toSeriesData = (bar: ChartBar) => ({
  time: Math.floor(new Date(bar.time).getTime() / 1000) as UTCTimestamp,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
});

export function SymbolChart({ symbol }: { symbol: SupportedSymbol }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [range, setRange] = useState<ChartRange>("1D");
  const [interval, setInterval] = useState<ChartInterval>("1m");
  const [data, setData] = useState<BarsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "#141414" },
        textColor: "#989491",
      },
      grid: {
        horzLines: { color: "rgba(255, 255, 255, 0.06)" },
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        rightOffset: 8,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#68c994",
      borderUpColor: "#68c994",
      wickUpColor: "#68c994",
      downColor: "#ef6948",
      borderDownColor: "#ef6948",
      wickDownColor: "#ef6948",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    async function loadBars() {
      try {
        const response = await fetch(`/api/market/bars/${symbol}?range=${range}&interval=${interval}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as BarsResponse | { error?: string };
        if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "Chart bars failed to load.");

        const nextData = payload as BarsResponse;
        setData(nextData);
        setStatus(nextData.bars.length ? "ready" : "empty");
        seriesRef.current?.setData(nextData.bars.map(toSeriesData));
        chartRef.current?.timeScale().fitContent();
      } catch (caught) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : "Chart bars failed to load.");
        seriesRef.current?.setData([]);
      }
    }

    loadBars();
    return () => controller.abort();
  }, [interval, range, symbol]);

  return (
    <div className="symbol-chart">
      <div className="chart-toolbar" aria-label={`${symbol} chart controls`}>
        <div className="chart-control-group" role="group" aria-label="Range">
          {ranges.map((option) => (
            <button
              aria-pressed={range === option}
              className={range === option ? "chart-control active" : "chart-control"}
              key={option}
              onClick={() => setRange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
        <div className="chart-control-group" role="group" aria-label="Interval">
          {intervals.map((option) => (
            <button
              aria-pressed={interval === option}
              className={interval === option ? "chart-control active" : "chart-control"}
              key={option}
              onClick={() => setInterval(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-canvas-wrap">
        <div className="chart-canvas" ref={containerRef} />
        {status === "loading" && <div className="chart-overlay">Loading bars...</div>}
        {status === "error" && <div className="chart-overlay chart-overlay-error">{error}</div>}
        {status === "empty" && <div className="chart-overlay">No bars returned for this range.</div>}
      </div>
      <div className="chart-meta-row">
        <span>Latest {formatDateTime(data?.meta.lastBarTime ?? null)}</span>
        <span>{data?.meta.activeProvider ?? "provider"}{data?.meta.feed ? `/${data.meta.feed}` : ""}</span>
        <span>{data?.meta.requestedRange ?? range} / {data?.meta.requestedInterval ?? interval}</span>
        <span>{data?.meta.barCount ?? 0} bars</span>
      </div>
      {data?.meta.warning && <p className="notice chart-warning">{data.meta.warning}</p>}
    </div>
  );
}
