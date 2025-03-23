import { memo, useState } from "react";
import { Handle, Position, NodeProps, Node, NodeResizer } from "@xyflow/react";

export interface InputNodeData extends Record<string, unknown> {
  type: "input";
  onGenerate?: (context: string) => Promise<void>;
  onGenerateBackward?: (context: string) => Promise<void>;
  value: string;
  timelineValue?: number;
  onUpdateAge?: (newAge: number) => void;
}

const InputNode = memo(
  ({ data, isConnectable, selected }: NodeProps<Node<InputNodeData>>) => {
    const [context, setContext] = useState((data.value as string) || "");
    const [isLoading, setIsLoading] = useState(false);
    const [isBackwardLoading, setIsBackwardLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isHoveringAge, setIsHoveringAge] = useState(false);
    const [isDraggingAge, setIsDraggingAge] = useState(false);

    // Get the age value from timelineValue (defaults to 22 if not set)
    const age = data.timelineValue || 22;

    // Get color based on age ranges with smoother transitions
    const getUrgencyColor = () => {
      const normalizedAge = age % 100; // Convert to 0-99 range for cyclical colors

      // Define our color stops with age ranges and hex colors
      const colorStops = [
        { age: 0, color: "#4ade80" }, // Green for <20s
        { age: 20, color: "#4ade80" }, // Green for 20s
        { age: 30, color: "#3b82f6" }, // Blue for 30s
        { age: 40, color: "#6366f1" }, // Indigo for 40s
        { age: 50, color: "#a855f7" }, // Purple for 50s
        { age: 60, color: "#f97316" }, // Orange for 60s
        { age: 70, color: "#facc15" }, // Yellow for 70s
        { age: 80, color: "#4ade80" }, // Back to green for 80s+
        { age: 100, color: "#4ade80" }, // Green to complete the cycle
      ];

      // Find the color stops that our age falls between
      let lowerIndex = 0;
      for (let i = 0; i < colorStops.length - 1; i++) {
        if (
          normalizedAge >= colorStops[i].age &&
          normalizedAge < colorStops[i + 1].age
        ) {
          lowerIndex = i;
          break;
        }
      }

      const lowerStop = colorStops[lowerIndex];
      const upperStop = colorStops[lowerIndex + 1];

      // Calculate how far we are between the two color stops (0 to 1)
      const range = upperStop.age - lowerStop.age;
      const progress =
        range === 0 ? 0 : (normalizedAge - lowerStop.age) / range;

      // Convert hex colors to RGB for interpolation
      const lowerRgb = hexToRgb(lowerStop.color);
      const upperRgb = hexToRgb(upperStop.color);

      // Interpolate between the two colors
      const r = Math.round(lowerRgb.r + (upperRgb.r - lowerRgb.r) * progress);
      const g = Math.round(lowerRgb.g + (upperRgb.g - lowerRgb.g) * progress);
      const b = Math.round(lowerRgb.b + (upperRgb.b - lowerRgb.b) * progress);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Helper function to convert hex to RGB
    const hexToRgb = (hex: string) => {
      // Remove # if present
      hex = hex.replace("#", "");

      // Parse hex values
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      return { r, g, b };
    };

    const handleAgeChange = (xDelta: number) => {
      if (data.timelineValue === undefined) return;

      // Calculate the actual age change based on drag distance
      // Use a smaller movement amount to allow for precise control
      const ageChange = xDelta / 10;

      // Round to the nearest integer
      const newAge = Math.round(
        Math.max(0, Math.min(99, data.timelineValue + ageChange))
      );

      // Only update if the age actually changed
      if (newAge !== data.timelineValue) {
        // Update node data
        if (data.onUpdateAge) {
          data.onUpdateAge(newAge);
        }
      }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent node dragging
      setIsDraggingAge(true);
    };

    const handleGenerate = async () => {
      if (!context.trim() || !data.onGenerate) return;
      setIsLoading(true);
      setError(null);
      try {
        await data.onGenerate(context);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate options"
        );
      } finally {
        setIsLoading(false);
      }
    };

    const handleGenerateBackward = async () => {
      if (!context.trim() || !data.onGenerateBackward) return;
      setIsBackwardLoading(true);
      setError(null);
      try {
        await data.onGenerateBackward(context);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to generate backward options"
        );
      } finally {
        setIsBackwardLoading(false);
      }
    };

    return (
      <div
        className="relative min-w-[200px] min-h-[120px]"
        style={{
          backgroundColor: "#E6F0FF",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
          borderRadius: "8px",
          border: `2px solid ${getUrgencyColor()}`,
          zIndex: 10,
          position: "relative",
          width: "100%",
          height: "100%",
          margin: 0,
          padding: 0,
          overflow: "visible",
        }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={200}
          minHeight={120}
          handleClassName="!bg-blue-500"
          lineClassName="border-blue-200"
        />

        {/* Age Badge */}
        <div
          className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-bold text-xs z-30 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: getUrgencyColor(),
            color: "white",
            width: isHoveringAge ? "auto" : "24px",
            height: "24px",
            padding: isHoveringAge ? "0 8px" : "0",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
          onMouseEnter={() => setIsHoveringAge(true)}
          onMouseLeave={() => !isDraggingAge && setIsHoveringAge(false)}
          onMouseDown={handleMouseDown}
          onMouseUp={() => setIsDraggingAge(false)}
          onMouseMove={(e) => {
            if (isDraggingAge) {
              handleAgeChange(e.movementX);
            }
          }}
        >
          {isHoveringAge ? `Age: ${age}` : age}
        </div>

        {/* Tooltip for dragging instructions */}
        {isHoveringAge && !isDraggingAge && (
          <div className="absolute top-6 right-0 transform translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs z-40 whitespace-nowrap">
            Drag node to adjust age
          </div>
        )}

        <div
          className="flex flex-col gap-2 p-4"
          style={{ position: "relative", zIndex: 11 }}
        >
          <div className="font-medium text-gray-700 text-sm flex justify-between">
            <span>Current Context</span>
          </div>
          <textarea
            value={context}
            onChange={(e) => {
              setContext(e.target.value);
              // Update node data value
              if (data.value !== undefined) {
                data.value = e.target.value;
              }
            }}
            onKeyDown={(e) => {
              // Only proceed if there's content in the textarea
              if (!context.trim()) return;

              // Handle keyboard shortcuts
              if (e.key === "Enter") {
                e.preventDefault(); // Prevent default behavior (new line)

                if (e.shiftKey) {
                  // Shift+Enter -> Backward generation
                  if (!isBackwardLoading && data.onGenerateBackward) {
                    handleGenerateBackward();
                  }
                } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                  // Just Enter (no other modifier keys) -> Forward generation
                  if (!isLoading && data.onGenerate) {
                    handleGenerate();
                  }
                }
              }
            }}
            className="w-full p-2 border border-gray-200 rounded-lg text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ backgroundColor: "white", color: "black" }}
            placeholder="Enter the current context..."
          />
          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-50 rounded-lg">
              {error}
            </div>
          )}
          <div className="flex gap-1 mt-1">
            {/* Backward planning button - now on the left */}
            <div className="relative flex-1 group">
              <button
                onClick={handleGenerateBackward}
                disabled={isBackwardLoading || !context.trim()}
                className={`w-full py-1.5 px-1 rounded-lg text-white text-xs font-medium transition-colors duration-200 flex items-center justify-center
                ${
                  isBackwardLoading || !context.trim()
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                <span className="whitespace-nowrap">
                  {isBackwardLoading ? "..." : "← Backward"}
                </span>
              </button>
              <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block">
                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                  {" "}
                  <kbd className="bg-gray-700 px-1 rounded">Shift+Enter</kbd>
                </div>
              </div>
            </div>

            {/* Forward planning button - now on the right */}
            <div className="relative flex-1 group">
              <button
                onClick={handleGenerate}
                disabled={isLoading || !context.trim()}
                className={`w-full py-1.5 px-1 rounded-lg text-white text-xs font-medium transition-colors duration-200 flex items-center justify-center
                ${
                  isLoading || !context.trim()
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
              >
                <span className="whitespace-nowrap">
                  {isLoading ? "..." : "Forward →"}
                </span>
              </button>
              <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block">
                <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                  <kbd className="bg-gray-700 px-1 rounded">Enter</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right handle - for forward planning */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className="!bg-blue-500"
          style={{
            right: "0px",
            width: "12px",
            height: "12px",
            zIndex: 20,
          }}
        />

        {/* Left handle for backward planning - source */}
        <Handle
          type="source"
          position={Position.Left}
          isConnectable={isConnectable}
          id="backward-source"
          className="!bg-orange-500"
          style={{
            left: "0px",
            width: "12px",
            height: "12px",
            zIndex: 20,
          }}
        />

        {/* Left handle for backward planning - target */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={isConnectable}
          id="backward-target"
          className="!bg-orange-500"
          style={{
            left: "0px",
            width: "12px",
            height: "12px",
            zIndex: 20,
            // Hide this handle visually since it overlaps with the source handle
            // but it will still work for connections
            opacity: 0,
          }}
        />
      </div>
    );
  }
);

InputNode.displayName = "InputNode";

export default InputNode;
