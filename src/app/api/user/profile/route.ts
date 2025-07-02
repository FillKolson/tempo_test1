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

    // Get user profile and subscription info
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 },
      );
    }

    // Get subscription info
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || profile?.name,
        subscription_status: profile?.subscription_status || "free",
        api_usage_current_month: profile?.api_usage_current_month || 0,
        api_limit_per_month: profile?.api_limit_per_month || 100,
        created_at: profile?.created_at,
      },
      subscription: subscription
        ? {
            plan_name:
              subscription.interval === "month"
                ? subscription.amount === 1900
                  ? "pro"
                  : "enterprise"
                : "free",
            status: subscription.status,
            current_period_end: subscription.current_period_end,
          }
        : null,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const { full_name, email } = await request.json();

    // Update user profile
    const updates: any = {};
    if (full_name) updates.full_name = full_name;
    if (email && email !== user.email) {
      // Update auth email
      const { error: emailError } = await supabase.auth.updateUser({ email });
      if (emailError) {
        return NextResponse.json(
          { error: "Failed to update email" },
          { status: 400 },
        );
      }
      updates.email = email;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 },
        );
      }
    }

    // Return updated profile
    const { data: profile } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      user: {
        id: user.id,
        email: profile?.email || user.email,
        full_name: profile?.full_name || profile?.name,
        subscription_status: profile?.subscription_status || "free",
        api_usage_current_month: profile?.api_usage_current_month || 0,
        api_limit_per_month: profile?.api_limit_per_month || 100,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
