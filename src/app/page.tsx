"use client";

import { useCallback, useRef, useEffect, useMemo } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "@/components/CustomNode";
import ConnectionLine from "@/components/ConnectionLine";

type NodeData = {
  type: "operator" | "value";
  value: string | number;
  result?: number;
  inputs?: number[];
  sourceIds?: string[];
  history?: string[];
  [key: string]: unknown;
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node<NodeData>[] = [
  {
    id: "0",
    type: "custom",
    data: {
      type: "value",
      value: Math.floor(Math.random() * 4) + 1,
    },
    position: { x: 0, y: 50 },
  },
];

const initialEdges: Edge[] = [];

let id = 1;
const getId = () => `${id++}`;

function getRandomNodeData(): NodeData {
  const isOperator = Math.random() > 0.5;
  return {
    type: isOperator ? "operator" : "value",
    value: isOperator
      ? ["+", "-"][Math.floor(Math.random() * 2)]
      : Math.floor(Math.random() * 4) + 1,
  };
}

function calculateResult(operator: string, values: number[]): number {
  if (values.length < 2) return 0;
  if (operator === "+") {
    return values.reduce((a, b) => a + b, 0);
  }
  return values.reduce((a, b) => a - b);
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
      const values: number[] = [];
      const sourceIds: string[] = [];

      sourceNodes.forEach((sourceNode) => {
        sourceIds.push(sourceNode.id);
        if (sourceNode.data.type === "value") {
          values.push(sourceNode.data.value as number);
        } else if (sourceNode.data.result !== undefined) {
          values.push(sourceNode.data.result);
        }
      });

      // Calculate result
      const result = calculateResult(node.data.value as string, values);

      // Return updated node with inputs, result and source IDs as history
      return {
        ...node,
        data: {
          ...node.data,
          inputs: values,
          sourceIds,
          result,
          history: sourceIds, // Store IDs in history
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

function Flow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<NodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();

  // Calculate results when edges change
  const onEdgesChangeWithCalculation = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
      setNodes((nds) => calculateNodeResults(nds, edges));
    },
    [edges, onEdgesChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      const targetNode = nodes.find((node) => node.id === params.target);
      const sourceNode = nodes.find((node) => node.id === params.source);

      if (!targetNode || !sourceNode) return;

      const isValidConnection =
        targetNode.data.type === "operator" ||
        (sourceNode.data.type === "operator" &&
          targetNode.data.type === "value");

      if (isValidConnection) {
        setEdges((eds) => {
          const newEdges = addEdge(params, eds);
          // Trigger calculation after adding edge
          setNodes((nds) => calculateNodeResults(nds, newEdges));
          return newEdges;
        });
      }
    },
    [nodes]
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

        const nodeData = getRandomNodeData();
        const newNode: Node<NodeData> = {
          id,
          type: "custom",
          position,
          data: nodeData,
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
    [screenToFlowPosition, edges]
  );

  return (
    <div className="h-screen w-screen" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeWithCalculation}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        connectionLineComponent={ConnectionLine}
        fitView
        fitViewOptions={{ padding: 2 }}
      >
        <Background />
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
