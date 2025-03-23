import React from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onAddNode: () => void;
  onClose: () => void;
}

export default function ContextMenu({
  x,
  y,
  onAddNode,
  onClose,
}: ContextMenuProps) {
  React.useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed z-[9999] min-w-[150px] bg-white rounded-xl shadow-xl border border-gray-100 py-1 text-sm overflow-hidden"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors duration-200 text-gray-700 font-medium"
        onClick={(e) => {
          e.stopPropagation();
          onAddNode();
          onClose();
        }}
      >
        Add Input Node
      </button>
    </div>
  );
}
