import { memo, useState } from "react";
import {
  Handle,
  Position,
  NodeProps,
  Node,
  useStore,
  useReactFlow,
  NodeResizer,
} from "@xyflow/react";
import LoadingSpinner from "./LoadingSpinner";

export interface CustomNodeData extends Record<string, unknown> {
  type: "operator" | "value" | "input";
  value: string | number;
  result?: string;
  inputs?: string[];
  sourceIds?: string[]; // Array of source node IDs
  history?: string[]; // Changed from number[] to string[] to store IDs
  timelineValue?: number;
  isLoading?: boolean;
  generatingOptions?: boolean;
  onGenerate?: (context: string) => Promise<void>;
  onUpdateAge?: (newAge: number) => void;
}

const OPERATORS = ["+", "-", "*", "%"];

const CustomNode = memo(
  ({ id, data, isConnectable, selected }: NodeProps<Node<CustomNodeData>>) => {
    const isOperator = data.type === "operator";
    // Number of current connections plus one empty slot for new connections
    const numHandles = (data.inputs?.length || 0) + 1;
    const { setNodes } = useReactFlow();
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
        // Update node data directly
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  timelineValue: newAge,
                },
              };
            }
            return node;
          })
        );

        // Also call onUpdateAge if provided
        if (data.onUpdateAge) {
          data.onUpdateAge(newAge);
        }
      }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent node dragging
      setIsDraggingAge(true);
    };

    // Create an array of positions for the input handles
    const getHandlePosition = (index: number, total: number) => {
      const topPadding = 0.1; // 10% padding from top
      const handleSpacing = 0.15; // 15% of node height between handles
      return (topPadding + index * handleSpacing) * 100;
    };

    // Get color scheme based on operator or value type
    const getColorScheme = () => {
      if (!isOperator) {
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
          handle: "!bg-blue-500",
          button: "bg-blue-100 hover:bg-blue-200 text-blue-700",
        };
      }
      // Different colors for different operators
      return data.value === "+"
        ? {
            bg: "bg-emerald-50",
            border: "border-emerald-200",
            text: "text-emerald-700",
            handle: "!bg-emerald-500",
            button: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
          }
        : data.value === "-"
        ? {
            bg: "bg-rose-50",
            border: "border-rose-200",
            text: "text-rose-700",
            handle: "!bg-rose-500",
            button: "bg-rose-100 hover:bg-rose-200 text-rose-700",
          }
        : data.value === "*"
        ? {
            bg: "bg-purple-50",
            border: "border-purple-200",
            text: "text-purple-700",
            handle: "!bg-purple-500",
            button: "bg-purple-100 hover:bg-purple-200 text-purple-700",
          }
        : {
            bg: "bg-amber-50",
            border: "border-amber-200",
            text: "text-amber-700",
            handle: "!bg-amber-500",
            button: "bg-amber-100 hover:bg-amber-200 text-amber-700",
          };
    };

    const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newOperator = e.target.value;
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                value: newOperator,
              },
            };
          }
          return node;
        })
      );
    };

    const colors = getColorScheme();

    const handleGenerate = async () => {
      if (data.onGenerate && data.result) {
        try {
          await data.onGenerate(data.result);
        } catch (error) {
          console.error("Error generating options:", error);
        }
      }
    };

    return (
      <div
        className={`relative px-4 py-2 min-w-[80px] min-h-[80px] text-center ${
          data.isLoading ? "animate-pulse" : ""
        }`}
        style={{
          backgroundColor: isOperator
            ? data.value === "+"
              ? "#F0FFF4" // emerald-50
              : data.value === "-"
              ? "#FFF5F5" // rose-50
              : data.value === "*"
              ? "#FAF5FF" // purple-50
              : "#FFFBEB" // amber-50
            : "#EBF8FF", // blue-50
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
          borderRadius: "8px",
          border: `2px solid ${
            isOperator
              ? data.value === "+"
                ? "#C6F6D5" // emerald-200
                : data.value === "-"
                ? "#FED7D7" // rose-200
                : data.value === "*"
                ? "#E9D8FD" // purple-200
                : "#FEF3C7" // amber-200
              : getUrgencyColor()
          }`, // Use urgency color for value nodes
        }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={80}
          handleClassName={colors.handle}
          lineClassName={`border-${colors.border}`}
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
            Drag to adjust age
          </div>
        )}

        {/* Input handles for operators */}
        {isOperator && (
          <>
            {Array.from({ length: numHandles }, (_, i) => (
              <Handle
                key={`input-${i}`}
                type="target"
                position={Position.Left}
                id={`input-${i}`}
                isConnectable={isConnectable}
                className={colors.handle}
                style={{
                  width: "8px",
                  height: "8px",
                  top: `${getHandlePosition(i, numHandles)}%`,
                }}
              />
            ))}
          </>
        )}

        {/* Left input handle for values */}
        {!isOperator && (
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            className={colors.handle}
          />
        )}

        <div className={`font-medium ${colors.text}`}>
          {isOperator ? (
            <div className="flex flex-col items-center gap-1">
              <select
                value={data.value as string}
                onChange={handleOperatorChange}
                className={`text-lg bg-transparent border-none cursor-pointer focus:outline-none ${colors.text}`}
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              {data.inputs && data.inputs.length > 0 && (
                <div className="text-sm opacity-75">
                  #{data.sourceIds?.join(` ${data.value} #`)}
                </div>
              )}
              {data.isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <LoadingSpinner />
                  <div className="text-sm opacity-75">
                    Generating outcome...
                  </div>
                </div>
              ) : (
                <>
                  {data.result && (
                    <>
                      <div className="text-sm opacity-75 max-w-[300px] whitespace-pre-wrap">
                        {data.result}
                      </div>
                      <button
                        onClick={handleGenerate}
                        disabled={data.generatingOptions}
                        className={`mt-2 px-2 py-1 text-xs rounded ${
                          colors.button
                        } transition-colors duration-200 flex items-center gap-2 ${
                          data.generatingOptions
                            ? "opacity-75 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {data.generatingOptions ? (
                          <>
                            <LoadingSpinner />
                            <span>Generating...</span>
                          </>
                        ) : (
                          "Generate Options"
                        )}
                      </button>
                    </>
                  )}
                  {data.history && data.history.length > 0 && (
                    <div className="text-xs opacity-50 mt-1 border-t border-current pt-1">
                      Used: [#{data.history.join(", #")}]
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="text-sm max-w-[300px] whitespace-pre-wrap">
                {data.value}
              </div>
            </div>
          )}
        </div>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className={colors.handle}
        />
      </div>
    );
  }
);

CustomNode.displayName = "CustomNode";

export default CustomNode;
