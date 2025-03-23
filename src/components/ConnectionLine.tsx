import { ConnectionLineComponentProps } from "@xyflow/react";

export default function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
}: ConnectionLineComponentProps) {
  return (
    <g>
      <path
        fill="none"
        stroke="#2dd4bf"
        strokeWidth={2}
        className="animated"
        d={`M${fromX},${fromY} C ${fromX + 50},${fromY} ${
          toX - 50
        },${toY} ${toX},${toY}`}
      />
      <circle cx={toX} cy={toY} fill="#2dd4bf" r={3} />
    </g>
  );
}
