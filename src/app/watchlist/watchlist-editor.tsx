"use client";

import Link from "next/link";
import { useState } from "react";
import { SUPPORTED_SYMBOLS, type SupportedSymbol } from "@/lib/rules/types";

export function WatchlistEditor({ initialSymbols }: { initialSymbols: SupportedSymbol[] }) {
  const [symbols, setSymbols] = useState(initialSymbols);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string>();
  const normalizedSearch = search.trim().toUpperCase();
  const visibleSymbols = SUPPORTED_SYMBOLS.filter((symbol) => symbol.includes(normalizedSearch));

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
      <div className="watchlist-search">
        <input
          aria-label="Search supported symbols"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search symbols"
          type="search"
          value={search}
        />
        <span className="small">{visibleSymbols.length} shown</span>
      </div>
      <div className="watchlist-grid">
        {visibleSymbols.map((symbol) => {
          const selected = symbols.includes(symbol);
          return (
            <div className={`watchlist-option ${selected ? "watchlist-selected" : ""}`} key={symbol}>
              <strong>{symbol}</strong>
              <div className="watchlist-tile-actions">
                {selected ? <Link href={`/symbols/${symbol}`}>View chart</Link> : <span />}
                <button onClick={() => update(symbol)} type="button">{selected ? "Remove" : "Add symbol"}</button>
              </div>
            </div>
          );
        })}
      </div>
      {visibleSymbols.length === 0 && <p className="empty-state">No supported symbols match that search.</p>}
      {error && <p className="notice" style={{ marginTop: "0.8rem" }}>{error}</p>}
    </section>
  );
}
