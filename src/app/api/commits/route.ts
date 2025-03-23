import { NextResponse } from "next/server";

export async function GET() {
  // This is a mock response since we're just simulating the API
  const mockCommits = [
    {
      commit: {
        author: {
          date: "2025-01-20T12:00:00Z",
        },
      },
    },
    {
      commit: {
        author: {
          date: "2025-01-22T14:30:00Z",
        },
      },
    },
    {
      commit: {
        author: {
          date: "2025-01-25T09:15:00Z",
        },
      },
    },
  ];

  return NextResponse.json(mockCommits);
}
