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
      label: "Click me to branch",
      onChange: (newLabel: string) => console.log("Node 1:", newLabel),
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

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (branchedNodes.has(node.id)) {
        // Remove all child nodes and their edges recursively
        const childNodeIds = getChildNodeIds(node.id);
        setNodes((nds) => nds.filter((n) => !childNodeIds.includes(n.id)));
        setEdges((eds) => eds.filter((e) => !childNodeIds.includes(e.target)));

        // Remove all branched status for the node and its children
        setBranchedNodes((prev) => {
          const newSet = new Set(prev);
          newSet.delete(node.id);
          childNodeIds.forEach((id) => newSet.delete(id));
          return newSet;
        });
      } else {
        // Create new branches
        const baseY = node.position.y + 150;
        const newNodes: Node[] = [
          {
            id: `${node.id}-1`,
            type: "editable",
            data: {
              label: "Branch 1",
              onChange: (newLabel: string) =>
                console.log(`${node.id}-1:`, newLabel),
            },
            position: { x: node.position.x - 150, y: baseY },
          },
          {
            id: `${node.id}-2`,
            type: "editable",
            data: {
              label: "Branch 2",
              onChange: (newLabel: string) =>
                console.log(`${node.id}-2:`, newLabel),
            },
            position: { x: node.position.x, y: baseY },
          },
          {
            id: `${node.id}-3`,
            type: "editable",
            data: {
              label: "Branch 3",
              onChange: (newLabel: string) =>
                console.log(`${node.id}-3:`, newLabel),
            },
            position: { x: node.position.x + 150, y: baseY },
          },
        ];

        const newEdges: Edge[] = [
          { id: `e${node.id}-1`, source: node.id, target: `${node.id}-1` },
          { id: `e${node.id}-2`, source: node.id, target: `${node.id}-2` },
          { id: `e${node.id}-3`, source: node.id, target: `${node.id}-3` },
        ];

        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
        setBranchedNodes((prev) => new Set([...prev, node.id]));
      }
    },
    [branchedNodes, getChildNodeIds]
  );

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
