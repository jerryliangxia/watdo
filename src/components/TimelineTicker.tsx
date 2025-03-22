import React from "react";
import { useStore, useReactFlow } from "@xyflow/react";

interface TimelineTickerProps {
  startAge: number;
  endAge: number;
  width: number;
  startX: number;
  timelineScale: number;
}

export default function TimelineTicker({
  startAge,
  endAge,
  width,
  startX,
  timelineScale,
}: TimelineTickerProps) {
  // Get viewport transform from ReactFlow
  const transform = useStore((state) => state.transform);
  const [x, y, zoom] = transform;

  const ageRange = endAge - startAge;
  const tickCount = Math.min(ageRange, 20); // Show at most 20 ticks
  const step = Math.ceil(ageRange / tickCount);
  const ticks = [];

  // Create ticks at regular intervals
  for (let age = startAge; age <= endAge; age += step) {
    // Calculate position from the right side of the timeline
    const xPos = startX + width - (endAge - age) * timelineScale;
    const isStart = age === startAge;
    const isEnd = age === endAge;

    ticks.push(
      <div
        key={age}
        className="absolute flex flex-col items-center"
        style={{
          left: `${xPos}px`,
          transform: `translateX(-50%) scale(${1 / zoom})`,
          transformOrigin: "top",
        }}
      >
        <div
          className={`h-4 w-0.5 ${
            isStart ? "bg-blue-500" : isEnd ? "bg-red-500" : "bg-gray-300"
          }`}
        ></div>
        <span
          className={`text-sm mt-1 font-medium ${
            isStart ? "text-blue-500" : isEnd ? "text-red-500" : "text-gray-500"
          }`}
        >
          {age}
        </span>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-8 left-0 right-0 pointer-events-none"
      style={{
        height: "40px",
        transform: `translateX(${x}px)`,
      }}
    >
      {/* Timeline gradient background */}
      <div
        className="absolute h-0.5 bg-gradient-to-r from-blue-500 via-gray-300 to-red-500"
        style={{
          left: `${startX}px`,
          width: `${width}px`,
          transform: `scale(${1 / zoom}, 1)`,
          transformOrigin: "left",
        }}
      ></div>

      {/* Timeline markers */}
      <div className="absolute h-8 w-full">{ticks}</div>
    </div>
  );
}
