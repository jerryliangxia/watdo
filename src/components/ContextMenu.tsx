import React from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onAddNode: () => void;
  onClose: () => void;
  onAddMilestoneNode?: () => void;
}

export default function ContextMenu({
  x,
  y,
  onAddNode,
  onClose,
  onAddMilestoneNode,
}: ContextMenuProps) {
  React.useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  return (
    <div
      className="fixed z-[9999] min-w-[220px] bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 text-sm overflow-hidden divide-y divide-gray-100"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Add Node
      </div>

      <div className="py-1">
        <button
          className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors duration-200 text-gray-700 font-medium flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            onAddNode();
            onClose();
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-blue-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          Input Node
        </button>

        {onAddMilestoneNode && (
          <button
            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 transition-colors duration-200 text-purple-700 font-medium flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onAddMilestoneNode();
              onClose();
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-purple-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
            </svg>
            Milestone Node
          </button>
        )}
      </div>
    </div>
  );
}
