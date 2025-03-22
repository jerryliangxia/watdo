import { useState, useCallback, useEffect } from "react";
import { Handle, Position } from "@xyflow/react";

interface EditableNodeData {
  label: string;
  onChange: (newLabel: string) => void;
  onBranch: () => Promise<void>;
  hasBranches: boolean;
  nodeType: "prompt" | "predictions" | "action";
  age?: number | null;
  deathAge?: number;
}

export default function EditableNode({ data }: { data: EditableNodeData }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-enter edit mode for initial prompt node
  useEffect(() => {
    if (data.nodeType === "prompt" && data.label === "Enter your question...") {
      setIsEditing(true);
      setEditValue("");
    }
  }, [data.nodeType, data.label]);

  const handleDoubleClick = useCallback(() => {
    if (data.nodeType === "prompt" || data.nodeType === "action") {
      setIsEditing(true);
      setEditValue(data.label);
    }
  }, [data.nodeType, data.label]);

  const getNodeStyle = () => {
    const baseStyle =
      "p-4 transition-all duration-200 text-center flex flex-col justify-center items-center gap-2 relative";

    switch (data.nodeType) {
      case "prompt":
        return `${baseStyle} bg-white/80 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl font-medium text-gray-800 hover:shadow-lg cursor-pointer w-[300px] min-h-[120px] ${
          !isEditing ? "hover:bg-white/90" : ""
        }`;
      case "predictions":
        return `${baseStyle} bg-gradient-to-br from-blue-50/80 to-red-50/80 backdrop-blur-md shadow-md rounded-xl text-gray-800 whitespace-pre-line w-[400px] min-h-[200px]`;
      case "action":
        return `${baseStyle} bg-green-50/80 backdrop-blur-md shadow-md rounded-xl text-green-800 hover:shadow-lg cursor-pointer w-[300px] min-h-[120px] ${
          !isEditing ? "hover:bg-green-50/90" : ""
        }`;
      default:
        return baseStyle;
    }
  };

  // Extract age from text if present
  const extractAge = (text: string) => {
    const match = text.match(/(\d+)\s*(?:years?\s*old|yo|age)/i);
    return match ? parseInt(match[1]) : null;
  };

  const handleSubmitOrBranch = useCallback(async () => {
    if (isLoading) return;

    if (isEditing && editValue.trim()) {
      const age = extractAge(editValue);
      setIsEditing(false);
      data.onChange(editValue);
      if (age && data.nodeType === "prompt") {
        // Update the node's age
        const node = document.querySelector(`[data-id="${data.id}"]`);
        if (node) {
          node.setAttribute("data-age", age.toString());
        }
      }
    } else if (data.hasBranches) {
      setIsLoading(true);
      try {
        await data.onBranch();
      } finally {
        setIsLoading(false);
      }
    }
  }, [data, editValue, isEditing, isLoading]);

  const handleKeyDown = useCallback(
    (evt: React.KeyboardEvent) => {
      if (evt.key === "Enter" && !evt.shiftKey) {
        evt.preventDefault();
        handleSubmitOrBranch();
      } else if (evt.key === "Escape") {
        setIsEditing(false);
        setEditValue(data.label);
      }
    },
    [handleSubmitOrBranch]
  );

  return (
    <div
      className={getNodeStyle()}
      onDoubleClick={handleDoubleClick}
      title={
        data.nodeType === "prompt" || data.nodeType === "action"
          ? "Double click to edit"
          : ""
      }
      data-age={data.age}
    >
      {/* Age indicator for nodes with age */}
      {data.age && (
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-2 py-0.5 rounded text-sm">
          Age {data.age}
        </div>
      )}

      {/* Death age indicator for predictions node */}
      {data.nodeType === "predictions" && data.deathAge && (
        <div className="absolute -top-6 right-0 bg-red-600 text-white px-2 py-0.5 rounded text-sm">
          Death: Age {data.deathAge}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Right}
        className="!bg-white/50 !border-white/50"
        id="right"
      />

      <div className="w-full flex flex-col gap-2 items-center">
        {isEditing ? (
          <>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none text-center focus:outline-none resize-none min-h-[60px]"
              placeholder={
                data.nodeType === "prompt"
                  ? "Enter your age and current situation..."
                  : "Edit text..."
              }
              autoFocus
            />
            <button
              onClick={handleSubmitOrBranch}
              disabled={!editValue.trim()}
              className="px-4 py-1.5 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {data.nodeType === "prompt" ? "Start Journey" : "Save"}
            </button>
          </>
        ) : (
          <>
            <div className="w-full break-words text-left">
              {data.nodeType === "predictions" ? (
                data.label.split("\n").map((line, i) => (
                  <div
                    key={i}
                    className={line.startsWith("Potential") ? "mt-4" : ""}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-center">{data.label}</div>
              )}
            </div>
            {data.hasBranches && (
              <button
                onClick={handleSubmitOrBranch}
                disabled={isLoading}
                className="px-4 py-1.5 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 relative"
              >
                <span className={isLoading ? "opacity-0" : ""}>
                  Explore Path
                </span>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </button>
            )}
          </>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Left}
        className="!bg-white/50 !border-white/50"
        id="left"
      />
    </div>
  );
}
