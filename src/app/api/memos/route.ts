import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase not configured" },
      { status: 503 }
    );
  }

  const body = await request.json();

  const {
    ticker,
    company_name,
    step1_passed,
    step1_analysis,
    step2_passed,
    step2_analysis,
    step3_passed,
    step3_analysis,
    step4_passed,
    step4_analysis,
    overall_verdict,
    stock_data,
  } = body;

  if (!ticker || !company_name) {
    return NextResponse.json(
      { error: "ticker and company_name are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("memos")
    .insert({
      ticker,
      company_name,
      step1_passed,
      step1_analysis,
      step2_passed,
      step2_analysis,
      step3_passed,
      step3_analysis,
      step4_passed,
      step4_analysis,
      overall_verdict,
      stock_data,
    })
    .select()
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json(
      { error: "Failed to save memo" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function GET() {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Supabase not configured" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase
    .from("memos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch memos" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
