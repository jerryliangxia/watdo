import { CohereClient } from "cohere-ai";

// Define types for the fortunes
export interface Fortunes {
  probabilities: string[];
  actions: string[];
  random: string[];
}

export interface ShuffleResult {
  predictions: Record<number, string>;
  category: string;
}

// Initialize the Cohere client
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || "",
});

// Different prompt templates for different scenarios
const PROMPT_TEMPLATES = {
  initial: `You are a mystic fortune teller. Based on this context: "{{INPUT}}", generate three types of predictions:
      
1. Three probability-based predictions about what might happen (realistic but uncertain, max 10 words each)
2. Two action recommendations (beneficial advice, max 10 words each)
3. Two unlikely but possible negative scenarios (rare occurrences, max 10 words each)

Each prediction MUST be unique - no duplicate predictions allowed.
Each prediction MUST be relevant to the input context.
Each negative scenario MUST be completely different from the others.

Format your response as a JSON object with the following structure:
{
  "probabilities": ["prediction1", "prediction2", "prediction3"],
  "actions": ["action1", "action2"],
  "random": ["scenario1", "scenario2"]
}

Only return the JSON object, nothing else.`,

  probabilitySingle: `You are a mystic fortune teller predicting what might happen. Based on this context: "{{INPUT}}", generate one probability-based prediction (realistic but uncertain, maximum 10 words).

It MUST be different from these existing predictions: "{{EXISTING}}".
AVOID giving advice - just state what might happen.
Focus on events rather than personal qualities.

Only return the prediction text, nothing else.`,

  actionSingle: `You are a mystic fortune teller suggesting what someone should do. Based on this context: "{{INPUT}}", generate one action recommendation (beneficial advice, maximum 10 words).

It MUST be different from these existing recommendations: "{{EXISTING}}".
Make it practical, relevant, and specific to the context.
Avoid general life advice that's too broad to be useful.

Only return the action recommendation text, nothing else.`,

  randomSingle: `You are a mystic fortune teller predicting rare but possible negative scenarios. Based on this context: "{{INPUT}}", generate one unlikely negative scenario (maximum 10 words).

IMPORTANT REQUIREMENTS:
1. It MUST be completely different in topic and content from: "{{EXISTING}}"
2. It should be unexpected but still plausible
3. It should focus on a specific event, not vague consequences
4. Avoid duplicating words or phrases from existing scenarios
5. It MUST be different in structure from existing scenarios
6. It should be a concrete scenario, not general advice
7. Focus on what might happen, not what one should do

Only return the scenario text, no additional formatting.`,

  randomBatch: `You are a mystic fortune teller predicting rare but possible negative events. Based on this context: "{{INPUT}}", generate {{COUNT}} completely different unlikely negative scenarios (maximum 10 words each).

EXTREMELY IMPORTANT REQUIREMENTS:
1. Each scenario MUST cover a completely different area of life or concern
2. Each scenario MUST use different vocabulary and sentence structures
3. Each scenario MUST focus on different types of risks
4. No scenario should be similar to: "{{EXISTING}}"
5. Each scenario should be unexpected but still plausible
6. Each scenario should describe concrete events, not vague warnings
7. Avoid repetitive structures like "You will..." in multiple scenarios
8. Focus on what might happen, not what one should do

Format as a JSON array of strings: ["scenario1", "scenario2", ...]
Only return the JSON array, nothing else.`,
};

// Generate initial fortunes
export async function generateFortunes(userInput: string): Promise<Fortunes> {
  try {
    const prompt = PROMPT_TEMPLATES.initial.replace("{{INPUT}}", userInput);

    const response = await cohere.generate({
      prompt,
      maxTokens: 300,
      temperature: 0.75,
      k: 0,
      stopSequences: [],
      returnLikelihoods: "NONE",
    });

    // Parse the generated text as JSON
    const generatedText = response.generations[0].text.trim();
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

    // Create a properly structured fortunes object
    const fortunes: Fortunes = {
      probabilities: parsedResponse.probabilities,
      actions: parsedResponse.actions,
      random: parsedResponse.random,
    };

    // Check for duplicates within each category and fix if needed
    await fixDuplicates(fortunes, userInput);

    return fortunes;
  } catch (error) {
    console.error("Failed to generate fortunes:", error);
    // Return fallback fortunes
    return getFallbackFortunes();
  }
}

// Generate a batch of shuffled predictions
export async function generateBatchShuffles(
  userInput: string,
  category: string,
  indices: number[],
  currentPredictions: string[]
): Promise<ShuffleResult> {
  try {
    // Choose the appropriate template and approach based on category and batch size
    if (category === "random" && indices.length > 1) {
      const result = await generateRandomBatch(
        userInput,
        indices,
        currentPredictions
      );
      return {
        predictions: result,
        category,
      };
    } else {
      // Process individual items for other categories or small batches
      const result = await generateIndividualShuffles(
        userInput,
        category,
        indices,
        currentPredictions
      );
      return {
        predictions: result,
        category,
      };
    }
  } catch (error) {
    console.error(`Error generating batch shuffles for ${category}:`, error);
    // Return fallback predictions
    const fallbacks = getFallbacksByCategory(category);
    const result: Record<number, string> = {};
    indices.forEach((index, i) => {
      const fallbackIndex = i % fallbacks.length;
      result[index] = fallbacks[fallbackIndex];
    });
    return {
      predictions: result,
      category,
    };
  }
}

// Generate random negative scenarios as a batch
async function generateRandomBatch(
  userInput: string,
  indices: number[],
  currentPredictions: string[]
): Promise<Record<number, string>> {
  const result: Record<number, string> = {};
  const existingPredictions = currentPredictions.filter(
    (_, i) => !indices.includes(i)
  );

  const prompt = PROMPT_TEMPLATES.randomBatch
    .replace("{{INPUT}}", userInput)
    .replace("{{COUNT}}", indices.length.toString())
    .replace("{{EXISTING}}", existingPredictions.join(", "));

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
      // Try to parse as JSON array
      const scenarios = JSON.parse(generatedText);
      if (Array.isArray(scenarios) && scenarios.length >= indices.length) {
        // Add each scenario to the result using the original indices
        indices.forEach((index, i) => {
          if (i < scenarios.length) {
            result[index] = scenarios[i];
          }
        });

        // Check for duplicates or similarities within the newly generated set
        const newlyGenerated = Object.values(result);
        const dupeIndices: number[] = [];

        // Check each new prediction against others for similarities
        newlyGenerated.forEach((prediction, i) => {
          for (let j = 0; j < i; j++) {
            if (areSimilar(prediction, newlyGenerated[j])) {
              dupeIndices.push(indices[i]);
              break;
            }
          }
        });

        // If we found duplicates, individually generate replacements
        if (dupeIndices.length > 0) {
          const replacements = await generateIndividualShuffles(
            userInput,
            "random",
            dupeIndices,
            [...currentPredictions, ...Object.values(result)]
          );

          // Merge the replacements with the results
          Object.assign(result, replacements);
        }

        return result;
      }
    } catch (e) {
      console.error("Failed to parse batch random scenarios:", e);
      // Fall through to individual generation
    }
  } catch (e) {
    console.error("Failed to generate batch random scenarios:", e);
    // Fall through to individual generation
  }

  // Fallback to individual generation
  return generateIndividualShuffles(
    userInput,
    "random",
    indices,
    currentPredictions
  );
}

// Generate individual shuffled predictions
async function generateIndividualShuffles(
  userInput: string,
  category: string,
  indices: number[],
  currentPredictions: string[]
): Promise<Record<number, string>> {
  const result: Record<number, string> = {};
  const allExistingPredictions = [...currentPredictions];

  // Process each index individually
  for (const index of indices) {
    // Get all predictions that aren't being shuffled plus what we've generated so far
    const otherPredictions = currentPredictions
      .filter((_, i) => !indices.includes(i) || i === index)
      .concat(Object.values(result));

    const currentValue = currentPredictions[index];
    let attempts = 0;
    let newPrediction = "";

    // Try up to 3 times to get a unique prediction
    do {
      newPrediction = await generateSinglePrediction(
        userInput,
        category,
        otherPredictions
      );
      attempts++;
    } while (
      attempts < 3 &&
      (areSimilar(newPrediction, currentValue) ||
        otherPredictions.some((p) => areSimilar(p, newPrediction)))
    );

    result[index] = newPrediction;
    allExistingPredictions.push(newPrediction);
  }

  return result;
}

// Generate a single prediction for a specific category
async function generateSinglePrediction(
  userInput: string,
  category: string,
  existingPredictions: string[] = []
): Promise<string> {
  try {
    // Select the appropriate template based on category
    let templateKey: keyof typeof PROMPT_TEMPLATES;

    switch (category) {
      case "probabilities":
        templateKey = "probabilitySingle";
        break;
      case "actions":
        templateKey = "actionSingle";
        break;
      case "random":
        templateKey = "randomSingle";
        break;
      default:
        throw new Error("Invalid category");
    }

    const prompt = PROMPT_TEMPLATES[templateKey]
      .replace("{{INPUT}}", userInput)
      .replace("{{EXISTING}}", existingPredictions.join(", "));

    const response = await cohere.generate({
      prompt,
      maxTokens: 30,
      temperature: category === "random" ? 0.92 : 0.82,
      k: 0,
      stopSequences: ["\n"],
      returnLikelihoods: "NONE",
    });

    let prediction = response.generations[0].text.trim();

    // If the prediction is similar to any existing ones, try again with higher temperature
    if (existingPredictions.some((p) => areSimilar(p, prediction))) {
      const retryResponse = await cohere.generate({
        prompt,
        maxTokens: 30,
        temperature: 0.98, // Much higher temperature for more variation
        k: 0,
        stopSequences: ["\n"],
        returnLikelihoods: "NONE",
      });
      prediction = retryResponse.generations[0].text.trim();
    }

    return prediction;
  } catch (error) {
    console.error(`Error generating single prediction for ${category}:`, error);
    // Return a fallback prediction
    return getRandomFallback(category, existingPredictions);
  }
}

// Fix any duplicates in the generated fortunes
async function fixDuplicates(
  fortunes: Fortunes,
  userInput: string
): Promise<void> {
  const categories: (keyof Fortunes)[] = ["probabilities", "actions", "random"];

  for (const category of categories) {
    const items = fortunes[category];
    const uniqueItems = Array.from(
      new Set(items.map((item) => item.toLowerCase()))
    );

    // If we have duplicates, generate new predictions
    if (uniqueItems.length < items.length) {
      const existingPredictions = [...new Set(items)];
      const neededCount = items.length - existingPredictions.length;

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

    // Also check for similar items
    const finalPredictions = [...fortunes[category]];
    const similarityMap: Record<number, boolean> = {};

    for (let i = 0; i < finalPredictions.length; i++) {
      for (let j = i + 1; j < finalPredictions.length; j++) {
        if (areSimilar(finalPredictions[i], finalPredictions[j])) {
          // Mark the later item for replacement
          similarityMap[j] = true;
        }
      }
    }

    // Replace similar items
    const similarIndices = Object.keys(similarityMap).map(Number);
    if (similarIndices.length > 0) {
      for (const index of similarIndices) {
        const newPrediction = await generateSinglePrediction(
          userInput,
          category,
          finalPredictions
        );
        finalPredictions[index] = newPrediction;
      }

      fortunes[category] = finalPredictions;
    }
  }
}

// Check if two predictions are similar
function areSimilar(a: string, b: string): boolean {
  // Check for exact match (case insensitive)
  if (a.toLowerCase() === b.toLowerCase()) return true;

  // Extract meaningful words (longer than 3 characters) for comparison
  const wordsA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const wordsB = b
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // If either has too few meaningful words, do a substring check
  if (wordsA.size < 2 || wordsB.length < 2) {
    const shorterText = a.length < b.length ? a.toLowerCase() : b.toLowerCase();
    const longerText = a.length < b.length ? b.toLowerCase() : a.toLowerCase();
    return longerText.includes(shorterText);
  }

  // Check word overlap percentage
  let matchCount = 0;
  for (const word of wordsB) {
    if (wordsA.has(word)) matchCount++;
  }

  // If more than 60% of significant words match, consider them similar
  return wordsB.length > 0 && matchCount / wordsB.length > 0.6;
}

// Get a random fallback prediction for a category
function getRandomFallback(
  category: string,
  existingPredictions: string[] = []
): string {
  const fallbacks = getFallbacksByCategory(category);

  // Filter out any existing predictions or similar content
  const availableFallbacks = fallbacks.filter((fallback) => {
    return !existingPredictions.some((existing) =>
      areSimilar(existing, fallback)
    );
  });

  // If all fallbacks are used, create a modified version
  if (availableFallbacks.length === 0) {
    const randomFallback =
      fallbacks[Math.floor(Math.random() * fallbacks.length)];
    const modifiers =
      category === "random"
        ? [
            "Unexpectedly, ",
            "Surprisingly, ",
            "Without warning, ",
            "Suddenly, ",
            "Out of nowhere, ",
          ]
        : [
            "Very likely ",
            "Almost certainly ",
            "In all probability ",
            "There's a good chance ",
          ];

    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    return `${modifier}${randomFallback.toLowerCase()}`;
  }

  // Return a random unused fallback
  return availableFallbacks[
    Math.floor(Math.random() * availableFallbacks.length)
  ];
}

// Get fallback predictions for a specific category
function getFallbacksByCategory(category: string): string[] {
  const fallbacks = {
    probabilities: [
      "New technology will disrupt your industry within months.",
      "A collaboration opportunity will present itself soon.",
      "Financial market shifts favor your current position.",
      "Your skills will become more valuable in six months.",
      "Major reorganization will impact your team by year-end.",
      "Remote work becomes permanent for your position.",
      "Competitor acquisition changes market dynamics significantly.",
      "Demand for your expertise increases unexpectedly.",
      "New industry regulations create growth opportunities.",
      "Leadership changes open advancement possibilities.",
    ],
    actions: [
      "Invest in learning one new skill this quarter.",
      "Strengthen your network in unexpected industries.",
      "Document your achievements for future opportunities.",
      "Build a personal brand around unique expertise.",
      "Set boundaries to prevent career burnout.",
      "Diversify your income streams now.",
      "Create metrics to demonstrate your value.",
      "Lead a high-visibility project to increase recognition.",
      "Build deeper relationships with key stakeholders.",
      "Reposition your expertise for emerging market needs.",
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
      "Misinterpreted communication damages important relationship.",
      "Identity theft causes financial complications lasting months.",
      "Unexpected relocation requirement disrupts family plans.",
      "Budget cuts eliminate resources needed for success.",
      "Technical failure during presentation damages credibility.",
      "Healthcare costs exceed emergency savings significantly.",
      "Personal data accidentally shared with wrong party.",
      "Rejected loan application delays important plans.",
      "Reputation damaged by association with controversial person.",
      "Supply chain disruption leaves projects incomplete indefinitely.",
    ],
  };

  return (
    fallbacks[category as keyof typeof fallbacks] || fallbacks.probabilities
  );
}

// Get full set of fallback fortunes
function getFallbackFortunes(): Fortunes {
  return {
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
