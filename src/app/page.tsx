"use client";

import { useState, FormEvent } from "react";

interface StockData {
  companyName: string;
  ticker: string;
  currentPrice: number | null;
  currency: string;
  peRatio: number | null;
  forwardPE: number | null;
  marketCap: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  revenue: number | null;
  netIncome: number | null;
  profitMargin: number | null;
  roic: number | null;
}

function formatCurrency(value: number | null, compact = false): string {
  if (value === null || value === undefined) return "\u2014";
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "\u2014";
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || value === undefined) return "\u2014";
  return value.toFixed(2);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-mono font-medium text-zinc-100">
        {value}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = ticker.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(
        `/api/stock?ticker=${encodeURIComponent(trimmed)}`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch data");
      }

      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-800/60">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-50">
            Buffett Analyzer
          </h1>
        </div>
      </header>

      {/* Search */}
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-2">
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="Ticker symbol (e.g. KO)"
            spellCheck={false}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !ticker.trim()}
            className="rounded-lg bg-zinc-100 px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Search"}
          </button>
        </form>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-zinc-500">
            <svg
              className="mr-3 h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm">Fetching data...</span>
          </div>
        )}

        {/* Stock Data */}
        {data && (
          <div>
            {/* Company header */}
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-zinc-50">
                  {data.companyName}
                </h2>
                <p className="mt-1 font-mono text-sm text-zinc-500">
                  {data.ticker}
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-mono font-semibold tabular-nums text-zinc-50">
                  {formatCurrency(data.currentPrice)}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{data.currency}</p>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="P/E Ratio (TTM)"
                value={formatNumber(data.peRatio)}
              />
              <MetricCard
                label="Forward P/E"
                value={formatNumber(data.forwardPE)}
              />
              <MetricCard
                label="Market Cap"
                value={formatCurrency(data.marketCap, true)}
              />
              <MetricCard
                label="52-Week Range"
                value={
                  data.fiftyTwoWeekLow !== null &&
                  data.fiftyTwoWeekHigh !== null
                    ? `${formatCurrency(data.fiftyTwoWeekLow)} \u2013 ${formatCurrency(data.fiftyTwoWeekHigh)}`
                    : "\u2014"
                }
              />
              <MetricCard
                label="Revenue (TTM)"
                value={formatCurrency(data.revenue, true)}
              />
              <MetricCard
                label="Net Income (TTM)"
                value={formatCurrency(data.netIncome, true)}
              />
              <MetricCard
                label="Profit Margin"
                value={formatPercent(data.profitMargin)}
              />
              <MetricCard
                label="ROIC"
                value={data.roic !== null ? formatPercent(data.roic) : "\u2014"}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-zinc-500">
              Search for a ticker to view fundamentals
            </p>
            <p className="mt-2 text-xs text-zinc-700">
              Try KO, AAPL, BRK-B, MSFT, JNJ
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
