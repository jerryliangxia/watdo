import { memo } from "react";
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
}

const OPERATORS = ["+", "-", "*", "%"];

const CustomNode = memo(
  ({ id, data, isConnectable, selected }: NodeProps<Node<CustomNodeData>>) => {
    const isOperator = data.type === "operator";
    // Number of current connections plus one empty slot for new connections
    const numHandles = (data.inputs?.length || 0) + 1;
    const { setNodes } = useReactFlow();

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
              : "#BEE3F8" // blue-200
          }`,
        }}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={80}
          handleClassName={colors.handle}
          lineClassName={`border-${colors.border}`}
        />

        {/* Node ID and Timeline value display */}
        <div className="absolute -top-2 -right-2 flex gap-1">
          <div className="text-[10px] px-1 rounded bg-gray-700 text-white opacity-75">
            {data.timelineValue ?? 0}
          </div>
          <div className="text-[10px] px-1 rounded bg-gray-700 text-white opacity-75">
            #{id}
          </div>
        </div>

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
