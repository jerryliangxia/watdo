"use client";

import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import {
  Background,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  Connection,
  Edge,
  Node,
  NodeTypes,
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "@/components/CustomNode";
import ConnectionLine from "@/components/ConnectionLine";
import Timeline from "@/components/Timeline";
import InputNode from "@/components/InputNode";
import ContextMenu from "@/components/ContextMenu";

type NodeData = {
  type: "operator" | "value" | "input";
  value: string | number;
  result?: string;
  inputs?: string[];
  sourceIds?: string[];
  history?: string[];
  timelineValue?: number;
  onGenerate?: (context: string) => Promise<void>;
  isLoading?: boolean;
  generatingOptions?: boolean;
  [key: string]: unknown;
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
  input: InputNode,
};

const initialNodes: Node<NodeData>[] = [
  {
    id: "0",
    type: "input",
    data: {
      type: "input",
      value: "",
    },
    position: { x: 0, y: 50 },
  },
];

const initialEdges: Edge[] = [];

let id = 1;
const getId = () => `${id++}`;

async function calculateContextResult(
  operator: string,
  contexts: string[]
): Promise<string> {
  if (contexts.length < 2) return "";

  const prompt = (() => {
    switch (operator) {
      case "+":
        return `Given these two situations:
1. ${contexts[0]}
2. ${contexts[1]}

Generate a brief positive outcome (max 15 words) that results from combining these actions.`;

      case "-":
        return `Given these two situations:
1. ${contexts[0]}
2. ${contexts[1]}

Generate a brief conflict outcome (max 15 words) where these actions interfere with each other.`;

      case "*":
        return `Given these two situations:
1. ${contexts[0]}
2. ${contexts[1]}

Generate a brief negative obstacle (max 15 words) that could occur during these actions.`;

      case "%":
        return `Given these two situations:
1. ${contexts[0]}
2. ${contexts[1]}

Generate a brief positive opportunity (max 15 words) that could arise during these actions.`;

      default:
        return "";
    }
  })();

  if (!prompt) return "";

  try {
    const response = await fetch("https://api.cohere.ai/v1/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_COHERE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "command",
        prompt,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate result");
    }

    const data = await response.json();
    return data.generations[0].text.trim();
  } catch (error) {
    console.error("Error generating result:", error);
    return "Error generating result";
  }
}

async function processNodeCalculations(
  nodes: Node<NodeData>[],
  edges: Edge[],
  operatorNode: Node<NodeData>,
  generateOptions: (context: string, nodeId: string) => Promise<void>
): Promise<Node<NodeData>[]> {
  // Find connected source nodes
  const sourceNodes = nodes.filter((node) =>
    edges.some(
      (edge) => edge.target === operatorNode.id && edge.source === node.id
    )
  );

  if (sourceNodes.length < 2) {
    return nodes;
  }

  // Get contexts from source nodes
  const contexts = sourceNodes.map((node) =>
    typeof node.data.value === "string"
      ? node.data.value
      : String(node.data.value)
  );

  // Set loading state
  const updatedNodes = nodes.map((node) =>
    node.id === operatorNode.id
      ? { ...node, data: { ...node.data, isLoading: true } }
      : node
  );

  // Calculate result
  const result = await calculateContextResult(
    operatorNode.data.value as string,
    contexts
  );

  // Update node with result
  return updatedNodes.map((node) =>
    node.id === operatorNode.id
      ? {
          ...node,
          data: {
            ...node.data,
            result,
            inputs: contexts,
            sourceIds: sourceNodes.map((n) => n.id),
            isLoading: false,
            onGenerate: (context: string) =>
              generateOptions(context, operatorNode.id),
          },
        }
      : node
  );
}

function calculateNodeResults(nodes: Node<NodeData>[], edges: Edge[]) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return nodes.map((node) => {
    if (node.data.type === "operator") {
      // Find incoming edges
      const incomingEdges = edges.filter((edge) => edge.target === node.id);
      const sourceNodes = incomingEdges
        .map((edge) => nodeMap.get(edge.source))
        .filter((node): node is Node<NodeData> => node !== undefined);

      // Get values and collect source IDs
      const contexts: string[] = [];
      const sourceIds: string[] = [];

      sourceNodes.forEach((sourceNode) => {
        sourceIds.push(sourceNode.id);
        contexts.push(
          typeof sourceNode.data.value === "string"
            ? sourceNode.data.value
            : String(sourceNode.data.value)
        );
      });

      // Return updated node with inputs and source IDs as history
      return {
        ...node,
        data: {
          ...node.data,
          inputs: contexts,
          sourceIds,
          history: sourceIds,
        },
      };
    }
    // For value nodes, set their own ID in history
    if (node.data.type === "value") {
      return {
        ...node,
        data: {
          ...node.data,
          history: [node.id],
        },
      };
    }
    return node;
  });
}

function getRandomNodeData(sourceNodeType?: string): NodeData {
  // If dragging from a value or input node, always create an operator node
  if (sourceNodeType === "value" || sourceNodeType === "input") {
    const operators = ["+", "-", "*", "%"];
    return {
      type: "operator",
      value: operators[Math.floor(Math.random() * operators.length)],
    };
  }

  // If dragging from an operator or no source specified, use the original random logic
  const isOperator = Math.random() > 0.5;
  const operators = ["+", "-", "*", "%"];
  return {
    type: isOperator ? "operator" : "value",
    value: isOperator
      ? operators[Math.floor(Math.random() * operators.length)]
      : Math.floor(Math.random() * 4) + 1,
  };
}

function Flow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<NodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getViewport } = useReactFlow();

  // Add new state for context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  // Add Cohere API call function
  const generateOptions = async (context: string, nodeId: string) => {
    try {
      if (!process.env.NEXT_PUBLIC_COHERE_API_KEY) {
        throw new Error("Cohere API key is not configured");
      }

      // Set loading state
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, generatingOptions: true } }
            : n
        )
      );

      // Find the operator node by ID
      const sourceOperatorNode = nodes.find((n) => n.id === nodeId);
      if (!sourceOperatorNode) {
        throw new Error("Source operator node not found");
      }

      const response = await fetch("https://api.cohere.ai/v1/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_COHERE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "command",
          prompt: `Based on this situation: "${context}"

Generate 3 brief next actions (max 15 words each).
Return them in this exact JSON format, with no other text:
[
  "First brief action",
  "Second brief action",
  "Third brief action"
]`,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Failed to generate options: ${response.status} ${
            response.statusText
          }${errorData.message ? ` - ${errorData.message}` : ""}`
        );
      }

      const data = await response.json();

      if (!data.generations?.[0]?.text) {
        throw new Error("Invalid response format from Cohere API");
      }

      let options;
      try {
        // Clean and prepare the text for JSON parsing
        let cleanText = data.generations[0].text
          .trim()
          .replace(/[\n\r]/g, "")
          .replace(/\s+/g, " ");

        // If the text starts with something other than [, try to find the first [
        const startBracket = cleanText.indexOf("[");
        if (startBracket !== -1) {
          cleanText = cleanText.slice(startBracket);
        }

        // If the text ends with something other than ], try to find the last ]
        const endBracket = cleanText.lastIndexOf("]");
        if (endBracket !== -1) {
          cleanText = cleanText.slice(0, endBracket + 1);
        }

        options = JSON.parse(cleanText);
      } catch (parseError) {
        console.error(
          "Failed to parse options:",
          parseError,
          "Raw text:",
          data.generations[0].text
        );
        throw new Error("Invalid JSON format in API response");
      }

      if (!Array.isArray(options) || options.length !== 3) {
        throw new Error("Invalid options format from Cohere API");
      }

      // Create new nodes for each option
      const newNodes: Node<NodeData>[] = options.map(
        (option: string, index: number) => {
          const id = getId();
          // Calculate positions in a forward-facing arc
          const angle = (Math.PI / 6) * (index - 1); // Less spread (-30 to 30 degrees)
          const distance = 350; // Increased safe distance

          // Calculate position - ensure x is always positive (forward)
          const xPos =
            sourceOperatorNode.position.x + Math.cos(angle) * distance;
          const yPos =
            sourceOperatorNode.position.y + Math.sin(angle) * distance;

          // Check for potential collisions with existing nodes
          const nodeWidth = 250; // Approximate node width
          const nodeHeight = 150; // Approximate node height

          // Create some padding around the node
          const nodePadding = 50;

          // Find if this position would collide with any existing node
          const wouldCollide = nodes.some((existingNode) => {
            // Skip checking against the source node itself
            if (existingNode.id === sourceOperatorNode.id) return false;

            const distX = Math.abs(existingNode.position.x - xPos);
            const distY = Math.abs(existingNode.position.y - yPos);

            // If the distance is less than the combined half widths/heights + padding, they collide
            return (
              distX < nodeWidth + nodePadding &&
              distY < nodeHeight + nodePadding
            );
          });

          // If collision detected, adjust the distance outward
          const finalDistance = wouldCollide ? distance * 1.5 : distance;
          const finalXPos =
            sourceOperatorNode.position.x + Math.cos(angle) * finalDistance;
          const finalYPos =
            sourceOperatorNode.position.y + Math.sin(angle) * finalDistance;

          return {
            id,
            type: "custom",
            data: {
              type: "value",
              value: option,
              timelineValue: getTimelineValue(finalXPos),
            },
            position: {
              x: finalXPos,
              y: finalYPos,
            },
          };
        }
      );

      // Add new nodes and edges
      setNodes((nds) => {
        const updatedNodes = [...nds, ...newNodes].map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, generatingOptions: false } }
            : n
        );
        return updatedNodes;
      });

      setEdges((eds) => [
        ...eds,
        ...newNodes.map((node) => ({
          id: `e${node.id}`,
          source: sourceOperatorNode.id,
          target: node.id,
          type: "default",
        })),
      ]);
    } catch (error) {
      // Clear loading state on error
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, generatingOptions: false } }
            : n
        )
      );
      console.error("Error generating options:", error);
      throw error;
    }
  };

  // Modify the initial node to include the generate function
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === "0"
          ? {
              ...node,
              data: {
                ...node.data,
                onGenerate: (context: string) =>
                  generateOptions(context, node.id),
              },
            }
          : node
      )
    );
  }, []);

  // Prevent deletion of the input node and handle edge deletion for operator nodes
  const onNodesChangeWithProtection = useCallback(
    (changes: NodeChange<Node<NodeData>>[]) => {
      // Filter out changes to delete the initial input node (id "0")
      const safeChanges = changes.filter(
        (change) => !(change.type === "remove" && change.id === "0")
      );

      // Handle deletion of operator nodes - remove edges connected to them
      const nodesToDelete = safeChanges.filter(
        (change): change is { type: "remove"; id: string } =>
          change.type === "remove"
      );

      if (nodesToDelete.length > 0) {
        const nodeIdsToDelete = nodesToDelete.map((change) => change.id);

        // Remove edges connected to deleted nodes
        setEdges((currentEdges) =>
          currentEdges.filter(
            (edge) =>
              !nodeIdsToDelete.includes(edge.source) &&
              !nodeIdsToDelete.includes(edge.target)
          )
        );
      }

      // Apply the filtered changes
      onNodesChange(safeChanges);
    },
    [setEdges, onNodesChange]
  );

  // Add function to calculate timeline value from x position
  const getTimelineValue = useCallback((xPos: number) => {
    // Map x position to timeline value (20-24 range)
    // 0 position = 20, 400 position = 24 (100px per unit)
    const value = Math.round(20 + xPos / 100);

    // Clamp value between min and max
    return Math.max(20, Math.min(24, value));
  }, []);

  // Handle node dragging
  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                timelineValue: getTimelineValue(node.position.x),
              },
            };
          }
          return n;
        })
      );
    },
    [getTimelineValue, setNodes]
  );

  // Handle node drag stop
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                timelineValue: getTimelineValue(node.position.x),
              },
            };
          }
          return n;
        })
      );
    },
    [getTimelineValue, setNodes]
  );

  // Calculate results when edges change
  const onEdgesChangeWithCalculation = useCallback(
    async (changes: any) => {
      onEdgesChange(changes);

      // Find operator nodes that need recalculation
      const operatorNodes = nodes.filter(
        (node) =>
          node.data.type === "operator" &&
          edges.some((edge) => edge.target === node.id)
      );

      // Set loading state for all operator nodes that will be processed
      setNodes((nds) =>
        nds.map((n) =>
          operatorNodes.some((op) => op.id === n.id)
            ? {
                ...n,
                data: {
                  ...n.data,
                  isLoading: true,
                },
              }
            : n
        )
      );

      // Process each operator node sequentially
      let currentNodes = nodes;
      for (const operatorNode of operatorNodes) {
        currentNodes = await processNodeCalculations(
          currentNodes,
          edges,
          operatorNode,
          generateOptions
        );
        setNodes(currentNodes);
      }
    },
    [edges, nodes, onEdgesChange]
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      const targetNode = nodes.find((node) => node.id === params.target);
      const sourceNode = nodes.find((node) => node.id === params.source);

      if (!targetNode || !sourceNode) return;

      const isDuplicateConnection = targetNode.data.history?.includes(
        sourceNode.id
      );

      const isValidConnection =
        !isDuplicateConnection &&
        (targetNode.data.type === "operator" ||
          (sourceNode.data.type === "operator" &&
            targetNode.data.type === "value"));

      if (isValidConnection) {
        const newEdges = addEdge(params, edges);
        setEdges(newEdges);

        if (targetNode.data.type === "operator") {
          // Set loading state immediately
          setNodes((nds) =>
            nds.map((n) =>
              n.id === targetNode.id
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      isLoading: true,
                    },
                  }
                : n
            )
          );

          const updatedNodes = await processNodeCalculations(
            nodes,
            newEdges,
            targetNode,
            generateOptions
          );
          setNodes(updatedNodes);
        }
      }
    },
    [nodes, edges]
  );

  const onConnectEnd = useCallback(
    (event: any, connectionState: any) => {
      if (!connectionState.isValid) {
        const id = getId();
        const { clientX, clientY } =
          "changedTouches" in event ? event.changedTouches[0] : event;

        const position = screenToFlowPosition({
          x: clientX,
          y: clientY,
        });

        // Get the source node to determine what type of node to create
        const sourceNode = nodes.find(
          (n) => n.id === connectionState.fromNode.id
        );
        const sourceNodeType = sourceNode?.data.type;

        const nodeData = getRandomNodeData(sourceNodeType);
        const newNode: Node<NodeData> = {
          id,
          type: "custom",
          position,
          data: {
            ...nodeData,
            timelineValue: getTimelineValue(position.x),
          },
        };

        const newEdge: Edge = {
          id,
          source: connectionState.fromNode.id,
          target: id,
          type: "default",
          sourceHandle: connectionState.handleId,
        };

        setNodes((nds) => {
          const updatedNodes = [...nds, newNode];
          // Calculate results for the new configuration
          return calculateNodeResults(updatedNodes, [...edges, newEdge]);
        });
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [screenToFlowPosition, edges, getTimelineValue, nodes]
  );

  return (
    <div className="h-screen w-screen" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithProtection}
        onEdgesChange={onEdgesChangeWithCalculation}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        connectionLineComponent={ConnectionLine}
        className="!bg-black"
        style={{
          background: "black",
          width: "100%",
          height: "100%",
        }}
        proOptions={{
          hideAttribution: true,
        }}
        defaultViewport={{
          x: 0,
          y: 0,
          zoom: 1.5,
        }}
        fitViewOptions={{
          padding: 2,
          minZoom: 0.8,
          maxZoom: 2.5,
        }}
        onContextMenu={(event) => {
          // Prevent default context menu
          event.preventDefault();

          // Get the position for the context menu
          const bounds = reactFlowWrapper.current?.getBoundingClientRect();
          if (!bounds) return;

          const x = event.clientX - bounds.left;
          const y = event.clientY - bounds.top;

          // Convert screen position to flow position
          const flowPosition = screenToFlowPosition({ x, y });

          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            flowPosition,
          });
        }}
        fitView
      >
        <Background color="#fff" gap={20} style={{ zIndex: 0, opacity: 0.5 }} />
        {/* <Timeline min={20} max={24} /> */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onAddNode={() => {
              const newNodeId = getId();
              const newNode: Node<NodeData> = {
                id: newNodeId,
                type: "input",
                position: contextMenu.flowPosition,
                data: {
                  type: "input",
                  value: "",
                  onGenerate: (context: string) =>
                    generateOptions(context, newNodeId),
                },
              };
              setNodes((nds) => [...nds, newNode]);
              setContextMenu(null);
            }}
          />
        )}
      </ReactFlow>
    </div>
  );
}

export default function Home() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
