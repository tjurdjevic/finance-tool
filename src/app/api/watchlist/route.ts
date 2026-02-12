import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

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
    .from("watchlist")
    .select("*")
    .order("added_at", { ascending: false });

  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

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
  const { ticker, company_name } = body;

  if (!ticker || !company_name) {
    return NextResponse.json(
      { error: "ticker and company_name are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("watchlist")
    .insert({ ticker, company_name })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Already in watchlist" },
        { status: 409 }
      );
    }
    console.error("Supabase insert error:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
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
  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { error: "id is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Supabase delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
