import React from "react";
import { Handle, Position } from "@xyflow/react";

const Timeline: React.FC = () => {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 bg-transparent pointer-events-none">
      <div className="relative w-full h-full">
        {/* Timeline line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200/30" />

        {/* Timeline markers */}
        {Array.from({ length: 81 }, (_, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${(i / 80) * 100}%` }}
          >
            {/* Marker line */}
            <div className="w-0.5 h-3 bg-gray-200/30" />
            {/* Marker value */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400">
              {i}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
