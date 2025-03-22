"use client";

import { useCallback, useState } from "react";
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
} from "@xyflow/react";
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
    },
    position: { x: 250, y: 25 },
  },
];

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [branchedNodes, setBranchedNodes] = useState<Set<string>>(new Set());

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

      // Recursively get children of children
      immediateChildren.forEach((childId) => {
        if (branchedNodes.has(childId)) {
          allChildren.push(...getChildNodeIds(childId));
        }
      });

      return allChildren;
    },
    [branchedNodes]
  );

  const handleBranch = useCallback(
    (nodeId: string) => {
      if (branchedNodes.has(nodeId)) {
        // Remove all child nodes and their edges recursively
        const childNodeIds = getChildNodeIds(nodeId);
        setNodes((nds) => nds.filter((n) => !childNodeIds.includes(n.id)));
        setEdges((eds) => eds.filter((e) => !childNodeIds.includes(e.target)));

        // Remove all branched status for the node and its children
        setBranchedNodes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(nodeId);
          childNodeIds.forEach((id) => newSet.delete(id));
          return newSet;
        });
      } else {
        // Create new branches
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        const baseY = node.position.y + 150;
        const newNodes: Node[] = [
          {
            id: `${nodeId}-1`,
            type: "editable",
            data: {
              label: "Branch 1",
              onChange: (newLabel: string) =>
                console.log(`${nodeId}-1:`, newLabel),
              onBranch: () => handleBranch(`${nodeId}-1`),
            },
            position: { x: node.position.x - 150, y: baseY },
          },
          {
            id: `${nodeId}-2`,
            type: "editable",
            data: {
              label: "Branch 2",
              onChange: (newLabel: string) =>
                console.log(`${nodeId}-2:`, newLabel),
              onBranch: () => handleBranch(`${nodeId}-2`),
            },
            position: { x: node.position.x, y: baseY },
          },
          {
            id: `${nodeId}-3`,
            type: "editable",
            data: {
              label: "Branch 3",
              onChange: (newLabel: string) =>
                console.log(`${nodeId}-3:`, newLabel),
              onBranch: () => handleBranch(`${nodeId}-3`),
            },
            position: { x: node.position.x + 150, y: baseY },
          },
        ];

        const newEdges: Edge[] = [
          { id: `e${nodeId}-1`, source: nodeId, target: `${nodeId}-1` },
          { id: `e${nodeId}-2`, source: nodeId, target: `${nodeId}-2` },
          { id: `e${nodeId}-3`, source: nodeId, target: `${nodeId}-3` },
        ];

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        setBranchedNodes((prev) => new Set([...prev, nodeId]));
      }
    },
    [branchedNodes, getChildNodeIds, nodes]
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

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes.map((node) => ({
          ...node,
          data: {
            ...node.data,
            onChange: (newLabel: string) => updateNodeData(node.id, newLabel),
            onBranch: () => handleBranch(node.id),
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
    </div>
  );
}
