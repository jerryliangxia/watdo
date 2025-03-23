import { memo, useState } from "react";
import { Handle, Position, NodeProps, Node, NodeResizer } from "@xyflow/react";

export interface InputNodeData extends Record<string, unknown> {
  type: "input";
  onGenerate?: (context: string) => Promise<void>;
  onGenerateBackward?: (context: string) => Promise<void>;
  value: string;
}

const InputNode = memo(
  ({ data, isConnectable, selected }: NodeProps<Node<InputNodeData>>) => {
    const [context, setContext] = useState((data.value as string) || "");
    const [isLoading, setIsLoading] = useState(false);
    const [isBackwardLoading, setIsBackwardLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
          border: "2px solid #90CDF4",
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

        <div
          className="flex flex-col gap-2 p-4"
          style={{ position: "relative", zIndex: 11 }}
        >
          <div className="font-medium text-gray-700 text-sm">
            Current Context
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
            className="w-full p-2 border border-gray-200 rounded-lg text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ backgroundColor: "white", color: "black" }}
            placeholder="Enter the current context..."
          />
          {error && (
            <div className="text-sm text-red-500 p-2 bg-red-50 rounded-lg">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            {/* Forward planning button */}
            <button
              onClick={handleGenerate}
              disabled={isLoading || !context.trim()}
              className={`w-full py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors duration-200
              ${
                isLoading || !context.trim()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
            >
              {isLoading ? "Generating..." : "Forward Options →"}
            </button>

            {/* Backward planning button */}
            <button
              onClick={handleGenerateBackward}
              disabled={isBackwardLoading || !context.trim()}
              className={`w-full py-2 px-4 rounded-lg text-white text-sm font-medium transition-colors duration-200
              ${
                isBackwardLoading || !context.trim()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {isBackwardLoading ? "Generating..." : "← Backward Steps"}
            </button>
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
