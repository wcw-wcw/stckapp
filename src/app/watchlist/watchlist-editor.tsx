"use client";

import Link from "next/link";
import { useState } from "react";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";

export function WatchlistEditor({ initialSymbols }: { initialSymbols: SupportedSymbol[] }) {
  const [symbols, setSymbols] = useState(initialSymbols);
  const [error, setError] = useState<string>();

  async function update(symbol: SupportedSymbol) {
    setError(undefined);
    const selected = symbols.includes(symbol);
    const response = await fetch(selected ? `/api/watchlist/${symbol}` : "/api/watchlist", {
      method: selected ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: selected ? undefined : JSON.stringify({ symbol }),
    });
    if (!response.ok) {
      setError("Could not update the watchlist.");
      return;
    }
    setSymbols((current) =>
      selected ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  }

  return (
    <section className="card">
      <div className="card-header"><h2>Supported symbols</h2><span className="small">{symbols.length} selected</span></div>
      <div className="watchlist-grid">
        {SUPPORTED_SYMBOLS.map((symbol) => {
          const selected = symbols.includes(symbol);
          return (
            <div className={`watchlist-option ${selected ? "watchlist-selected" : ""}`} key={symbol}>
              <strong>{symbol}</strong>
              <button onClick={() => update(symbol)}>{selected ? "Remove" : "Add symbol"}</button>
              {selected && <Link href={`/symbols/${symbol}`}>View chart</Link>}
            </div>
          );
        })}
      </div>
      {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
    </section>
  );
}
