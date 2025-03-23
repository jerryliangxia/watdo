import { memo, useState, useCallback, useRef, useEffect } from "react";
import {
  Handle,
  Position,
  NodeProps,
  Node,
  useStore,
  useReactFlow,
  NodeResizer,
} from "@xyflow/react";
import LoadingSpinner from "./LoadingSpinner";

export interface CustomNodeData extends Record<string, unknown> {
  type: "operator" | "value" | "input";
  value: string | number;
  result?: string;
  inputs?: string[];
  sourceIds?: string[]; // Array of source node IDs
  history?: string[]; // Changed from number[] to string[] to store IDs
  timelineValue?: number;
  isLoading?: boolean;
  generatingOptions?: boolean;
  onGenerate?: (context: string) => Promise<void>;
  onUpdateAge?: (newAge: number) => void;
  onReshuffleContext?: () => Promise<void>; // Function to reshuffle the node's context
  showOperatorDropdown?: boolean;
}

// Define operator values and their display names
const OPERATORS = ["+", "-", "*", "%"];
const OPERATOR_LABELS: Record<string, string> = {
  "+": "Benefit",
  "-": "Detriment",
  "*": "Unlucky",
  "%": "Lucky",
};

// Helper function to generate a unique ID
let nodeCounter = 1;
const generateId = () => `custom-${nodeCounter++}`;

const CustomNode = memo(
  ({ id, data, isConnectable, selected }: NodeProps<Node<CustomNodeData>>) => {
    const isOperator = data.type === "operator";
    // Number of current connections plus one empty slot for new connections
    const numHandles = (data.inputs?.length || 0) + 1;
    const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
    const [isHoveringAge, setIsHoveringAge] = useState(false);
    const [isDraggingAge, setIsDraggingAge] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle click outside of dropdown
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as HTMLElement)
        ) {
          setNodes((nodes) =>
            nodes.map((node) => {
              if (node.id === id && node.data.showOperatorDropdown) {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    showOperatorDropdown: false,
                  },
                };
              }
              return node;
            })
          );
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [id, setNodes]);

    // Get the age value from timelineValue (defaults to 22 if not set)
    const age = data.timelineValue || 22;

    // Function to create an operator node when Cmd+Click on a value node
    const handleNodeClick = useCallback(
      (e: React.MouseEvent) => {
        // Only handle for value nodes, not operators
        if (isOperator || data.type !== "value") return;

        // Check if Cmd key (Mac) or Ctrl key (Windows) is pressed
        if (e.metaKey || e.ctrlKey) {
          e.stopPropagation(); // Prevent other click handlers

          // Create a random operator
          const operator =
            OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
          const currentNodes = getNodes();
          const currentEdges = getEdges();

          // Get the position of the current node
          const sourceNode = currentNodes.find((node) => node.id === id);
          if (!sourceNode) return;

          // Position the new operator node ahead (right/forward) of the clicked node
          const newNodeId = generateId();
          const offsetX = 500; // Increased distance to the right (from 350 to 500)
          const offsetY = 0; // Same vertical position

          // Create the new operator node with proper structure
          const newNode = {
            id: newNodeId,
            type: "custom",
            position: {
              x: sourceNode.position.x + offsetX,
              y: sourceNode.position.y + offsetY,
            },
            data: {
              type: "operator",
              value: operator,
              timelineValue: sourceNode.data.timelineValue,
              inputs: [], // Initialize empty inputs array
              sourceIds: [], // Initialize empty sourceIds array
              history: [], // Initialize empty history array
            },
          };

          // Create an edge from the current value node to the new operator node
          const newEdge = {
            id: `edge-${id}-${newNodeId}`,
            source: id,
            target: newNodeId,
            type: "default",
          };

          // First add the node
          setNodes((nodes) => {
            const updatedNodes = [...nodes, newNode];

            // Add edge after node is added
            setTimeout(() => {
              setEdges((edges) => {
                const newEdges = [...edges, newEdge];

                // Calculate results with the updated nodes and edges
                setNodes((latestNodes) => {
                  // Find the newly added node
                  const operatorNode = latestNodes.find(
                    (n) => n.id === newNodeId
                  );
                  if (!operatorNode) return latestNodes;

                  // Use the same logic as calculateNodeResults for operator nodes
                  const nodeMap = new Map(
                    latestNodes.map((node) => [node.id, node])
                  );

                  // Find incoming edges for the operator node
                  const incomingEdges = newEdges.filter(
                    (edge) => edge.target === newNodeId
                  );
                  const sourceNodes = incomingEdges
                    .map((edge) => nodeMap.get(edge.source))
                    .filter((node): node is Node<any> => node !== undefined);

                  // Get values and collect source IDs
                  const contexts: string[] = [];
                  const sourceIds: string[] = [];

                  sourceNodes.forEach((srcNode) => {
                    sourceIds.push(srcNode.id);
                    contexts.push(
                      typeof srcNode.data.value === "string"
                        ? srcNode.data.value
                        : String(srcNode.data.value)
                    );
                  });

                  // Update the operator node with inputs and source IDs
                  return latestNodes.map((n) => {
                    if (n.id === newNodeId) {
                      return {
                        ...n,
                        data: {
                          ...n.data,
                          inputs: contexts,
                          sourceIds,
                          history: sourceIds,
                        },
                      };
                    }
                    return n;
                  });
                });

                return newEdges;
              });
            }, 10);

            return updatedNodes;
          });
        }
      },
      [
        id,
        isOperator,
        data.type,
        setNodes,
        setEdges,
        getNodes,
        getEdges,
        data.timelineValue,
      ]
    );

    // Get color based on age ranges with smoother transitions
    const getUrgencyColor = () => {
      const normalizedAge = age % 100; // Convert to 0-99 range for cyclical colors

      // Define our color stops with age ranges and hex colors
      const colorStops = [
        { age: 0, color: "#4ade80" }, // Green for <20s
        { age: 20, color: "#4ade80" }, // Green for 20s
        { age: 30, color: "#3b82f6" }, // Blue for 30s
        { age: 40, color: "#6366f1" }, // Indigo for 40s
        { age: 50, color: "#a855f7" }, // Purple for 50s
        { age: 60, color: "#f97316" }, // Orange for 60s
        { age: 70, color: "#facc15" }, // Yellow for 70s
        { age: 80, color: "#4ade80" }, // Back to green for 80s+
        { age: 100, color: "#4ade80" }, // Green to complete the cycle
      ];

      // Find the color stops that our age falls between
      let lowerIndex = 0;
      for (let i = 0; i < colorStops.length - 1; i++) {
        if (
          normalizedAge >= colorStops[i].age &&
          normalizedAge < colorStops[i + 1].age
        ) {
          lowerIndex = i;
          break;
        }
      }

      const lowerStop = colorStops[lowerIndex];
      const upperStop = colorStops[lowerIndex + 1];

      // Calculate how far we are between the two color stops (0 to 1)
      const range = upperStop.age - lowerStop.age;
      const progress =
        range === 0 ? 0 : (normalizedAge - lowerStop.age) / range;

      // Convert hex colors to RGB for interpolation
      const lowerRgb = hexToRgb(lowerStop.color);
      const upperRgb = hexToRgb(upperStop.color);

      // Interpolate between the two colors
      const r = Math.round(lowerRgb.r + (upperRgb.r - lowerRgb.r) * progress);
      const g = Math.round(lowerRgb.g + (upperRgb.g - lowerRgb.g) * progress);
      const b = Math.round(lowerRgb.b + (upperRgb.b - lowerRgb.b) * progress);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Helper function to convert hex to RGB
    const hexToRgb = (hex: string) => {
      // Remove # if present
      hex = hex.replace("#", "");

      // Parse hex values
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      return { r, g, b };
    };

    const handleAgeChange = (xDelta: number) => {
      if (data.timelineValue === undefined) return;

      // Calculate the actual age change based on drag distance
      // Use a smaller movement amount to allow for precise control
      const ageChange = xDelta / 10;

      // Round to the nearest integer
      const newAge = Math.round(
        Math.max(0, Math.min(99, data.timelineValue + ageChange))
      );

      // Only update if the age actually changed
      if (newAge !== data.timelineValue) {
        // Update node data directly
        setNodes((nodes) =>
          nodes.map((node) => {
            if (node.id === id) {
              return {
                ...node,
                data: {
                  ...node.data,
                  timelineValue: newAge,
                },
              };
            }
            return node;
          })
        );

        // Also call onUpdateAge if provided
        if (data.onUpdateAge) {
          data.onUpdateAge(newAge);
        }
      }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent node dragging
      setIsDraggingAge(true);
    };

    // Create an array of positions for the input handles
    const getHandlePosition = (index: number, total: number) => {
      const topPadding = 0.1; // 10% padding from top
      const handleSpacing = 0.15; // 15% of node height between handles
      return (topPadding + index * handleSpacing) * 100;
    };

    // Get color scheme based on operator or value type
    const getColorScheme = () => {
      if (!isOperator) {
        return {
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-700",
          handle: "!bg-blue-500",
          button: "bg-blue-100 hover:bg-blue-200 text-blue-700",
        };
      }
      // Different colors for different operators
      return data.value === "+" // Benefit
        ? {
            bg: "bg-emerald-50",
            border: "border-emerald-200",
            text: "text-emerald-700",
            handle: "!bg-emerald-500",
            button: "bg-emerald-100 hover:bg-emerald-200 text-emerald-700",
          }
        : data.value === "-" // Detriment
        ? {
            bg: "bg-rose-50",
            border: "border-rose-200",
            text: "text-rose-700",
            handle: "!bg-rose-500",
            button: "bg-rose-100 hover:bg-rose-200 text-rose-700",
          }
        : data.value === "*" // Unlucky
        ? {
            bg: "bg-purple-50",
            border: "border-purple-200",
            text: "text-purple-700",
            handle: "!bg-purple-500",
            button: "bg-purple-100 hover:bg-purple-200 text-purple-700",
          }
        : {
            // Lucky
            bg: "bg-amber-50",
            border: "border-amber-200",
            text: "text-amber-700",
            handle: "!bg-amber-500",
            button: "bg-amber-100 hover:bg-amber-200 text-amber-700",
          };
    };

    const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newOperator = e.target.value;
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: {
                ...node.data,
                value: newOperator,
              },
            };
          }
          return node;
        })
      );
    };

    const colors = getColorScheme();

    const handleGenerate = async () => {
      if (data.onGenerate && data.result) {
        try {
          await data.onGenerate(data.result);
        } catch (error) {
          console.error("Error generating options:", error);
        }
      }
    };

    return (
      <div
        className={`relative px-4 py-2 min-w-[80px] min-h-[80px] text-center ${
          data.isLoading ? "animate-pulse" : ""
        } ${!isOperator && data.type === "value" ? "group" : ""}`}
        style={{
          backgroundColor: isOperator
            ? data.value === "+" // Benefit
              ? "#F0FFF4" // emerald-50
              : data.value === "-" // Detriment
              ? "#FFF5F5" // rose-50
              : data.value === "*" // Unlucky
              ? "#FAF5FF" // purple-50
              : "#FFFBEB" // amber-50 (Lucky)
            : "#EBF8FF", // blue-50
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
          borderRadius: "8px",
          border: `2px solid ${
            isOperator
              ? data.value === "+" // Benefit
                ? "#C6F6D5" // emerald-200
                : data.value === "-" // Detriment
                ? "#FED7D7" // rose-200
                : data.value === "*" // Unlucky
                ? "#E9D8FD" // purple-200
                : "#FEF3C7" // amber-200 (Lucky)
              : getUrgencyColor()
          }`, // Use urgency color for value nodes
        }}
        onClick={handleNodeClick}
      >
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={80}
          handleClassName={colors.handle}
          lineClassName={`border-${colors.border}`}
        />

        {/* Command+Click Tooltip (only for value nodes) */}
        {!isOperator && data.type === "value" && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block z-50">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
              <kbd className="bg-gray-700 px-1 rounded">
                {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Click
              </kbd>{" "}
              to add operator
            </div>
          </div>
        )}

        {/* Age Badge */}
        <div
          className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center font-bold text-xs z-30 cursor-pointer transition-all duration-200"
          style={{
            backgroundColor: getUrgencyColor(),
            color: "white",
            width: isHoveringAge ? "auto" : "24px",
            height: "24px",
            padding: isHoveringAge ? "0 8px" : "0",
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
          onMouseEnter={() => setIsHoveringAge(true)}
          onMouseLeave={() => !isDraggingAge && setIsHoveringAge(false)}
          onMouseDown={handleMouseDown}
          onMouseUp={() => setIsDraggingAge(false)}
          onMouseMove={(e) => {
            if (isDraggingAge) {
              handleAgeChange(e.movementX);
            }
          }}
        >
          {isHoveringAge ? `Age: ${age}` : age}
        </div>

        {/* Tooltip for dragging instructions */}
        {isHoveringAge && !isDraggingAge && (
          <div className="absolute top-6 right-0 transform translate-x-1/2 bg-gray-800 text-white px-2 py-1 rounded text-xs z-40 whitespace-nowrap">
            Drag node to adjust age
          </div>
        )}

        {/* Input handles for operators */}
        {isOperator && (
          <>
            {Array.from({ length: numHandles }, (_, i) => (
              <Handle
                key={`input-${i}`}
                type="target"
                position={Position.Left}
                id={`input-${i}`}
                isConnectable={isConnectable}
                className={colors.handle}
                style={{
                  width: "8px",
                  height: "8px",
                  top: `${getHandlePosition(i, numHandles)}%`,
                }}
              />
            ))}
          </>
        )}

        {/* Left input handle for values */}
        {!isOperator && (
          <Handle
            type="target"
            position={Position.Left}
            isConnectable={isConnectable}
            className={colors.handle}
          />
        )}

        <div className={`font-medium ${colors.text}`}>
          {isOperator ? (
            <div className="flex flex-col items-center gap-1">
              {/* Custom Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNodes((nodes) =>
                      nodes.map((node) => {
                        if (node.id === id) {
                          return {
                            ...node,
                            data: {
                              ...node.data,
                              showOperatorDropdown:
                                !node.data.showOperatorDropdown,
                            },
                          };
                        }
                        return node;
                      })
                    );
                  }}
                  className="flex items-center justify-between w-full text-sm font-semibold px-3 py-1.5 rounded-md appearance-none cursor-pointer focus:outline-none"
                  style={{
                    backgroundColor:
                      data.value === "+" // Benefit
                        ? "#F0FFF4" // emerald-50
                        : data.value === "-" // Detriment
                        ? "#FFF5F5" // rose-50
                        : data.value === "*" // Unlucky
                        ? "#FAF5FF" // purple-50
                        : "#FFFBEB", // amber-50 (Lucky)
                    borderRadius: "6px",
                    border: `1px solid ${
                      data.value === "+" // Benefit
                        ? "#C6F6D5" // emerald-200
                        : data.value === "-" // Detriment
                        ? "#FED7D7" // rose-200
                        : data.value === "*" // Unlucky
                        ? "#E9D8FD" // purple-200
                        : "#FEF3C7" // amber-200 (Lucky)
                    }`,
                    color:
                      data.value === "+" // Benefit
                        ? "#047857" // emerald-700
                        : data.value === "-" // Detriment
                        ? "#BE123C" // rose-700
                        : data.value === "*" // Unlucky
                        ? "#7E22CE" // purple-700
                        : "#B45309", // amber-700 (Lucky)
                  }}
                >
                  <span>{OPERATOR_LABELS[data.value as string]}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {data.showOperatorDropdown && (
                  <div
                    ref={dropdownRef}
                    className="absolute top-full left-0 w-full mt-1 rounded-md shadow-lg overflow-hidden z-50"
                    style={{
                      zIndex: 9999,
                    }}
                  >
                    {OPERATORS.map((op) => {
                      // Get background color based on operator type
                      let bgColor =
                        op === "+" // Benefit
                          ? "#F0FFF4" // emerald-50
                          : op === "-" // Detriment
                          ? "#FFF5F5" // rose-50
                          : op === "*" // Unlucky
                          ? "#FAF5FF" // purple-50
                          : "#FFFBEB"; // amber-50 (Lucky)

                      // Get text/border color based on operator type
                      let textColor =
                        op === "+" // Benefit
                          ? "#C6F6D5" // emerald-200 (border color)
                          : op === "-" // Detriment
                          ? "#FED7D7" // rose-200 (border color)
                          : op === "*" // Unlucky
                          ? "#E9D8FD" // purple-200 (border color)
                          : "#FEF3C7"; // amber-200 (border color)

                      return (
                        <div
                          key={op}
                          className="px-3 py-1.5 cursor-pointer text-center"
                          style={{
                            backgroundColor: bgColor,
                            color:
                              op === "+" // Benefit
                                ? "#047857" // emerald-700
                                : op === "-" // Detriment
                                ? "#BE123C" // rose-700
                                : op === "*" // Unlucky
                                ? "#7E22CE" // purple-700
                                : "#B45309", // amber-700 (Lucky)
                            borderBottom:
                              op !== "%" ? `1px solid ${textColor}` : "none",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodes((nodes) =>
                              nodes.map((node) => {
                                if (node.id === id) {
                                  return {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      value: op,
                                      showOperatorDropdown: false,
                                    },
                                  };
                                }
                                return node;
                              })
                            );
                          }}
                        >
                          {OPERATOR_LABELS[op]}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {data.isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <LoadingSpinner />
                  <div className="text-sm opacity-75">
                    Generating outcome...
                  </div>
                </div>
              ) : (
                <>
                  {data.result && (
                    <>
                      <div className="text-sm opacity-75 max-w-[300px] whitespace-pre-wrap">
                        {data.result}
                      </div>
                      <button
                        onClick={handleGenerate}
                        disabled={data.generatingOptions}
                        className={`mt-2 px-2 py-1 text-xs rounded ${
                          colors.button
                        } transition-colors duration-200 flex items-center gap-2 ${
                          data.generatingOptions
                            ? "opacity-75 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {data.generatingOptions ? (
                          <>
                            <LoadingSpinner />
                            <span>Generating...</span>
                          </>
                        ) : (
                          "Generate Options"
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="text-sm max-w-[300px] whitespace-pre-wrap">
                {data.value}
              </div>

              {/* Reshuffle Button - only for value nodes */}
              {data.type === "value" && data.onReshuffleContext && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    data.onReshuffleContext?.();
                  }}
                  className="absolute bottom-1 right-1 p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors duration-200"
                  title="Reshuffle this context"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 2v6h6"></path>
                    <path d="M3 8L8 3"></path>
                    <path d="M21 12A9 9 0 0 0 3 16.2L7 22"></path>
                    <path d="M21 22v-6h-6"></path>
                    <path d="M21 16l-5 5"></path>
                    <path d="M3 12a9 9 0 0 0 18-4.2l-4-7.8"></path>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Output handle */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={isConnectable}
          className={colors.handle}
        />
      </div>
    );
  }
);

CustomNode.displayName = "CustomNode";

export default CustomNode;
