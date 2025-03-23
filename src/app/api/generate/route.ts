import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Make sure we have a Cohere API key
    if (!process.env.NEXT_PUBLIC_COHERE_API_KEY) {
      return NextResponse.json(
        { error: "Cohere API key is not configured" },
        { status: 500 }
      );
    }

    // Get request body
    const body = await request.json();
    const { prompt, model } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

    // Call Cohere API
    const response = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "command",
        prompt,
        max_tokens: 200,
        temperature: 0.7,
        return_likelihoods: "NONE",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Cohere API error:", errorData);
      return NextResponse.json(
        {
          error: `Failed to generate text: ${response.status} ${response.statusText}`,
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract the generated text
    const text = data.generations?.[0]?.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: "No text generated from Cohere API" },
        { status: 500 }
      );
    }

    // Return the generated text
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Error in generate API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
