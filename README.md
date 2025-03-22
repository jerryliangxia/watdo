This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Fortune Teller App

A modern fortune teller application that uses the Cohere API to generate personalized predictions based on user input.

## Getting Started

First, you need to set up your Cohere API key:

1. Sign up for a Cohere account at [https://cohere.ai/](https://cohere.ai/)
2. Get your API key from the [Cohere dashboard](https://dashboard.cohere.ai/api-keys)
3. Create a `.env.local` file in the root directory and add your API key:

```
COHERE_API_KEY=your_api_key_here
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can interact with the fortune teller by entering your context or question.

## Features

- Generate personalized fortune predictions using AI
- Three types of predictions: probability-based, action recommendations, and unlikely scenarios
- Modern, clean UI inspired by Apple design principles

## Technology Stack

- Next.js 15.x with App Router
- React 19.x
- TypeScript
- Tailwind CSS
- Cohere AI API for text generation

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [Cohere API Documentation](https://docs.cohere.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

Remember to set up your `COHERE_API_KEY` environment variable in your Vercel project settings.
