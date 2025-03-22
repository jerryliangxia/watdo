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

interface FortuneResponse {
  fortunes: {
    probabilities: string[];
    actions: string[];
    random: string[];
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
      label: "Enter your question...",
      onChange: (newLabel: string) => console.log("Node 1:", newLabel),
      onBranch: () => console.log("Branch clicked for node 1"),
      hasBranches: false,
      nodeType: "prompt",
    },
    position: { x: 0, y: 0 },
  },
];

// Dagre layout configuration
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction = "LR"
) => {
  const isHorizontal = direction === "LR";
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 150, // Vertical spacing between nodes in the same rank
    ranksep: 200, // Horizontal spacing between ranks
    edgesep: 100, // Minimum spacing between edges
  });

  // Clear the graph
  dagreGraph.nodes().forEach((n) => dagreGraph.removeNode(n));

  // Add nodes to the graph with different sizes based on type
  nodes.forEach((node) => {
    const width = node.data.nodeType === "predictions" ? 400 : 300;
    const height = node.data.nodeType === "predictions" ? 200 : 100;
    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges to the graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Apply the layout
  dagre.layout(dagreGraph);

  // Get the positioned nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const width = node.data.nodeType === "predictions" ? 400 : 300;
    const height = node.data.nodeType === "predictions" ? 200 : 100;
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  return layoutedNodes;
};

function Flow() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [branchedNodes, setBranchedNodes] = useState<Set<string>>(new Set());
  const { fitView, getNodes } = useReactFlow();

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
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
                  "Probabilities:",
                  ...fortune.fortunes.probabilities.map((p) => `• ${p}`),
                  "\nPotential Risks:",
                  ...fortune.fortunes.random.map((r) => `• ${r}`),
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
                  label: action,
                  nodeType: "action",
                  hasBranches: true,
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
              },
              // Edges from predictions to actions
              ...actionNodes.map((node) => ({
                id: `e-predictions-${node.id}`,
                source: predictionsNode.id,
                target: node.id,
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
              },
            }
          : node
      )
    );
  }, []);

  // Initial layout
  useEffect(() => {
    const layoutedNodes = getLayoutedElements(nodes, edges);
    setNodes(layoutedNodes);
    setTimeout(() => {
      fitView();
    }, 0);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onChange: (newLabel: string) => updateNodeData(node.id, newLabel),
          onBranch: () => handleBranch(node.id),
          hasBranches:
            node.data.nodeType === "prompt" || node.data.nodeType === "action",
        },
      }))}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
    </ReactFlow>
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
