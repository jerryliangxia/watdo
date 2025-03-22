"use client";

import { useState, useRef } from "react";

interface Mode {
  id: string;
  name: string;
  icon: string;
  description: string;
}

const MODES: Mode[] = [
  {
    id: "predict",
    name: "Predict",
    icon: "🔮",
    description: "See potential futures",
  },
  {
    id: "decide",
    name: "Decide",
    icon: "⚡",
    description: "Get decisive answers",
  },
  {
    id: "mog",
    name: "Mog",
    icon: "👑",
    description: "Become the best version",
  },
];

function ModeSelector({
  selectedMode,
  onSelectMode,
}: {
  selectedMode: string;
  onSelectMode: (mode: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-4 mb-4 -mx-6 px-6">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onSelectMode(mode.id)}
          className={`flex flex-col items-center min-w-[72px] p-3 rounded-xl transition-colors ${
            selectedMode === mode.id
              ? "bg-[#0066cc] text-white"
              : "bg-[#f5f5f7] dark:bg-[#2d2d2f] text-[#1d1d1f] dark:text-white hover:bg-[#e5e5ea] dark:hover:bg-[#3d3d3f]"
          }`}
        >
          <span className="text-2xl mb-1">{mode.icon}</span>
          <span className="text-xs font-medium">{mode.name}</span>
        </button>
      ))}
    </div>
  );
}

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
      </div>
    </div>
  );
}

function FortuneTeller() {
  const [input, setInput] = useState("");
  const [selectedMode, setSelectedMode] = useState("predict");
  const [fortunesByMode, setFortunesByMode] = useState<
    Record<
      string,
      {
        probabilities: string[];
        actions: string[];
        random: string[];
      } | null
    >
  >({
    predict: null,
    decide: null,
    mog: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shufflingItems, setShufflingItems] = useState<Record<string, boolean>>(
    {}
  );

  // Create refs to track pending shuffles
  const pendingShuffles = useRef<{
    [key: string]: { indices: number[]; timeoutId: NodeJS.Timeout | null };
  }>({});

  // Just switch mode without clearing fortunes
  const handleModeChange = (mode: string) => {
    setSelectedMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/fortune", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: input,
          mode: selectedMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get fortune");
      }

      const data = await response.json();
      // Update fortunes for current mode only
      setFortunesByMode((prev) => ({
        ...prev,
        [selectedMode]: data,
      }));
      setShufflingItems({});
      // Clear any pending shuffles
      Object.values(pendingShuffles.current).forEach((item) => {
        if (item.timeoutId) clearTimeout(item.timeoutId);
      });
      pendingShuffles.current = {};
    } catch (err) {
      console.error("Error fetching fortune:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  // Get current fortunes based on selected mode
  const currentFortunes = fortunesByMode[selectedMode];

  const processBatchShuffle = async (category: string) => {
    if (!input.trim() || !currentFortunes) return;

    const pendingBatch = pendingShuffles.current[category];
    if (!pendingBatch || pendingBatch.indices.length === 0) return;

    // Clear the timeout
    if (pendingBatch.timeoutId) {
      clearTimeout(pendingBatch.timeoutId);
    }

    // Get the indices and reset the pending shuffles
    const indices = [...pendingBatch.indices];
    pendingShuffles.current[category] = { indices: [], timeoutId: null };

    // Set all the indices as shuffling
    const updatedShufflingItems = { ...shufflingItems };
    indices.forEach((index) => {
      updatedShufflingItems[`${category}-${index}`] = true;
    });
    setShufflingItems(updatedShufflingItems);

    try {
      // Get the current predictions for this category to ensure uniqueness
      const currentCategoryPredictions =
        currentFortunes[category as keyof typeof currentFortunes];

      const response = await fetch("/api/fortune", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: input,
          category: category,
          indices: indices,
          currentPredictions: currentCategoryPredictions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to shuffle predictions");
      }

      const data = await response.json();

      // Update the predictions in the fortunes state
      setFortunesByMode((prev) => ({
        ...prev,
        [selectedMode]: {
          ...prev[selectedMode]!,
          [category as keyof (typeof prev)[typeof selectedMode]]:
            Object.entries(data.predictions).reduce(
              (acc: string[], [indexStr, prediction]) => {
                const index = parseInt(indexStr, 10);
                acc[index] = prediction as string;
                return acc;
              },
              [
                ...prev[selectedMode]![
                  category as keyof (typeof prev)[typeof selectedMode]
                ],
              ]
            ),
        },
      }));
    } catch (err) {
      console.error("Error shuffling predictions:", err);
    } finally {
      // Clear shuffling state for all indices
      const clearedShufflingItems = { ...shufflingItems };
      indices.forEach((index) => {
        delete clearedShufflingItems[`${category}-${index}`];
      });
      setShufflingItems(clearedShufflingItems);
    }
  };

  const handleShuffleItem = (category: string, index: number) => {
    if (!input.trim() || !currentFortunes) return;

    // Add this index to the pending shuffles
    if (!pendingShuffles.current[category]) {
      pendingShuffles.current[category] = { indices: [], timeoutId: null };
    }

    // Add the index if it's not already there
    if (!pendingShuffles.current[category].indices.includes(index)) {
      pendingShuffles.current[category].indices.push(index);
    }

    // Show loading state immediately for better UX
    setShufflingItems((prev) => ({ ...prev, [`${category}-${index}`]: true }));

    // Clear previous timeout if it exists
    if (pendingShuffles.current[category].timeoutId) {
      clearTimeout(pendingShuffles.current[category].timeoutId);
    }

    // Set a new timeout to process the batch
    pendingShuffles.current[category].timeoutId = setTimeout(() => {
      processBatchShuffle(category);
    }, 500); // Wait 500ms to batch requests
  };

  const handleShuffleAll = (category: string) => {
    if (!input.trim() || !currentFortunes) return;

    const categoryItems =
      currentFortunes[category as keyof typeof currentFortunes];
    if (!Array.isArray(categoryItems)) return;

    // Add all indices to pending shuffles
    if (!pendingShuffles.current[category]) {
      pendingShuffles.current[category] = { indices: [], timeoutId: null };
    }

    // Set all indices
    pendingShuffles.current[category].indices = Array.from(
      { length: categoryItems.length },
      (_, i) => i
    );

    // Show loading state for all items
    const updatedShufflingItems = { ...shufflingItems };
    categoryItems.forEach((_, i) => {
      updatedShufflingItems[`${category}-${i}`] = true;
    });
    setShufflingItems(updatedShufflingItems);

    // Process immediately rather than waiting
    processBatchShuffle(category);
  };

  return (
    <div className="p-6">
      <ModeSelector
        selectedMode={selectedMode}
        onSelectMode={handleModeChange}
      />
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 20))}
            placeholder={
              selectedMode === "decide"
                ? "What decision do you need help with?"
                : "Enter your context..."
            }
            maxLength={20}
            className="w-full bg-[#f5f5f7] dark:bg-[#2d2d2f] rounded-lg border-none px-4 py-3 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#0066cc]"
          />
          <div className="absolute right-3 bottom-3 text-xs text-[#86868b]">
            {input.length}/20
          </div>
        </div>

        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="mt-4 w-full bg-[#0066cc] hover:bg-[#0055b3] text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "Consulting the stars..."
            : selectedMode === "decide"
            ? "Make Decision"
            : selectedMode === "mog"
            ? "Show Path to Victory"
            : "Reveal My Future"}
        </button>
      </form>

      {error && (
        <div className="py-3 px-4 mb-6 bg-[#ff453a] dark:bg-[#ff453a]/20 text-white dark:text-[#ff453a] rounded-lg text-sm">
          {error}
        </div>
      )}

      {currentFortunes && (
        <div className="space-y-6 animate-fade-in">
          <FortuneSection
            title={
              selectedMode === "decide"
                ? "The Decision"
                : selectedMode === "mog"
                ? "Your Potential"
                : "What might happen"
            }
            items={currentFortunes.probabilities}
            icon={
              selectedMode === "decide"
                ? "⚡"
                : selectedMode === "mog"
                ? "👑"
                : "⭐"
            }
            description={
              selectedMode === "decide"
                ? "Clear path forward"
                : selectedMode === "mog"
                ? "Your path to excellence"
                : "Based on historical probabilities"
            }
            category="probabilities"
            onShuffleItem={handleShuffleItem}
            onShuffleAll={handleShuffleAll}
            shufflingItems={shufflingItems}
          />

          <FortuneSection
            title={
              selectedMode === "decide"
                ? "Next Steps"
                : selectedMode === "mog"
                ? "Power Moves"
                : "What you should do"
            }
            items={currentFortunes.actions}
            icon={
              selectedMode === "decide"
                ? "🎯"
                : selectedMode === "mog"
                ? "💪"
                : "🧭"
            }
            description={
              selectedMode === "decide"
                ? "Actions to implement the decision"
                : selectedMode === "mog"
                ? "Assert your dominance"
                : "Profitable and progressive actions"
            }
            category="actions"
            onShuffleItem={handleShuffleItem}
            onShuffleAll={handleShuffleAll}
            shufflingItems={shufflingItems}
          />

          <FortuneSection
            title={
              selectedMode === "decide"
                ? "Watch Out For"
                : selectedMode === "mog"
                ? "Threats to Eliminate"
                : "Unlikely dark possibilities"
            }
            items={currentFortunes.random}
            icon={
              selectedMode === "decide"
                ? "⚠️"
                : selectedMode === "mog"
                ? "🎯"
                : "🔮"
            }
            description={
              selectedMode === "decide"
                ? "Potential pitfalls to avoid"
                : selectedMode === "mog"
                ? "Overcome these challenges"
                : "Rare but possible scenarios (0.1% chance)"
            }
            category="random"
            onShuffleItem={handleShuffleItem}
            onShuffleAll={handleShuffleAll}
            shufflingItems={shufflingItems}
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
  category,
  onShuffleItem,
  onShuffleAll,
  shufflingItems,
}: {
  title: string;
  items: string[];
  icon: string;
  description: string;
  category: string;
  onShuffleItem: (category: string, index: number) => void;
  onShuffleAll: (category: string) => void;
  shufflingItems: Record<string, boolean>;
}) {
  const isShufflingAny = items.some(
    (_, i) => shufflingItems[`${category}-${i}`]
  );

  return (
    <div>
      <h2 className="text-sm font-medium text-[#86868b] dark:text-[#a1a1a6] mb-1 flex items-center justify-between">
        <span className="flex items-center">
          {icon} <span className="ml-2">{title}</span>
        </span>
        <button
          onClick={() => onShuffleAll(category)}
          disabled={isShufflingAny}
          className={`text-xs px-2 py-1 rounded ${
            title === "Unlikely dark possibilities"
              ? "bg-[#2c2c2e] hover:bg-[#3c3c3e] text-[#ff453a]"
              : "bg-[#e5e5ea] hover:bg-[#d1d1d6] text-[#1d1d1f]"
          } transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center`}
          title="Shuffle all predictions in this section"
        >
          {isShufflingAny ? (
            <>
              <svg
                className="animate-spin h-3 w-3 mr-1"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Shuffling...
            </>
          ) : (
            <>
              <svg
                className="h-3 w-3 mr-1"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Shuffle All
            </>
          )}
        </button>
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
            } relative group`}
          >
            {item}
            <button
              onClick={() => onShuffleItem(category, i)}
              disabled={shufflingItems[`${category}-${i}`]}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full 
                ${
                  title === "Unlikely dark possibilities"
                    ? "bg-[#2c2c2e] hover:bg-[#3c3c3e] text-[#ff453a]"
                    : "bg-[#e5e5ea] hover:bg-[#d1d1d6] text-[#1d1d1f]"
                } 
                ${
                  shufflingItems[`${category}-${i}`]
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }
                transition-opacity 
                disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label="Shuffle prediction"
              title="Shuffle this prediction"
            >
              {shufflingItems[`${category}-${i}`] ? (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
