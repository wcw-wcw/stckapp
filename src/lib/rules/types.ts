export const SUPPORTED_SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "AAPL",
  "NVDA",
  "TSLA",
  "AMD",
  "MSFT",
] as const;

export const INDICATORS = [
  "price",
  "volume",
  "vwap",
  "ema_9",
  "ema_20",
  "previous_day_high",
  "previous_day_low",
  "opening_range_high",
  "opening_range_low",
  "premarket_high",
  "premarket_low",
  "high_of_day",
  "low_of_day",
  "average_volume",
] as const;

export const OPERATORS = [
  "crosses_above",
  "crosses_below",
  ">",
  "<",
  ">=",
  "<=",
  "touches",
  "within_percent",
  "breaks_above",
  "breaks_below",
] as const;

export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];
export type Indicator = (typeof INDICATORS)[number];
export type RuleOperator = (typeof OPERATORS)[number];

export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type RuleCondition = {
  left: Indicator;
  operator: RuleOperator;
  right: Indicator;
  params?: {
    multiplier?: number;
    percent?: number;
    lookback?: number;
  };
};

export type AlertRule = {
  name: string;
  symbol: SupportedSymbol;
  timeframe: "1m";
  logic: "AND";
  conditions: RuleCondition[];
  timeFilter?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  cooldownMinutes: number;
  smsEnabled: boolean;
  isActive: boolean;
  marketHoursOnly: boolean;
};

export type IndicatorState = Record<Indicator, number> & {
  timestamp: string;
};

export type ForwardStat = {
  averageMove: number;
  percentPositive: number;
};

export type BacktestResult = {
  triggerCount: number;
  warning?: string;
  forward: Record<"5" | "15" | "30" | "60", ForwardStat>;
  averageMaxFavorableMove: number;
  averageMaxAdverseMove: number;
  bestResult: number;
  worstResult: number;
  bestTimeOfDay: string | null;
  worstTimeOfDay: string | null;
};
