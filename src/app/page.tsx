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
  NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CustomNode from "@/components/CustomNode";
import ConnectionLine from "@/components/ConnectionLine";
import Timeline from "@/components/Timeline";

type NodeData = {
  type: "operator" | "value";
  value: string | number;
  result?: number;
  inputs?: number[];
  sourceIds?: string[];
  history?: string[];
  timelineValue?: number;
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

function calculateResult(operator: string, values: number[]): number {
  if (values.length < 2) return 0;

  switch (operator) {
    case "+":
      return values.reduce((a, b) => a + b, 0);
    case "-":
      return values.reduce((a, b) => a - b);
    case "*":
      return values.reduce((a, b) => a * b, 1);
    case "%":
      // For modulo, we only use the first two values
      return values[0] % values[1];
    default:
      return 0;
  }
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

function getRandomNodeData(): NodeData {
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
  const { screenToFlowPosition } = useReactFlow();

  // Add function to calculate timeline value from x position
  const getTimelineValue = (xPos: number) => {
    const viewport = document.querySelector(".react-flow__viewport");
    if (!viewport) return 20;

    const viewportWidth = viewport.clientWidth;
    // Scale down by dividing by 20 to create larger gaps (5 units per value)
    const value = ((xPos / viewportWidth) * 100) / 20;
    // Shift the range from 0-4 to 20-24
    return Math.max(20, Math.min(24, Math.round(value) + 20));
  };

  // Modify onNodesChange to update timeline values
  const onNodesChangeWithTimeline = (changes: NodeChange<Node<NodeData>>[]) => {
    // Handle node deletions first
    const deletedNodeIds = changes
      .filter((change) => change.type === "remove")
      .map((change) => change.id);

    if (deletedNodeIds.length > 0) {
      // Remove edges connected to deleted nodes
      setEdges((eds) =>
        eds.filter(
          (edge) =>
            !deletedNodeIds.includes(edge.source) &&
            !deletedNodeIds.includes(edge.target)
        )
      );

      // Clean up references and recalculate
      setNodes((nds) => {
        // First remove deleted nodes
        const remainingNodes = nds.filter(
          (node) => !deletedNodeIds.includes(node.id)
        );

        // Then clean up references and recalculate
        return remainingNodes.map((node) => {
          if (node.data.type === "operator") {
            return {
              ...node,
              data: {
                ...node.data,
                inputs: undefined,
                sourceIds: undefined,
                result: undefined,
                history: undefined,
              },
            };
          }
          return node;
        });
      });
    }

    // Apply other changes
    onNodesChange(changes);

    // Update timeline values for moved nodes
    setNodes((nds) =>
      nds.map((node) => {
        const timelineValue = getTimelineValue(node.position.x);
        return {
          ...node,
          data: {
            ...node.data,
            timelineValue,
          },
        };
      })
    );

    // Recalculate results after all changes
    setNodes((nds) => calculateNodeResults(nds, edges));
  };

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

      // Check if this source node is already connected (exists in history)
      const isDuplicateConnection = targetNode.data.history?.includes(
        sourceNode.id
      );

      const isValidConnection =
        !isDuplicateConnection && // Prevent duplicate connections
        (targetNode.data.type === "operator" ||
          (sourceNode.data.type === "operator" &&
            targetNode.data.type === "value"));

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
        onNodesChange={onNodesChangeWithTimeline}
        onEdgesChange={onEdgesChangeWithCalculation}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        connectionLineComponent={ConnectionLine}
        fitView
        fitViewOptions={{ padding: 2 }}
      >
        <Background />
        {/* <Timeline min={0} max={100} /> */}
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
