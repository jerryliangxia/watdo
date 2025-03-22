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
  Rect,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import EditableNode from "@/components/EditableNode";

const nodeTypes = {
  editable: EditableNode as any,
};

const initialNodes: Node[] = [
  {
    id: "1",
    type: "editable",
    data: {
      label: "Click Branch to expand",
      onChange: (newLabel: string) => console.log("Node 1:", newLabel),
      onBranch: () => console.log("Branch clicked for node 1"),
      hasBranches: false,
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
  dagreGraph.setGraph({ rankdir: direction });

  // Clear the graph
  dagreGraph.nodes().forEach((n) => dagreGraph.removeNode(n));

  // Add nodes to the graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 300, height: 60 });
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
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 150, // center the node (width/2)
        y: nodeWithPosition.y - 30, // center the node (height/2)
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
      const immediateChildren = [`${nodeId}-1`, `${nodeId}-2`, `${nodeId}-3`];
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

      // Calculate the bounding box
      const xMin = Math.min(...relevantNodes.map((n) => n.position.x));
      const xMax = Math.max(...relevantNodes.map((n) => n.position.x + 300)); // node width
      const yMin = Math.min(...relevantNodes.map((n) => n.position.y));
      const yMax = Math.max(...relevantNodes.map((n) => n.position.y + 60)); // node height

      // Add some padding
      const padding = 50;
      const viewBox: Rect = {
        x: xMin - padding,
        y: yMin - padding,
        width: xMax - xMin + padding * 2,
        height: yMax - yMin + padding * 2,
      };

      fitView({ duration: 800, padding: 0.1, viewBox });
    },
    [getNodes, fitView]
  );

  const handleBranch = useCallback(
    (nodeId: string) => {
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
        // Create new branches
        const newNodes: Node[] = [
          {
            id: `${nodeId}-1`,
            type: "editable",
            data: {
              label: "Branch 1",
              onChange: (newLabel: string) =>
                console.log(`${nodeId}-1:`, newLabel),
              onBranch: () => handleBranch(`${nodeId}-1`),
              hasBranches: false,
            },
            position: { x: 0, y: 0 },
          },
          {
            id: `${nodeId}-2`,
            type: "editable",
            data: {
              label: "Branch 2",
              onChange: (newLabel: string) =>
                console.log(`${nodeId}-2:`, newLabel),
              onBranch: () => handleBranch(`${nodeId}-2`),
              hasBranches: false,
            },
            position: { x: 0, y: 0 },
          },
          {
            id: `${nodeId}-3`,
            type: "editable",
            data: {
              label: "Branch 3",
              onChange: (newLabel: string) =>
                console.log(`${nodeId}-3:`, newLabel),
              onBranch: () => handleBranch(`${nodeId}-3`),
              hasBranches: false,
            },
            position: { x: 0, y: 0 },
          },
        ];

        const newEdges: Edge[] = [
          { id: `e${nodeId}-1`, source: nodeId, target: `${nodeId}-1` },
          { id: `e${nodeId}-2`, source: nodeId, target: `${nodeId}-2` },
          { id: `e${nodeId}-3`, source: nodeId, target: `${nodeId}-3` },
        ];

        const childIds = [`${nodeId}-1`, `${nodeId}-2`, `${nodeId}-3`];

        setNodes((nds) => {
          const updatedNodes = [...nds, ...newNodes];
          const layoutedNodes = getLayoutedElements(updatedNodes, [
            ...edges,
            ...newEdges,
          ]);
          setTimeout(() => focusOnNodes([nodeId, ...childIds]), 50);
          return layoutedNodes;
        });
        setEdges((eds) => [...eds, ...newEdges]);
        setBranchedNodes((prev) => new Set([...prev, nodeId]));
      }
    },
    [branchedNodes, getChildNodeIds, edges, focusOnNodes]
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
          hasBranches: branchedNodes.has(node.id),
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
      <Controls />
      <MiniMap />
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
