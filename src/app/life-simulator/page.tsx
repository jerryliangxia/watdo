"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
import {
  StartNode,
  DeathNode,
  MilestoneNode,
  EventNode,
  PredictionNode,
} from "@/components/LifeNodeTypes";

// Type definitions
type Stats = {
  luck: number;
  intelligence: number;
  rizz: number;
  ambition: number;
};

type Skill = {
  name: string;
  level: number;
};

type LifeSimulatorNodeData = {
  type: "start" | "milestone" | "event" | "prediction" | "death";
  content: string;
  age?: number;
  isLoading?: boolean;
  onShuffle?: () => Promise<void>;
  onAccept?: () => void;
} & Record<string, unknown>;

// Initial states
const initialNodes: Node<LifeSimulatorNodeData>[] = [];
const initialEdges: Edge[] = [];

// Define custom node types
const nodeTypes: NodeTypes = {
  start: StartNode,
  death: DeathNode,
  milestone: MilestoneNode,
  event: EventNode,
  prediction: PredictionNode,
};

// Generate unique IDs
let id = 1;
const getId = () => `${id++}`;

// Helper function to calculate age based on position
const getAgeForPosition = (
  startAge: number,
  endAge: number,
  startX: number,
  endX: number,
  xPos: number
) => {
  const ageRange = endAge - startAge;
  const xRange = endX - startX;
  const agePerPixel = ageRange / xRange;
  return Math.round(startAge + (xPos - startX) * agePerPixel);
};

function LifeSimulator() {
  // Main state
  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<LifeSimulatorNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Inputs state
  const [startingContext, setStartingContext] = useState<string>("");
  const [deathContext, setDeathContext] = useState<string>("");
  const [timeHorizon, setTimeHorizon] = useState<number>(80);

  // UI state
  const [startX] = useState<number>(250);
  const [endX] = useState<number>(1250);
  const [showNodeMenu, setShowNodeMenu] = useState<boolean>(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [flowPosition, setFlowPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [randomEvent, setRandomEvent] = useState<{
    content: string;
    isSponsored: boolean;
    sponsor?: string;
  } | null>(null);
  const [randomEventTimeout, setRandomEventTimeout] =
    useState<NodeJS.Timeout | null>(null);

  // Stats state
  const [stats, setStats] = useState<Stats>({
    luck: 25,
    intelligence: 25,
    rizz: 25,
    ambition: 25,
  });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(false);
  const [nextPredictionGroupId, setNextPredictionGroupId] = useState<number>(1);

  // Connection handling
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));

      // When a connection is made, recalculate stats
      // This will be implemented later
    },
    [setEdges]
  );

  // Milestone shuffling
  const shuffleMilestone = useCallback(
    async (nodeId: string) => {
      // Mark the node as loading
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, isLoading: true } }
            : node
        )
      );

      try {
        // Get the node
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // Get the age to generate an appropriate milestone
        const age = node.data.age || 25;

        // Get the start and end contexts to base milestones on
        const startNode = nodes.find((n) => n.id === "start");
        const endNode = nodes.find((n) => n.id === "end");

        if (!startNode || !endNode) return;

        // Commented out because these variables are not used
        // const startContext = startNode.data.content;
        // const endContext = endNode.data.content;

        // Here we would call an API to generate a milestone based on start/end goals
        // For now, we'll simulate with appropriate milestone content
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Create a context-aware milestone
        let milestone = "";
        if (age < 30) {
          milestone = `Educational achievement that will help reach the goal of "${endNode.data.content.substring(
            0,
            30
          )}..."`;
        } else if (age < 50) {
          milestone = `Career advancement toward "${endNode.data.content.substring(
            0,
            30
          )}..."`;
        } else {
          milestone = `Legacy planning related to "${endNode.data.content.substring(
            0,
            30
          )}..."`;
        }

        // Update the milestone content
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    content: milestone,
                    isLoading: false,
                  },
                }
              : n
          )
        );
      } catch (error) {
        console.error("Error shuffling milestone:", error);

        // Clear loading state
        setNodes((nds) =>
          nds.map((node) =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, isLoading: false } }
              : node
          )
        );
      }
    },
    [nodes, setNodes]
  );

  // Handle milestone acceptance
  const acceptMilestone = useCallback(
    (nodeId: string) => {
      // Mark the milestone as accepted
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  isAccepted: true,
                  // Remove the onShuffle function to prevent re-rolling
                  onShuffle: undefined,
                },
              }
            : node
        )
      );

      // Update stats based on the milestone
      // This is a placeholder for actual stat updates
      setStats((prevStats) => {
        const statChanges = {
          luck: Math.min(100, prevStats.luck + Math.floor(Math.random() * 5)),
          intelligence: Math.min(
            100,
            prevStats.intelligence + Math.floor(Math.random() * 5)
          ),
          rizz: Math.min(100, prevStats.rizz + Math.floor(Math.random() * 5)),
          ambition: Math.min(
            100,
            prevStats.ambition + Math.floor(Math.random() * 5)
          ),
        };

        return statChanges;
      });

      // Potentially add a skill based on the milestone
      const skillChance = Math.random();
      if (skillChance > 0.7) {
        const possibleSkills = [
          "Leadership",
          "Communication",
          "Technical",
          "Creativity",
          "Problem Solving",
          "Adaptability",
          "Financial Management",
        ];
        const newSkill =
          possibleSkills[Math.floor(Math.random() * possibleSkills.length)];

        // Check if skill already exists
        const existingSkill = skills.find((s) => s.name === newSkill);
        if (existingSkill) {
          // Upgrade existing skill
          setSkills((prevSkills) =>
            prevSkills.map((skill) =>
              skill.name === newSkill
                ? { ...skill, level: Math.min(10, skill.level + 1) }
                : skill
            )
          );
        } else {
          // Add new skill
          setSkills((prevSkills) => [
            ...prevSkills,
            { name: newSkill, level: 1 },
          ]);
        }
      }
    },
    [setNodes, skills]
  );

  // Handle clicking away from menu
  const closeMenu = useCallback(() => {
    setShowNodeMenu(false);
  }, []);

  // Add a new node based on selected type
  const addNode = useCallback(
    (nodeType: "milestone" | "event" | "prediction") => {
      const newNodeId = getId();
      const age = getAgeForPosition(
        20,
        timeHorizon,
        startX,
        endX,
        flowPosition.x
      );

      // Get the start and end contexts
      const startNode = nodes.find((n) => n.id === "start");
      const endNode = nodes.find((n) => n.id === "end");

      // Default content
      let content = `New ${nodeType} at age ${age}`;

      // For milestones, make them context-aware
      if (nodeType === "milestone" && startNode && endNode) {
        const progressPercent = ((age - 20) / (timeHorizon - 20)) * 100;

        // Choose appropriate content based on age range
        if (progressPercent < 33) {
          // Early life milestone (education, early career)
          content = `Working toward ${endNode.data.content} through education and skill development`;
        } else if (progressPercent < 66) {
          // Mid-life milestone (career, family)
          content = `Making significant progress toward ${endNode.data.content} through career advancement`;
        } else {
          // Later life milestone (legacy, retirement)
          content = `Ensuring legacy of ${endNode.data.content} through mentorship and planning`;
        }
      }

      const newNode: Node<LifeSimulatorNodeData> = {
        id: newNodeId,
        type: nodeType,
        position: flowPosition,
        data: {
          type: nodeType,
          content: content,
          age,
          onShuffle:
            nodeType === "milestone"
              ? () => shuffleMilestone(newNodeId)
              : undefined,
          onAccept:
            nodeType === "milestone"
              ? () => acceptMilestone(newNodeId)
              : nodeType === "event"
              ? () => console.log(`Accepted ${nodeType}`)
              : undefined,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      closeMenu();
    },
    [
      flowPosition,
      timeHorizon,
      startX,
      endX,
      setNodes,
      shuffleMilestone,
      acceptMilestone,
      closeMenu,
      nodes,
    ]
  );

  // Right click handler to show node menu
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();

      // Get the cursor position in screen coordinates
      const x = event.clientX;
      const y = event.clientY;

      // Set the position for the menu
      setMenuPosition({ x, y });

      // Convert screen position to flow position
      if (reactFlowWrapper.current) {
        const boundingRect = reactFlowWrapper.current.getBoundingClientRect();
        const position = screenToFlowPosition({
          x: x - boundingRect.left,
          y: y - boundingRect.top,
        });
        setFlowPosition(position);
      }

      // Show the menu
      setShowNodeMenu(true);
    },
    [screenToFlowPosition]
  );

  useEffect(() => {
    if (showNodeMenu) {
      // Add event listener to detect clicks outside menu
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest(".node-menu")) {
          closeMenu();
        }
      };

      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [showNodeMenu, closeMenu]);

  // Generate milestones
  const generateMilestones = useCallback(async () => {
    // Here we would call an API to generate milestones based on the start and end goals
    // For now, we'll create milestone templates

    const milestoneCount = 5;
    const startAge = 20;
    const endAge = timeHorizon;
    const ageRange = endAge - startAge;
    const ageStep = ageRange / (milestoneCount + 1);

    const newMilestones: Node<LifeSimulatorNodeData>[] = [];

    // Commented out because these variables are not used
    // const startContext = startingContext;
    // const endContext = deathContext;

    // Increased horizontal spacing - use full width plus extra spacing
    const horizontalSpacing = (endX - startX) * 1.5; // Increased from 0.8 to 1.5 for wider spacing
    const xMargin = -horizontalSpacing * 0.125; // Negative margin to allow extending beyond endpoints

    for (let i = 1; i <= milestoneCount; i++) {
      const age = Math.round(startAge + ageStep * i);

      // Improved horizontal distribution with much wider spacing
      const xPos =
        startX + xMargin + (horizontalSpacing * i) / (milestoneCount + 1);

      // Zigzag pattern: alternate between higher and lower y positions
      const yPos = 200 + (i % 2 === 0 ? 50 : -50);

      // Create a milestone description based on age and the journey
      let milestoneContent;

      // Use predefined career and risk-oriented milestone content instead of context-based
      const careerMilestones = [
        "Graduate with a degree in a high-demand field",
        "Land first professional job with competitive salary",
        "Take risky career pivot into emerging industry",
        "Start own business venture with personal savings",
        "Secure major investment for scaling business",
        "Lead company through difficult market conditions",
        "Make bold acquisition of competitor business",
        "Achieve executive position through strategic risks",
        "Create innovative product that disrupts market",
        "Successfully sell startup for significant profit",
      ];

      const riskMilestones = [
        "Move to new city without secured employment",
        "Invest substantial savings in volatile stock",
        "Quit stable job to pursue passion project",
        "Take extended sabbatical to travel worldwide",
        "Back risky but promising technological innovation",
        "Bet on yourself with major career ultimatum",
        "Publicly challenge industry conventional wisdom",
        "Invest in property in developing market region",
        "Launch controversial product against market advice",
        "Make significant career decision against family wishes",
      ];

      // Combine milestone types and select based on index and randomness
      if (i % 2 === 0) {
        // Even indices get career milestones
        milestoneContent =
          careerMilestones[Math.floor(Math.random() * careerMilestones.length)];
      } else {
        // Odd indices get risk milestones
        milestoneContent =
          riskMilestones[Math.floor(Math.random() * riskMilestones.length)];
      }

      // Add age context to the milestone
      milestoneContent = `Age ${age}: ${milestoneContent}`;

      newMilestones.push({
        id: `milestone-${i}`,
        type: "milestone",
        data: {
          type: "milestone",
          content: milestoneContent,
          age,
          onShuffle: () => shuffleMilestone(`milestone-${i}`),
          onAccept: () => acceptMilestone(`milestone-${i}`),
        },
        position: { x: xPos, y: yPos },
      });
    }

    // Create edges connecting all nodes in sequence
    const newEdges: Edge[] = [];

    // Connect start to first milestone
    newEdges.push({
      id: `e-start-milestone-1`,
      source: "start",
      target: "milestone-1",
      type: "default",
    });

    // Connect milestones in sequence
    for (let i = 1; i < milestoneCount; i++) {
      newEdges.push({
        id: `e-milestone-${i}-milestone-${i + 1}`,
        source: `milestone-${i}`,
        target: `milestone-${i + 1}`,
        type: "default",
      });
    }

    // Connect last milestone to death
    newEdges.push({
      id: `e-milestone-${milestoneCount}-end`,
      source: `milestone-${milestoneCount}`,
      target: "end",
      type: "default",
    });

    // Add milestones to nodes and create edges
    setNodes((nds) => [...nds, ...newMilestones]);
    setEdges(newEdges);
  }, [
    setNodes,
    setEdges,
    startX,
    endX,
    timeHorizon,
    shuffleMilestone,
    acceptMilestone,
    // startingContext,
    // deathContext,
  ]);

  // Dismiss random event notification
  const dismissRandomEvent = useCallback(() => {
    setRandomEvent(null);
    if (randomEventTimeout) {
      clearTimeout(randomEventTimeout);
      setRandomEventTimeout(null);
    }
  }, [randomEventTimeout]);

  // Generate random event
  const generateRandomEvent = useCallback(() => {
    // List of possible random events
    const possibleEvents = [
      "You get a surprise job offer",
      "An old friend contacts you",
      "You find $100 on the street",
      "You get invited to a party",
      "You win a small lottery prize",
      "You receive a surprise inheritance",
      "You get offered a chance to travel abroad",
      "You meet someone famous",
      "You discover a new passion",
      "A health scare makes you reconsider priorities",
    ];

    // Sponsored events
    const sponsoredEvents = [
      { content: "You get a job offer at Amazon", sponsor: "Amazon" },
      { content: "You win a free trip to Hawaii", sponsor: "Delta Airlines" },
      { content: "You receive a year of free coffee", sponsor: "Starbucks" },
      { content: "You win a new smartphone", sponsor: "Apple" },
      { content: "You get invited to a VIP concert", sponsor: "Spotify" },
    ];

    // 20% chance of sponsored event
    const isSponsored = Math.random() < 0.2;

    let newEvent;
    if (isSponsored) {
      const randomSponsoredEvent =
        sponsoredEvents[Math.floor(Math.random() * sponsoredEvents.length)];
      newEvent = {
        content: randomSponsoredEvent.content,
        isSponsored: true,
        sponsor: randomSponsoredEvent.sponsor,
      };
    } else {
      newEvent = {
        content:
          possibleEvents[Math.floor(Math.random() * possibleEvents.length)],
        isSponsored: false,
      };
    }

    setRandomEvent(newEvent);

    // Auto-dismiss after 10 seconds
    const timeout = setTimeout(() => {
      setRandomEvent(null);
      setRandomEventTimeout(null);
    }, 10000);

    setRandomEventTimeout(timeout);

    return newEvent;
  }, []);

  // Shuffle a prediction
  const shufflePrediction = useCallback(
    async (nodeId: string) => {
      // Mark prediction as loading
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true } } : n
        )
      );

      try {
        // Get the prediction node
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;

        // API call would go here for real predictions
        // For now, simulate with a timeout
        await new Promise((resolve) => setTimeout(resolve, 800));

        // List of possible prediction contents
        const possiblePredictions = [
          "This leads to a major success in your career",
          "This results in personal growth and new opportunities",
          "This causes unexpected changes in your relationships",
          "This opens doors to new experiences",
          "This brings both challenges and rewards",
          "This creates a turning point in your life story",
          "This may not go as planned but teaches valuable lessons",
          "This becomes a defining moment in your journey",
        ];

        // Choose a random prediction
        const newContent =
          possiblePredictions[
            Math.floor(Math.random() * possiblePredictions.length)
          ];

        // Update the prediction content
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    content: newContent,
                    isLoading: false,
                  },
                }
              : n
          )
        );
      } catch (error) {
        console.error("Error shuffling prediction:", error);

        // Clear loading state
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, isLoading: false } }
              : n
          )
        );
      }
    },
    [nodes, setNodes]
  );

  // Forward declaration of functions to resolve circular dependencies
  const generatePredictionsRef = useRef<
    ((eventNodeId: string) => Promise<void>) | null
  >(null);
  const acceptPredictionRef = useRef<
    ((predictionId: string, groupId: number) => void) | null
  >(null);

  // Add a random event to the flow
  const acceptRandomEvent = useCallback(() => {
    if (!randomEvent || !generatePredictionsRef.current) return;

    // Create a new event node
    const newNodeId = getId();

    // Position in top-right area
    const position = {
      x: Math.random() * 300 + 500,
      y: Math.random() * 200 + 100,
    };

    // Determine age based on x position
    const age = getAgeForPosition(20, timeHorizon, startX, endX, position.x);

    // Create event content
    let content = randomEvent.content;
    if (randomEvent.isSponsored) {
      content = `${content} (Sponsored by ${randomEvent.sponsor})`;
    }

    const newNode: Node<LifeSimulatorNodeData> = {
      id: newNodeId,
      type: "event",
      position,
      data: {
        type: "event",
        content,
        age,
        onGeneratePredictions: () => generatePredictionsRef.current!(newNodeId),
      },
    };

    setNodes((nds) => [...nds, newNode]);
    dismissRandomEvent();
  }, [randomEvent, dismissRandomEvent, timeHorizon, startX, endX, setNodes]);

  // Generate prediction nodes from an event
  const generatePredictions = useCallback(
    async (eventNodeId: string) => {
      // Get the event node
      const eventNode = nodes.find((n) => n.id === eventNodeId);
      if (!eventNode || !acceptPredictionRef.current) return;

      // Mark event as having generated predictions
      setNodes((nds) =>
        nds.map((n) =>
          n.id === eventNodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  predictionsGenerated: true,
                },
              }
            : n
        )
      );

      // Create a new prediction group ID
      const groupId = nextPredictionGroupId;
      setNextPredictionGroupId((prev) => prev + 1);

      // Position predictions in a fan pattern below the event
      const basePosition = { ...eventNode.position };
      const predictions: Node<LifeSimulatorNodeData>[] = [];

      // API call would go here for real predictions
      // For now, create 3 dummy predictions
      const predictionContents = [
        "You succeed beyond expectations",
        "Things go according to plan",
        "There are unexpected challenges",
      ];

      // Create 3 prediction nodes in a fan pattern with alternating offsets
      for (let i = 0; i < 3; i++) {
        const xOffset = (i - 1) * 250; // Increased from 140 to 250 for wider horizontal spread
        const yDistance = 150; // Increased vertical distance

        const newPosition = {
          x: basePosition.x + xOffset,
          y: basePosition.y + yDistance + (i % 2 === 0 ? 40 : 0), // Extra offset for even indices
        };

        const newNodeId = `prediction-${groupId}-${i + 1}`;

        predictions.push({
          id: newNodeId,
          type: "prediction",
          position: newPosition,
          data: {
            type: "prediction",
            content: predictionContents[i],
            age: eventNode.data.age,
            predictionGroup: groupId.toString(),
            isPrimaryPrediction: i === 0, // Highlight the first prediction
            onShuffle: () => shufflePrediction(newNodeId),
            onAccept: () => acceptPredictionRef.current!(newNodeId, groupId),
          },
        });
      }

      // Add predictions to nodes
      setNodes((nds) => [...nds, ...predictions]);

      // Create connections from event to predictions
      const newEdges: Edge[] = predictions.map((p) => ({
        id: `e-${eventNodeId}-${p.id}`,
        source: eventNodeId,
        sourceHandle: "c", // Bottom handle
        target: p.id,
        targetHandle: "a", // Left handle
      }));

      setEdges((eds) => [...eds, ...newEdges]);
    },
    [nodes, setNodes, setEdges, nextPredictionGroupId, shufflePrediction]
  );

  // Assign the function to the ref
  useEffect(() => {
    generatePredictionsRef.current = generatePredictions;
  }, [generatePredictions]);

  // Accept a prediction
  const acceptPrediction = useCallback(
    (predictionId: string, groupId: number) => {
      // Find all predictions in this group
      const predictionsInGroup = nodes.filter(
        (n) =>
          n.data.type === "prediction" &&
          n.data.predictionGroup === groupId.toString()
      );

      // Find the selected prediction
      const selectedPrediction = nodes.find((n) => n.id === predictionId);
      if (!selectedPrediction || !generatePredictionsRef.current) return;

      // Find the parent event node
      const parentEdges = edges.filter((e) => e.target === predictionId);
      const parentEventId =
        parentEdges.length > 0 ? parentEdges[0].source : null;

      // IDs of predictions to remove (all except the accepted one)
      const idsToRemove = predictionsInGroup
        .filter((p) => p.id !== predictionId)
        .map((p) => p.id);

      // Remove edges connected to the removed predictions
      setEdges((eds) =>
        eds.filter(
          (e) =>
            !idsToRemove.includes(e.target) && !idsToRemove.includes(e.source)
        )
      );

      // Remove unwanted predictions
      setNodes((nds) => nds.filter((n) => !idsToRemove.includes(n.id)));

      // Convert the accepted prediction to an event node
      const newEventId = `event-from-prediction-${getId()}`;
      setNodes((nds) => {
        const updatedNodes = nds.map((n) => {
          if (n.id === predictionId) {
            // Create a properly typed event node from the prediction
            const newNode: Node<LifeSimulatorNodeData> = {
              ...n,
              id: newEventId,
              type: "event",
              data: {
                ...n.data,
                type: "event" as const,
                onGeneratePredictions: () =>
                  generatePredictionsRef.current!(newEventId),
                // Remove prediction-specific props
                predictionGroup: undefined,
                isPrimaryPrediction: undefined,
                onShuffle: undefined,
                onAccept: undefined,
              },
            };
            return newNode;
          }
          return n;
        });

        // Update the edge from parent to point to the new event node
        if (parentEventId) {
          setEdges((eds) => {
            return eds.map((edge) => {
              if (
                edge.source === parentEventId &&
                edge.target === predictionId
              ) {
                return { ...edge, target: newEventId };
              }
              return edge;
            });
          });
        }

        return updatedNodes;
      });

      // Add a skill or upgrade existing skill
      const possibleSkills = [
        "Leadership",
        "Communication",
        "Technical",
        "Creativity",
        "Problem Solving",
        "Adaptability",
        "Financial Management",
        "Resilience",
        "Strategic Thinking",
        "Networking",
      ];

      // Pick a random skill
      const newSkill =
        possibleSkills[Math.floor(Math.random() * possibleSkills.length)];

      // Check if skill already exists
      const existingSkill = skills.find((s) => s.name === newSkill);
      if (existingSkill) {
        // Upgrade existing skill
        setSkills((prevSkills) =>
          prevSkills.map((skill) =>
            skill.name === newSkill
              ? { ...skill, level: Math.min(10, skill.level + 1) }
              : skill
          )
        );
      } else {
        // Add new skill
        setSkills((prevSkills) => [
          ...prevSkills,
          { name: newSkill, level: 1 },
        ]);
      }
    },
    [nodes, setNodes, setEdges, skills, edges]
  );

  // Assign the function to the ref
  useEffect(() => {
    acceptPredictionRef.current = acceptPrediction;
  }, [acceptPrediction]);

  // Random events system
  useEffect(() => {
    if (!isSetupComplete) return;

    // Generate initial random event after 5 seconds
    const initialTimeout = setTimeout(() => {
      generateRandomEvent();
    }, 5000);

    // Set up interval for random events (every 30 seconds)
    const randomEventInterval = setInterval(() => {
      generateRandomEvent();
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(randomEventInterval);
      if (randomEventTimeout) {
        clearTimeout(randomEventTimeout);
      }
    };
  }, [isSetupComplete, generateRandomEvent, randomEventTimeout]);

  // Complete initial setup
  const completeSetup = async () => {
    if (!startingContext || !deathContext || !timeHorizon) return;

    // Set initial nodes with adjusted positioning
    const startNode: Node<LifeSimulatorNodeData> = {
      id: "start",
      type: "start",
      data: {
        type: "start",
        content: startingContext,
        age: 20,
      },
      position: { x: startX - 200, y: 200 }, // Move start node further left
    };

    const endNode: Node<LifeSimulatorNodeData> = {
      id: "end",
      type: "death",
      data: {
        type: "death",
        content: deathContext,
        age: timeHorizon,
      },
      position: { x: endX + 320, y: 200 }, // Increased from +200 to +400 to move death node further right
    };

    setNodes([startNode, endNode]);
    setIsSetupComplete(true);

    // Generate milestones
    await generateMilestones();
  };

  // If setup is not complete, show the setup form
  if (!isSetupComplete) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Life Simulator Setup
          </h1>

          <div className="mb-4">
            <label className="block mb-2">Starting Context</label>
            <textarea
              className="w-full p-2 bg-gray-700 rounded text-white"
              rows={3}
              value={startingContext}
              onChange={(e) => setStartingContext(e.target.value)}
              placeholder="Describe your starting point in life..."
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2">Death Context</label>
            <textarea
              className="w-full p-2 bg-gray-700 rounded text-white"
              rows={3}
              value={deathContext}
              onChange={(e) => setDeathContext(e.target.value)}
              placeholder="How do you want to be remembered?"
            />
          </div>

          <div className="mb-6">
            <label className="block mb-2">Life Expectancy (years)</label>
            <input
              type="range"
              min={40}
              max={120}
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-center">{timeHorizon} years</div>
          </div>

          <button
            onClick={completeSetup}
            disabled={!startingContext || !deathContext}
            className="w-full p-3 bg-blue-600 rounded font-bold disabled:opacity-50"
          >
            Begin Life Journey
          </button>
        </div>
      </div>
    );
  }

  // Main simulator view
  return (
    <div className="flex h-screen">
      <div className="w-[70%] h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onPaneContextMenu={onPaneContextMenu}
          fitView
        >
          <Background />
        </ReactFlow>

        {/* Node creation menu - shows on right click */}
        {showNodeMenu && (
          <div
            className="node-menu absolute bg-white shadow-lg rounded-md border border-gray-200 z-50"
            style={{
              left: menuPosition.x,
              top: menuPosition.y,
              transform: "translate(-50%, -50%)",
            }}
          >
            <ul className="py-2">
              <li
                className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                onClick={() => addNode("milestone")}
              >
                Add Milestone
              </li>
              <li
                className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                onClick={() => addNode("event")}
              >
                Add Event
              </li>
              <li
                className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                onClick={() => addNode("prediction")}
              >
                Add Prediction
              </li>
            </ul>
          </div>
        )}

        {/* Random Event Notification */}
        {randomEvent && (
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border-2 z-50 overflow-hidden max-w-md transition-all duration-300 ease-in-out transform">
            <div
              className={`px-4 py-2 text-white font-bold ${
                randomEvent.isSponsored ? "bg-yellow-500" : "bg-purple-500"
              }`}
            >
              {randomEvent.isSponsored ? (
                <div className="flex items-center justify-between">
                  <span>Sponsored Event</span>
                  <span className="text-xs bg-white text-yellow-500 px-2 py-1 rounded">
                    {randomEvent.sponsor}
                  </span>
                </div>
              ) : (
                <span>Random Life Event</span>
              )}
            </div>
            <div className="p-4">
              <p className="text-gray-800 mb-4">{randomEvent.content}</p>
              <div className="flex space-x-2">
                <button
                  onClick={acceptRandomEvent}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded"
                >
                  Accept
                </button>
                <button
                  onClick={dismissRandomEvent}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="w-[30%] h-full bg-gray-900 text-white p-4 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 border-b pb-2">
          Character Stats
        </h2>

        <div className="mb-6">
          {Object.entries(stats).map(([stat, value]) => (
            <div key={stat} className="mb-2">
              <div className="flex justify-between mb-1">
                <span className="capitalize">{stat}</span>
                <span>{value}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${
                    stat === "luck"
                      ? "bg-green-600"
                      : stat === "intelligence"
                      ? "bg-blue-600"
                      : stat === "rizz"
                      ? "bg-purple-600"
                      : "bg-orange-600"
                  }`}
                  style={{ width: `${value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-4 border-b pb-2">Skills</h2>
        <div>
          {skills.length === 0 ? (
            <p className="text-gray-400 italic">No skills acquired yet</p>
          ) : (
            <ul className="space-y-2">
              {skills.map((skill, index) => (
                <li key={index} className="flex justify-between">
                  <span>{skill.name}</span>
                  <span>Lvl {skill.level}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LifeSimulatorPage() {
  return (
    <ReactFlowProvider>
      <LifeSimulator />
    </ReactFlowProvider>
  );
}
