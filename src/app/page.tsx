"use client";

import { useCallback, useRef, useEffect, useState } from "react";
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
  EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "@/components/CustomNode";
import ConnectionLine from "@/components/ConnectionLine";
import InputNode from "@/components/InputNode";
import ContextMenu from "@/components/ContextMenu";
import Changelog from "@/components/Changelog";

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
  onGenerateBackward?: (context: string) => Promise<void>;
  onUpdateAge?: (newAge: number) => void;
  onReshuffleContext?: () => Promise<void>;
  operatorResults?: Record<string, string>;
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

  // Initialize or update operator results
  const currentOperatorResults = operatorNode.data.operatorResults || {};
  const updatedOperatorResults = {
    ...currentOperatorResults,
    [operatorNode.data.value as string]: result,
  };

  // Update node with result and add calculateResult function
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
            operatorResults: updatedOperatorResults,
            onGenerate: (context: string) =>
              generateOptions(context, operatorNode.id),
            calculateResult: async (inputs: string[], operatorType: string) => {
              return calculateContextResult(operatorType, inputs);
            },
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

function getRandomNodeData(
  sourceNodeType?: string,
  handleId?: string
): NodeData {
  // If dragging from the left handle of an input node, create a "precursor" value node
  if (sourceNodeType === "input" && handleId === "backward") {
    return {
      type: "value",
      value: "Prerequisite step...",
    };
  }

  // If dragging from a value or input node (right handle), always create an operator node
  if (
    sourceNodeType === "value" ||
    (sourceNodeType === "input" && handleId !== "backward")
  ) {
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
  const { screenToFlowPosition, getEdges } = useReactFlow();

  // Add function to calculate timeline value from x position
  const getTimelineValue = useCallback((xPos: number) => {
    // Base age is 20
    const baseAge = 20;

    // Map x position to timeline value (20-99 range)
    // Every 150px increment represents roughly one decade
    const offset = Math.round(xPos / 150);

    // Clamp value between min and max
    return Math.max(baseAge, Math.min(99, baseAge + offset));
  }, []);

  // Add new state for context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowPosition: { x: number; y: number };
  } | null>(null);

  // First declare reshuffleContext function
  const reshuffleContext = useCallback(
    async (nodeId: string) => {
      try {
        // Get the current node and set loading state
        const nodeInfo = await new Promise<{ node: Node<NodeData> }>(
          (resolve, reject) => {
            setNodes((currentNodes) => {
              const node = currentNodes.find((n) => n.id === nodeId);
              if (!node) {
                reject(new Error("Node not found"));
                return currentNodes;
              }

              // Mark as loading and capture node info
              resolve({ node });

              // Set loading state
              return currentNodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, isLoading: true } }
                  : n
              );
            });
          }
        );

        const { node } = nodeInfo;

        // Get the age value to determine context
        const age = node.data.timelineValue || 22;
        const normalizedAge = age % 100; // Normalize to 0-99 cycle

        // Generate age-specific context prompt
        let ageContext = "";
        if (normalizedAge < 30) {
          ageContext =
            "You are in your 20s. You have plenty of time for long-term planning.";
        } else if (normalizedAge < 40) {
          ageContext =
            "You are in your 30s. You should balance immediate needs with future planning.";
        } else if (normalizedAge < 50) {
          ageContext =
            "You are in your 40s. You should focus on career advancement and financial security.";
        } else if (normalizedAge < 60) {
          ageContext =
            "You are in your 50s. You should prepare for retirement and focus on health.";
        } else if (normalizedAge < 70) {
          ageContext =
            "You are in your 60s. You should transition to retirement and maintain health.";
        } else if (normalizedAge < 80) {
          ageContext =
            "You are in your 70s. You should focus on health and enjoying retirement.";
        } else {
          ageContext =
            "You are in your 80s or older. You should focus on health, family and legacy.";
        }

        // Generate a new context based on the node's current value and age
        const response = await fetch("https://api.cohere.ai/v1/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_COHERE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "command",
            prompt: `Generate an alternative to this action/context: "${
              node.data.value
            }"
${ageContext ? ageContext + "\n" : ""}
Create 1 alternative action that is similar in theme but different in approach (max 15 words).
Make it specific, practical, and appropriate for someone of this age.
Return only the text of the action, with no quotes or extra formatting.`,
            max_tokens: 100,
            temperature: 0.8, // Slightly higher temperature for more variation
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to reshuffle context: ${response.status}`);
        }

        const data = await response.json();
        const newContext = data.generations?.[0]?.text?.trim();

        if (!newContext) {
          throw new Error("Invalid response format from Cohere API");
        }

        // Update the node with the new context
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    value: newContext,
                    isLoading: false,
                  },
                }
              : n
          )
        );
      } catch (error) {
        console.error("Error reshuffling context:", error);
        // Clear loading state on error
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isLoading: false } }
              : n
          )
        );
      }
    },
    [setNodes]
  );

  // Then declare generateOptions function
  const generateOptions = useCallback(
    async (context: string, nodeId: string) => {
      if (!process.env.NEXT_PUBLIC_COHERE_API_KEY) {
        console.error("Cohere API key is not configured");
        return;
      }

      try {
        // Get node info and set loading state in a single operation
        const nodeInfo = await new Promise<{ sourceNode: Node<NodeData> }>(
          (resolve, reject) => {
            setNodes((currentNodes) => {
              const sourceNode = currentNodes.find((n) => n.id === nodeId);
              if (!sourceNode) {
                reject(new Error("Source node not found"));
                return currentNodes; // Return unchanged state
              }

              // Mark as loading and capture node info
              resolve({ sourceNode });

              // Set loading state
              return currentNodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, generatingOptions: true } }
                  : n
              );
            });
          }
        );

        const { sourceNode } = nodeInfo;

        // Get the age value to determine context
        const age = sourceNode.data.timelineValue || 22;
        const normalizedAge = age % 100; // Normalize to 0-99 cycle

        // Customize prompt based on age
        let ageContext = "";

        if (normalizedAge < 30) {
          ageContext =
            "You are in your 20s. You have plenty of time for long-term planning.";
        } else if (normalizedAge < 40) {
          ageContext =
            "You are in your 30s. You should balance immediate needs with future planning.";
        } else if (normalizedAge < 50) {
          ageContext =
            "You are in your 40s. You should focus on career advancement and financial security.";
        } else if (normalizedAge < 60) {
          ageContext =
            "You are in your 50s. You should prepare for retirement and focus on health.";
        } else if (normalizedAge < 70) {
          ageContext =
            "You are in your 60s. You should transition to retirement and maintain health.";
        } else if (normalizedAge < 80) {
          ageContext =
            "You are in your 70s. You should focus on health and enjoying retirement.";
        } else {
          ageContext =
            "You are in your 80s or older. You should focus on health, family and legacy.";
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
${ageContext ? ageContext + "\n" : ""}
Generate 3 distinct next actions (max 15 words each) that are appropriate for someone of this age:

1. A HISTORICAL action that follows traditional approaches or is rooted in established methods.
2. A PROGRESSIVE action that embraces innovation, technology, or forward-thinking approaches.
3. A CHAOTIC/RANDOM action that is unexpected, creative, or takes an unusual direction.

Return them in this exact JSON format, with no other text:
[
  "Historical action - traditional approach",
  "Progressive action - innovative approach",
  "Chaotic action - unexpected approach"
]`,
            max_tokens: 200,
            temperature: 0.8,
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

        // Create new nodes with the latest node position
        setNodes((currentNodes) => {
          // Get the latest version of the source node
          const latestSourceNode = currentNodes.find((n) => n.id === nodeId);
          if (!latestSourceNode) {
            // This shouldn't happen since we already checked earlier
            console.error("Source node disappeared during processing");
            return currentNodes;
          }

          // Create new nodes for each option
          const newNodes: Node<NodeData>[] = options.map(
            (option: string, index: number) => {
              const id = getId();
              // Calculate positions in a forward-facing arc
              const angle = (Math.PI / 6) * (index - 1); // Less spread (-30 to 30 degrees)
              const distance = 500; // Increased safe distance from 350px to 500px

              // Calculate position - ensure x is always positive (forward)
              const xPos =
                latestSourceNode.position.x + Math.cos(angle) * distance;
              const yPos =
                latestSourceNode.position.y + Math.sin(angle) * distance;

              // Check for potential collisions with existing nodes
              const nodeWidth = 250; // Approximate node width
              const nodeHeight = 150; // Approximate node height

              // Create some padding around the node
              const nodePadding = 100; // Increased padding from 50px to 100px

              // Find if this position would collide with any existing node
              const wouldCollide = currentNodes.some((existingNode) => {
                // Skip checking against the source node itself
                if (existingNode.id === latestSourceNode.id) return false;

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
                latestSourceNode.position.x + Math.cos(angle) * finalDistance;
              const finalYPos =
                latestSourceNode.position.y + Math.sin(angle) * finalDistance;

              return {
                id,
                type: "custom",
                data: {
                  type: "value",
                  value: option,
                  timelineValue: getTimelineValue(finalXPos),
                  onReshuffleContext: () => reshuffleContext(id),
                },
                position: {
                  x: finalXPos,
                  y: finalYPos,
                },
              };
            }
          );

          // Add new nodes and update loading state
          const updatedNodes = [...currentNodes, ...newNodes].map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, generatingOptions: false } }
              : n
          );

          // Create edges for the new nodes
          setEdges((eds) => [
            ...eds,
            ...newNodes.map((node) => ({
              id: `e${node.id}`,
              source: latestSourceNode.id,
              target: node.id,
              type: "default",
            })),
          ]);

          return updatedNodes;
        });
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
      }
    },
    [setNodes, getTimelineValue, setEdges, reshuffleContext]
  );

  // Add backward planning function
  const generateBackwardOptions = useCallback(
    async (context: string, nodeId: string) => {
      if (!process.env.NEXT_PUBLIC_COHERE_API_KEY) {
        console.error("Cohere API key is not configured");
        return;
      }

      try {
        // Get node info and set loading state in a single operation
        const nodeInfo = await new Promise<{ sourceNode: Node<NodeData> }>(
          (resolve, reject) => {
            setNodes((currentNodes) => {
              const sourceNode = currentNodes.find((n) => n.id === nodeId);
              if (!sourceNode) {
                reject(new Error("Source node not found"));
                return currentNodes; // Return unchanged state
              }

              // Mark as loading and capture node info
              resolve({ sourceNode });

              // Set loading state
              return currentNodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, generatingOptions: true } }
                  : n
              );
            });
          }
        );

        const { sourceNode } = nodeInfo;

        // Get the age value to determine context
        const age = sourceNode.data.timelineValue || 22;
        const normalizedAge = age % 100; // Normalize to 0-99 cycle

        // Customize prompt based on age
        let ageContext = "";

        if (normalizedAge < 30) {
          ageContext =
            "You are in your 20s. You have plenty of time for long-term planning.";
        } else if (normalizedAge < 40) {
          ageContext =
            "You are in your 30s. You should balance immediate needs with future planning.";
        } else if (normalizedAge < 50) {
          ageContext =
            "You are in your 40s. You should focus on career advancement and financial security.";
        } else if (normalizedAge < 60) {
          ageContext =
            "You are in your 50s. You should prepare for retirement and focus on health.";
        } else if (normalizedAge < 70) {
          ageContext =
            "You are in your 60s. You should transition to retirement and maintain health.";
        } else if (normalizedAge < 80) {
          ageContext =
            "You are in your 70s. You should focus on health and enjoying retirement.";
        } else {
          ageContext =
            "You are in your 80s or older. You should focus on health, family and legacy.";
        }

        const response = await fetch("https://api.cohere.ai/v1/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_COHERE_API_KEY}`,
          },
          body: JSON.stringify({
            model: "command",
            prompt: `Given this future situation: "${context}"
${ageContext ? ageContext + "\n" : ""}
Generate 3 distinct prerequisite actions that would need to be taken BEFORE this situation (max 15 words each).
These should be appropriate for someone of this age:

1. A HISTORICAL prerequisite action that follows traditional approaches or established methods.
2. A PROGRESSIVE prerequisite action that embraces innovation, technology, or forward-thinking approaches.
3. A CHAOTIC/RANDOM prerequisite action that is unexpected, creative, or takes an unusual direction.

Return them in this exact JSON format, with no other text:
[
  "Historical prerequisite - traditional approach",
  "Progressive prerequisite - innovative approach",
  "Chaotic prerequisite - unexpected approach"
]`,
            max_tokens: 200,
            temperature: 0.8,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Failed to generate backward options: ${response.status} ${
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

        // Create new nodes using the latest nodes state
        setNodes((currentNodes) => {
          // Get the latest version of the source node
          const latestSourceNode = currentNodes.find((n) => n.id === nodeId);
          if (!latestSourceNode) {
            console.error("Source node disappeared during processing");
            return currentNodes;
          }

          // Create new nodes for each option - placed to the LEFT of the input node
          const newNodes: Node<NodeData>[] = options.map(
            (option: string, index: number) => {
              const id = getId();

              // Base distance from input node
              const distance = 500; // Horizontal distance to the left (increased from 350px to 500px)

              // For horizontal spacing, use a simple pattern:
              // Place all nodes at the same distance to the left
              const xPos = latestSourceNode.position.x - distance;

              // Calculate vertical position with more spacing between nodes
              // Increase spacing from 75px to 150px for better visual separation
              const spacing = 150; // increased from 75px to 150px
              const totalHeight = spacing * (options.length - 1);
              const startY = latestSourceNode.position.y - totalHeight / 2;
              const yPos = startY + index * spacing;

              // Calculate age value for backward nodes (all one step before the input node)
              const currentAge = latestSourceNode.data.timelineValue || 22;
              const backwardAge = Math.max(20, currentAge - 5); // Reduce by 5 years for backward planning

              return {
                id,
                type: "custom",
                data: {
                  type: "value",
                  value: option,
                  timelineValue: backwardAge,
                  onReshuffleContext: () => reshuffleContext(id),
                },
                position: {
                  x: xPos,
                  y: yPos,
                },
              };
            }
          );

          // Add new nodes and update loading state
          const updatedNodes = [...currentNodes, ...newNodes].map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, generatingOptions: false } }
              : n
          );

          // Create edges between generated nodes and to the input node
          setEdges((eds) => {
            // Connect all backward nodes directly to the input node's backward-target handle
            const newEdges = newNodes.map((node) => ({
              id: `e${node.id}-to-input`,
              source: node.id,
              target: latestSourceNode.id,
              targetHandle: "backward-target", // Specify the left target handle on the input node
              type: "default",
            }));

            return [...eds, ...newEdges];
          });

          return updatedNodes;
        });
      } catch (error) {
        // Clear loading state on error
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, generatingOptions: false } }
              : n
          )
        );
        console.error("Error generating backward options:", error);
      }
    },
    [setNodes, getTimelineValue, setEdges, reshuffleContext]
  );

  // Handle manual age updates from dragging the age badge
  const handleUpdateAge = useCallback(
    (nodeId: string, newAge: number) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                timelineValue: newAge,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes]
  );

  // Update the initial node
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
                onGenerateBackward: (context: string) =>
                  generateBackwardOptions(context, node.id),
                onUpdateAge: (newAge: number) =>
                  handleUpdateAge(node.id, newAge),
                onReshuffleContext: () => reshuffleContext(node.id),
              },
            }
          : node
      )
    );
  }, [
    generateBackwardOptions,
    generateOptions,
    handleUpdateAge,
    reshuffleContext,
    setNodes,
  ]);

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
    [setEdges, onNodesChange, generateOptions, setNodes]
  );

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
    async (changes: EdgeChange[]) => {
      // Get the edges that are being added or removed
      const edgeAdditions = changes
        .filter(
          (change): change is { type: "add"; item: Edge } =>
            change.type === "add"
        )
        .map((change) => change.item);

      const edgeRemovals = changes
        .filter(
          (change): change is { type: "remove"; id: string } =>
            change.type === "remove"
        )
        .map((change) => change.id);

      // Apply changes first
      onEdgesChange(changes);

      // Get updated edges after changes
      const updatedEdges = getEdges();

      // Find only operator nodes affected by the changes
      const affectedOperatorNodes = nodes.filter(
        (node) =>
          node.data.type === "operator" &&
          // Node is a target of a newly added edge
          (edgeAdditions.some((edge: Edge) => edge.target === node.id) ||
            // Node had an edge removed
            edgeRemovals.some((edgeId: string) => {
              const edge = edges.find((e) => e.id === edgeId);
              return edge && edge.target === node.id;
            }))
      );

      // If no affected nodes, we're done
      if (affectedOperatorNodes.length === 0) return;

      // Set loading state only for affected operator nodes
      setNodes((nds) =>
        nds.map((n) =>
          affectedOperatorNodes.some((op) => op.id === n.id)
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

      // Process only the affected operator nodes sequentially
      let currentNodes = nodes;
      for (const operatorNode of affectedOperatorNodes) {
        currentNodes = await processNodeCalculations(
          currentNodes,
          updatedEdges,
          operatorNode,
          generateOptions
        );
        setNodes(currentNodes);
      }
    },
    [edges, nodes, onEdgesChange, getEdges, generateOptions, setNodes]
  );

  const onConnect = useCallback(
    async (params: Connection) => {
      const targetNode = nodes.find((node) => node.id === params.target);
      const sourceNode = nodes.find((node) => node.id === params.source);

      if (!targetNode || !sourceNode) return;

      // Check if connecting to input node's backward target handle
      const isBackwardConnection =
        targetNode.type === "input" &&
        params.targetHandle === "backward-target";

      // For backward connections, we always allow them
      if (isBackwardConnection) {
        const newEdges = addEdge(params, edges);
        setEdges(newEdges);
        return;
      }

      // Regular connection logic for other handles
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
    [nodes, edges, setEdges, setNodes, generateOptions]
  );

  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: {
        isValid: boolean | null;
        fromNode: { id: string } | null;
        handleId?: string;
      }
    ) => {
      if (connectionState && !connectionState.isValid) {
        const id = getId();
        const { clientX, clientY } =
          "changedTouches" in event ? event.changedTouches[0] : event;

        const position = screenToFlowPosition({
          x: clientX,
          y: clientY,
        });

        // Get the source node to determine what type of node to create
        const sourceNode = nodes.find(
          (n) => n.id === (connectionState.fromNode?.id || "")
        );

        if (!sourceNode || !connectionState.fromNode) return;

        const sourceNodeType = sourceNode.data.type;
        const handleId = connectionState.handleId || "";

        // Special case: if connecting from left handle of input node
        if (sourceNodeType === "input" && handleId === "backward-source") {
          // Get the input value from the source node
          const inputValue = String(sourceNode.data.value || "");

          if (inputValue.trim()) {
            // Generate backward options based on the input value
            generateBackwardOptions(inputValue, sourceNode.id).catch(
              console.error
            );
          }
          return;
        }

        const nodeData = getRandomNodeData(sourceNodeType, handleId);
        const newNode: Node<NodeData> = {
          id,
          type: "custom",
          position,
          data: {
            ...nodeData,
            timelineValue: getTimelineValue(position.x),
          },
        };

        // Determine edge source and target based on handle
        let source = connectionState.fromNode.id;
        let target = id;
        let sourceHandle = connectionState.handleId;
        let targetHandle = undefined;

        // If connecting from backward handle, reverse the edge direction
        if (handleId === "backward-source") {
          source = id;
          target = connectionState.fromNode.id;
          sourceHandle = undefined;
          targetHandle = "backward-target";
        }

        const newEdge: Edge = {
          id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: "default",
        };

        setNodes((nds) => {
          const updatedNodes = [...nds, newNode];
          // Calculate results for the new configuration
          return calculateNodeResults(updatedNodes, [...edges, newEdge]);
        });
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [
      screenToFlowPosition,
      edges,
      getTimelineValue,
      nodes,
      setNodes,
      setEdges,
      generateBackwardOptions,
    ]
  );

  // Add the handleContextMenu function back
  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
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
    },
    [screenToFlowPosition]
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
          zoom: 0.8,
        }}
        fitViewOptions={{
          padding: 2,
          minZoom: 0.8,
          maxZoom: 2.5,
        }}
        onContextMenu={handleContextMenu}
        fitView
      >
        <Background color="#fff" gap={20} style={{ zIndex: 0, opacity: 0.5 }} />
        {/* <Timeline height={70} spacingFactor={1.5} /> */}
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
                  timelineValue: getTimelineValue(contextMenu.flowPosition.x),
                  onGenerate: (context: string) =>
                    generateOptions(context, newNodeId),
                  onGenerateBackward: (context: string) =>
                    generateBackwardOptions(context, newNodeId),
                  onUpdateAge: (newAge: number) =>
                    handleUpdateAge(newNodeId, newAge),
                  onReshuffleContext: () => reshuffleContext(newNodeId),
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
      <Changelog />
    </ReactFlowProvider>
  );
}
