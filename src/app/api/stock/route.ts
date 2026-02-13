import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  const symbol = ticker.toUpperCase();

  try {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // Fetch quoteSummary + fundamentalsTimeSeries (balance-sheet and financials separately
    // because module:"all" fails for some tickers when one module has validation issues)
    const [summary, balanceSheet, financials] = await Promise.all([
      yahooFinance.quoteSummary(symbol, {
        modules: [
          "price",
          "summaryDetail",
          "financialData",
          "defaultKeyStatistics",
          "summaryProfile",
        ],
      }),
      yahooFinance
        .fundamentalsTimeSeries(symbol, {
          period1: twoYearsAgo,
          type: "annual",
          module: "balance-sheet",
        })
        .catch(() => null),
      yahooFinance
        .fundamentalsTimeSeries(symbol, {
          period1: twoYearsAgo,
          type: "annual",
          module: "financials",
        })
        .catch(() => null),
    ]);

    const price = summary.price;
    const detail = summary.summaryDetail;
    const financial = summary.financialData;
    const keyStats = summary.defaultKeyStatistics;

    // Calculate ROIC = NOPAT / Invested Capital
    // Strategy: try multiple data sources for each component
    let roic: number | null = null;
    let roicNote: string | null = null;

    const latestBs = balanceSheet?.length
      ? (balanceSheet[balanceSheet.length - 1] as Record<string, unknown>)
      : null;
    const latestFin = financials?.length
      ? (financials[financials.length - 1] as Record<string, unknown>)
      : null;

    // 1) Operating income: prefer fundamentalsTimeSeries financials, fall back to quoteSummary
    let operatingIncome: number | null = null;
    if (latestFin?.operatingIncome) {
      operatingIncome = latestFin.operatingIncome as number;
    } else if (financial?.operatingMargins && financial?.totalRevenue) {
      operatingIncome = financial.operatingMargins * financial.totalRevenue;
      roicNote = "Operating income estimated from margins";
    }

    // 2) Invested capital: prefer direct value, fall back to totalAssets - currentLiabilities
    let investedCapital: number | null = null;
    if (latestBs?.investedCapital) {
      investedCapital = latestBs.investedCapital as number;
    } else if (latestBs?.totalAssets && latestBs?.currentLiabilities) {
      investedCapital =
        (latestBs.totalAssets as number) -
        (latestBs.currentLiabilities as number);
      roicNote = roicNote
        ? `${roicNote}; invested capital estimated from total assets - current liabilities`
        : "Invested capital estimated from total assets - current liabilities";
    }

    // 3) Tax rate: use fundamentals value or default 21%
    const taxRate = (latestFin?.taxRateForCalcs as number | undefined) ?? 0.21;

    if (operatingIncome && investedCapital && investedCapital > 0) {
      const nopat = operatingIncome * (1 - taxRate);
      roic = nopat / investedCapital;
    } else {
      roicNote = "Insufficient data to calculate ROIC";
    }

    const data = {
      companyName: price?.longName || price?.shortName || symbol,
      ticker: symbol,
      currentPrice: price?.regularMarketPrice ?? null,
      currency: price?.currency ?? "USD",
      peRatio: detail?.trailingPE ?? null,
      forwardPE: detail?.forwardPE ?? null,
      marketCap: price?.marketCap ?? null,
      fiftyTwoWeekLow: detail?.fiftyTwoWeekLow ?? null,
      fiftyTwoWeekHigh: detail?.fiftyTwoWeekHigh ?? null,
      revenue: financial?.totalRevenue ?? null,
      netIncome: keyStats?.netIncomeToCommon ?? null,
      profitMargin: financial?.profitMargins ?? null,
      roic,
      roicNote,
      businessSummary: summary.summaryProfile?.longBusinessSummary ?? null,
      website: summary.summaryProfile?.website ?? null,
    };

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: `Could not find data for ticker "${symbol}"` },
      { status: 404 }
    );
  }
}
