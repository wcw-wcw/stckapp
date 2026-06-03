import type { AlertRule, BacktestResult, SupportedSymbol } from "@/lib/rules/types";

export type SuggestedRuleCandidate = {
  id: string;
  symbol: SupportedSymbol;
  rule: AlertRule;
  stats: BacktestResult;
  score: number;
  source: "historical_scan" | "curated_template";
  sampleSize: number;
  generatedAt: string;
  expiresAt?: string;
};

export interface SuggestedRuleService {
  listCandidates(symbol?: SupportedSymbol): Promise<SuggestedRuleCandidate[]>;
}

// Future ranking should scan a bounded catalog of structured rule templates,
// backtest them without lookahead bias, reject small samples, and persist only
// ranked summaries. The live worker should never generate candidate rules.
