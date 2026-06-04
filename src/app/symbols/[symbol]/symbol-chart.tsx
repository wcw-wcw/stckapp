"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import type { ChartBar, ChartInterval, ChartRange } from "@/lib/market/types";
import type { SupportedSymbol } from "@/lib/rules/types";
import type { SavedSymbolLevel } from "@/lib/symbol-levels";

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

const formatPrice = (value: number | null | undefined) =>
  typeof value === "number" ? `$${value.toFixed(2)}` : "n/a";

const formatVolume = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString("en-US") : "n/a";

const toSeriesData = (bar: ChartBar) => ({
  time: Math.floor(new Date(bar.time).getTime() / 1000) as UTCTimestamp,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
});

const toVolumeData = (bar: ChartBar) => ({
  time: Math.floor(new Date(bar.time).getTime() / 1000) as UTCTimestamp,
  value: bar.volume,
  color: bar.close >= bar.open ? "rgba(104, 201, 148, 0.28)" : "rgba(239, 105, 72, 0.28)",
});

const priceLineColor = (level: SavedSymbolLevel) => {
  if (level.isExpired) return "rgba(152, 148, 145, 0.5)";
  if (level.levelType === "support") return "#68c994";
  if (level.levelType === "resistance") return "#ef6948";
  if (level.levelType === "watch") return "#ed9a63";
  return "#989491";
};

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

export function SymbolChart({ symbol }: { symbol: SupportedSymbol }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const barsRef = useRef<ChartBar[]>([]);
  const [range, setRange] = useState<ChartRange>("1D");
  const [interval, setInterval] = useState<ChartInterval>("1m");
  const [data, setData] = useState<BarsResponse | null>(null);
  const [hoveredBar, setHoveredBar] = useState<ChartBar | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  const detailBar = hoveredBar ?? data?.bars.at(-1) ?? null;

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
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(152, 148, 145, 0.24)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
      borderVisible: false,
    });

    const onCrosshairMove = (param: MouseEventParams) => {
      const item = param.seriesData.get(series) as
        | { time: UTCTimestamp; open: number; high: number; low: number; close: number }
        | undefined;
      if (!item) {
        setHoveredBar(null);
        return;
      }
      const matched = barsRef.current.find((bar) => Math.floor(new Date(bar.time).getTime() / 1000) === item.time);
      setHoveredBar(matched ?? null);
    };
    chart.subscribeCrosshairMove(onCrosshairMove);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      priceLinesRef.current = [];
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    setHoveredBar(null);

    async function loadBars() {
      try {
        const response = await fetch(`/api/market/bars/${symbol}?range=${range}&interval=${interval}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as BarsResponse | { error?: string };
        if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "Chart bars failed to load.");

        const nextData = payload as BarsResponse;
        barsRef.current = nextData.bars;
        setData(nextData);
        setStatus(nextData.bars.length ? "ready" : "empty");
        seriesRef.current?.setData(nextData.bars.map(toSeriesData));
        volumeSeriesRef.current?.setData(nextData.bars.map(toVolumeData));
        chartRef.current?.timeScale().fitContent();
      } catch (caught) {
        if (controller.signal.aborted) return;
        setStatus("error");
        setError("Chart bars failed to load.");
        barsRef.current = [];
        setData(null);
        setHoveredBar(null);
        seriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
      }
    }

    loadBars();
    return () => controller.abort();
  }, [interval, range, symbol]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLevels() {
      try {
        const response = await fetch(`/api/symbol-levels?symbol=${symbol}`, { signal: controller.signal });
        const payload = await readJson<{ levels?: SavedSymbolLevel[] }>(response);
        if (!response.ok) return;
        const series = seriesRef.current;
        if (!series) return;
        priceLinesRef.current.forEach((line) => series.removePriceLine(line));
        priceLinesRef.current = (payload?.levels ?? []).map((level) =>
          series.createPriceLine({
            price: level.price,
            color: priceLineColor(level),
            lineWidth: level.isExpired ? 1 : 2,
            lineStyle: level.isExpired ? LineStyle.Dotted : LineStyle.Solid,
            axisLabelVisible: true,
            title: `${level.name}${level.isExpired ? " (expired)" : ""}`,
          }),
        );
      } catch {
        if (!controller.signal.aborted) {
          priceLinesRef.current.forEach((line) => seriesRef.current?.removePriceLine(line));
          priceLinesRef.current = [];
        }
      }
    }

    loadLevels();
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string }>).detail;
      if (!detail?.symbol || detail.symbol === symbol) loadLevels();
    };
    window.addEventListener("signaldesk:symbol-levels-changed", onChanged);
    return () => {
      controller.abort();
      window.removeEventListener("signaldesk:symbol-levels-changed", onChanged);
      priceLinesRef.current.forEach((line) => seriesRef.current?.removePriceLine(line));
      priceLinesRef.current = [];
    };
  }, [symbol]);

  return (
    <div className="symbol-chart">
      <div className="chart-current-bar" aria-live="polite">
        <span className="small">Latest bar: {formatDateTime(data?.meta.lastBarTime ?? null)}</span>
      </div>
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
        <button className="chart-control chart-control-standalone" onClick={() => chartRef.current?.timeScale().fitContent()} type="button">
          Fit
        </button>
      </div>
      <div className="chart-canvas-wrap">
        <div className="chart-legend" aria-live="polite">
          <span>{formatDateTime(detailBar?.time ?? null)}</span>
          <span>O {formatPrice(detailBar?.open)}</span>
          <span>H {formatPrice(detailBar?.high)}</span>
          <span>L {formatPrice(detailBar?.low)}</span>
          <span>C {formatPrice(detailBar?.close)}</span>
          <span>V {formatVolume(detailBar?.volume)}</span>
        </div>
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
