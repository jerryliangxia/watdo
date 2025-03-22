import { NextRequest, NextResponse } from "next/server";
import {
  generateFortunes,
  generateBatchShuffles,
} from "@/lib/models/fortune-generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, category, indices, currentPredictions } = body;

    // Validate input
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "A valid prompt is required" },
        { status: 400 }
      );
    }

    // Handle two types of requests: initial fortune generation and prediction shuffles
    if (category && indices && currentPredictions) {
      // This is a request to shuffle specific predictions
      if (!Array.isArray(indices) || !Array.isArray(currentPredictions)) {
        return NextResponse.json(
          { error: "Invalid indices or currentPredictions format" },
          { status: 400 }
        );
      }

      // Handle batch shuffling
      const result = await generateBatchShuffles(
        prompt,
        category,
        indices,
        currentPredictions
      );

      return NextResponse.json(result);
    } else {
      // This is a request for initial fortune generation
      const fortunes = await generateFortunes(prompt);
      return NextResponse.json(fortunes);
    }
  } catch (_error) {
    console.error("Error processing fortune request:", _error);
    return NextResponse.json(
      { error: "Failed to generate fortunes" },
      { status: 500 }
    );
  }
}
