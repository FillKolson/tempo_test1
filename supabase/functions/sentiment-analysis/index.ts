import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SentimentRequest {
  text: string;
  user_id: string;
}

interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  key_phrases: string[];
  processing_time_ms: number;
  tokens_used: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, user_id }: SentimentRequest = await req.json();

    if (!text || !user_id) {
      return new Response(
        JSON.stringify({ error: "Text and user_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const startTime = Date.now();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Check user's usage limits
    const { data: userData } = await supabaseClient
      .from("users")
      .select("api_usage_current_month, api_limit_per_month")
      .eq("id", user_id)
      .single();

    if (
      userData &&
      userData.api_usage_current_month >= userData.api_limit_per_month
    ) {
      return new Response(
        JSON.stringify({ error: "API usage limit exceeded" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Simple sentiment analysis (replace with Anthropic API call in production)
    const positiveWords = [
      "good",
      "great",
      "excellent",
      "amazing",
      "wonderful",
      "fantastic",
      "love",
      "perfect",
      "best",
      "awesome",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "awful",
      "horrible",
      "hate",
      "worst",
      "disappointing",
      "poor",
      "useless",
      "annoying",
    ];

    const words = text.toLowerCase().split(/\W+/);
    let positiveCount = 0;
    let negativeCount = 0;
    const foundKeyPhrases: string[] = [];

    words.forEach((word) => {
      if (positiveWords.includes(word)) {
        positiveCount++;
        foundKeyPhrases.push(word);
      } else if (negativeWords.includes(word)) {
        negativeCount++;
        foundKeyPhrases.push(word);
      }
    });

    let sentiment: "positive" | "negative" | "neutral";
    let confidence: number;

    if (positiveCount > negativeCount) {
      sentiment = "positive";
      confidence = Math.min(0.6 + (positiveCount - negativeCount) * 0.1, 0.95);
    } else if (negativeCount > positiveCount) {
      sentiment = "negative";
      confidence = Math.min(0.6 + (negativeCount - positiveCount) * 0.1, 0.95);
    } else {
      sentiment = "neutral";
      confidence = 0.5 + Math.random() * 0.2;
    }

    const processingTime = Date.now() - startTime;
    const tokensUsed = Math.ceil(text.length / 4); // Rough estimate

    const result: SentimentResult = {
      sentiment,
      confidence,
      key_phrases: [...new Set(foundKeyPhrases)].slice(0, 5),
      processing_time_ms: processingTime,
      tokens_used: tokensUsed,
    };

    // Store the analysis in the database
    const { error: insertError } = await supabaseClient
      .from("sentiment_analyses")
      .insert({
        user_id,
        input_text: text,
        sentiment_result: result,
        analysis_type: "single_text",
        tokens_used: tokensUsed,
        processing_time_ms: processingTime,
      });

    if (insertError) {
      console.error("Error storing analysis:", insertError);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
