"use client";

import { useState } from "react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f7] dark:bg-[#1d1d1f] font-sans p-6">
      <div className="w-full max-w-md bg-white dark:bg-[#111113] rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 pb-0">
          <h1 className="text-2xl font-semibold text-[#1d1d1f] dark:text-white mb-1">
            Fortune Teller
          </h1>
          <p className="text-sm text-[#86868b] dark:text-[#a1a1a6] mb-6">
            Enter your context to reveal your future
          </p>
        </div>

        <FortuneTeller />

        <div className="px-6 py-4 text-xs text-center text-[#86868b] dark:text-[#a1a1a6] border-t border-[#e5e5e7] dark:border-[#2d2d2f]">
          Developed with Apple design principles
        </div>
      </div>
    </div>
  );
}

function FortuneTeller() {
  const [input, setInput] = useState("");
  const [fortunes, setFortunes] = useState<null | {
    probabilities: string[];
    actions: string[];
    random: string[];
  }>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    setIsLoading(true);

    // Simulate fortune generation
    setTimeout(() => {
      // Example responses - in a real app, these would come from an API based on the input
      setFortunes({
        // 3 probability-based predictions (accurate, historical, max 10 words)
        probabilities: [
          "Remote work positions will decrease by 18% next quarter.",
          "Market volatility will impact your sector within 45 days.",
          "Three competitors will merge before year's end.",
        ],
        // 2 action recommendations (profitable/progressive, max 10 words)
        actions: [
          "Diversify your income streams before the coming recession.",
          "Master one emerging technology others aren't pursuing yet.",
        ],
        // 2 ominous, random predictions (0.1% chance, unexpected, max 10 words)
        random: [
          "Undetected data breach silently compromises your personal financial information.",
          "Unknown illness from routine medical visit changes everything.",
        ],
      });
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 100))}
            placeholder="Enter your context..."
            maxLength={100}
            className="w-full bg-[#f5f5f7] dark:bg-[#2d2d2f] rounded-lg border-none px-4 py-3 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
          />
          <div className="absolute right-3 bottom-3 text-xs text-[#86868b]">
            {input.length}/100
          </div>
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="mt-4 w-full bg-[#0066cc] hover:bg-[#0055b3] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Consulting the stars..." : "Reveal My Fortune"}
        </button>
      </form>

      {fortunes && (
        <div className="space-y-6 animate-fade-in">
          <FortuneSection
            title="What might happen"
            items={fortunes.probabilities}
            icon="⭐"
            description="Based on historical probabilities"
          />

          <FortuneSection
            title="What you should do"
            items={fortunes.actions}
            icon="🧭"
            description="Profitable and progressive actions"
          />

          <FortuneSection
            title="Unlikely dark possibilities"
            items={fortunes.random}
            icon="🔮"
            description="Rare but possible scenarios (0.1% chance)"
          />
        </div>
      )}
    </div>
  );
}

function FortuneSection({
  title,
  items,
  icon,
  description,
}: {
  title: string;
  items: string[];
  icon: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-medium text-[#86868b] dark:text-[#a1a1a6] mb-1 flex items-center">
        {icon} <span className="ml-2">{title}</span>
      </h2>
      <p className="text-xs text-[#86868b] dark:text-[#a1a1a6] mb-2">
        {description}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            className={`p-3 rounded-lg text-sm ${
              title === "Unlikely dark possibilities"
                ? "bg-[#1c1c1e] text-[#ff453a] dark:bg-[#1a1a1a] dark:text-[#ff6961]"
                : "bg-[#f5f5f7] dark:bg-[#2d2d2f] text-[#1d1d1f] dark:text-white"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
