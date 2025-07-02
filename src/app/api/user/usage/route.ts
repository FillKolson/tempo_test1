import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's current usage
    const { data: userData } = await supabase
      .from("users")
      .select(
        "api_usage_current_month, api_limit_per_month, subscription_status",
      )
      .eq("id", user.id)
      .single();

    // Get usage history for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: usageHistory } = await supabase
      .from("usage_tracking")
      .select("date, api_calls_count, tokens_consumed")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: true });

    return NextResponse.json({
      current_month_usage: userData?.api_usage_current_month || 0,
      limit: userData?.api_limit_per_month || 100,
      subscription_plan: userData?.subscription_status || "free",
      usage_history: usageHistory || [],
    });
  } catch (error) {
    console.error("Usage fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
