import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  const symbol = ticker.toUpperCase();

  try {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const [summary, fundamentals] = await Promise.all([
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
          module: "all",
        })
        .catch(() => null),
    ]);

    const price = summary.price;
    const detail = summary.summaryDetail;
    const financial = summary.financialData;
    const keyStats = summary.defaultKeyStatistics;

    // Calculate ROIC from fundamentals time series data
    // ROIC = NOPAT / Invested Capital
    let roic: number | null = null;
    if (fundamentals && fundamentals.length > 0) {
      const latest = fundamentals[fundamentals.length - 1] as Record<
        string,
        unknown
      >;
      const operatingIncome = latest.operatingIncome as number | undefined;
      const investedCapital = latest.investedCapital as number | undefined;
      const taxRate = latest.taxRateForCalcs as number | undefined;

      if (operatingIncome && investedCapital && investedCapital > 0) {
        const nopat = operatingIncome * (1 - (taxRate ?? 0.21));
        roic = nopat / investedCapital;
      }
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
