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
  useStore,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "@/components/CustomNode";
import ConnectionLine from "@/components/ConnectionLine";
import InputNode from "@/components/InputNode";
import ContextMenu from "@/components/ContextMenu";
import Timeline from "@/components/Timeline";

// Utility function to map timeline values (0-80) to age ranges
const mapTimelineValueToAge = (timelineValue?: number | null): number => {
  if (timelineValue === undefined || timelineValue === null) {
    return 22; // Default age if no timeline value
  }
  
  // Direct mapping - timeline value is the age
  return timelineValue;
};

// Inverse function to get timeline value from age - in this case, they're the same
const ageToTimelineValue = (age: number): number => {
  return age;
};

type NodeData = {
  type: "operator" | "value" | "input";
  value: string | number;
  result?: string;
  inputs?: string[];
  sourceIds?: string[];
  history?: string[];
  onGenerate?: (context: string) => Promise<void>;
  isLoading?: boolean;
  generatingOptions?: boolean;
  timelinePosition?: number;
  onUpdateAge?: (newAge: number) => void;
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
      timelineValue: 20, // Set initial timeline value to age 20
      timelinePosition: 20, // Set initial position to match
    },
    position: { x: 300, y: 50 }, // Position = age * 15 = 20 * 15 = 300
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
  
  // Add proper conversion between position coordinates and timeline values
  const positionToTimelineValue = useCallback((xPos: number): number => {
    // Simple linear conversion from x position to age
    // Scale down the ReactFlow coordinates to a reasonable age range (0-80)
    const scaledValue = Math.max(0, Math.round(xPos / 35));
    return scaledValue;
  }, []);
  
  const timelineValueToPosition = useCallback((value: number): number => {
    // Convert a timeline/age value back to a position in ReactFlow coordinates
    // Increase multiplier to position nodes further to the right
    return value * 35;
  }, []);
  
  // Comment out viewport tracking 
  // const viewport = useStore((state) => ({
  //   x: state.transform[0],
  //   y: state.transform[1],
  //   zoom: state.transform[2]
  // }));

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

      // Get the age value to determine context
      const age = mapTimelineValueToAge(sourceOperatorNode.data.timelineValue as number | undefined);
      const normalizedAge = age % 100; // Normalize to 0-99 cycle

      // Customize prompt based on age
      let ageContext = "";

      if (normalizedAge < 30) {
        ageContext =
          `You are ${age} years old. You have plenty of time for long-term planning.`;
      } else if (normalizedAge < 40) {
        ageContext =
          `You are ${age} years old. You should balance immediate needs with future planning.`;
      } else if (normalizedAge < 50) {
        ageContext =
          `You are ${age} years old. You should focus on career advancement and financial security.`;
      } else if (normalizedAge < 60) {
        ageContext =
          `You are ${age} years old. You should prepare for retirement and focus on health.`;
      } else if (normalizedAge < 70) {
        ageContext =
          `You are ${age} years old. You should transition to retirement and maintain health.`;
      } else if (normalizedAge < 80) {
        ageContext =
          `You are ${age} years old. You should focus on health and enjoying retirement.`;
      } else {
        ageContext =
          `You are ${age} years old. You should focus on health, family and legacy.`;
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
Generate 3 brief next actions (max 15 words each) that are appropriate for someone of this age.
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
    }
  };

  // Add backward planning function
  const generateBackwardOptions = async (context: string, nodeId: string) => {
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
      const age = mapTimelineValueToAge(sourceNode.data.timelineValue as number | undefined);
      const normalizedAge = age % 100; // Normalize to 0-99 cycle

      // Customize prompt based on age
      let ageContext = "";

      if (normalizedAge < 30) {
        ageContext =
          `You are ${age} years old. You have plenty of time for long-term planning.`;
      } else if (normalizedAge < 40) {
        ageContext =
          `You are ${age} years old. You should balance immediate needs with future planning.`;
      } else if (normalizedAge < 50) {
        ageContext =
          `You are ${age} years old. You should focus on career advancement and financial security.`;
      } else if (normalizedAge < 60) {
        ageContext =
          `You are ${age} years old. You should prepare for retirement and focus on health.`;
      } else if (normalizedAge < 70) {
        ageContext =
          `You are ${age} years old. You should transition to retirement and maintain health.`;
      } else if (normalizedAge < 80) {
        ageContext =
          `You are ${age} years old. You should focus on health and enjoying retirement.`;
      } else {
        ageContext =
          `You are ${age} years old. You should focus on health, family and legacy.`;
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
Generate 3 specific prerequisite actions that would need to be taken BEFORE this situation to make it happen (max 15 words each).
These should be appropriate for someone of this age.
Return them in this exact JSON format, with no other text:
[
  "First prerequisite action needed before this situation",
  "Second prerequisite action needed before this situation",
  "Third prerequisite action needed before this situation"
]`,
          max_tokens: 200,
          temperature: 0.7,
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
            const distance = 350; // Horizontal distance to the left

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
            const currentAge = mapTimelineValueToAge(latestSourceNode.data.timelineValue as number | undefined);
            const backwardAge = Math.max(1, currentAge - 5); // Reduce by 5 years for backward planning, minimum age 1
            
            // Convert age back to timeline value
            const backwardTimelineValue = ageToTimelineValue(backwardAge);
            // Convert timeline value to appropriate ReactFlow position
            const backwardXPosition = timelineValueToPosition(backwardTimelineValue);

            return {
              id,
              type: "custom",
              data: {
                type: "value",
                value: option,
                timelineValue: backwardTimelineValue,
                timelinePosition: backwardTimelineValue,
              },
              position: {
                x: backwardXPosition, // Use calculated position based on timeline value
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
  };

  // Handle manual age updates from dragging the age badge
  const handleUpdateAge = useCallback(
    (nodeId: string, newAge: number) => {
      // Convert age to timeline value
      const newTimelineValue = ageToTimelineValue(newAge);
      
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            const newPosition = { ...n.position };
            // Update x position to match the timeline value using our conversion
            newPosition.x = timelineValueToPosition(newTimelineValue);
            
            return {
              ...n,
              position: newPosition, // Update actual position
              data: {
                ...n.data,
                timelineValue: newTimelineValue,
                timelinePosition: newTimelineValue,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes, timelineValueToPosition]
  );

  // Update the initial node
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === "0") {
          const ageValue = 20; // Age 20
          const nodePosition = timelineValueToPosition(ageValue); // Convert to position
          
          return {
            ...node,
            position: { ...node.position, x: nodePosition }, // Update position to match age 20
            data: {
              ...node.data,
              timelineValue: ageValue,
              timelinePosition: ageValue,
              onGenerate: (context: string) =>
                generateOptions(context, node.id),
              onGenerateBackward: (context: string) =>
                generateBackwardOptions(context, node.id),
              onUpdateAge: (newAge: number) =>
                handleUpdateAge(node.id, newAge),
            },
          };
        }
        return node;
      })
    );
  }, [timelineValueToPosition, handleUpdateAge]);

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

  // Handle node dragging
  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      // Convert the node's pixel position to a timeline value
      const timelineValue = positionToTimelineValue(node.position.x);
      
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                timelinePosition: timelineValue,
                timelineValue: timelineValue, // Update timelineValue in real-time during drag
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes, positionToTimelineValue]
  );

  // Handle node drag stop
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node<NodeData>) => {
      // Convert the node's pixel position to a timeline value
      const timelineValue = positionToTimelineValue(node.position.x);
      
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                timelinePosition: timelineValue,
                timelineValue: timelineValue,
              },
            };
          }
          return n;
        })
      );
    },
    [setNodes, positionToTimelineValue]
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
        const timelineValue = positionToTimelineValue(position.x);
        
        const newNode: Node<NodeData> = {
          id,
          type: "custom",
          position,
          data: {
            ...nodeData,
            timelineValue: timelineValue,
            timelinePosition: timelineValue,
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
    [screenToFlowPosition, edges, nodes, positionToTimelineValue]
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
                  // Set timeline values based on x position
                  timelineValue: positionToTimelineValue(contextMenu.flowPosition.x),
                  timelinePosition: positionToTimelineValue(contextMenu.flowPosition.x),
                  onGenerate: (context: string) =>
                    generateOptions(context, newNodeId),
                  onGenerateBackward: (context: string) =>
                    generateBackwardOptions(context, newNodeId),
                  onUpdateAge: (newAge: number) =>
                    handleUpdateAge(newNodeId, newAge),
                },
              };
              setNodes((nds) => [...nds, newNode]);
              setContextMenu(null);
            }}
          />
        )}
      </ReactFlow>
      <Timeline height={48} />
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
