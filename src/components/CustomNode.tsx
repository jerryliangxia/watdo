import { memo } from "react";
import { Handle, Position, NodeProps, Node, useStore } from "@xyflow/react";

export interface CustomNodeData extends Record<string, unknown> {
  type: "operator" | "value";
  value: string | number;
  result?: number;
  inputs?: number[];
  sourceIds?: string[]; // Array of source node IDs
  history?: string[]; // Changed from number[] to string[] to store IDs
}

const CustomNode = memo(
  ({ id, data, isConnectable }: NodeProps<Node<CustomNodeData>>) => {
    const isOperator = data.type === "operator";
    // Number of current connections plus one empty slot for new connections
    const numHandles = (data.inputs?.length || 0) + 1;

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
        };
      }
      // Different colors for + and -
      return data.value === "+"
        ? {
            bg: "bg-emerald-50",
            border: "border-emerald-200",
            text: "text-emerald-700",
            handle: "!bg-emerald-500",
          }
        : {
            bg: "bg-rose-50",
            border: "border-rose-200",
            text: "text-rose-700",
            handle: "!bg-rose-500",
          };
    };

    const colors = getColorScheme();

    return (
      <div
        className={`relative px-4 py-2 shadow-lg rounded-md border-2 min-w-[80px] min-h-[80px] text-center ${colors.bg} ${colors.border}`}
      >
        {/* Node ID display */}
        <div className="absolute -top-2 -right-2 text-[10px] px-1 rounded bg-gray-700 text-white opacity-75">
          #{id}
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
              <div className="text-lg">{data.value}</div>
              {data.inputs && data.inputs.length > 0 && (
                <div className="text-sm opacity-75">
                  {data.inputs.join(` ${data.value} `)}
                </div>
              )}
              {data.result !== undefined && (
                <div className="text-sm opacity-75">= {data.result}</div>
              )}
              {/* Show history of node IDs */}
              {data.history && data.history.length > 0 && (
                <div className="text-xs opacity-50 mt-1 border-t border-current pt-1">
                  Used: [#{data.history.join(", #")}]
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="text-lg">{data.value}</div>
              {/* Show history for value nodes too */}
              {data.history && data.history.length > 0 && (
                <div className="text-xs opacity-50 mt-1 border-t border-current pt-1">
                  Used: [#{data.history.join(", #")}]
                </div>
              )}
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
