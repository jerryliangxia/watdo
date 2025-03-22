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

// Different prompt templates for different modes
const PROMPT_TEMPLATES = {
  initial: {
    predict: `You are a mystic fortune teller. Based on this context: "{{INPUT}}", generate three types of predictions:
      
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

    decide: `You are a decisive AI advisor. For this decision context: "{{INPUT}}", generate three types of guidance:

1. Three clear, definitive statements about what decision to make (be assertive and specific)
2. Two concrete action steps to implement the decision (practical, immediate actions)
3. Two potential risks or pitfalls to watch out for (specific concerns)

Be direct and decisive - no ambiguity or uncertainty.
Each statement must be actionable and specific to the context.
Focus on clarity and confidence in the decision.

Format as JSON:
{
  "probabilities": ["decision1", "decision2", "decision3"],
  "actions": ["step1", "step2"],
  "random": ["risk1", "risk2"]
}`,

    mog: `You are an elite performance coach. For this context: "{{INPUT}}", generate three types of guidance for maximum dominance:

1. Three powerful statements about achieving superiority (focus on being the absolute best)
2. Two dominant actions to assert leadership (aggressive, high-impact moves)
3. Two threats to eliminate or overcome (frame challenges as opportunities to dominate)

Use confident, assertive language.
Focus on power, excellence, and total victory.
Each statement should emphasize superiority and dominance.

Format as JSON:
{
  "probabilities": ["power1", "power2", "power3"],
  "actions": ["move1", "move2"],
  "random": ["threat1", "threat2"]
}`,
  },

  probabilitySingle: {
    predict:
      'Generate a single likely prediction based on this context: "{{INPUT}}". Make it different from: {{EXISTING}}',
    decide:
      'Generate a single decisive statement about what to do for: "{{INPUT}}". Make it different from: {{EXISTING}}',
    mog: 'Generate a single powerful statement about achieving dominance in: "{{INPUT}}". Make it different from: {{EXISTING}}',
  },

  actionSingle: {
    predict:
      'Generate a single recommended action based on this context: "{{INPUT}}". Make it different from: {{EXISTING}}',
    decide:
      'Generate a single concrete step to implement the decision for: "{{INPUT}}". Make it different from: {{EXISTING}}',
    mog: 'Generate a single dominant action to assert superiority in: "{{INPUT}}". Make it different from: {{EXISTING}}',
  },

  randomSingle: {
    predict:
      'Generate a single unlikely negative scenario based on this context: "{{INPUT}}". Make it different from: {{EXISTING}}',
    decide:
      'Generate a single specific risk to watch for in this decision: "{{INPUT}}". Make it different from: {{EXISTING}}',
    mog: 'Generate a single threat to overcome and dominate in: "{{INPUT}}". Make it different from: {{EXISTING}}',
  },

  randomBatch: {
    predict:
      'Generate {{COUNT}} unique unlikely scenarios based on: "{{INPUT}}". Make them different from: {{EXISTING}}',
    decide:
      'Generate {{COUNT}} unique risks to watch for in: "{{INPUT}}". Make them different from: {{EXISTING}}',
    mog: 'Generate {{COUNT}} unique threats to overcome in: "{{INPUT}}". Make them different from: {{EXISTING}}',
  },
};

// Generate initial fortunes
export async function generateFortunes(
  userInput: string,
  mode: string = "predict"
): Promise<Fortunes> {
  try {
    const prompt = PROMPT_TEMPLATES.initial[
      mode as keyof typeof PROMPT_TEMPLATES.initial
    ].replace("{{INPUT}}", userInput);

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
    await fixDuplicates(fortunes, userInput, mode);

    return fortunes;
  } catch (error) {
    console.error("Failed to generate fortunes:", error);
    // Return fallback fortunes
    return getFallbackFortunes(mode);
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
  currentPredictions: string[],
  mode: string = "predict"
): Promise<Record<number, string>> {
  const result: Record<number, string> = {};
  const existingPredictions = currentPredictions.filter(
    (_, i) => !indices.includes(i)
  );

  const prompt = PROMPT_TEMPLATES.randomBatch[
    mode as keyof typeof PROMPT_TEMPLATES.initial
  ]
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
            [...currentPredictions, ...Object.values(result)],
            mode
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
    currentPredictions,
    mode
  );
}

// Generate individual shuffled predictions
async function generateIndividualShuffles(
  userInput: string,
  category: string,
  indices: number[],
  currentPredictions: string[],
  mode: string = "predict"
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
        otherPredictions,
        mode
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
  existingPredictions: string[] = [],
  mode: string = "predict"
): Promise<string> {
  try {
    // Select the appropriate template based on category
    let templateKey: keyof typeof PROMPT_TEMPLATES;
    let templateMode: string;

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

    const prompt = PROMPT_TEMPLATES[templateKey][
      mode as keyof typeof PROMPT_TEMPLATES.initial
    ]
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
    return getRandomFallback(category, existingPredictions, mode);
  }
}

// Fix any duplicates in the generated fortunes
async function fixDuplicates(
  fortunes: Fortunes,
  userInput: string,
  mode: string = "predict"
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
          existingPredictions,
          mode
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
          finalPredictions,
          mode
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
  existingPredictions: string[] = [],
  mode: string = "predict"
): string {
  const fallbacks = getFallbacksByCategory(category, mode);

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
function getFallbacksByCategory(
  category: string,
  mode: string = "predict"
): string[] {
  const fallbacks = {
    predict: {
      probabilities: [
        "New opportunities will present themselves soon",
        "A significant change is approaching",
        "Your efforts will be recognized",
      ],
      actions: [
        "Take time to reflect on your goals",
        "Reach out to someone you trust",
        "Consider a new approach",
      ],
      random: [
        "An unexpected event disrupts your plans",
        "A surprising coincidence changes everything",
        "A forgotten connection resurfaces",
      ],
    },
    decide: {
      probabilities: [
        "Choose the bold option without hesitation",
        "Move forward with the new opportunity",
        "Take the leadership position offered",
      ],
      actions: [
        "Make the decision final by tomorrow",
        "Communicate your choice clearly to all parties",
        "Begin implementation immediately",
      ],
      random: [
        "Key stakeholder may resist the change",
        "Timeline might be more aggressive than expected",
        "Resource constraints could limit options",
      ],
    },
    mog: {
      probabilities: [
        "Your superiority will be undeniable",
        "Others will follow your lead naturally",
        "Victory is within your grasp",
      ],
      actions: [
        "Assert dominance in every interaction",
        "Eliminate all signs of weakness",
        "Showcase your elite performance",
      ],
      random: [
        "Competitors attempt to undermine your position",
        "Weak allies hold back your progress",
        "Lesser talents try to copy your success",
      ],
    },
  };

  return (
    fallbacks[mode as keyof typeof fallbacks]?.[
      category as keyof typeof fallbacks.predict
    ] || fallbacks.predict[category as keyof typeof fallbacks.predict]
  );
}

// Get full set of fallback fortunes
function getFallbackFortunes(mode: string = "predict"): Fortunes {
  const fallbacks = getFallbacksByCategory("probabilities", mode);
  const actionFallbacks = getFallbacksByCategory("actions", mode);
  const randomFallbacks = getFallbacksByCategory("random", mode);

  return {
    probabilities: fallbacks.slice(0, 3),
    actions: actionFallbacks.slice(0, 2),
    random: randomFallbacks.slice(0, 2),
  };
}
