import DashboardNavbar from "@/components/dashboard-navbar";
import { createClient } from "../../../supabase/server";
import { redirect } from "next/navigation";
import SentimentAnalyzer from "@/components/sentiment-analyzer";
import DashboardStats from "@/components/dashboard-stats";
import RecentAnalyses from "@/components/recent-analyses";
import { Toaster } from "@/components/ui/toaster";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get user profile data
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNavbar />
      <main className="w-full">
        <div className="container mx-auto px-4 py-8 space-y-8">
          {/* Header Section */}
          <header className="">
            <h1 className="text-3xl font-bold text-gray-900">
              Sentiment Analysis Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Analyze customer feedback and gain actionable insights
            </p>
          </header>

          {/* Stats Overview */}
          <DashboardStats userId={user.id} />

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Sentiment Analyzer */}
            <div className="lg:col-span-2">
              <SentimentAnalyzer
                userId={user.id}
                currentUsage={profile?.api_usage_current_month || 0}
                usageLimit={profile?.api_limit_per_month || 100}
                subscriptionStatus={profile?.subscription_status || "free"}
              />
            </div>

            {/* Recent Analyses */}
            <div className="lg:col-span-1">
              <RecentAnalyses userId={user.id} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
