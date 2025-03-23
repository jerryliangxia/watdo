import { memo, useState, useCallback, useEffect } from "react";
import { Handle, Position, NodeProps, Node, useReactFlow } from "@xyflow/react";
import LoadingSpinner from "./LoadingSpinner";

// Add styles for fade-out animation
const fadeOutStyle = {
  opacity: 0,
  transition: "opacity 1s ease-out",
  pointerEvents: "none" as const,
};

// Add styles for warning message
const warningStyle = {
  position: "absolute" as const,
  top: "-24px",
  left: "50%",
  transform: "translateX(-50%)",
  backgroundColor: "rgba(255, 100, 100, 0.9)",
  color: "white",
  padding: "2px 6px",
  borderRadius: "4px",
  fontSize: "11px",
  whiteSpace: "nowrap" as const,
  zIndex: 10,
};

export interface MilestoneNodeData extends Record<string, unknown> {
  type: "milestone";
  value: string;
  milestones?: string[];
  startGoal?: string;
  endGoal?: string;
  isLoading?: boolean;
  timelineValue?: number;
  onGenerateMilestones?: (startGoal: string, endGoal: string) => Promise<void>;
}

// Add a utility function to calculate the approximate age for each milestone step
const calculateMilestoneAge = (
  startAge: number,
  endAge: number,
  index: number,
  totalMilestones: number
) => {
  // Linear interpolation between start and end age
  const ageRange = endAge - startAge;
  const ageStep = ageRange / (totalMilestones + 1);
  return Math.round(startAge + ageStep * (index + 1));
};

// Calculate x-offset for each milestone to space them apart horizontally
const calculateMilestoneXOffset = (index: number, totalMilestones: number) => {
  // Give each milestone a different x-offset
  // First milestone slightly to the left, last one to the right
  const xOffsetRange = 420; // Significantly increased for much wider spacing
  const centerIndex = (totalMilestones - 1) / 2;
  const relativePosition = index - centerIndex;
  return relativePosition * (xOffsetRange / totalMilestones);
};

// Calculate y-offset for alternating up/down pattern
const calculateMilestoneYOffset = (index: number) => {
  // Alternate between up and down positions
  return index % 2 === 0 ? -30 : 30; // -30px for even indices (up), 30px for odd indices (down)
};

const MilestoneNode = memo(
  ({
    id,
    data,
    isConnectable,
    selected,
  }: NodeProps<Node<MilestoneNodeData>>) => {
    const { setNodes } = useReactFlow();
    const [isVisible, setIsVisible] = useState(true);
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const currentAge = data.timelineValue || 30;
    const [startGoal, setStartGoal] = useState(data.startGoal || "");
    const [endGoal, setEndGoal] = useState(data.endGoal || "");

    // Apply fade-out style when animation is active
    const nodeStyle = isFadingOut ? fadeOutStyle : {};

    // Generate background color gradient based on timeline value
    const getGradient = () => {
      // Timeline value from 20-99 mapped to gradient
      const age = data.timelineValue || 22;

      // Create a gradient that shifts from blue->purple->pink as age increases
      const startHue = 220; // Blue
      const endHue = 320; // Pink

      // Linear interpolation between start and end hues based on age
      const progress = Math.min(1, Math.max(0, (age - 20) / 79));
      const hue = startHue + progress * (endHue - startHue);

      return `linear-gradient(135deg, 
        hsl(${hue}, 100%, 97%) 0%, 
        hsl(${hue}, 70%, 90%) 100%)`;
    };

    // Update goals when input changes
    const handleStartGoalChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setStartGoal(e.target.value);
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, startGoal: e.target.value } }
              : node
          )
        );
      },
      [id, setNodes]
    );

    const handleEndGoalChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setEndGoal(e.target.value);
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === id
              ? { ...node, data: { ...node.data, endGoal: e.target.value } }
              : node
          )
        );
      },
      [id, setNodes]
    );

    // Handle generating milestones
    const handleGenerateMilestones = useCallback(() => {
      console.log("Generate milestones button clicked");
      console.log("Starting goal:", startGoal);
      console.log("End goal:", endGoal);
      console.log(
        "onGenerateMilestones function exists:",
        !!data.onGenerateMilestones
      );

      if (!data.onGenerateMilestones) {
        console.error("onGenerateMilestones function is not defined");
        return;
      }

      // Use local state values for goals
      try {
        data.onGenerateMilestones(startGoal, endGoal);
      } catch (error) {
        console.error("Error calling onGenerateMilestones:", error);
      }
    }, [startGoal, endGoal, data]);

    // Effect to make node disappear after 5 seconds
    useEffect(() => {
      // Show warning immediately
      setShowWarning(true);

      // Update countdown every second
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start fade out after 4 seconds
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 4000);

      // Remove node after 5 seconds
      const removeTimer = setTimeout(() => {
        setIsVisible(false);

        // Remove the node from the flow after it disappears
        setNodes((nodes) => nodes.filter((node) => node.id !== id));
      }, 5000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
        clearInterval(countdownInterval);
      };
    }, [id, setNodes]);

    // If the node is not visible, return null (don't render anything)
    if (!isVisible) {
      return null;
    }

    return (
      <div
        className={`relative px-3 py-2 rounded-lg border-2 shadow-lg transition-all duration-300 ${
          selected ? "border-blue-500" : "border-purple-300"
        } ${data.isLoading ? "animate-pulse" : ""}`}
        style={{
          background: getGradient(),
          minWidth: "300px", // Increased from 220px
          minHeight: "80px",
          maxWidth: "600px", // Increased from 400px
          ...nodeStyle,
          position: "relative", // To position warning message
        }}
      >
        {/* Warning message */}
        {showWarning && (
          <div style={warningStyle}>
            Life event disappearing in {countdown} seconds
          </div>
        )}

        {/* Input handle on left */}
        <Handle
          type="target"
          position={Position.Left}
          id="start-target"
          className="w-2.5 h-2.5 !bg-purple-500"
          isConnectable={isConnectable}
        />

        {/* Output handle on right */}
        <Handle
          type="source"
          position={Position.Right}
          id="end-source"
          className="w-2.5 h-2.5 !bg-purple-500"
          isConnectable={isConnectable}
        />

        {/* Milestone Node Header */}
        <div className="flex justify-between items-center mb-1.5">
          <div className="text-base font-semibold text-purple-800">
            Life Path
          </div>
          {data.timelineValue && (
            <div className="bg-purple-600 text-white px-1.5 py-0.5 rounded-full text-xs">
              Age {data.timelineValue}
            </div>
          )}
        </div>

        {/* Start and End Goals - Editable inputs */}
        <div className="mb-2 space-y-1.5">
          <div className="flex">
            <span className="text-xs font-medium text-purple-700 mr-1">
              Start:
            </span>
            <input
              value={startGoal}
              onChange={handleStartGoalChange}
              className="text-xs flex-1 bg-white bg-opacity-50 rounded px-1 py-0.5 border border-purple-200"
              placeholder="Enter starting point"
            />
          </div>
          <div className="flex">
            <span className="text-xs font-medium text-purple-700 mr-1">
              End:
            </span>
            <input
              value={endGoal}
              onChange={handleEndGoalChange}
              className="text-xs flex-1 bg-white bg-opacity-50 rounded px-1 py-0.5 border border-purple-200"
              placeholder="Enter end goal"
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-1 px-2 rounded-md text-sm transition"
          onClick={handleGenerateMilestones}
          disabled={data.isLoading || !startGoal || !endGoal}
        >
          {data.isLoading ? (
            <div className="flex items-center justify-center">
              <LoadingSpinner size={12} />
              <span className="ml-1.5 text-xs">Loading...</span>
            </div>
          ) : (
            "Generate Path"
          )}
        </button>

        {/* Milestones Display - More compact design */}
        {data.milestones && data.milestones.length > 0 && (
          <div className="mt-2 relative pb-12 pt-8">
            {/* Timeline connector line */}
            <div
              className="absolute top-12 left-0 right-0 h-0.5 bg-purple-200 z-0"
              style={{
                width: "100%",
              }}
            />

            {data.milestones.map((milestone, index) => {
              const milestoneAge = calculateMilestoneAge(
                currentAge - 5,
                currentAge + 15,
                index,
                data.milestones?.length || 3
              );

              // Calculate horizontal offset for this milestone
              const xOffset = calculateMilestoneXOffset(
                index,
                data.milestones?.length || 3
              );

              // Calculate vertical offset for alternating pattern
              const yOffset = calculateMilestoneYOffset(index);

              return (
                <div
                  key={index}
                  className="absolute bg-white bg-opacity-70 rounded border border-purple-100 pl-2 pr-10 py-1.5"
                  style={{
                    transform: `translate(${xOffset}px, ${yOffset}px)`,
                    zIndex: index + 1, // Ensure proper stacking
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    maxWidth: "220px", // Slightly wider to fit more text
                    left: "50%",
                    top: "12px", // Position relative to the center line
                    marginLeft: "-110px", // Center the card (half of maxWidth)
                  }}
                >
                  {/* Timeline dot */}
                  <div
                    className="absolute w-4 h-4 rounded-full bg-purple-400 border-2 border-white"
                    style={{
                      left: "50%",
                      transform: "translateX(-50%)",
                      top: yOffset < 0 ? "calc(100% + 4px)" : "-12px", // Position dot above or below depending on card position
                    }}
                  />

                  {/* Connector line from card to timeline */}
                  <div
                    className="absolute w-0.5 bg-purple-200"
                    style={{
                      left: "50%",
                      height: Math.abs(yOffset) - 8 + "px",
                      transform: "translateX(-50%)",
                      top: yOffset < 0 ? "100%" : `-${Math.abs(yOffset) - 8}px`,
                    }}
                  />

                  <div className="absolute top-0.5 right-0.5 bg-purple-500 text-white px-1 py-0.5 rounded-full text-xs">
                    {milestoneAge}
                  </div>
                  <p className="text-xs text-purple-900">{milestone}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

// Add display name
MilestoneNode.displayName = "MilestoneNode";

export default MilestoneNode;
