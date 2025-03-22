import { NextRequest, NextResponse } from "next/server";
import { CohereClient } from "cohere-ai";

// Initialize the Cohere client
// Note: API key should be set in environment variables
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const { userInput } = await req.json();

    if (!userInput || typeof userInput !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!process.env.COHERE_API_KEY) {
      return NextResponse.json(
        { error: "Cohere API key not configured" },
        { status: 500 }
      );
    }

    // Generate the fortunes using Cohere
    const response = await cohere.generate({
      prompt: `You are a mystic fortune teller. Based on this context: "${userInput}", generate three types of predictions:
      
      1. Three probability-based predictions (realistic, data-driven, max 10 words each)
      2. Two action recommendations (beneficial advice, max 10 words each)
      3. Two unlikely but possible negative scenarios (rare occurrences, max 10 words each)
      
      Format your response as a JSON object with the following structure:
      {
        "probabilities": ["prediction1", "prediction2", "prediction3"],
        "actions": ["action1", "action2"],
        "random": ["scenario1", "scenario2"]
      }
      
      Only return the JSON object, nothing else.`,
      maxTokens: 300,
      temperature: 0.7,
      k: 0,
      stopSequences: [],
      returnLikelihoods: "NONE",
    });

    // Parse the generated text as JSON
    const generatedText = response.generations[0].text.trim();
    let fortunes;

    try {
      fortunes = JSON.parse(generatedText);

      // Validate the structure
      if (
        !fortunes.probabilities ||
        !fortunes.actions ||
        !fortunes.random ||
        !Array.isArray(fortunes.probabilities) ||
        !Array.isArray(fortunes.actions) ||
        !Array.isArray(fortunes.random)
      ) {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Failed to parse Cohere response:", generatedText);
      // Fallback to default fortunes if parsing fails
      fortunes = {
        probabilities: [
          "Market trends indicate potential growth in your sector.",
          "A professional opportunity will present itself soon.",
          "Your current path leads to financial stability.",
        ],
        actions: [
          "Diversify your investments for long-term security.",
          "Build connections in your field of interest.",
        ],
        random: [
          "Unexpected travel disruption may affect future plans.",
          "A technological failure could impact personal data.",
        ],
      };
    }

    return NextResponse.json({ fortunes });
  } catch (error) {
    console.error("Error processing fortune request:", error);
    return NextResponse.json(
      { error: "Failed to generate fortune" },
      { status: 500 }
    );
  }
}
