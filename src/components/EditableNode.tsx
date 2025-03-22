import { memo, useState } from "react";
import { Handle, Position } from "@xyflow/react";

interface EditableNodeData {
  label: string;
  onChange: (newLabel: string) => void;
  onBranch: () => void;
  hasBranches?: boolean;
}

interface EditableNodeProps {
  data: EditableNodeData;
}

const EditableNode = ({ data }: EditableNodeProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(data.label);
  const [tempText, setTempText] = useState(data.label);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditing(false);
      data.onChange(editText);
      if (data.hasBranches) {
        data.onBranch();
      }
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditText(tempText);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    setEditText(tempText);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditText(e.target.value);
  };

  return (
    <div
      className="px-4 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-xl bg-white/80 backdrop-blur-md border border-white/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] transition-all duration-200 cursor-pointer group"
      onDoubleClick={handleDoubleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white/50 !border-white/50 !w-3 !h-3"
      />
      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={editText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="w-full bg-transparent border-none focus:outline-none text-center font-medium text-gray-800"
            autoFocus
          />
        ) : (
          <span className="font-medium text-gray-800 text-center flex-1">
            {data.label}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onBranch();
          }}
          className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
        >
          Branch
        </button>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white/50 !border-white/50 !w-3 !h-3 group-hover:!bg-gray-200/50 group-hover:!border-gray-200/50 transition-colors duration-200"
      />
    </div>
  );
};

export default memo(EditableNode);
