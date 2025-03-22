import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";

type EditableNodeData = {
  label: string;
  onChange?: (newLabel: string) => void;
};

function EditableNode({ data, isConnectable }: NodeProps<EditableNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    data.onChange?.(label);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      setIsEditing(false);
      data.onChange?.(label);
    }
  };

  return (
    <div className="w-[200px] px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl bg-white/80 backdrop-blur-md border border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-200 cursor-pointer group">
      {isConnectable && (
        <Handle
          type="target"
          position={Position.Top}
          className="!bg-white/50 !border-white/50"
        />
      )}
      {isEditing ? (
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="nodrag w-full outline-none text-center bg-transparent font-medium text-gray-800 placeholder-gray-400"
          placeholder="Enter text..."
        />
      ) : (
        <div
          onDoubleClick={handleDoubleClick}
          className="truncate text-center font-medium text-gray-800"
        >
          {label}
        </div>
      )}
      {isConnectable && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-white/50 !border-white/50 group-hover:!bg-white/80 transition-colors duration-200"
        />
      )}
    </div>
  );
}

export default memo(EditableNode);
