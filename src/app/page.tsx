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
  website: string | null;
}

interface SavedMemo {
  id: string;
  created_at: string;
  ticker: string;
  company_name: string;
  step1_passed: boolean | null;
  step1_analysis: Step1Analysis | null;
  step2_passed: boolean | null;
  step2_analysis: Step2Analysis | null;
  step3_passed: boolean | null;
  step3_analysis: Step3Analysis | null;
  step4_passed: boolean | null;
  step4_analysis: Step4Analysis | null;
  overall_verdict: string;
  stock_data: StockData | null;
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

interface Step2Analysis {
  moatType: string;
  moatRating: "strong" | "moderate" | "weak";
  evidence: string;
  threats: string;
}

interface Step3Analysis {
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  concerns: string;
  note: string;
}

interface Step4Analysis {
  verdict: "undervalued" | "fairly valued" | "overvalued";
  reasoning: string;
  marginOfSafety: "high" | "moderate" | "low" | "none";
  keyMetric: string;
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

function getLogoDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

// --- Static data ---

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

const headlines = [
  { time: "2m ago", cat: "FED", title: "Fed holds rates steady, signals patience on cuts" },
  { time: "18m ago", cat: "EARNINGS", title: "NVDA beats Q4 estimates, guides higher on AI demand" },
  { time: "34m ago", cat: "MACRO", title: "January CPI comes in at 2.9%, below expectations" },
  { time: "1h ago", cat: "M&A", title: "Broadcom nears $15B deal for cloud infrastructure firm" },
  { time: "2h ago", cat: "BONDS", title: "10Y yield rises to 4.28% as traders digest labor data" },
  { time: "3h ago", cat: "GLOBAL", title: "ECB officials signal April rate cut increasingly likely" },
];

// --- Kill Chain Config ---

const STEP_HEADINGS = [
  "Can you explain how this company makes money?",
  "Does this company have a durable competitive advantage?",
  "Do you trust management with your capital?",
  "Is the price attractive?",
];

const STEP_LABELS = ["Business", "Moat", "Management", "Valuation"];

const LOADING_MESSAGES = [
  "Analyzing business model...",
  "Evaluating competitive moat...",
  "Assessing management quality...",
  "Analyzing valuation...",
];

const MOAT_RATING_COLORS: Record<string, string> = {
  strong: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  weak: "border-red-500/40 bg-red-500/10 text-red-400",
};

const GRADE_COLORS: Record<string, string> = {
  A: "border-emerald-500/50 bg-emerald-500/15 text-emerald-400",
  B: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  C: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  D: "border-red-500/40 bg-red-500/10 text-red-400",
  F: "border-red-500/50 bg-red-500/15 text-red-400",
};

const VERDICT_COLORS: Record<string, string> = {
  undervalued: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  "fairly valued": "border-amber-500/40 bg-amber-500/10 text-amber-400",
  overvalued: "border-red-500/40 bg-red-500/10 text-red-400",
};

const MOS_COLORS: Record<string, string> = {
  high: "text-emerald-400",
  moderate: "text-amber-400",
  low: "text-red-400",
  none: "text-red-500",
};

// --- Custom Hook ---

function useStepAnalysis<T>(step: number, currentStep: number, data: StockData) {
  const [analysis, setAnalysis] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, stockData: data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");
      setAnalysis(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [step, data]);

  useEffect(() => {
    if (currentStep === step && !analysis && !loading) {
      fetch_();
    }
  }, [currentStep, step, analysis, loading, fetch_]);

  return { analysis, loading, error, retry: fetch_ };
}

// --- Shared Components ---

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

// --- Kill Chain Components ---

function StepLoadingSpinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
      <svg className="mb-3 h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-xs font-mono">{message}</span>
    </div>
  );
}

function StepError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="border border-red-900/40 bg-red-950/20 px-3 py-2.5 text-xs text-red-400 mb-3">
      {message}
      <button onClick={onRetry} className="ml-2 underline hover:text-red-300">
        Retry
      </button>
    </div>
  );
}

function CompanyContextBar({ data }: { data: StockData }) {
  const [logoError, setLogoError] = useState(false);
  const domain = getLogoDomain(data.website);

  return (
    <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-zinc-800/50">
      {domain && !logoError ? (
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt=""
          className="h-8 w-8 rounded bg-zinc-800"
          onError={() => setLogoError(true)}
        />
      ) : (
        <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center">
          <span className="text-[10px] font-mono font-bold text-zinc-500">
            {data.ticker.slice(0, 2)}
          </span>
        </div>
      )}
      <div>
        <p className="text-xs font-semibold text-zinc-200">{data.companyName}</p>
        <p className="text-[10px] font-mono text-zinc-500">{data.ticker} &middot; {data.currency}</p>
      </div>
    </div>
  );
}

function AccentBlock({
  label,
  children,
  accent = "emerald",
}: {
  label: string;
  children: React.ReactNode;
  accent?: "emerald" | "red" | "amber" | "zinc";
}) {
  const borderColors = {
    emerald: "border-l-emerald-500/50",
    red: "border-l-red-500/50",
    amber: "border-l-amber-500/50",
    zinc: "border-l-zinc-600/50",
  };
  return (
    <div className={`border-l-2 ${borderColors[accent]} pl-3.5 py-0.5`}>
      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        {label}
      </p>
      <p className="text-[13px] text-zinc-300 leading-7">{children}</p>
    </div>
  );
}

function SectionDivider() {
  return <div className="border-t border-zinc-800/40 my-4" />;
}

function ProgressBar({
  currentStep,
  activeStep,
  onGoToStep,
}: {
  currentStep: number;
  activeStep: number;
  onGoToStep: (step: number) => void;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-mono font-semibold tracking-widest text-zinc-500">
          STEP {Math.min(currentStep, 4)} OF 4
        </p>
        <p className="text-[10px] font-mono text-zinc-600">
          {STEP_LABELS[Math.min(currentStep, 4) - 1] ?? "Summary"}
        </p>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((s) => {
          const isFilled = s <= Math.min(activeStep, 4);
          const isCurrent = s === currentStep;
          const isClickable = s <= activeStep && s !== currentStep;
          return (
            <button
              key={s}
              onClick={() => isClickable && onGoToStep(s)}
              disabled={!isClickable}
              className={`relative h-1.5 flex-1 transition-all duration-300 rounded-[1px] ${
                isFilled
                  ? isCurrent
                    ? "bg-emerald-400"
                    : "bg-emerald-600"
                  : "bg-zinc-800"
              } ${isClickable ? "cursor-pointer hover:bg-emerald-400" : "cursor-default"}`}
            />
          );
        })}
      </div>
      {/* Step labels */}
      <div className="flex gap-1 mt-1">
        {[1, 2, 3, 4].map((s) => {
          const isClickable = s <= activeStep && s !== currentStep;
          return (
            <button
              key={s}
              onClick={() => isClickable && onGoToStep(s)}
              disabled={!isClickable}
              className={`flex-1 text-[9px] font-mono transition-colors ${
                s === currentStep
                  ? "text-zinc-300"
                  : s < activeStep
                    ? "text-zinc-600 hover:text-zinc-400 cursor-pointer"
                    : "text-zinc-800 cursor-default"
              }`}
            >
              {STEP_LABELS[s - 1]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}

function VerdictBanner({ result }: { result: StepResult }) {
  const config =
    result.passed === true
      ? { label: "PASSED", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" }
      : result.passed === false
        ? { label: "FAILED", cls: "bg-red-500/10 border-red-500/30 text-red-400" }
        : { label: "UNSURE", cls: "bg-amber-500/10 border-amber-500/30 text-amber-400" };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border text-[11px] font-mono font-bold tracking-wide ${config.cls}`}>
      {result.passed === true && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {result.passed === false && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {result.passed === null && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
        </svg>
      )}
      Your verdict: {config.label}
    </div>
  );
}

function ReviewActions({
  result,
  killChainStep,
  activeStep,
  onGoToStep,
}: {
  result: StepResult;
  killChainStep: number;
  activeStep: number;
  onGoToStep: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <VerdictBanner result={result} />
      <button
        onClick={() => onGoToStep(Math.min(killChainStep + 1, activeStep))}
        className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-mono font-semibold text-zinc-300 border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 transition-colors shrink-0"
      >
        Continue
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

function PassFailButtons({ onPass, onFail }: { onPass: () => void; onFail: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onPass}
        className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        PASS
      </button>
      <button
        onClick={onFail}
        className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        FAIL
      </button>
    </div>
  );
}

// --- Kill Chain Flow ---

function KillChainFlow({
  data,
  killChainStep,
  stepResults,
  onPass,
  onFail,
  onUnsure,
  onReset,
  onGoToStep,
  onMemoSaved,
}: {
  data: StockData;
  killChainStep: number;
  stepResults: StepResult[];
  onPass: (notes: string) => void;
  onFail: (notes: string) => void;
  onUnsure: (notes: string) => void;
  onReset: () => void;
  onGoToStep: (step: number) => void;
  onMemoSaved: () => void;
}) {
  const [showStep1Fail, setShowStep1Fail] = useState(false);
  const [summaryLogoError, setSummaryLogoError] = useState(false);
  const [memoSaving, setMemoSaving] = useState(false);
  const [memoSaved, setMemoSaved] = useState(false);
  const [memoError, setMemoError] = useState<string | null>(null);

  const s1 = useStepAnalysis<Step1Analysis>(1, killChainStep, data);
  const s2 = useStepAnalysis<Step2Analysis>(2, killChainStep, data);
  const s3 = useStepAnalysis<Step3Analysis>(3, killChainStep, data);
  const s4 = useStepAnalysis<Step4Analysis>(4, killChainStep, data);

  const activeStep = stepResults.length + 1;
  const isReviewing = killChainStep < activeStep && killChainStep <= 4;
  const summaryLogoDomain = getLogoDomain(data.website);

  // Step 1 fail/unsure → Buffett quote
  if (showStep1Fail) {
    return (
      <div className="px-4 py-4 step-fade-in">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full border border-zinc-800 bg-zinc-900/50 flex items-center justify-center mb-6">
            <span className="text-2xl">&#x201C;</span>
          </div>
          <p className="text-base text-zinc-300 italic max-w-sm leading-relaxed mb-2">
            Never invest in a business you cannot understand.
          </p>
          <p className="text-[10px] text-zinc-500 font-mono mb-8">
            &mdash; Warren Buffett
          </p>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-semibold border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            BACK TO SEARCH
          </button>
        </div>
      </div>
    );
  }

  // Summary view (step 5)
  if (killChainStep === 5) {
    const allPassed = stepResults.every((r) => r.passed === true);
    const timestamp = new Date().toLocaleString();

    return (
      <div className="px-4 py-4 step-fade-in">
        <ProgressBar currentStep={5} activeStep={5} onGoToStep={onGoToStep} />

        <div className="border border-zinc-800 bg-zinc-900/20 rounded-sm overflow-hidden">
          {/* Header */}
          <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {summaryLogoDomain && !summaryLogoError ? (
                <img
                  src={`https://logo.clearbit.com/${summaryLogoDomain}`}
                  alt=""
                  className="h-9 w-9 rounded bg-zinc-800"
                  onError={() => setSummaryLogoError(true)}
                />
              ) : (
                <div className="h-9 w-9 rounded bg-zinc-800 flex items-center justify-center">
                  <span className="text-[11px] font-mono font-bold text-zinc-500">
                    {data.ticker.slice(0, 2)}
                  </span>
                </div>
              )}
              <div>
                <h2 className="text-sm font-semibold text-zinc-50">{data.companyName}</h2>
                <p className="text-[10px] font-mono text-zinc-500">
                  {data.ticker} &middot; Kill Chain Summary
                </p>
              </div>
            </div>
            <div
              className={`px-3 py-1.5 text-[11px] font-mono font-bold tracking-wide ${
                allPassed
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                  : "bg-red-500/15 text-red-400 border border-red-500/40"
              }`}
            >
              {allPassed ? "STRONG BUY CANDIDATE" : "DOES NOT PASS"}
            </div>
          </div>

          {/* Step results */}
          <div className="divide-y divide-zinc-800/50">
            {stepResults.map((result, i) => (
              <button
                key={i}
                onClick={() => onGoToStep(i + 1)}
                className="w-full px-4 py-3.5 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors text-left"
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-mono font-bold rounded-sm ${
                    result.passed === true
                      ? "bg-emerald-500/15 text-emerald-400"
                      : result.passed === false
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {result.passed === true ? "\u2713" : result.passed === false ? "\u2717" : "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-300">
                    Step {i + 1}: {STEP_HEADINGS[i]}
                  </p>
                  {result.notes && (
                    <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-2">
                      {result.notes}
                    </p>
                  )}
                </div>
                <svg className="h-3.5 w-3.5 text-zinc-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>

          {/* Memo status */}
          {memoSaved && (
            <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 flex items-center gap-2">
              <svg className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-[11px] font-mono text-emerald-400">Memo saved to database</p>
            </div>
          )}
          {memoError && (
            <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-2.5">
              <p className="text-[11px] font-mono text-red-400">{memoError}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
            <p className="text-[10px] text-zinc-600 font-mono">{timestamp}</p>
            <div className="flex gap-2">
              <button
                disabled={memoSaving || memoSaved}
                onClick={async () => {
                  setMemoSaving(true);
                  setMemoError(null);
                  try {
                    const res = await fetch("/api/memos", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ticker: data.ticker,
                        company_name: data.companyName,
                        step1_passed: stepResults[0]?.passed ?? null,
                        step1_analysis: s1.analysis ?? null,
                        step2_passed: stepResults[1]?.passed ?? null,
                        step2_analysis: s2.analysis ?? null,
                        step3_passed: stepResults[2]?.passed ?? null,
                        step3_analysis: s3.analysis ?? null,
                        step4_passed: stepResults[3]?.passed ?? null,
                        step4_analysis: s4.analysis ?? null,
                        overall_verdict: allPassed ? "STRONG BUY CANDIDATE" : "DOES NOT PASS",
                        stock_data: data,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Failed to save");
                    setMemoSaved(true);
                    onMemoSaved();
                  } catch (err) {
                    setMemoError(err instanceof Error ? err.message : "Failed to save memo");
                  } finally {
                    setMemoSaving(false);
                  }
                }}
                className={`px-3 py-1.5 text-[10px] font-mono font-semibold border transition-colors ${
                  memoSaved
                    ? "border-emerald-500/30 text-emerald-400 cursor-default"
                    : memoSaving
                      ? "border-zinc-700 text-zinc-500 cursor-wait"
                      : "border-zinc-600 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500"
                }`}
              >
                {memoSaved ? "SAVED" : memoSaving ? "SAVING..." : "SAVE MEMO"}
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

  // Steps 1-4
  return (
    <div className="px-4 py-4">
      <ProgressBar currentStep={killChainStep} activeStep={activeStep} onGoToStep={onGoToStep} />

      <div key={killChainStep} className="step-fade-in">
        {/* Back button */}
        {killChainStep > 1 && (
          <BackButton onClick={() => onGoToStep(killChainStep - 1)} />
        )}

        {/* Company context */}
        <CompanyContextBar data={data} />

        {/* Step heading */}
        <h3 className="text-base font-semibold text-zinc-100 mb-5">
          {STEP_HEADINGS[killChainStep - 1]}
        </h3>

        {/* --- Step 1: Business Understanding --- */}
        {killChainStep === 1 && (
          <>
            {s1.loading && <StepLoadingSpinner message={LOADING_MESSAGES[0]} />}
            {s1.error && <StepError message={s1.error} onRetry={s1.retry} />}
            {s1.analysis && (
              <>
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {s1.analysis.characteristics.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    >
                      {tag}
                    </span>
                  ))}
                  <span
                    className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-full border ${
                      s1.analysis.verdict === "simple"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {s1.analysis.verdict === "simple" ? "Simple Business" : "Complex Business"}
                  </span>
                </div>

                <AccentBlock label="How It Makes Money" accent="emerald">
                  {s1.analysis.summary}
                </AccentBlock>

                <SectionDivider />

                <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-3 mb-5">
                  <MetricCard label="Revenue" value={formatCurrency(data.revenue, true)} />
                  <MetricCard label="Net Income" value={formatCurrency(data.netIncome, true)} />
                  <MetricCard label="Margin" value={formatPercent(data.profitMargin)} />
                </div>

                {isReviewing ? (
                  <ReviewActions
                    result={stepResults[0]}
                    killChainStep={1}
                    activeStep={activeStep}
                    onGoToStep={onGoToStep}
                  />
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onPass(s1.analysis!.summary)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      PASS
                    </button>
                    <button
                      onClick={() => { onFail(s1.analysis!.summary); setShowStep1Fail(true); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-bold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-all"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      FAIL
                    </button>
                    <button
                      onClick={() => { onUnsure(s1.analysis!.summary); setShowStep1Fail(true); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
                      </svg>
                      UNSURE
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* --- Step 2: Moat & Competitive Advantage --- */}
        {killChainStep === 2 && (
          <>
            {s2.loading && <StepLoadingSpinner message={LOADING_MESSAGES[1]} />}
            {s2.error && <StepError message={s2.error} onRetry={s2.retry} />}
            {s2.analysis && (
              <>
                {/* Badges */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="px-3 py-1 text-[11px] font-mono font-bold rounded-full border border-zinc-600/40 bg-zinc-700/20 text-zinc-200">
                    {s2.analysis.moatType}
                  </span>
                  <span
                    className={`px-3 py-1 text-[11px] font-mono font-bold rounded-full border ${
                      MOAT_RATING_COLORS[s2.analysis.moatRating] ?? MOAT_RATING_COLORS.weak
                    }`}
                  >
                    {s2.analysis.moatRating.toUpperCase()} MOAT
                  </span>
                </div>

                <AccentBlock label="Evidence" accent="emerald">
                  {s2.analysis.evidence}
                </AccentBlock>

                <SectionDivider />

                <AccentBlock label="Threats" accent="red">
                  {s2.analysis.threats}
                </AccentBlock>

                <SectionDivider />

                <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-3 mb-5">
                  <MetricCard label="Margin" value={formatPercent(data.profitMargin)} />
                  <MetricCard label="ROIC" value={data.roic !== null ? formatPercent(data.roic) : "\u2014"} />
                  <MetricCard label="Mkt Cap" value={formatCurrency(data.marketCap, true)} />
                </div>

                {isReviewing ? (
                  <ReviewActions
                    result={stepResults[1]}
                    killChainStep={2}
                    activeStep={activeStep}
                    onGoToStep={onGoToStep}
                  />
                ) : (
                  <PassFailButtons
                    onPass={() => onPass(s2.analysis!.evidence)}
                    onFail={() => onFail(s2.analysis!.evidence)}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* --- Step 3: Management Quality --- */}
        {killChainStep === 3 && (
          <>
            {s3.loading && <StepLoadingSpinner message={LOADING_MESSAGES[2]} />}
            {s3.error && <StepError message={s3.error} onRetry={s3.retry} />}
            {s3.analysis && (
              <>
                {/* Grade badge */}
                <div className="flex items-center gap-4 mb-5">
                  <span
                    className={`flex h-14 w-14 items-center justify-center text-2xl font-mono font-bold border rounded-sm ${
                      GRADE_COLORS[s3.analysis.grade] ?? GRADE_COLORS.C
                    }`}
                  >
                    {s3.analysis.grade}
                  </span>
                  <div>
                    <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-400">
                      Management Grade
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">Based on capital allocation signals</p>
                  </div>
                </div>

                <AccentBlock label="Assessment" accent="emerald">
                  {s3.analysis.summary}
                </AccentBlock>

                <SectionDivider />

                <AccentBlock label="Concerns" accent="red">
                  {s3.analysis.concerns}
                </AccentBlock>

                <SectionDivider />

                <div className="border border-zinc-800/60 bg-zinc-900/30 px-3.5 py-2.5 mb-5 rounded-sm">
                  <p className="text-[10px] text-zinc-500 italic">{s3.analysis.note}</p>
                </div>

                {isReviewing ? (
                  <ReviewActions
                    result={stepResults[2]}
                    killChainStep={3}
                    activeStep={activeStep}
                    onGoToStep={onGoToStep}
                  />
                ) : (
                  <PassFailButtons
                    onPass={() => onPass(s3.analysis!.summary)}
                    onFail={() => onFail(s3.analysis!.summary)}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* --- Step 4: Valuation --- */}
        {killChainStep === 4 && (
          <>
            {s4.loading && <StepLoadingSpinner message={LOADING_MESSAGES[3]} />}
            {s4.error && <StepError message={s4.error} onRetry={s4.retry} />}
            {s4.analysis && (
              <>
                {/* Verdict + Margin of Safety */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <span
                    className={`px-3 py-1 text-[11px] font-mono font-bold rounded-full border ${
                      VERDICT_COLORS[s4.analysis.verdict] ?? VERDICT_COLORS["fairly valued"]
                    }`}
                  >
                    {s4.analysis.verdict.toUpperCase()}
                  </span>
                  <span className="px-3 py-1 text-[11px] font-mono font-semibold rounded-full border border-zinc-700 bg-zinc-800/50 text-zinc-300">
                    Margin of Safety:{" "}
                    <span className={`font-bold ${MOS_COLORS[s4.analysis.marginOfSafety] ?? "text-zinc-400"}`}>
                      {s4.analysis.marginOfSafety.toUpperCase()}
                    </span>
                  </span>
                </div>

                <AccentBlock label="Reasoning" accent="emerald">
                  {s4.analysis.reasoning}
                </AccentBlock>

                <SectionDivider />

                <div className="border-l-2 border-l-amber-500/50 pl-3.5 py-0.5 mb-4">
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
                    Key Metric
                  </p>
                  <p className="text-[13px] text-zinc-300 leading-7">{s4.analysis.keyMetric}</p>
                </div>

                <SectionDivider />

                <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 sm:grid-cols-4 mb-5">
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

                {isReviewing ? (
                  <ReviewActions
                    result={stepResults[3]}
                    killChainStep={4}
                    activeStep={activeStep}
                    onGoToStep={onGoToStep}
                  />
                ) : (
                  <PassFailButtons
                    onPass={() => onPass(s4.analysis!.reasoning)}
                    onFail={() => onFail(s4.analysis!.reasoning)}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Past Analyses ---

function PastAnalyses({
  memos,
  loading,
  onSelect,
}: {
  memos: SavedMemo[];
  loading: boolean;
  onSelect: (memo: SavedMemo) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-zinc-500">
        <svg className="mr-2 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs font-mono">Loading memos...</span>
      </div>
    );
  }

  if (memos.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-[11px] text-zinc-600 font-mono">
          No analyses yet &mdash; search a ticker to get started
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Past Analyses
        </h3>
        <span className="text-[10px] font-mono text-zinc-600">{memos.length} memo{memos.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {memos.map((memo) => {
          const isPass = memo.overall_verdict === "STRONG BUY CANDIDATE";
          const date = new Date(memo.created_at);
          const dateStr = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const domain = memo.stock_data ? getLogoDomain(memo.stock_data.website) : null;

          return (
            <MemoCard
              key={memo.id}
              memo={memo}
              isPass={isPass}
              dateStr={dateStr}
              domain={domain}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

function MemoCard({
  memo,
  isPass,
  dateStr,
  domain,
  onSelect,
}: {
  memo: SavedMemo;
  isPass: boolean;
  dateStr: string;
  domain: string | null;
  onSelect: (memo: SavedMemo) => void;
}) {
  const [logoError, setLogoError] = useState(false);

  return (
    <button
      onClick={() => onSelect(memo)}
      className="w-full flex items-center gap-3 px-3 py-3 border border-zinc-800/60 bg-zinc-900/20 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-left group"
    >
      {domain && !logoError ? (
        <img
          src={`https://logo.clearbit.com/${domain}`}
          alt=""
          className="h-8 w-8 rounded bg-zinc-800 shrink-0"
          onError={() => setLogoError(true)}
        />
      ) : (
        <div className="h-8 w-8 rounded bg-zinc-800 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-mono font-bold text-zinc-500">
            {memo.ticker.slice(0, 2)}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-zinc-200 truncate">
            {memo.company_name}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
            {memo.ticker}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[10px] font-mono font-bold ${
              isPass ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isPass ? "STRONG BUY" : "DOES NOT PASS"}
          </span>
          <span className="text-[10px] text-zinc-600">&middot;</span>
          <span className="text-[10px] font-mono text-zinc-600">{dateStr}</span>
        </div>
      </div>
      <svg
        className="h-3.5 w-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function SavedMemoDetail({
  memo,
  onBack,
}: {
  memo: SavedMemo;
  onBack: () => void;
}) {
  const [logoError, setLogoError] = useState(false);
  const domain = memo.stock_data ? getLogoDomain(memo.stock_data.website) : null;
  const isPass = memo.overall_verdict === "STRONG BUY CANDIDATE";
  const timestamp = new Date(memo.created_at).toLocaleString();

  const steps = [
    { passed: memo.step1_passed, analysis: memo.step1_analysis },
    { passed: memo.step2_passed, analysis: memo.step2_analysis },
    { passed: memo.step3_passed, analysis: memo.step3_analysis },
    { passed: memo.step4_passed, analysis: memo.step4_analysis },
  ];

  return (
    <div className="px-4 py-4 step-fade-in">
      <BackButton onClick={onBack} />

      <div className="border border-zinc-800 bg-zinc-900/20 rounded-sm overflow-hidden">
        {/* Header */}
        <div className="border-b border-zinc-800 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {domain && !logoError ? (
              <img
                src={`https://logo.clearbit.com/${domain}`}
                alt=""
                className="h-9 w-9 rounded bg-zinc-800"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="h-9 w-9 rounded bg-zinc-800 flex items-center justify-center">
                <span className="text-[11px] font-mono font-bold text-zinc-500">
                  {memo.ticker.slice(0, 2)}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-zinc-50">{memo.company_name}</h2>
              <p className="text-[10px] font-mono text-zinc-500">
                {memo.ticker} &middot; Saved Analysis
              </p>
            </div>
          </div>
          <div
            className={`px-3 py-1.5 text-[11px] font-mono font-bold tracking-wide ${
              isPass
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
                : "bg-red-500/15 text-red-400 border border-red-500/40"
            }`}
          >
            {memo.overall_verdict}
          </div>
        </div>

        {/* Step results */}
        <div className="divide-y divide-zinc-800/50">
          {steps.map((step, i) => (
            <div key={i} className="px-4 py-3.5 flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-mono font-bold rounded-sm ${
                  step.passed === true
                    ? "bg-emerald-500/15 text-emerald-400"
                    : step.passed === false
                      ? "bg-red-500/15 text-red-400"
                      : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {step.passed === true ? "\u2713" : step.passed === false ? "\u2717" : "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-zinc-300">
                  Step {i + 1}: {STEP_HEADINGS[i]}
                </p>
                {/* Step-specific summary from saved analysis */}
                {i === 0 && step.analysis && (
                  <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-3">
                    {(step.analysis as Step1Analysis).summary}
                  </p>
                )}
                {i === 1 && step.analysis && (
                  <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-3">
                    {(step.analysis as Step2Analysis).evidence}
                  </p>
                )}
                {i === 2 && step.analysis && (
                  <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-3">
                    {(step.analysis as Step3Analysis).summary}
                  </p>
                )}
                {i === 3 && step.analysis && (
                  <p className="mt-1 text-[11px] text-zinc-500 leading-relaxed line-clamp-3">
                    {(step.analysis as Step4Analysis).reasoning}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600 font-mono">{timestamp}</p>
          <button
            onClick={onBack}
            className="px-3 py-1.5 text-[10px] font-mono font-semibold border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            BACK TO LIST
          </button>
        </div>
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

  const [memos, setMemos] = useState<SavedMemo[]>([]);
  const [memosLoading, setMemosLoading] = useState(true);
  const [viewingMemo, setViewingMemo] = useState<SavedMemo | null>(null);

  useEffect(() => {
    async function fetchMemos() {
      try {
        const res = await fetch("/api/memos");
        if (res.ok) {
          const data = await res.json();
          setMemos(data);
        }
      } catch {
        // Silently fail — memos are non-critical
      } finally {
        setMemosLoading(false);
      }
    }
    fetchMemos();
  }, []);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const trimmed = ticker.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setData(null);
    setKillChainActive(false);
    setViewingMemo(null);

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

  function goToStep(step: number) {
    const maxStep = Math.min(stepResults.length + 1, 5);
    if (step >= 1 && step <= maxStep) {
      setKillChainStep(step);
    }
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
              onGoToStep={goToStep}
              onMemoSaved={async () => {
                try {
                  const res = await fetch("/api/memos");
                  if (res.ok) setMemos(await res.json());
                } catch { /* ignore */ }
              }}
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

                {/* Empty state — past analyses or prompt */}
                {!data && !loading && !error && (
                  viewingMemo ? (
                    <SavedMemoDetail
                      memo={viewingMemo}
                      onBack={() => setViewingMemo(null)}
                    />
                  ) : (
                    <div>
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-xs text-zinc-500 font-mono">
                          Enter a ticker to view fundamentals
                        </p>
                        <p className="mt-1.5 text-[10px] text-zinc-700 font-mono">
                          KO &middot; AAPL &middot; BRK-B &middot; MSFT &middot; JNJ
                        </p>
                      </div>
                      <div className="border-t border-zinc-800/40 mx-0 mb-4" />
                      <PastAnalyses
                        memos={memos}
                        loading={memosLoading}
                        onSelect={(memo) => setViewingMemo(memo)}
                      />
                    </div>
                  )
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
