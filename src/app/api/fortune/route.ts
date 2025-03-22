import { NextRequest, NextResponse } from "next/server";
import { CohereClient } from "cohere-ai";

// Initialize the Cohere client
// Note: API key should be set in environment variables
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || "",
});

export async function POST(req: NextRequest) {
  try {
    const { userInput } = await req.json();

    // Extract the goal from the user's input
    const goalMatch = userInput.match(/At age 80, (.*)/i);
    const goal = goalMatch ? goalMatch[1] : userInput;

    const prompt = `You are a life path advisor. The user wants to achieve this goal at age 80: "${goal}"

Generate a response in this exact JSON format:
{
  "fortunes": {
    "probabilities": [
      {
        "text": "A major life event that directly leads to the goal at age 80",
        "age": 65
      }
    ],
    "actions": [
      {
        "text": "A specific action or decision that leads to the major life event",
        "age": 45
      }
    ],
    "random": [
      {
        "text": "A potential challenge or obstacle to consider",
        "age": 55
      }
    ]
  }
}

Important rules:
1. The ages should be between 20 and 80
2. Each probability should be a significant life event that directly contributes to the goal at age 80
3. Each action should be a specific decision or step that leads to one of the probabilities
4. The random events should be realistic challenges that could affect the path
5. Make the response feel personal and meaningful to the user's goal
6. Keep the ages logically spaced (earlier events should have earlier ages)
7. Focus on actionable and specific events/decisions
8. Work backwards from age 80 - each event should be a stepping stone towards the final goal
9. The probabilities should be major milestones that are necessary to achieve the goal
10. The actions should be concrete steps that lead to those milestones`;

    const response = await cohere.generate({
      prompt,
      maxTokens: 500,
      temperature: 0.7,
      k: 0,
      stopSequences: [],
      returnLikelihoods: "NONE",
    });

    const generatedText = response.generations[0].text;
    const fortuneData = JSON.parse(generatedText);

    return NextResponse.json(fortuneData);
  } catch (error) {
    console.error("Error generating fortune:", error);
    return NextResponse.json(
      { error: "Failed to generate fortune" },
      { status: 500 }
    );
  }
}
