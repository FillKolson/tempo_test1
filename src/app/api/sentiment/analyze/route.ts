import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

interface SentimentResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  key_phrases: string[];
  processing_time_ms: number;
  tokens_used: number;
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get request body
    const { text, options = {} } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length > 10000) {
      return NextResponse.json(
        { error: "Text too long (max 10,000 characters)" },
        { status: 400 },
      );
    }

    // Check user's usage limits
    const { data: userData } = await supabase
      .from("users")
      .select(
        "api_usage_current_month, api_limit_per_month, subscription_status",
      )
      .eq("id", user.id)
      .single();

    if (
      userData &&
      userData.api_usage_current_month >= userData.api_limit_per_month
    ) {
      return NextResponse.json(
        {
          error: "API usage limit exceeded. Please upgrade your plan.",
        },
        { status: 429 },
      );
    }

    // Analyze sentiment using Anthropic Claude
    const prompt = `Analyze the sentiment of the following text and provide a JSON response with the following structure:
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": number between 0 and 1,
  "key_phrases": ["phrase1", "phrase2", "phrase3"]
}

Text to analyze: "${text}"

Provide only the JSON response, no additional text.`;

    const message = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";
    let analysisResult;

    try {
      analysisResult = JSON.parse(responseText);
    } catch (parseError) {
      // Fallback parsing if JSON is malformed
      const sentiment = responseText.toLowerCase().includes("positive")
        ? "positive"
        : responseText.toLowerCase().includes("negative")
          ? "negative"
          : "neutral";
      analysisResult = {
        sentiment,
        confidence: 0.7,
        key_phrases: [],
      };
    }

    const processingTime = Date.now() - startTime;
    const tokensUsed = message.usage?.input_tokens || 0;

    const result: SentimentResult = {
      sentiment: analysisResult.sentiment,
      confidence: analysisResult.confidence,
      key_phrases: analysisResult.key_phrases || [],
      processing_time_ms: processingTime,
      tokens_used: tokensUsed,
    };

    // Store the analysis in the database
    const { error: insertError } = await supabase
      .from("sentiment_analyses")
      .insert({
        user_id: user.id,
        input_text: text,
        sentiment_result: result,
        analysis_type: "single_text",
        tokens_used: tokensUsed,
        processing_time_ms: processingTime,
      });

    if (insertError) {
      console.error("Error storing analysis:", insertError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Sentiment analysis error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
