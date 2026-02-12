import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a senior investment analyst. You analyze businesses using Warren Buffett and Charlie Munger's framework. You are concise, opinionated, and direct. No fluff. No jargon unless necessary. A smart 16-year-old should understand your output.";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { step, stockData } = body;

  if (!step || !stockData) {
    return NextResponse.json(
      { error: "step and stockData are required" },
      { status: 400 }
    );
  }

  if (step === 1) {
    return handleStep1(stockData);
  }

  return NextResponse.json({ error: "Invalid step" }, { status: 400 });
}

async function handleStep1(stockData: Record<string, unknown>) {
  const userPrompt = `Analyze this company for a Buffett-style investment review.

Company: ${stockData.companyName} (${stockData.ticker})
Business Description: ${stockData.businessSummary || "Not available"}
Revenue: ${stockData.revenue ?? "N/A"}
Net Income: ${stockData.netIncome ?? "N/A"}
Profit Margin: ${stockData.profitMargin ?? "N/A"}
Market Cap: ${stockData.marketCap ?? "N/A"}

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
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    let text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

    const parsed = JSON.parse(text);

    return NextResponse.json({
      step: 1,
      characteristics: parsed.characteristics,
      summary: parsed.summary,
      verdict: parsed.verdict,
    });
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      { error: "Failed to analyze business" },
      { status: 500 }
    );
  }
}
