import { useEffect, useRef } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

interface TimelineProps {
  min: number;
  max: number;
}

const Timeline = ({ min, max }: TimelineProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { getViewport } = useReactFlow();
  const transform = useStore((state) => state.transform);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewport = getViewport();
    const { zoom, x: viewportX } = viewport;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = 50;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate timeline parameters
    const totalWidth = canvas.width / zoom;
    const visibleWidth = canvas.width;
    const viewportLeft = -viewportX / zoom;

    // Calculate marker spacing - we want 5 sections for values 0-4
    const sectionsCount = 5;
    const markerSpacing = visibleWidth / sectionsCount;

    // Draw timeline
    ctx.beginPath();
    ctx.moveTo(0, 25);
    ctx.lineTo(canvas.width, 25);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw markers and labels
    ctx.font = "12px system-ui";
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";

    // Draw section markers
    for (let i = 0; i <= sectionsCount; i++) {
      const x = i * markerSpacing;
      const value = i + 20; // Shift values to start at 20

      // Only draw if marker is within canvas bounds
      if (x >= -markerSpacing && x <= visibleWidth + markerSpacing) {
        // Draw marker
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, 30);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw label if value is between 20 and 24
        if (value >= 20 && value <= 24) {
          ctx.fillText(value.toString(), x, 45);
        }
      }
    }
  }, [transform, min, max, getViewport]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[50px] pointer-events-none">
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
};

export default Timeline;
