"use client";

import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeChange,
  EdgeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import EditableNode from "@/components/EditableNode";
import TimelineTicker from "@/components/TimelineTicker";

interface FortuneResponse {
  fortunes: {
    probabilities: Array<{
      text: string;
      age?: number;
    }>;
    actions: Array<{
      text: string;
      age?: number;
    }>;
    random: Array<{
      text: string;
      age?: number;
    }>;
    deathAge?: number;
  };
}

const nodeTypes = {
  editable: EditableNode as any,
};

const initialNodes: Node[] = [
  {
    id: "1",
    type: "editable",
    data: {
      label: "At age 80, what do you want to have achieved in life?",
      onChange: (newLabel: string) => console.log("Node 1:", newLabel),
      onBranch: () => console.log("Branch clicked for node 1"),
      hasBranches: false,
      nodeType: "prompt",
      age: 80,
    },
    position: { x: 50, y: window.innerHeight / 2 },
  },
];

// Timeline configuration
const TIMELINE_START_X = 50; // Left margin
const TIMELINE_WIDTH = window.innerWidth * 2; // Make timeline wider to accommodate all nodes
const TARGET_AGE = 80; // The target age we're working backwards from
const MIN_AGE = 20; // Minimum age to consider
const NODE_HORIZONTAL_SPACING = 300; // Minimum horizontal space between nodes

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "LR"
) => {
  // Calculate age range for scaling (working backwards from 80)
  const ageRange = TARGET_AGE - MIN_AGE;
  const timelineScale = TIMELINE_WIDTH / ageRange;

  // Position nodes based on their age
  const layoutedNodes = nodes.map((node) => {
    let xPos;
    let yPos = node.position.y;

    if (node.id === "1") {
      // Place initial node at the end (age 80)
      xPos = TIMELINE_START_X + TIMELINE_WIDTH;
    } else if (node.data.age) {
      // Position based on age, working backwards from 80
      // Calculate position from the right side of the timeline
      xPos =
        TIMELINE_START_X +
        TIMELINE_WIDTH -
        (TARGET_AGE - node.data.age) * timelineScale;
    } else if (node.data.nodeType === "predictions") {
      // Position predictions node after its parent
      const parentNode = nodes.find((n) => n.id === node.id.split("-")[0]);
      if (parentNode && parentNode.data.age) {
        xPos =
          TIMELINE_START_X +
          TIMELINE_WIDTH -
          (TARGET_AGE - parentNode.data.age) * timelineScale -
          NODE_HORIZONTAL_SPACING;
      } else {
        xPos = parentNode
          ? parentNode.position.x - NODE_HORIZONTAL_SPACING
          : node.position.x;
      }
    } else {
      // For nodes without age, maintain relative positioning
      const parentNode = nodes.find((n) => n.id === node.id.split("-")[0]);
      if (parentNode && parentNode.data.age) {
        xPos =
          TIMELINE_START_X +
          TIMELINE_WIDTH -
          (TARGET_AGE - parentNode.data.age) * timelineScale -
          NODE_HORIZONTAL_SPACING;
      } else {
        xPos = parentNode
          ? parentNode.position.x - NODE_HORIZONTAL_SPACING
          : node.position.x;
      }
    }

    // Adjust vertical position for action nodes from the same parent
    if (node.data.nodeType === "action") {
      const siblingIndex = parseInt(node.id.split("-action-")[1]);
      yPos = window.innerHeight / 2 + (siblingIndex * 200 - 100);
    }

    return {
      ...node,
      position: { x: xPos, y: yPos },
    };
  });

  return layoutedNodes;
};

function Flow() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [branchedNodes, setBranchedNodes] = useState<Set<string>>(new Set());
  const [currentAge, setCurrentAge] = useState<number>(TARGET_AGE);
  const [minAge, setMinAge] = useState<number>(MIN_AGE);
  const { fitView, getNodes } = useReactFlow();

  // Update ages when nodes change
  useEffect(() => {
    let newMinAge = MIN_AGE;
    nodes.forEach((node) => {
      if (node.data.age && node.data.age < newMinAge) {
        newMinAge = node.data.age;
      }
    });
    setMinAge(newMinAge);
  }, [nodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            sourceHandle: "left",
            targetHandle: "right",
            type: "smoothstep",
          },
          eds
        )
      ),
    []
  );

  const getChildNodeIds = useCallback(
    (nodeId: string): string[] => {
      const predictionId = `${nodeId}-predictions`;
      const actionIds = [0, 1].map((i) => `${nodeId}-action-${i}`);
      const immediateChildren = [predictionId, ...actionIds];
      const allChildren = [...immediateChildren];

      immediateChildren.forEach((childId) => {
        if (branchedNodes.has(childId)) {
          allChildren.push(...getChildNodeIds(childId));
        }
      });

      return allChildren;
    },
    [branchedNodes]
  );

  const focusOnNodes = useCallback(
    (nodeIds: string[]) => {
      const relevantNodes = getNodes().filter((node) =>
        nodeIds.includes(node.id)
      );
      if (relevantNodes.length === 0) return;

      const xMin = Math.min(...relevantNodes.map((n) => n.position.x));
      const xMax = Math.max(...relevantNodes.map((n) => n.position.x + 300));
      const yMin = Math.min(...relevantNodes.map((n) => n.position.y));
      const yMax = Math.max(...relevantNodes.map((n) => n.position.y + 60));

      const padding = 50;
      fitView({
        duration: 800,
        padding: 0.1,
        minZoom: 0.5,
        maxZoom: 1.5,
        nodes: relevantNodes,
      });
    },
    [getNodes, fitView]
  );

  const getFortune = async (prompt: string): Promise<FortuneResponse> => {
    const response = await fetch("/api/fortune", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userInput: prompt }),
    });

    if (!response.ok) {
      throw new Error("Failed to get fortune");
    }

    return response.json();
  };

  const handleBranch = useCallback(
    async (nodeId: string) => {
      if (branchedNodes.has(nodeId)) {
        // Remove all child nodes and their edges recursively
        const childNodeIds = getChildNodeIds(nodeId);
        setNodes((nds) => {
          const filteredNodes = nds.filter((n) => !childNodeIds.includes(n.id));
          const layoutedNodes = getLayoutedElements(filteredNodes, edges);
          setTimeout(() => focusOnNodes([nodeId]), 50);
          return layoutedNodes;
        });
        setEdges((eds) => eds.filter((e) => !childNodeIds.includes(e.target)));

        setBranchedNodes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(nodeId);
          childNodeIds.forEach((id) => newSet.delete(id));
          return newSet;
        });
      } else {
        try {
          // Get the current node's data
          const currentNode = nodes.find((n) => n.id === nodeId);
          if (!currentNode) return;

          // If it's a prompt node or an action node, get a new fortune
          if (
            currentNode.data.nodeType === "prompt" ||
            currentNode.data.nodeType === "action"
          ) {
            const fortune = await getFortune(currentNode.data.label);

            // Create combined predictions node
            const predictionsNode = {
              id: `${nodeId}-predictions`,
              type: "editable",
              data: {
                label: [
                  "Key Life Events:",
                  ...fortune.fortunes.probabilities.map(
                    (p) => `• ${p.text}${p.age ? ` (Age ${p.age})` : ""}`
                  ),
                  "\nPotential Challenges:",
                  ...fortune.fortunes.random.map(
                    (r) => `• ${r.text}${r.age ? ` (Age ${r.age})` : ""}`
                  ),
                ].join("\n"),
                nodeType: "predictions",
                hasBranches: false,
              },
              position: { x: 0, y: 0 },
            };

            // Create action nodes with unique IDs
            const actionNodes = fortune.fortunes.actions.map(
              (action, index) => ({
                id: `${nodeId}-action-${index}`,
                type: "editable",
                data: {
                  label: `${action.text}${
                    action.age ? ` (Age ${action.age})` : ""
                  }`,
                  nodeType: "action",
                  hasBranches: true,
                  age: action.age,
                },
                position: { x: 0, y: 0 },
              })
            );

            const newNodes = [predictionsNode, ...actionNodes];
            const newEdges = [
              // Edge from parent to predictions
              {
                id: `e-${nodeId}-predictions`,
                source: nodeId,
                target: predictionsNode.id,
                sourceHandle: "left",
                targetHandle: "right",
                type: "smoothstep",
              },
              // Edges from predictions to actions
              ...actionNodes.map((node) => ({
                id: `e-predictions-${node.id}`,
                source: predictionsNode.id,
                target: node.id,
                sourceHandle: "left",
                targetHandle: "right",
                type: "smoothstep",
              })),
            ];

            setNodes((nds) => {
              const updatedNodes = [...nds, ...newNodes];
              const layoutedNodes = getLayoutedElements(updatedNodes, [
                ...edges,
                ...newEdges,
              ]);
              setTimeout(
                () => focusOnNodes([nodeId, ...newNodes.map((n) => n.id)]),
                50
              );
              return layoutedNodes;
            });
            setEdges((eds) => [...eds, ...newEdges]);
            setBranchedNodes((prev) => new Set([...prev, nodeId]));
          }
        } catch (error) {
          console.error("Error getting fortune:", error);
          // You might want to show an error message to the user here
        }
      }
    },
    [branchedNodes, getChildNodeIds, edges, focusOnNodes, nodes]
  );

  const updateNodeData = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label: newLabel,
                age: node.id === "1" ? extractAge(newLabel) : node.data.age,
              },
            }
          : node
      )
    );
  }, []);

  // Extract age helper function
  const extractAge = (text: string) => {
    const match = text.match(/(\d+)\s*(?:years?\s*old|yo|age)/i);
    return match ? parseInt(match[1]) : null;
  };

  // Initial layout
  useEffect(() => {
    const layoutedNodes = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setTimeout(() => {
      fitView();
    }, 0);
  }, [fitView]);

  // Add viewport change handler
  const onMoveEnd = useCallback((event: any, viewport: any) => {
    // This ensures the timeline stays in sync with the viewport
    const container = document.querySelector(".react-flow__viewport");
    if (container) {
      container.style.willChange = "transform";
    }
  }, []);

  return (
    <>
      <ReactFlow
        nodes={nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            onChange: (newLabel: string) => updateNodeData(node.id, newLabel),
            onBranch: () => handleBranch(node.id),
            hasBranches:
              node.data.nodeType === "prompt" ||
              node.data.nodeType === "action",
          },
        }))}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView
        minZoom={0.2}
        maxZoom={1}
        translateExtent={[
          [-TIMELINE_WIDTH / 2, -1000],
          [TIMELINE_WIDTH * 1.5, window.innerHeight + 1000],
        ]}
      >
        <Background />
        <TimelineTicker
          startAge={minAge}
          endAge={TARGET_AGE}
          width={TIMELINE_WIDTH}
          startX={TIMELINE_START_X}
          timelineScale={TIMELINE_WIDTH / (TARGET_AGE - minAge)}
        />
      </ReactFlow>
    </>
  );
}

export default function Home() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
