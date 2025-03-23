import { memo, useEffect, useRef, useState } from "react";
import { useStore, useReactFlow } from "@xyflow/react";

interface TimelineProps {
  className?: string;
  height?: number;
  spacingFactor?: number;
}

// Define scaling factor as a constant to ensure consistency
const TIMELINE_SCALING_FACTOR = 150; // 150px per decade

const Timeline = memo(
  ({ className = "", height = 60, spacingFactor = 1.5 }: TimelineProps) => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const { getNodes, getViewport, setViewport } = useReactFlow();
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [initialTransformX, setInitialTransformX] = useState(0);

    // Get viewport transform (pan and zoom state)
    const transform = useStore((state) => state.transform);
    const [x, y, zoom] = transform;

    // Ensure the timeline shows a good initial view when first rendered
    useEffect(() => {
      // Only set initial position if the timeline is at default position
      if (Math.abs(x) < 10 && Math.abs(zoom - 1) < 0.1) {
        // Center the timeline view around position 20 for better backward view
        const initialX =
          -(20 * TIMELINE_SCALING_FACTOR) + window.innerWidth / 2;

        // Use a slightly smaller zoom level to show more context
        const initialZoom = 0.8;
        setViewport({ x: initialX, y, zoom: initialZoom });
      }
    }, []);

    // Calculate the visible range based on viewport and container size
    const calculateVisibleRange = () => {
      if (!timelineRef.current) return { start: 0, end: 100 };

      const containerWidth = timelineRef.current.clientWidth;
      // Adjust the calculation to account for the scaling factor and spacingFactor
      const adjustedScalingFactor = TIMELINE_SCALING_FACTOR / spacingFactor;
      const start = Math.floor(-x / (zoom * adjustedScalingFactor));
      const end =
        start + Math.floor(containerWidth / (zoom * adjustedScalingFactor));

      return { start, end };
    };

    // Generate tick marks for the timeline
    const generateTicks = () => {
      const { start, end } = calculateVisibleRange();
      const adjustedScalingFactor = TIMELINE_SCALING_FACTOR / spacingFactor;

      // Use larger tick spacing to reduce clutter with extreme stretching
      let tickSpacing = 10; // Show major ticks every 10 units

      // Adjust spacing based on zoom level for better readability
      if (zoom < 0.5) tickSpacing = 20;
      else if (zoom > 1.5) tickSpacing = 5;

      // Constrain start position to be at least 0
      const constrainedStart = Math.max(0, start);

      // Adjust the start position to be a multiple of the tick spacing
      const startTick =
        Math.floor(constrainedStart / tickSpacing) * tickSpacing;
      const ticks = [];

      // Only generate primary ticks between 0 and 80
      for (let pos = startTick; pos <= Math.min(end, 80); pos += tickSpacing) {
        // Skip negative positions
        if (pos < 0) continue;

        // Calculate the position in viewport coordinates
        const viewportPos = pos * adjustedScalingFactor * zoom + x;

        // Always show major ticks (divisible by 10)
        const isMajorTick = pos % 20 === 0;

        ticks.push(
          <div
            key={`tick-${pos}`}
            className={`absolute bottom-0 ${
              isMajorTick ? "h-6 border-l-2" : "h-5 border-l"
            } border-gray-500`}
            style={{
              left: `${viewportPos}px`,
              transform: "translateX(-50%)",
            }}
          >
            {pos % 10 === 0 && (
              <span
                className="absolute text-xs font-bold text-gray-700"
                style={{ bottom: "25px", transform: "translateX(-50%)" }}
              >
                {pos}
              </span>
            )}
          </div>
        );
      }

      // Add secondary ticks at 5-unit intervals
      for (
        let pos = Math.max(0, Math.floor(start / 5) * 5);
        pos <= Math.min(end, 80);
        pos += 5
      ) {
        // Skip positions that already have primary ticks
        if (pos % tickSpacing === 0 || pos < 0) continue;

        // Calculate the position in viewport coordinates
        const viewportPos = pos * adjustedScalingFactor * zoom + x;

        ticks.push(
          <div
            key={`secondary-tick-${pos}`}
            className="absolute bottom-0 h-4 border-l border-gray-400"
            style={{
              left: `${viewportPos}px`,
              transform: "translateX(-50%)",
            }}
          >
            <span
              className="absolute text-[9px] font-medium text-gray-500"
              style={{ bottom: "16px", transform: "translateX(-50%)" }}
            >
              {pos}
            </span>
          </div>
        );
      }

      // Determine whether to show minor tick values based on zoom level
      const showMinorValues = zoom > 1.2;

      // Add minor tick marks between the main ticks for more precision
      let minorTickSpacing = 1; // Show frequent minor ticks (every unit)

      // Adjust spacing based on zoom to prevent overcrowding
      if (zoom < 0.5) {
        minorTickSpacing = 5; // Fewer ticks when zoomed out
      } else if (zoom < 1) {
        minorTickSpacing = 2; // More ticks at medium zoom
      } else {
        minorTickSpacing = 1; // Maximum ticks at high zoom
      }

      // Generate minor ticks
      for (
        let pos = Math.max(0, Math.floor(start));
        pos <= Math.min(end, 80);
        pos += minorTickSpacing
      ) {
        // Skip positions that already have other ticks
        if (pos % 5 === 0 || pos < 0) continue;

        // Calculate the position in viewport coordinates
        const viewportPos = pos * adjustedScalingFactor * zoom + x;

        ticks.push(
          <div
            key={`minor-tick-${pos}`}
            className="absolute bottom-0 h-1.5 border-l border-gray-300"
            style={{
              left: `${viewportPos}px`,
              transform: "translateX(-50%)",
            }}
          >
            {showMinorValues && (
              <span
                className="absolute text-[8px] font-light text-gray-400"
                style={{ bottom: "6px", transform: "translateX(-50%)" }}
              >
                {pos}
              </span>
            )}
          </div>
        );
      }

      return ticks;
    };

    // Highlight the positions of nodes on the timeline
    const generateNodeMarkers = () => {
      const nodes = getNodes();
      const adjustedScalingFactor = TIMELINE_SCALING_FACTOR / spacingFactor;

      return nodes.map((node) => {
        // Use the timelineValue if available, otherwise use the current x position
        let nodePosition =
          node.data?.timelineValue !== undefined
            ? (node.data.timelineValue as number)
            : node.position.x / adjustedScalingFactor;

        // Constrain node position to the 0-80 range
        nodePosition = Math.max(0, Math.min(80, nodePosition));

        // Apply the same scaling factor for node markers to match tick positions
        const xPos = nodePosition * adjustedScalingFactor * zoom + x;

        // Determine the marker color based on node type
        const getMarkerColor = () => {
          if (!node.data?.type) return "bg-blue-500";

          switch (node.data.type) {
            case "operator":
              const value = node.data.value as string;
              if (value === "+") return "bg-emerald-500";
              if (value === "-") return "bg-rose-500";
              if (value === "*") return "bg-purple-500";
              if (value === "%") return "bg-amber-500";
              return "bg-blue-500";
            case "input":
              return "bg-cyan-500";
            case "value":
            default:
              return "bg-blue-500";
          }
        };

        const markerColor = getMarkerColor();

        return (
          <div
            key={`node-${node.id}`}
            className={`absolute bottom-0 w-4 h-10 ${markerColor} rounded-t-md shadow-md`}
            style={{
              left: `${xPos}px`,
              transform: "translateX(-50%)",
              zIndex: 20,
            }}
            title={`Node ${node.id} at position ${Math.round(nodePosition)}`}
          />
        );
      });
    };

    // Handle mouse interaction for timeline panning
    const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStartX(e.clientX);
      setInitialTransformX(x);
      e.preventDefault();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;

      const dx = e.clientX - dragStartX;
      // Adjust the panning speed to be smoother with the scaling factor
      const panSpeed = 1.0; // Lower value makes panning less sensitive
      const newX = initialTransformX + dx * panSpeed;

      // Update the React Flow viewport x position
      setViewport({ x: newX, y, zoom });
      e.preventDefault();
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Ensure we clean up event listeners
    useEffect(() => {
      const cleanup = () => {
        setIsDragging(false);
      };

      window.addEventListener("mouseup", cleanup);
      return () => {
        window.removeEventListener("mouseup", cleanup);
      };
    }, []);

    return (
      <div
        ref={timelineRef}
        className={`fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 overflow-hidden select-none z-10 ${className}`}
        style={{ height: `${height}px` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className="relative w-full h-full">
          <div className="absolute top-2 left-4 text-sm font-medium text-gray-700">
            Timeline (Age 20-80) | Zoom: {zoom.toFixed(1)}x
          </div>

          <div className="w-full h-full pt-10">
            {generateTicks()}
            {generateNodeMarkers()}
          </div>

          {/* Drag indicator */}
          <div className="absolute top-2 right-4 text-xs text-gray-500">
            {isDragging ? "Panning..." : "Drag to pan"}
          </div>
        </div>
      </div>
    );
  }
);

Timeline.displayName = "Timeline";

export default Timeline;
