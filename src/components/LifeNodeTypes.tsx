import React, { memo, useState } from "react";
import {
  Handle,
  Position,
  Node,
  NodeProps as ReactFlowNodeProps,
} from "@xyflow/react";

// Define the data structure for our life nodes
export interface LifeNodeData extends Record<string, unknown> {
  type: "start" | "milestone" | "event" | "prediction" | "death";
  content: string;
  age?: number;
  isLoading?: boolean;
  onShuffle?: () => Promise<void>;
  onAccept?: () => void;
  isAccepted?: boolean;
  onGeneratePredictions?: () => Promise<void>;
  predictionsGenerated?: boolean;
  isPrimaryPrediction?: boolean;
  predictionGroup?: string;
}

// The correct type for node components in ReactFlow
type LifeNodeProps = ReactFlowNodeProps<Node<LifeNodeData>>;

// Custom node for the starting point of a life
export const StartNode = memo(({ data }: LifeNodeProps) => {
  // Cast data to our expected type
  const nodeData = data as unknown as LifeNodeData;

  return (
    <div className="p-4 rounded-lg border-2 border-green-500 bg-green-100 text-black shadow-md w-60">
      <div className="font-bold text-green-700 mb-2">
        Birth ({nodeData.age} years old)
      </div>
      <div className="text-sm">{nodeData.content}</div>
      <Handle type="source" position={Position.Right} id="a" />
    </div>
  );
});
StartNode.displayName = "StartNode";

// Custom node for the death
export const DeathNode = memo(({ data }: LifeNodeProps) => {
  // Cast data to our expected type
  const nodeData = data as unknown as LifeNodeData;

  return (
    <div className="p-4 rounded-lg border-2 border-gray-500 bg-gray-100 text-black shadow-md w-60">
      <div className="font-bold text-gray-700 mb-2">
        Death ({nodeData.age} years old)
      </div>
      <div className="text-sm">{nodeData.content}</div>
      <Handle type="target" position={Position.Left} id="a" />
    </div>
  );
});
DeathNode.displayName = "DeathNode";

// Custom node for milestones
export const MilestoneNode = memo(({ data }: LifeNodeProps) => {
  // Cast data to our expected type
  const nodeData = data as unknown as LifeNodeData;
  const [isAccepted, setIsAccepted] = useState<boolean>(
    nodeData.isAccepted || false
  );

  const handleAccept = () => {
    setIsAccepted(true);
    if (nodeData.onAccept) {
      nodeData.onAccept();
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 ${
        isAccepted
          ? "border-green-600 bg-green-50"
          : "border-blue-500 bg-blue-100"
      } text-black shadow-md w-60`}
    >
      <div className="font-bold text-blue-700 mb-2">
        Milestone ({nodeData.age} years old)
      </div>
      <div className="text-sm">{nodeData.content}</div>

      {!isAccepted && nodeData.onShuffle && (
        <div className="mt-2 flex space-x-2">
          <button
            onClick={nodeData.onShuffle}
            disabled={nodeData.isLoading}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs font-bold disabled:opacity-50 flex-1"
          >
            {nodeData.isLoading ? "Loading..." : "Re-roll"}
          </button>

          <button
            onClick={handleAccept}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold flex-1"
          >
            Accept
          </button>
        </div>
      )}

      {isAccepted && (
        <div className="mt-2 text-xs text-green-600 font-medium flex items-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Milestone Accepted
        </div>
      )}

      <Handle type="target" position={Position.Left} id="a" />
      <Handle type="source" position={Position.Right} id="b" />
    </div>
  );
});
MilestoneNode.displayName = "MilestoneNode";

// Custom node for random life events
export const EventNode = memo(({ data }: LifeNodeProps) => {
  // Cast data to our expected type
  const nodeData = data as unknown as LifeNodeData;
  const [isGeneratingPredictions, setIsGeneratingPredictions] = useState(false);

  const handleGeneratePredictions = () => {
    if (nodeData.onGeneratePredictions) {
      setIsGeneratingPredictions(true);
      nodeData.onGeneratePredictions().finally(() => {
        setIsGeneratingPredictions(false);
      });
    }
  };

  return (
    <div className="p-4 rounded-lg border-2 border-purple-500 bg-purple-100 text-black shadow-md w-60">
      <div className="font-bold text-purple-700 mb-2">
        Life Event ({nodeData.age} years old)
      </div>
      <div className="text-sm">{nodeData.content}</div>
      <div className="mt-2 flex space-x-2">
        {!nodeData.predictionsGenerated && (
          <button
            onClick={handleGeneratePredictions}
            disabled={isGeneratingPredictions}
            className="px-2 py-1 bg-purple-500 text-white rounded text-xs font-bold flex-1"
          >
            {isGeneratingPredictions
              ? "Generating..."
              : "See Potential Futures"}
          </button>
        )}
        {nodeData.onAccept && (
          <button
            onClick={nodeData.onAccept}
            className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold"
          >
            Accept
          </button>
        )}
        {nodeData.onShuffle && (
          <button
            onClick={nodeData.onShuffle}
            disabled={nodeData.isLoading}
            className="px-2 py-1 bg-gray-500 text-white rounded text-xs font-bold disabled:opacity-50"
          >
            {nodeData.isLoading ? "Loading..." : "Skip"}
          </button>
        )}
      </div>
      <Handle type="target" position={Position.Left} id="a" />
      <Handle type="source" position={Position.Right} id="b" />
      <Handle type="source" position={Position.Bottom} id="c" />
    </div>
  );
});
EventNode.displayName = "EventNode";

// Custom node for AI predictions
export const PredictionNode = memo(({ data }: LifeNodeProps) => {
  // Cast data to our expected type
  const nodeData = data as unknown as LifeNodeData;
  const [isLoading, setIsLoading] = useState(false);

  const handleShuffle = async () => {
    if (nodeData.onShuffle) {
      setIsLoading(true);
      try {
        await nodeData.onShuffle();
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAccept = () => {
    if (nodeData.onAccept) {
      nodeData.onAccept();
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 ${
        nodeData.isPrimaryPrediction ? "border-yellow-600" : "border-yellow-500"
      } bg-yellow-100 text-black shadow-md w-60`}
    >
      <div className="font-bold text-yellow-700 mb-2">
        Prediction ({nodeData.age} years old)
        {nodeData.predictionGroup && (
          <span className="text-xs ml-2 bg-yellow-200 rounded px-1">
            Group {nodeData.predictionGroup}
          </span>
        )}
      </div>
      <div className="text-sm">{nodeData.content}</div>

      <div className="mt-2 flex space-x-2">
        <button
          onClick={handleShuffle}
          disabled={isLoading}
          className="px-2 py-1 bg-yellow-500 text-white rounded text-xs font-bold flex-1 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Shuffle"}
        </button>

        <button
          onClick={handleAccept}
          className="px-2 py-1 bg-green-500 text-white rounded text-xs font-bold flex-1"
        >
          Accept
        </button>
      </div>

      <Handle type="target" position={Position.Left} id="a" />
      <Handle type="source" position={Position.Right} id="b" />
    </div>
  );
});
PredictionNode.displayName = "PredictionNode";
