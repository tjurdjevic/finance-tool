import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a senior investment analyst. You analyze businesses using Warren Buffett and Charlie Munger's framework. You are concise, opinionated, and direct. No fluff. No jargon unless necessary. A smart 16-year-old should understand your output.";

function parseJSON(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  return JSON.parse(cleaned);
}

function buildDataBlock(stockData: Record<string, unknown>): string {
  return `Company: ${stockData.companyName} (${stockData.ticker})
Business Description: ${stockData.businessSummary || "Not available"}
Current Price: ${stockData.currentPrice ?? "N/A"}
Revenue: ${stockData.revenue ?? "N/A"}
Net Income: ${stockData.netIncome ?? "N/A"}
Profit Margin: ${stockData.profitMargin ?? "N/A"}
Market Cap: ${stockData.marketCap ?? "N/A"}
ROIC: ${stockData.roic ?? "N/A"}
P/E (TTM): ${stockData.peRatio ?? "N/A"}
Forward P/E: ${stockData.forwardPE ?? "N/A"}
52-Week Low: ${stockData.fiftyTwoWeekLow ?? "N/A"}
52-Week High: ${stockData.fiftyTwoWeekHigh ?? "N/A"}`;
}

async function callClaude(userPrompt: string): Promise<string> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { step, stockData } = body;

  if (!step || !stockData) {
    return NextResponse.json(
      { error: "step and stockData are required" },
      { status: 400 }
    );
  }

  const handlers: Record<number, (d: Record<string, unknown>) => Promise<NextResponse>> = {
    1: handleStep1,
    2: handleStep2,
    3: handleStep3,
    4: handleStep4,
  };

  const handler = handlers[step];
  if (!handler) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }
  return handler(stockData);
}

async function handleStep1(stockData: Record<string, unknown>) {
  const userPrompt = `Analyze this company for a Buffett-style investment review.

${buildDataBlock(stockData)}

Return your analysis as JSON with exactly this structure:
{
  "characteristics": ["tag1", "tag2", "tag3"],
  "summary": "Exactly 3 sentences max. How does this company make money? Written so a teenager gets it.",
  "verdict": "simple" or "complex"
}

Rules:
- characteristics: 3-5 short tags describing the business model (e.g. "Asset-Light", "Brand-Led", "Franchise Model", "Pricing Power", "Global Reach", "Subscription", "Platform", "Hardware", "Commodity", "Regulated")
- summary: Max 3 sentences. Plain English. How does the company actually make money?
- verdict: "simple" if a smart teenager could explain this business after 5 minutes, "complex" if not

Return ONLY the JSON object, no markdown fences, no extra text.`;

  try {
    const text = await callClaude(userPrompt);
    const parsed = parseJSON(text) as Record<string, unknown>;
    return NextResponse.json({
      step: 1,
      characteristics: parsed.characteristics,
      summary: parsed.summary,
      verdict: parsed.verdict,
    });
  } catch (err) {
    console.error("Step 1 analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze business" },
      { status: 500 }
    );
  }
}

async function handleStep2(stockData: Record<string, unknown>) {
  const userPrompt = `Evaluate the competitive moat of this company using Buffett's framework.

${buildDataBlock(stockData)}

Return your analysis as JSON with exactly this structure:
{
  "moatType": "one of: Brand Power, Network Effects, Switching Costs, Cost Advantage, Regulatory Moat, None Identified",
  "moatRating": "strong" or "moderate" or "weak",
  "evidence": "2-3 sentences explaining WHY this moat exists, with specific evidence from the data.",
  "threats": "1-2 sentences on what could erode or destroy this moat."
}

Rules:
- moatType: pick the single most dominant moat source. Be specific.
- moatRating: "strong" = nearly impossible to compete with, "moderate" = defensible but challenged, "weak" = little to no moat
- evidence: Use actual numbers from the data (margins, ROIC, market cap) to support your claim. Be concrete.
- threats: What realistic scenario could break this moat? Be honest.

Return ONLY the JSON object, no markdown fences, no extra text.`;

  try {
    const text = await callClaude(userPrompt);
    const parsed = parseJSON(text) as Record<string, unknown>;
    return NextResponse.json({
      step: 2,
      moatType: parsed.moatType,
      moatRating: parsed.moatRating,
      evidence: parsed.evidence,
      threats: parsed.threats,
    });
  } catch (err) {
    console.error("Step 2 analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze competitive advantage" },
      { status: 500 }
    );
  }
}

async function handleStep3(stockData: Record<string, unknown>) {
  const userPrompt = `Evaluate the management quality and capital allocation of this company.

${buildDataBlock(stockData)}

Return your analysis as JSON with exactly this structure:
{
  "grade": "A" or "B" or "C" or "D" or "F",
  "summary": "2-3 sentences on management quality and capital allocation track record.",
  "concerns": "1-2 sentences on any red flags or concerns about management.",
  "note": "Full management analysis requires SEC filing integration (coming soon)"
}

Rules:
- grade: Based on what you can infer from the financial data about capital allocation skill. A = exceptional, B = good, C = average, D = poor, F = destructive
- summary: Focus on what the numbers tell you about how management deploys capital. Are they generating good returns? Growing sensibly?
- concerns: Be honest. If margins are thin or ROIC is low, say so. If you can't assess something, say that.
- note: Always include the note field exactly as shown — this is a placeholder for future SEC filing analysis.

Return ONLY the JSON object, no markdown fences, no extra text.`;

  try {
    const text = await callClaude(userPrompt);
    const parsed = parseJSON(text) as Record<string, unknown>;
    return NextResponse.json({
      step: 3,
      grade: parsed.grade,
      summary: parsed.summary,
      concerns: parsed.concerns,
      note: parsed.note,
    });
  } catch (err) {
    console.error("Step 3 analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze management" },
      { status: 500 }
    );
  }
}

async function handleStep4(stockData: Record<string, unknown>) {
  const userPrompt = `Evaluate whether this stock is attractively priced for a long-term Buffett-style investor.

${buildDataBlock(stockData)}

Return your analysis as JSON with exactly this structure:
{
  "verdict": "undervalued" or "fairly valued" or "overvalued",
  "reasoning": "2-3 sentences explaining your valuation assessment. Reference specific metrics.",
  "marginOfSafety": "high" or "moderate" or "low" or "none",
  "keyMetric": "Name the single most important valuation metric for THIS specific company and explain in 1 sentence why it matters most."
}

Rules:
- verdict: Based on the current price relative to what the business earns and its growth prospects.
- reasoning: Use the P/E, forward P/E, margins, and 52-week range to make your case. Be specific with numbers.
- marginOfSafety: "high" = significant discount to intrinsic value, "moderate" = some cushion, "low" = slim margin, "none" = no margin of safety
- keyMetric: What single metric should an investor focus on for this company? (e.g. "P/E ratio at 25x vs 10-year average of 22x suggests slight premium")

Return ONLY the JSON object, no markdown fences, no extra text.`;

  try {
    const text = await callClaude(userPrompt);
    const parsed = parseJSON(text) as Record<string, unknown>;
    return NextResponse.json({
      step: 4,
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
      marginOfSafety: parsed.marginOfSafety,
      keyMetric: parsed.keyMetric,
    });
  } catch (err) {
    console.error("Step 4 analysis error:", err);
    return NextResponse.json(
      { error: "Failed to analyze valuation" },
      { status: 500 }
    );
  }
}
