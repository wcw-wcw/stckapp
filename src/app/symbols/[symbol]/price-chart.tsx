"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import type { Candle, SupportedSymbol } from "@/lib/rules/types";

const WIDTH = 1000;
const HEIGHT = 320;
const LEFT_PAD = 58;
const RIGHT_PAD = 58;
const TOP_PAD = 16;
const BOTTOM_PAD = 34;

const timeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

const detailTimeLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });

const tickIndexes = (length: number, count: number) => {
  const tickCount = Math.min(length, count);
  return Array.from({ length: tickCount }, (_, index) =>
    Math.round((index / Math.max(tickCount - 1, 1)) * Math.max(length - 1, 0)),
  );
};

export function PriceChart({ candles, symbol }: { candles: Candle[]; symbol: SupportedSymbol }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const lows = candles.map((candle) => candle.low);
  const highs = candles.map((candle) => candle.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = Math.max(max - min, 0.01);
  const plotWidth = WIDTH - LEFT_PAD - RIGHT_PAD;
  const plotHeight = HEIGHT - TOP_PAD - BOTTOM_PAD;
  const x = (index: number) => LEFT_PAD + (index / Math.max(candles.length - 1, 1)) * plotWidth;
  const y = (price: number) => TOP_PAD + (1 - (price - min) / range) * plotHeight;
  const candleWidth = Math.max(2, Math.min(7, (plotWidth / Math.max(candles.length, 1)) * 0.62));
  const points = candles.map((candle, index) => `${x(index)},${y(candle.close)}`).join(" ");
  const area = `${LEFT_PAD},${HEIGHT - BOTTOM_PAD} ${points} ${WIDTH - RIGHT_PAD},${HEIGHT - BOTTOM_PAD}`;
  const priceTicks = [max, min + range * 0.75, min + range * 0.5, min + range * 0.25, min];
  const timeTicks = tickIndexes(candles.length, 5);
  const hoverCandle = hoverIndex === null ? null : candles[hoverIndex];
  const hoverX = hoverIndex === null ? null : x(hoverIndex);
  const tooltipX = hoverX === null ? 0 : Math.min(Math.max(hoverX + 14, LEFT_PAD), WIDTH - RIGHT_PAD - 178);
  const tooltipY =
    hoverCandle === null ? 0 : Math.min(Math.max(y(hoverCandle.high) - 12, TOP_PAD + 4), HEIGHT - BOTTOM_PAD - 104);

  function updateHover(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const cursorX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (cursorX - LEFT_PAD) / plotWidth;
    const index = Math.round(ratio * Math.max(candles.length - 1, 0));
    setHoverIndex(Math.min(Math.max(index, 0), candles.length - 1));
  }

  return (
    <div className="price-chart">
      <svg
        aria-label={`${symbol} price chart with candles and close line`}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={updateHover}
        role="img"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef6948" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#ef6948" stopOpacity="0" />
          </linearGradient>
        </defs>
        {priceTicks.map((price) => (
          <g key={price}>
            <line className="chart-gridline" x1={LEFT_PAD} x2={WIDTH - RIGHT_PAD} y1={y(price)} y2={y(price)} />
            <text className="chart-y-label" x={WIDTH - RIGHT_PAD + 8} y={y(price) + 4}>${price.toFixed(2)}</text>
          </g>
        ))}
        {timeTicks.map((index) => (
          <g key={candles[index]?.timestamp ?? index}>
            <line className="chart-x-tick" x1={x(index)} x2={x(index)} y1={HEIGHT - BOTTOM_PAD} y2={HEIGHT - BOTTOM_PAD + 5} />
            <text className="chart-x-label" textAnchor="middle" x={x(index)} y={HEIGHT - 10}>
              {timeLabel(candles[index]?.timestamp ?? "")}
            </text>
          </g>
        ))}
        <polygon fill="url(#chart-fill)" points={area} />
        {candles.map((candle, index) => {
          const center = x(index);
          const isUp = candle.close >= candle.open;
          const openY = y(candle.open);
          const closeY = y(candle.close);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(openY - closeY), 1.5);
          return (
            <g className={isUp ? "chart-candle chart-candle-up" : "chart-candle chart-candle-down"} key={candle.timestamp}>
              <line x1={center} x2={center} y1={y(candle.high)} y2={y(candle.low)} />
              <rect
                height={bodyHeight}
                rx="1"
                width={candleWidth}
                x={center - candleWidth / 2}
                y={bodyTop}
              />
            </g>
          );
        })}
        <polyline className="chart-line" fill="none" points={points} />
        {hoverCandle && hoverX !== null && (
          <g className="chart-hover">
            <line className="chart-crosshair" x1={hoverX} x2={hoverX} y1={TOP_PAD} y2={HEIGHT - BOTTOM_PAD} />
            <circle cx={hoverX} cy={y(hoverCandle.close)} r="4" />
            <rect height="100" rx="8" width="178" x={tooltipX} y={tooltipY} />
            <text x={tooltipX + 10} y={tooltipY + 19}>{detailTimeLabel(hoverCandle.timestamp)}</text>
            <text x={tooltipX + 10} y={tooltipY + 38}>O ${hoverCandle.open.toFixed(2)} · H ${hoverCandle.high.toFixed(2)}</text>
            <text x={tooltipX + 10} y={tooltipY + 57}>L ${hoverCandle.low.toFixed(2)} · C ${hoverCandle.close.toFixed(2)}</text>
            <text x={tooltipX + 10} y={tooltipY + 76}>Vol {Math.round(hoverCandle.volume).toLocaleString()}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
