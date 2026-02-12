"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";

// --- Types ---

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
  businessSummary: string | null;
}

interface StepResult {
  passed: boolean | null;
  notes: string;
}

interface Step1Analysis {
  characteristics: string[];
  summary: string;
  verdict: "simple" | "complex";
}

// --- Formatters ---

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

// --- Hardcoded ticker tape data ---

const tickerTape = [
  { symbol: "S&P 500", value: "6,012.34", change: "+0.42%", up: true },
  { symbol: "NASDAQ", value: "19,234.56", change: "-0.18%", up: false },
  { symbol: "DOW", value: "43,891.02", change: "+0.31%", up: true },
  { symbol: "10Y UST", value: "4.28%", change: "+0.03", up: false },
  { symbol: "VIX", value: "14.32", change: "-1.21%", up: true },
  { symbol: "BTC", value: "97,412.00", change: "+2.14%", up: true },
  { symbol: "GOLD", value: "2,934.50", change: "+0.08%", up: true },
  { symbol: "OIL", value: "71.23", change: "-0.54%", up: false },
];

// --- Placeholder headlines ---

const headlines = [
  { time: "2m ago", cat: "FED", title: "Fed holds rates steady, signals patience on cuts" },
  { time: "18m ago", cat: "EARNINGS", title: "NVDA beats Q4 estimates, guides higher on AI demand" },
  { time: "34m ago", cat: "MACRO", title: "January CPI comes in at 2.9%, below expectations" },
  { time: "1h ago", cat: "M&A", title: "Broadcom nears $15B deal for cloud infrastructure firm" },
  { time: "2h ago", cat: "BONDS", title: "10Y yield rises to 4.28% as traders digest labor data" },
  { time: "3h ago", cat: "GLOBAL", title: "ECB officials signal April rate cut increasingly likely" },
];

// --- Kill Chain Step Config ---

const STEP_HEADINGS = [
  "Can you explain how this company makes money?",
  "Does this company have a durable competitive advantage?",
  "Do you trust management with your capital?",
  "Is the price attractive?",
];

const STEP_PROMPTS = [
  "Write your understanding of the business",
  "Describe the moat \u2014 what stops competitors?",
  "What gives you confidence (or concern) about management?",
  "What's your thesis on valuation?",
];

// --- Components ---

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-base font-mono font-medium text-zinc-100">
        {value}
      </p>
    </div>
  );
}

function TickerTape() {
  const items = [...tickerTape, ...tickerTape];
  return (
    <div className="border-b border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="ticker-scroll flex whitespace-nowrap py-1.5">
        {items.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-4 text-xs font-mono">
            <span className="text-zinc-400 font-medium">{t.symbol}</span>
            <span className="text-zinc-300">{t.value}</span>
            <span className={t.up ? "text-emerald-400" : "text-red-400"}>
              {t.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function HeadlinesPanel() {
  return (
    <div className="flex flex-col">
      <div className="border-b border-zinc-800 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Market Headlines
        </h2>
      </div>
      <div className="flex-1 divide-y divide-zinc-800/60">
        {headlines.map((h, i) => (
          <div key={i} className="px-3 py-2.5 hover:bg-zinc-900/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono font-medium text-amber-500/80">{h.cat}</span>
              <span className="text-[10px] text-zinc-600">{h.time}</span>
            </div>
            <p className="text-xs leading-snug text-zinc-300">{h.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HoldingsPanel() {
  return (
    <div className="flex flex-col">
      <div className="border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Your Holdings
        </h2>
        <button className="flex h-5 w-5 items-center justify-center rounded border border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-colors text-xs">
          +
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="h-8 w-8 rounded border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 mb-3">
          <span className="text-lg leading-none">+</span>
        </div>
        <p className="text-xs text-zinc-500">Add stocks to your watchlist</p>
        <p className="text-[10px] text-zinc-700 mt-1">Track positions and get alerts</p>
      </div>
    </div>
  );
}

// --- Kill Chain Flow ---

function StepDataMetrics({ step, data }: { step: number; data: StockData }) {
  // Step 1 is handled separately in KillChainFlow with AI analysis
  if (step === 2) {
    return (
      <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-3">
        <MetricCard label="Margin" value={formatPercent(data.profitMargin)} />
        <MetricCard label="ROIC" value={data.roic !== null ? formatPercent(data.roic) : "\u2014"} />
        <MetricCard label="Mkt Cap" value={formatCurrency(data.marketCap, true)} />
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-3">
        <p className="text-xs text-zinc-500 italic">
          SEC filing analysis coming soon
        </p>
      </div>
    );
  }

  // step === 4
  return (
    <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-4">
      <MetricCard label="Price" value={formatCurrency(data.currentPrice)} />
      <MetricCard label="P/E (TTM)" value={formatNumber(data.peRatio)} />
      <MetricCard label="Fwd P/E" value={formatNumber(data.forwardPE)} />
      <MetricCard
        label="52W Range"
        value={
          data.fiftyTwoWeekLow !== null && data.fiftyTwoWeekHigh !== null
            ? `${formatCurrency(data.fiftyTwoWeekLow)}\u2013${formatCurrency(data.fiftyTwoWeekHigh)}`
            : "\u2014"
        }
      />
    </div>
  );
}

function KillChainFlow({
  data,
  killChainStep,
  stepResults,
  onPass,
  onFail,
  onUnsure,
  onReset,
}: {
  data: StockData;
  killChainStep: number;
  stepResults: StepResult[];
  onPass: (notes: string) => void;
  onFail: (notes: string) => void;
  onUnsure: (notes: string) => void;
  onReset: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [showStep1Fail, setShowStep1Fail] = useState(false);
  const [step1Analysis, setStep1Analysis] = useState<Step1Analysis | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  const fetchStep1 = useCallback(async () => {
    setStep1Loading(true);
    setStep1Error(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: 1, stockData: data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");
      setStep1Analysis(json);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setStep1Loading(false);
    }
  }, [data]);

  useEffect(() => {
    if (killChainStep === 1 && !step1Analysis && !step1Loading) {
      fetchStep1();
    }
  }, [killChainStep, step1Analysis, step1Loading, fetchStep1]);

  // Summary view
  if (killChainStep === 5) {
    const allPassed = stepResults.every((r) => r.passed === true);
    const timestamp = new Date().toLocaleString();
    return (
      <div className="px-4 py-4">
        <div className="border border-zinc-800 bg-zinc-900/30">
          {/* Header */}
          <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-50">
                {data.companyName}
              </h2>
              <p className="text-[10px] font-mono text-zinc-500">
                {data.ticker} &middot; Kill Chain Summary
              </p>
            </div>
            <div
              className={`px-2.5 py-1 text-[10px] font-mono font-bold tracking-wide ${
                allPassed
                  ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/40"
                  : "bg-red-600/20 text-red-400 border border-red-600/40"
              }`}
            >
              {allPassed ? "STRONG BUY CANDIDATE" : "DOES NOT PASS"}
            </div>
          </div>

          {/* Step results */}
          <div className="divide-y divide-zinc-800/60">
            {stepResults.map((result, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-mono font-bold ${
                    result.passed === true
                      ? "bg-emerald-600/20 text-emerald-400"
                      : result.passed === false
                        ? "bg-red-600/20 text-red-400"
                        : "bg-amber-600/20 text-amber-400"
                  }`}
                >
                  {result.passed === true ? "\u2713" : result.passed === false ? "\u2717" : "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300">
                    Step {i + 1}: {STEP_HEADINGS[i]}
                  </p>
                  {result.notes && (
                    <p className="mt-1 text-[11px] text-zinc-500 line-clamp-2">
                      {result.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
            <p className="text-[10px] text-zinc-600 font-mono">{timestamp}</p>
            <div className="flex gap-2">
              <button
                disabled
                className="px-3 py-1.5 text-[10px] font-mono font-semibold border border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50"
              >
                SAVE MEMO
              </button>
              <button
                onClick={onReset}
                className="px-3 py-1.5 text-[10px] font-mono font-semibold border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                NEW ANALYSIS
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1 fail screen
  if (showStep1Fail) {
    return (
      <div className="px-4 py-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-zinc-300 italic max-w-md leading-relaxed mb-2">
            &ldquo;Never invest in a business you cannot understand.&rdquo;
          </p>
          <p className="text-[10px] text-zinc-500 font-mono mb-6">
            &mdash; Warren Buffett
          </p>
          <button
            onClick={onReset}
            className="px-4 py-2 text-xs font-mono font-semibold border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            BACK TO SEARCH
          </button>
        </div>
      </div>
    );
  }

  // Active step
  const stepIndex = killChainStep - 1;

  // Progress bar (shared across all steps)
  const progressBar = (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500">
          STEP {killChainStep} OF 4
        </p>
        <p className="text-[10px] font-mono text-zinc-600">
          {data.ticker}
        </p>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 ${
              s <= killChainStep ? "bg-emerald-500" : "bg-zinc-800"
            }`}
          />
        ))}
      </div>
    </div>
  );

  // Step 1: AI-powered business understanding
  if (killChainStep === 1) {
    return (
      <div className="px-4 py-4">
        {progressBar}

        <h3 className="text-sm font-semibold text-zinc-100 mb-4">
          {STEP_HEADINGS[0]}
        </h3>

        {step1Loading && (
          <div className="flex items-center justify-center py-12 text-zinc-500">
            <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs font-mono">Analyzing business model...</span>
          </div>
        )}

        {step1Error && (
          <div className="border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400 mb-3">
            {step1Error}
            <button
              onClick={fetchStep1}
              className="ml-2 underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {step1Analysis && (
          <div>
            {/* Characteristic badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {step1Analysis.characteristics.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border border-emerald-600/30 bg-emerald-600/10 text-emerald-400"
                >
                  {tag}
                </span>
              ))}
              <span
                className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border ${
                  step1Analysis.verdict === "simple"
                    ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-400"
                    : "border-amber-600/30 bg-amber-600/10 text-amber-400"
                }`}
              >
                {step1Analysis.verdict === "simple" ? "Simple Business" : "Complex Business"}
              </span>
            </div>

            {/* AI summary */}
            <p className="text-sm text-zinc-300 leading-relaxed mb-4">
              {step1Analysis.summary}
            </p>

            {/* Financial metrics */}
            <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-3 mb-4">
              <MetricCard label="Revenue" value={formatCurrency(data.revenue, true)} />
              <MetricCard label="Net Income" value={formatCurrency(data.netIncome, true)} />
              <MetricCard label="Margin" value={formatPercent(data.profitMargin)} />
            </div>

            {/* Pass / Fail / Unsure buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onPass(step1Analysis.summary);
                  setNotes("");
                }}
                className="flex-1 py-2 text-xs font-mono font-semibold bg-emerald-600/15 border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/25 transition-colors"
              >
                PASS
              </button>
              <button
                onClick={() => {
                  onFail(step1Analysis.summary);
                  setShowStep1Fail(true);
                }}
                className="flex-1 py-2 text-xs font-mono font-semibold bg-red-600/15 border border-red-600/40 text-red-400 hover:bg-red-600/25 transition-colors"
              >
                FAIL
              </button>
              <button
                onClick={() => {
                  onUnsure(step1Analysis.summary);
                  setShowStep1Fail(true);
                }}
                className="flex-1 py-2 text-xs font-mono font-semibold bg-amber-600/15 border border-amber-600/40 text-amber-400 hover:bg-amber-600/25 transition-colors"
              >
                UNSURE
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Steps 2-4: existing textarea-based flow
  return (
    <div className="px-4 py-4">
      {progressBar}

      {/* Heading */}
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">
        {STEP_HEADINGS[stepIndex]}
      </h3>

      {/* Data metrics */}
      <div className="mb-4">
        <StepDataMetrics step={killChainStep} data={data} />
      </div>

      {/* Textarea */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={STEP_PROMPTS[stepIndex]}
        rows={4}
        className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors resize-none font-mono"
      />

      {/* Pass / Fail buttons */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            onPass(notes);
            setNotes("");
          }}
          className="flex-1 py-2 text-xs font-mono font-semibold bg-emerald-600/15 border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/25 transition-colors"
        >
          PASS
        </button>
        <button
          onClick={() => {
            onFail(notes);
            setNotes("");
          }}
          className="flex-1 py-2 text-xs font-mono font-semibold bg-red-600/15 border border-red-600/40 text-red-400 hover:bg-red-600/25 transition-colors"
        >
          FAIL
        </button>
      </div>
    </div>
  );
}

// --- Main Dashboard ---

export default function Dashboard() {
  const [ticker, setTicker] = useState("");
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [killChainActive, setKillChainActive] = useState(false);
  const [killChainStep, setKillChainStep] = useState(1);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = ticker.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setData(null);
    setKillChainActive(false);

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

  function startKillChain() {
    setKillChainActive(true);
    setKillChainStep(1);
    setStepResults([]);
  }

  function resetKillChain() {
    setKillChainActive(false);
    setKillChainStep(1);
    setStepResults([]);
  }

  function handleStepPass(notes: string) {
    setStepResults((prev) => [...prev, { passed: true, notes }]);
    setKillChainStep((prev) => prev + 1);
  }

  function handleStepFail(notes: string) {
    setStepResults((prev) => [...prev, { passed: false, notes }]);
    setKillChainStep((prev) => prev + 1);
  }

  function handleStepUnsure(notes: string) {
    setStepResults((prev) => [...prev, { passed: null, notes }]);
    setKillChainStep((prev) => prev + 1);
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-2 flex items-center justify-between shrink-0">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-50 font-mono">
          BUFFETT ANALYZER
        </h1>
        <span className="text-[10px] text-zinc-600 font-mono">v0.1</span>
      </header>

      {/* Ticker tape */}
      <TickerTape />

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Left: Headlines */}
        <aside className="w-full lg:w-1/4 border-b lg:border-b-0 lg:border-r border-zinc-800 overflow-y-auto shrink-0">
          <HeadlinesPanel />
        </aside>

        {/* Center: Search + Results OR Kill Chain */}
        <main className="flex-1 overflow-y-auto">
          {killChainActive && data ? (
            <KillChainFlow
              data={data}
              killChainStep={killChainStep}
              stepResults={stepResults}
              onPass={handleStepPass}
              onFail={handleStepFail}
              onUnsure={handleStepUnsure}
              onReset={resetKillChain}
            />
          ) : (
            <>
              {/* Search bar */}
              <div className="border-b border-zinc-800 px-4 py-3">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="Ticker (e.g. KO)"
                    spellCheck={false}
                    className="flex-1 border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={loading || !ticker.trim()}
                    className="bg-zinc-100 px-4 py-1.5 text-xs font-semibold text-zinc-900 transition-colors hover:bg-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                  >
                    {loading ? "..." : "GO"}
                  </button>
                </form>
              </div>

              <div className="px-4 py-3">
                {/* Error */}
                {error && (
                  <div className="border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-400 mb-3">
                    {error}
                  </div>
                )}

                {/* Loading */}
                {loading && (
                  <div className="flex items-center justify-center py-16 text-zinc-500">
                    <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-xs font-mono">Fetching...</span>
                  </div>
                )}

                {/* Stock Data */}
                {data && (
                  <div>
                    {/* Company header */}
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-zinc-50 leading-tight">
                          {data.companyName}
                        </h2>
                        <p className="font-mono text-xs text-zinc-500">
                          {data.ticker} &middot; {data.currency}
                        </p>
                      </div>
                      <p className="text-2xl font-mono font-semibold tabular-nums text-zinc-50">
                        {formatCurrency(data.currentPrice)}
                      </p>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-4">
                      <MetricCard label="P/E (TTM)" value={formatNumber(data.peRatio)} />
                      <MetricCard label="Fwd P/E" value={formatNumber(data.forwardPE)} />
                      <MetricCard label="Mkt Cap" value={formatCurrency(data.marketCap, true)} />
                      <MetricCard
                        label="52W Range"
                        value={
                          data.fiftyTwoWeekLow !== null && data.fiftyTwoWeekHigh !== null
                            ? `${formatCurrency(data.fiftyTwoWeekLow)}\u2013${formatCurrency(data.fiftyTwoWeekHigh)}`
                            : "\u2014"
                        }
                      />
                      <MetricCard label="Revenue" value={formatCurrency(data.revenue, true)} />
                      <MetricCard label="Net Income" value={formatCurrency(data.netIncome, true)} />
                      <MetricCard label="Margin" value={formatPercent(data.profitMargin)} />
                      <MetricCard label="ROIC" value={data.roic !== null ? formatPercent(data.roic) : "\u2014"} />
                    </div>

                    {/* Kill Chain Analysis button */}
                    <button
                      onClick={startKillChain}
                      className="mt-4 w-full border border-emerald-600 bg-emerald-600/10 py-2.5 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-600/20 font-mono tracking-wide"
                    >
                      RUN KILL CHAIN ANALYSIS &rarr;
                    </button>
                  </div>
                )}

                {/* Empty state */}
                {!data && !loading && !error && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-xs text-zinc-500 font-mono">
                      Enter a ticker to view fundamentals
                    </p>
                    <p className="mt-1.5 text-[10px] text-zinc-700 font-mono">
                      KO &middot; AAPL &middot; BRK-B &middot; MSFT &middot; JNJ
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* Right: Holdings */}
        <aside className="w-full lg:w-1/4 border-t lg:border-t-0 lg:border-l border-zinc-800 overflow-y-auto shrink-0">
          <HoldingsPanel />
        </aside>
      </div>
    </div>
  );
}
