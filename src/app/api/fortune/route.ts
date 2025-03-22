import { NextRequest, NextResponse } from "next/server";
import { CohereClient } from "cohere-ai";

// Define type for the fortunes object
interface Fortunes {
  probabilities: string[];
  actions: string[];
  random: string[];
}

// Initialize the Cohere client
// Note: API key should be set in environment variables
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || "",
});

// Helper function to generate a single prediction based on category
async function generateSinglePrediction(
  userInput: string,
  category: string,
  existingPredictions: string[] = []
): Promise<string> {
  try {
    let prompt = "";

    if (category === "probabilities") {
      prompt = `You are a mystic fortune teller. Based on this context: "${userInput}", generate one probability-based prediction (realistic, data-driven, maximum 10 words). It MUST be different from these existing predictions: "${existingPredictions.join(
        ", "
      )}". Only return the prediction text, no additional formatting.`;
    } else if (category === "actions") {
      prompt = `You are a mystic fortune teller. Based on this context: "${userInput}", generate one action recommendation (beneficial advice, maximum 10 words). It MUST be different from these existing predictions: "${existingPredictions.join(
        ", "
      )}". Only return the action text, no additional formatting.`;
    } else if (category === "random") {
      prompt = `You are a mystic fortune teller. Based on this context: "${userInput}", generate one unlikely but possible negative scenario (rare occurrence, maximum 10 words). 

IMPORTANT: Your response MUST:
1. Be COMPLETELY DIFFERENT in topic and content from these existing predictions: "${existingPredictions.join(
        ", "
      )}"
2. Use different sentence structures and vocabulary than the existing predictions
3. Focus on a different aspect or area of concern
4. Be unique and surprising, but still plausible
5. Be no longer than 10 words

Only return the scenario text, no additional formatting.`;
    } else {
      throw new Error("Invalid category");
    }

    const response = await cohere.generate({
      prompt,
      maxTokens: 30,
      temperature: category === "random" ? 0.9 : 0.8, // Higher temperature for random scenarios
      k: 0,
      stopSequences: ["\n"],
      returnLikelihoods: "NONE",
    });

    const prediction = response.generations[0].text.trim();

    // Check for duplicate content or significant similarity
    const isDuplicate = existingPredictions.some((p) => {
      const existingLower = p.toLowerCase();
      const newLower = prediction.toLowerCase();

      // Check for exact match
      if (existingLower === newLower) return true;

      // Check for highly similar content (over 70% of words match)
      const existingWords = new Set(
        existingLower.split(/\s+/).filter((w) => w.length > 3)
      );
      const newWords = newLower.split(/\s+/).filter((w) => w.length > 3);
      let matchCount = 0;

      for (const word of newWords) {
        if (existingWords.has(word)) matchCount++;
      }

      // If we have significant words and more than 70% match, consider it a duplicate
      return newWords.length > 2 && matchCount / newWords.length > 0.7;
    });

    if (isDuplicate) {
      // Try again with even higher temperature for more variation
      const retryResponse = await cohere.generate({
        prompt,
        maxTokens: 30,
        temperature: 0.97, // Much higher temperature for more variation
        k: 0,
        stopSequences: ["\n"],
        returnLikelihoods: "NONE",
      });
      return retryResponse.generations[0].text.trim();
    }

    return prediction;
  } catch (error) {
    console.error(`Error generating single prediction for ${category}:`, error);

    // Fallback predictions by category
    const fallbacks = {
      probabilities: [
        "New technology will disrupt your industry within months.",
        "A collaboration opportunity will present itself soon.",
        "Financial market shifts favor your current position.",
        "Your skills will become more valuable in six months.",
        "Major reorganization will impact your team by year-end.",
        "Remote work becomes permanent for your position.",
      ],
      actions: [
        "Invest in learning one new skill this quarter.",
        "Strengthen your network in unexpected industries.",
        "Document your achievements for future opportunities.",
        "Build a personal brand around unique expertise.",
        "Set boundaries to prevent career burnout.",
      ],
      random: [
        "Data breach exposes sensitive information you shared online.",
        "Unexpected health concern requires immediate attention.",
        "Key team member suddenly leaves, shifting project responsibilities.",
        "Critical computer failure loses weeks of work.",
        "Industry regulation change obsoletes current skill set.",
        "Legal oversight costs you significant financial damages.",
        "Home damage from unexpected natural event.",
        "Accidental disclosure undermines client relationship trust.",
        "Vehicle malfunction leads to missed opportunity.",
        "Critical career opportunity missed due to scheduling error.",
      ],
    };

    // Get all fallbacks for this category
    const categoryFallbacks = fallbacks[category as keyof typeof fallbacks];

    // Filter out any existing predictions or similar content
    const availableFallbacks = categoryFallbacks.filter((fallback) => {
      return !existingPredictions.some((existing) => {
        // Check exact match
        if (existing.toLowerCase() === fallback.toLowerCase()) return true;

        // Check for significant word overlap
        const existingWords = new Set(
          existing
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3)
        );
        const fallbackWords = fallback
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        let matchCount = 0;

        for (const word of fallbackWords) {
          if (existingWords.has(word)) matchCount++;
        }

        return (
          fallbackWords.length > 2 && matchCount / fallbackWords.length > 0.5
        );
      });
    });

    // If all fallbacks are used, create a modified version
    if (availableFallbacks.length === 0) {
      const randomFallback =
        categoryFallbacks[Math.floor(Math.random() * categoryFallbacks.length)];
      const modifiers = [
        "Unexpectedly, ",
        "Surprisingly, ",
        "Without warning, ",
        "Suddenly, ",
        "Out of nowhere, ",
        "Despite precautions, ",
      ];
      const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      return `${modifier}${randomFallback.toLowerCase()}`;
    }

    // Return a random unused fallback
    return availableFallbacks[
      Math.floor(Math.random() * availableFallbacks.length)
    ];
  }
}

// Helper function to generate multiple unique predictions in a batch
async function generateBatchPredictions(
  userInput: string,
  category: string,
  indices: number[],
  currentPredictions: string[]
): Promise<Record<number, string>> {
  const result: Record<number, string> = {};
  // Create a deep copy to avoid reference issues
  const existingPredictions = [...currentPredictions];

  // If we're shuffling the entire category at once, it's better to generate all new predictions
  // to maximize uniqueness
  if (indices.length === currentPredictions.length && category === "random") {
    // For "random" category when shuffling all items, use a special grouped approach
    const prompt = `You are a mystic fortune teller. Based on this context: "${userInput}", generate ${
      indices.length
    } unlikely but possible negative scenarios (rare occurrences, maximum 10 words each).

    IMPORTANT REQUIREMENTS:
    1. Each scenario MUST be COMPLETELY DIFFERENT from the others
    2. Each scenario must cover a different area of life or concern
    3. Each should use different vocabulary and sentence structures
    4. Each must be original and not similar to: "${existingPredictions.join(
      ", "
    )}"
    5. Each must be no longer than 10 words
    6. Format as a JSON array of strings: ["scenario1", "scenario2", ...]
    
    Only return the JSON array, nothing else.`;

    try {
      const response = await cohere.generate({
        prompt,
        maxTokens: indices.length * 50,
        temperature: 0.9,
        k: 0,
        returnLikelihoods: "NONE",
      });

      const generatedText = response.generations[0].text.trim();
      try {
        // Try to parse as JSON
        const scenarios = JSON.parse(generatedText);
        if (Array.isArray(scenarios) && scenarios.length >= indices.length) {
          // Assign the scenarios to the respective indices
          indices.forEach((index, i) => {
            if (i < scenarios.length) {
              result[index] = scenarios[i];
            }
          });

          // Check if we got enough scenarios
          if (Object.keys(result).length === indices.length) {
            return result;
          }
        }
      } catch (e) {
        console.error("Failed to parse batch predictions:", e);
        // Fall through to individual generation if batch fails
      }
    } catch (e) {
      console.error("Failed to generate batch predictions:", e);
      // Fall through to individual generation if batch fails
    }
  }

  // Process each index individually (fallback approach or for small batches)
  for (const index of indices) {
    // Get current value to avoid shuffling to the same prediction
    const currentValue = currentPredictions[index];
    let attempts = 0;
    let newPrediction: string;

    // Try up to 3 times to get a unique prediction
    do {
      newPrediction = await generateSinglePrediction(
        userInput,
        category,
        existingPredictions
      );
      attempts++;
    } while (
      attempts < 3 &&
      (newPrediction.toLowerCase() === currentValue?.toLowerCase() ||
        existingPredictions.some(
          (p) => p.toLowerCase() === newPrediction.toLowerCase()
        ))
    );

    result[index] = newPrediction;
    existingPredictions.push(newPrediction);
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { userInput, shuffleCategory, shuffleIndices, currentPredictions } =
      body;

    if (!userInput || typeof userInput !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (!process.env.COHERE_API_KEY) {
      return NextResponse.json(
        { error: "Cohere API key not configured" },
        { status: 500 }
      );
    }

    // If we're shuffling multiple items
    if (
      shuffleCategory &&
      Array.isArray(shuffleIndices) &&
      shuffleIndices.length > 0 &&
      Array.isArray(currentPredictions)
    ) {
      const batchResults = await generateBatchPredictions(
        userInput,
        shuffleCategory,
        shuffleIndices,
        currentPredictions
      );

      return NextResponse.json({
        predictions: batchResults,
        category: shuffleCategory,
      });
    }

    // If we're shuffling a single item (backward compatibility)
    const shuffleIndex = body.shuffleIndex;
    if (shuffleCategory && typeof shuffleIndex === "number") {
      const existingPredictions = Array.isArray(currentPredictions)
        ? currentPredictions
        : [];
      const newPrediction = await generateSinglePrediction(
        userInput,
        shuffleCategory,
        existingPredictions
      );
      return NextResponse.json({
        prediction: newPrediction,
        category: shuffleCategory,
        index: shuffleIndex,
      });
    }

    // Generate the fortunes using Cohere
    const response = await cohere.generate({
      prompt: `You are a mystic fortune teller. Based on this context: "${userInput}", generate three types of predictions:
      
      1. Three probability-based predictions (realistic, data-driven, max 10 words each)
      2. Two action recommendations (beneficial advice, max 10 words each)
      3. Two unlikely but possible negative scenarios (rare occurrences, max 10 words each)
      
      Each prediction MUST be unique - no duplicate predictions allowed.
      
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
    let fortunes: Fortunes;

    try {
      const parsedResponse = JSON.parse(generatedText) as Partial<Fortunes>;

      // Validate the structure
      if (
        !parsedResponse.probabilities ||
        !parsedResponse.actions ||
        !parsedResponse.random ||
        !Array.isArray(parsedResponse.probabilities) ||
        !Array.isArray(parsedResponse.actions) ||
        !Array.isArray(parsedResponse.random)
      ) {
        throw new Error("Invalid response format");
      }

      fortunes = parsedResponse as Fortunes;

      // Check for duplicates within each category and fix if needed
      const fixDuplicates = async (category: keyof Fortunes) => {
        const items = fortunes[category];
        const uniqueItems = [...new Set(items)];

        // If we have duplicates, generate new predictions
        if (uniqueItems.length < items.length) {
          const existingPredictions = uniqueItems;
          // Number of new predictions needed
          const neededCount = items.length - uniqueItems.length;

          for (let i = 0; i < neededCount; i++) {
            const newPrediction = await generateSinglePrediction(
              userInput,
              category,
              existingPredictions
            );
            existingPredictions.push(newPrediction);
          }

          fortunes[category] = existingPredictions;
        }
      };

      await fixDuplicates("probabilities");
      await fixDuplicates("actions");
      await fixDuplicates("random");
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
