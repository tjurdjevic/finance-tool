import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const SYMBOLS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" },
  { symbol: "^DJI", label: "DOW" },
  { symbol: "^TNX", label: "10Y UST" },
];

export async function GET() {
  try {
    const results = await Promise.all(
      SYMBOLS.map(async ({ symbol, label }) => {
        try {
          const q = await yahooFinance.quote(symbol);
          const price = q.regularMarketPrice ?? null;
          const changePct = q.regularMarketChangePercent ?? null;

          // Format price: TNX is a yield (show as %), others as numbers
          let value: string;
          if (symbol === "^TNX" && price !== null) {
            value = `${price.toFixed(2)}%`;
          } else if (price !== null) {
            value = price.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          } else {
            value = "—";
          }

          const up = changePct !== null ? changePct >= 0 : true;
          const change =
            changePct !== null
              ? `${up ? "+" : ""}${changePct.toFixed(2)}%`
              : "—";

          return { symbol: label, value, change, up };
        } catch {
          return { symbol: label, value: "—", change: "—", up: true };
        }
      })
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
