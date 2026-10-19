/**
 * Graph Rendering Engine & Animation Controller for AI Search Simulation
 * Handles interactive canvas rendering, node dragging, pan/zoom,
 * timeline scrubbing, live data structure inspection, and animation loops.
 */

class Graph {
  constructor() {
    this.nodes = new Map(); // id -> { id, label, x, y }
    this.edges = new Map(); // key -> { id, from, to, weight, directed }
    this.isDirected = false;
  }

  addNode(id, label, x, y) {
    this.nodes.set(id, {
      id: id,
      label: label || id,
      x: x,
      y: y
    });
  }

  removeNode(id) {
    this.nodes.delete(id);
    for (const [key, edge] of this.edges.entries()) {
      if (edge.from === id || edge.to === id) {
        this.edges.delete(key);
      }
    }
  }

  getEdgeKey(u, v) {
    if (this.isDirected) {
      return `${u}->${v}`;
    }
    return u < v ? `${u}--${v}` : `${v}--${u}`;
  }

  addEdge(from, to, weight = 1, directed = false, curve = 0) {
    if (!this.nodes.has(from) || !this.nodes.has(to) || from === to) return false;
    const key = this.getEdgeKey(from, to);
    this.edges.set(key, {
      id: key,
      from,
      to,
      weight: Math.max(1, Math.round(Number(weight) || 1)),
      directed: this.isDirected || directed,
      curve: Number(curve) || 0
    });
    return true;
  }

  removeEdge(from, to) {
    const key = this.getEdgeKey(from, to);
    this.edges.delete(key);
  }

  getNodeLabel(id) {
    const node = this.nodes.get(id);
    return node ? node.label : id;
  }

  getNeighbors(nodeId) {
    const neighbors = [];
    for (const edge of this.edges.values()) {
      if (edge.from === nodeId) {
        neighbors.push({ target: edge.to, weight: edge.weight, edgeId: edge.id });
      } else if (!edge.directed && !this.isDirected && edge.to === nodeId) {
        neighbors.push({ target: edge.from, weight: edge.weight, edgeId: edge.id });
      }
    }
    // Sort deterministically by label/id so search order is reproducible
    neighbors.sort((a, b) => {
      const labelA = this.getNodeLabel(a.target);
      const labelB = this.getNodeLabel(b.target);
      return labelA.localeCompare(labelB);
    });
    return neighbors;
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
  }

  // Pre-configured Graph Generators
  static createKakRosMap() {
    const g = new Graph();
    g.isDirected = true;

    // Node layout matching Figure 1 (Kuching food delivery map)
    g.addNode('S', 'S (Shop)', 90, 260);
    g.addNode('B', 'B', 240, 110);
    g.addNode('A', 'A', 240, 260);
    g.addNode('E', 'E', 420, 80);
    g.addNode('D', 'D', 390, 310);
    g.addNode('F', 'F', 510, 420);
    g.addNode('C', 'C', 640, 420);
    g.addNode('G', 'G (Customer)', 790, 260);

    // One-way roads with travel times in minutes
    g.addEdge('S', 'A', 3, true);
    g.addEdge('S', 'B', 1, true);
    g.addEdge('S', 'C', 6, true, 80); // Curves downward along bottom
    g.addEdge('B', 'A', 1, true);
    g.addEdge('B', 'E', 5, true);
    g.addEdge('A', 'D', 2, true);
    g.addEdge('A', 'G', 9, true, -75); // Curves upward over top
    g.addEdge('C', 'G', 2, true);
    g.addEdge('D', 'F', 1, true);
    g.addEdge('D', 'G', 3, true);
    g.addEdge('E', 'G', 4, true);
    g.addEdge('F', 'C', 1, true);

    return g;
  }

  static createBinaryTree() {
    const g = new Graph();
    const treeData = [
      { id: 'A', label: 'A', x: 450, y: 70 },
      { id: 'B', label: 'B', x: 260, y: 160 },
      { id: 'C', label: 'C', x: 640, y: 160 },
      { id: 'D', label: 'D', x: 170, y: 260 },
      { id: 'E', label: 'E', x: 350, y: 260 },
      { id: 'F', label: 'F', x: 550, y: 260 },
      { id: 'G', label: 'G', x: 730, y: 260 },
      { id: 'H', label: 'H', x: 120, y: 360 },
      { id: 'I', label: 'I', x: 220, y: 360 },
      { id: 'J', label: 'J', x: 310, y: 360 },
      { id: 'K', label: 'K', x: 390, y: 360 },
      { id: 'L', label: 'L', x: 510, y: 360 },
      { id: 'M', label: 'M', x: 590, y: 360 },
      { id: 'N', label: 'N', x: 690, y: 360 },
      { id: 'P', label: 'P', x: 780, y: 360 }
    ];

    treeData.forEach(n => g.addNode(n.id, n.label, n.x, n.y));
    const edges = [
      ['A', 'B', 1], ['A', 'C', 1],
      ['B', 'D', 1], ['B', 'E', 1],
      ['C', 'F', 1], ['C', 'G', 1],
      ['D', 'H', 1], ['D', 'I', 1],
      ['E', 'J', 1], ['E', 'K', 1],
      ['F', 'L', 1], ['F', 'M', 1],
      ['G', 'N', 1], ['G', 'P', 1]
    ];
    edges.forEach(([u, v, w]) => g.addEdge(u, v, w));
    return g;
  }

  static createWeightedDilemma() {
    const g = new Graph();
    // Designed to show contrast: BFS takes short path (A->B->Goal, 2 hops, total cost 18)
    // UCS takes longer hop path with much lower cost (A->C->D->E->Goal, 4 hops, total cost 6!)
    const nodes = [
      { id: 'Start', label: 'Start (S)', x: 120, y: 220 },
      { id: 'B1', label: 'B1', x: 340, y: 110 },
      { id: 'B2', label: 'B2', x: 560, y: 110 },
      { id: 'C1', label: 'C1', x: 250, y: 330 },
      { id: 'C2', label: 'C2', x: 450, y: 350 },
      { id: 'C3', label: 'C3', x: 630, y: 320 },
      { id: 'M1', label: 'M1', x: 420, y: 220 },
      { id: 'Goal', label: 'Goal (G)', x: 780, y: 220 }
    ];
    nodes.forEach(n => g.addNode(n.id, n.label, n.x, n.y));

    // High cost direct route
    g.addEdge('Start', 'B1', 9);
    g.addEdge('B1', 'Goal', 9);

    // Medium cost route
    g.addEdge('Start', 'M1', 5);
    g.addEdge('M1', 'Goal', 6);

    // Low cost multi-hop route
    g.addEdge('Start', 'C1', 1);
    g.addEdge('C1', 'C2', 1);
    g.addEdge('C2', 'C3', 2);
    g.addEdge('C3', 'Goal', 2);

    // Cross-connections
    g.addEdge('B1', 'M1', 2);
    g.addEdge('M1', 'C2', 3);
    g.addEdge('B1', 'B2', 4);
    g.addEdge('B2', 'Goal', 8);

    return g;
  }

  static createRomaniaMap() {
    const g = new Graph();
    // Simplified version of the classic AIMA Romania roadmap
    const cities = [
      { id: 'Arad', label: 'Arad', x: 90, y: 170 },
      { id: 'Zerind', label: 'Zerind', x: 120, y: 80 },
      { id: 'Oradea', label: 'Oradea', x: 220, y: 50 },
      { id: 'Sibiu', label: 'Sibiu', x: 280, y: 190 },
      { id: 'Timisoara', label: 'Timisoara', x: 90, y: 300 },
      { id: 'Lugoj', label: 'Lugoj', x: 190, y: 340 },
      { id: 'Mehadia', label: 'Mehadia', x: 190, y: 410 },
      { id: 'Drobeta', label: 'Drobeta', x: 190, y: 480 },
      { id: 'Craiova', label: 'Craiova', x: 360, y: 470 },
      { id: 'Rimnicu', label: 'Rimnicu', x: 370, y: 270 },
      { id: 'Fagaras', label: 'Fagaras', x: 490, y: 180 },
      { id: 'Pitesti', label: 'Pitesti', x: 520, y: 330 },
      { id: 'Bucharest', label: 'Bucharest', x: 670, y: 360 },
      { id: 'Giurgiu', label: 'Giurgiu', x: 630, y: 470 },
      { id: 'Urziceni', label: 'Urziceni', x: 770, y: 310 }
    ];
    cities.forEach(c => g.addNode(c.id, c.label, c.x, c.y));

    const roads = [
      ['Arad', 'Zerind', 75],
      ['Zerind', 'Oradea', 71],
      ['Oradea', 'Sibiu', 151],
      ['Arad', 'Sibiu', 140],
      ['Arad', 'Timisoara', 118],
      ['Timisoara', 'Lugoj', 111],
      ['Lugoj', 'Mehadia', 70],
      ['Mehadia', 'Drobeta', 75],
      ['Drobeta', 'Craiova', 120],
      ['Sibiu', 'Fagaras', 99],
      ['Sibiu', 'Rimnicu', 80],
      ['Rimnicu', 'Craiova', 146],
      ['Rimnicu', 'Pitesti', 97],
      ['Craiova', 'Pitesti', 138],
      ['Fagaras', 'Bucharest', 211],
      ['Pitesti', 'Bucharest', 101],
      ['Bucharest', 'Giurgiu', 90],
      ['Bucharest', 'Urziceni', 85]
    ];
    roads.forEach(([u, v, w]) => g.addEdge(u, v, w));
    return g;
  }

  static createLatticeGrid() {
    const g = new Graph();
    const rows = 4;
    const cols = 5;
    const spacingX = 140;
    const spacingY = 100;
    const offsetX = 130;
    const offsetY = 70;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `N_${r}_${c}`;
        const label = `${String.fromCharCode(65 + r)}${c + 1}`;
        g.addNode(id, label, offsetX + c * spacingX, offsetY + r * spacingY);
      }
    }

    // Connect horizontal and vertical grid neighbors
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = `N_${r}_${c}`;
        // Right
        if (c + 1 < cols) {
          const rightId = `N_${r}_${c + 1}`;
          // Make middle path more expensive to demonstrate detour behavior
          const weight = (r === 1 && c === 2) || (r === 2 && c === 1) ? 8 : (r + c) % 3 + 1;
          g.addEdge(id, rightId, weight);
        }
        // Down
        if (r + 1 < rows) {
          const downId = `N_${r + 1}_${c}`;
          const weight = (r === 1 && c === 1) ? 7 : (r * 2 + c) % 4 + 1;
          g.addEdge(id, downId, weight);
        }
      }
    }
    return g;
  }
}

/**
 * Interactive Canvas Visualizer for Graphs and Search Simulations
 */
class Visualizer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.graph = new Graph();
    this.startNodeId = null;
    this.goalNodeId = null;

    // Simulation playback state
    this.frames = [];
    this.currentFrameIndex = 0;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.stepSpeedMs = 400; // milliseconds per frame
    this.selectedAlgorithm = 'BFS';

    // Camera / Pan & Zoom
    this.transform = {
      x: 0,
      y: 0,
      scale: 1.0
    };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    // Interaction modes: 'select', 'set-start', 'set-goal', 'add-node', 'add-edge', 'delete'
    this.interactionMode = 'select';
    this.edgeDraftSource = null;
    this.draggedNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.hoveredNodeId = null;
    this.hoveredEdgeId = null;

    // Visual theme styling
    this.colors = {
      bg: '#0a0e17',
      grid: '#161f30',
      nodeDefault: '#1a2234',
      nodeBorder: '#3b4b68',
      nodeText: '#e2e8f0',
      nodeHover: '#60a5fa',
      startNode: '#10b981',
      goalNode: '#ef4444',
      currentRing: '#38bdf8',
      visitedNode: '#6366f1',
      frontierNode: '#06b6d4',
      pathNode: '#f59e0b',
      edgeDefault: '#293548',
      edgeTree: '#4f46e5',
      edgeActive: '#38bdf8',
      edgePath: '#f59e0b',
      badgeBg: '#1e293b',
      badgeText: '#94a3b8'
    };

    // Animation ticker for pulse rings & glow
    this.pulseAngle = 0;
    this.lastTimestamp = 0;

    this.initCanvasSize();
    this.setupEventListeners();
    this.startRenderLoop();
  }

  initCanvasSize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = (rect.width || 800) * dpr;
    this.canvas.height = (rect.height || 540) * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
    this.cssWidth = rect.width || 800;
    this.cssHeight = rect.height || 540;
  }

  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
    });

    // Mouse & Touch interaction
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = screenX - rect.left;
    const mouseY = screenY - rect.top;
    return {
      x: (mouseX - this.transform.x) / this.transform.scale,
      y: (mouseY - this.transform.y) / this.transform.scale
    };
  }

  findNodeAt(worldX, worldY, radius = 24) {
    for (const [id, node] of this.graph.nodes.entries()) {
      const dx = node.x - worldX;
      const dy = node.y - worldY;
      if (dx * dx + dy * dy <= radius * radius) {
        return id;
      }
    }
    return null;
  }

  findEdgeAt(worldX, worldY, tolerance = 10) {
    for (const [key, edge] of this.graph.edges.entries()) {
      const u = this.graph.nodes.get(edge.from);
      const v = this.graph.nodes.get(edge.to);
      if (!u || !v) continue;

      const dist = this.pointToSegmentDistance(worldX, worldY, u.x, u.y, v.x, v.y);
      if (dist <= tolerance) {
        return key;
      }
    }
    return null;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(px - projX, py - projY);
  }

  handleMouseDown(e) {
    const { x: worldX, y: worldY } = this.screenToWorld(e.clientX, e.clientY);
    const clickedNodeId = this.findNodeAt(worldX, worldY);
    const isRightClick = e.button === 2;

    // If Right-click, initiate canvas pan immediately regardless of mode
    if (isRightClick || e.button === 1) {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
      return;
    }

    if (this.interactionMode === 'set-start') {
      if (clickedNodeId) {
        this.setStartNode(clickedNodeId);
        this.setInteractionMode('select');
      }
      return;
    }

    if (this.interactionMode === 'set-goal') {
      if (clickedNodeId) {
        this.setGoalNode(clickedNodeId);
        this.setInteractionMode('select');
      }
      return;
    }

    if (this.interactionMode === 'add-node') {
      if (!clickedNodeId) {
        this.promptAddNodeAt(worldX, worldY);
      }
      return;
    }

    if (this.interactionMode === 'add-edge') {
      if (clickedNodeId) {
        if (!this.edgeDraftSource) {
          this.edgeDraftSource = clickedNodeId;
          this.updateStatusBanner(`Selected source node [${this.graph.getNodeLabel(clickedNodeId)}]. Now click target node.`);
        } else if (this.edgeDraftSource !== clickedNodeId) {
          const from = this.edgeDraftSource;
          const to = clickedNodeId;
          this.edgeDraftSource = null;
          this.promptAddEdgeWeight(from, to);
        } else {
          this.edgeDraftSource = null;
          this.updateStatusBanner('Cancelled edge creation.');
        }
      }
      return;
    }

    if (this.interactionMode === 'delete') {
      if (clickedNodeId) {
        if (clickedNodeId === this.startNodeId) this.startNodeId = null;
        if (clickedNodeId === this.goalNodeId) this.goalNodeId = null;
        this.graph.removeNode(clickedNodeId);
        this.recomputeSearch();
      } else {
        const edgeKey = this.findEdgeAt(worldX, worldY);
        if (edgeKey) {
          const edge = this.graph.edges.get(edgeKey);
          if (edge) {
            this.graph.removeEdge(edge.from, edge.to);
            this.recomputeSearch();
          }
        }
      }
      return;
    }

    // Default 'select' mode: Drag node if clicked on node, else pan canvas
    if (clickedNodeId) {
      this.draggedNode = this.graph.nodes.get(clickedNodeId);
      this.dragOffset = {
        x: this.draggedNode.x - worldX,
        y: this.draggedNode.y - worldY
      };
    } else {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
    }
  }

  handleMouseMove(e) {
    const { x: worldX, y: worldY } = this.screenToWorld(e.clientX, e.clientY);

    if (this.isPanning) {
      this.transform.x = e.clientX - this.panStart.x;
      this.transform.y = e.clientY - this.panStart.y;
      return;
    }

    if (this.draggedNode) {
      this.draggedNode.x = worldX + this.dragOffset.x;
      this.draggedNode.y = worldY + this.dragOffset.y;
      return;
    }

    // Update hover states
    this.hoveredNodeId = this.findNodeAt(worldX, worldY);
    this.hoveredEdgeId = !this.hoveredNodeId ? this.findEdgeAt(worldX, worldY) : null;
    this.canvas.style.cursor = this.hoveredNodeId ? 'pointer' : this.hoveredEdgeId ? 'crosshair' : 'default';
  }

  handleMouseUp() {
    this.isPanning = false;
    this.draggedNode = null;
  }

  handleWheel(e) {
    e.preventDefault();
    const zoomFactor = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction > 0 ? zoomFactor : 1 / zoomFactor;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.min(3.0, Math.max(0.3, this.transform.scale * factor));
    const scaleRatio = newScale / this.transform.scale;

    this.transform.x = mouseX - (mouseX - this.transform.x) * scaleRatio;
    this.transform.y = mouseY - (mouseY - this.transform.y) * scaleRatio;
    this.transform.scale = newScale;
  }

  promptAddNodeAt(worldX, worldY) {
    const count = this.graph.nodes.size;
    const defaultLabel = String.fromCharCode(65 + (count % 26)) + (count >= 26 ? Math.floor(count / 26) : '');
    const label = prompt('Enter new node label:', defaultLabel);
    if (label && label.trim()) {
      const id = 'N_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      this.graph.addNode(id, label.trim(), Math.round(worldX), Math.round(worldY));
      if (!this.startNodeId) this.startNodeId = id;
      else if (!this.goalNodeId) this.goalNodeId = id;
      this.recomputeSearch();
    }
  }

  promptAddEdgeWeight(from, to) {
    const fromLabel = this.graph.getNodeLabel(from);
    const toLabel = this.graph.getNodeLabel(to);
    const weightStr = prompt(`Enter edge weight between [${fromLabel}] and [${toLabel}]:`, '2');
    if (weightStr !== null) {
      const weight = Math.max(1, parseInt(weightStr, 10) || 1);
      this.graph.addEdge(from, to, weight);
      this.recomputeSearch();
      this.updateStatusBanner(`Added edge [${fromLabel}] ↔ [${toLabel}] with weight ${weight}.`);
    }
  }

  setInteractionMode(mode) {
    this.interactionMode = mode;
    this.edgeDraftSource = null;

    // Update active button UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const messages = {
      'select': 'Select & Drag Mode: Drag nodes to position them, or drag background to pan canvas.',
      'set-start': 'Click any node on canvas to assign it as the START node (Green).',
      'set-goal': 'Click any node on canvas to assign it as the TARGET GOAL node (Red).',
      'add-node': 'Click anywhere on canvas to create a new graph node.',
      'add-edge': 'Click source node, then target node to link them with a weighted edge.',
      'delete': 'Click any node or edge to delete it from the simulation graph.'
    };
    this.updateStatusBanner(messages[mode] || '');
  }

  updateStatusBanner(msg) {
    const el = document.getElementById('canvas-status-banner');
    if (el) el.textContent = msg;
  }

  setStartNode(id) {
    if (this.graph.nodes.has(id)) {
      this.startNodeId = id;
      this.recomputeSearch();
      this.updateStatusBanner(`Start node set to [${this.graph.getNodeLabel(id)}].`);
    }
  }

  setGoalNode(id) {
    if (this.graph.nodes.has(id)) {
      this.goalNodeId = id;
      this.recomputeSearch();
      this.updateStatusBanner(`Goal node set to [${this.graph.getNodeLabel(id)}].`);
    }
  }

  loadPreset(presetName) {
    this.pause();
    this.graph.clear();

    switch (presetName) {
      case 'kakros':
        this.graph = Graph.createKakRosMap();
        this.startNodeId = 'S';
        this.goalNodeId = 'G';
        break;
      case 'tree':
        this.graph = Graph.createBinaryTree();
        this.startNodeId = 'A';
        this.goalNodeId = 'J';
        break;
      case 'weighted':
        this.graph = Graph.createWeightedDilemma();
        this.startNodeId = 'Start';
        this.goalNodeId = 'Goal';
        break;
      case 'romania':
        this.graph = Graph.createRomaniaMap();
        this.startNodeId = 'Arad';
        this.goalNodeId = 'Bucharest';
        break;
      case 'grid':
        this.graph = Graph.createLatticeGrid();
        this.startNodeId = 'N_0_0';
        this.goalNodeId = 'N_3_4';
        break;
      default:
        this.graph = Graph.createKakRosMap();
        this.startNodeId = 'S';
        this.goalNodeId = 'G';
    }

    this.centerGraph();
    this.recomputeSearch();
  }

  centerGraph() {
    if (this.graph.nodes.size === 0) return;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const node of this.graph.nodes.values()) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }

    const padding = 80;
    const graphWidth = maxX - minX + padding * 2;
    const graphHeight = maxY - minY + padding * 2;

    const scaleX = this.cssWidth / graphWidth;
    const scaleY = this.cssHeight / graphHeight;
    const fitScale = Math.min(1.4, Math.max(0.5, Math.min(scaleX, scaleY)));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    this.transform.scale = fitScale;
    this.transform.x = this.cssWidth / 2 - centerX * fitScale;
    this.transform.y = this.cssHeight / 2 - centerY * fitScale;
  }

  zoomIn() {
    this.transform.scale = Math.min(3.0, this.transform.scale * 1.25);
  }

  zoomOut() {
    this.transform.scale = Math.max(0.3, this.transform.scale * 0.8);
  }

  resetZoom() {
    this.centerGraph();
  }

  setAlgorithm(algo) {
    this.selectedAlgorithm = algo;
    this.recomputeSearch();
  }

  recomputeSearch() {
    this.pause();
    if (!this.startNodeId || !this.goalNodeId || !this.graph.nodes.has(this.startNodeId) || !this.graph.nodes.has(this.goalNodeId)) {
      this.frames = [];
      this.currentFrameIndex = 0;
      this.updateUIFrame(null);
      return;
    }

    if (this.selectedAlgorithm === 'BFS') {
      this.frames = SearchEngine.runBFS(this.graph, this.startNodeId, this.goalNodeId);
    } else if (this.selectedAlgorithm === 'DFS') {
      this.frames = SearchEngine.runDFS(this.graph, this.startNodeId, this.goalNodeId);
    } else if (this.selectedAlgorithm === 'UCS') {
      this.frames = SearchEngine.runUCS(this.graph, this.startNodeId, this.goalNodeId);
    }

    this.currentFrameIndex = 0;
    this.updateTimelineUI();
    this.updateUIFrame(this.getCurrentFrame());
  }

  getCurrentFrame() {
    if (!this.frames || this.frames.length === 0) return null;
    return this.frames[this.currentFrameIndex] || null;
  }

  play() {
    if (this.isPlaying) return;
    if (this.currentFrameIndex >= this.frames.length - 1) {
      this.currentFrameIndex = 0;
    }
    this.isPlaying = true;
    this.updatePlayButtonUI();
    this.runPlaybackStep();
  }

  pause() {
    this.isPlaying = false;
    clearTimeout(this.playbackTimer);
    this.updatePlayButtonUI();
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  runPlaybackStep() {
    if (!this.isPlaying) return;

    if (this.currentFrameIndex < this.frames.length - 1) {
      this.currentFrameIndex++;
      this.updateTimelineUI();
      this.updateUIFrame(this.getCurrentFrame());
      this.playbackTimer = setTimeout(() => this.runPlaybackStep(), this.stepSpeedMs);
    } else {
      this.pause();
    }
  }

  stepForward() {
    this.pause();
    if (this.currentFrameIndex < this.frames.length - 1) {
      this.currentFrameIndex++;
      this.updateTimelineUI();
      this.updateUIFrame(this.getCurrentFrame());
    }
  }

  stepBackward() {
    this.pause();
    if (this.currentFrameIndex > 0) {
      this.currentFrameIndex--;
      this.updateTimelineUI();
      this.updateUIFrame(this.getCurrentFrame());
    }
  }

  goToFrame(index) {
    this.pause();
    this.currentFrameIndex = Math.max(0, Math.min(this.frames.length - 1, index));
    this.updateTimelineUI();
    this.updateUIFrame(this.getCurrentFrame());
  }

  jumpToStart() {
    this.goToFrame(0);
  }

  jumpToEnd() {
    this.goToFrame(this.frames.length - 1);
  }

  setSpeed(ms) {
    this.stepSpeedMs = ms;
  }

  updatePlayButtonUI() {
    const playBtn = document.getElementById('play-btn');
    if (!playBtn) return;
    const icon = playBtn.querySelector('.icon');
    const label = playBtn.querySelector('.label');
    if (this.isPlaying) {
      if (icon) icon.textContent = '⏸';
      if (label) label.textContent = 'Pause';
      playBtn.classList.add('playing');
    } else {
      if (icon) icon.textContent = '▶';
      if (label) label.textContent = 'Play';
      playBtn.classList.remove('playing');
    }
  }

  updateTimelineUI() {
    const slider = document.getElementById('timeline-slider');
    const stepLabel = document.getElementById('timeline-step-label');
    const totalLabel = document.getElementById('timeline-total-label');

    if (slider) {
      slider.max = Math.max(0, this.frames.length - 1);
      slider.value = this.currentFrameIndex;
    }
    if (stepLabel) {
      stepLabel.textContent = `Step ${this.currentFrameIndex}`;
    }
    if (totalLabel) {
      totalLabel.textContent = `of ${Math.max(0, this.frames.length - 1)}`;
    }
  }

  updateUIFrame(frame) {
    // 1. Update live narration log
    const logContainer = document.getElementById('narration-log');
    if (logContainer) {
      if (!frame) {
        logContainer.innerHTML = '<div class="log-empty">Select start and goal nodes to begin simulation.</div>';
      } else {
        const badgeClass = `action-${(frame.action || 'step').toLowerCase().replace(/_/g, '-')}`;
        logContainer.innerHTML = `
          <div class="log-entry ${badgeClass}">
            <div class="log-header">
              <span class="log-badge">${frame.action}</span>
              <span class="log-step-num">Step #${frame.step}</span>
            </div>
            <div class="log-message">${frame.message}</div>
          </div>
        `;
      }
    }

    // 2. Update Metrics Cards
    const nodesExploredEl = document.getElementById('metric-explored');
    const frontierSizeEl = document.getElementById('metric-frontier');
    const peakFrontierEl = document.getElementById('metric-peak');
    const pathCostEl = document.getElementById('metric-cost');
    const pathFoundEl = document.getElementById('metric-status');

    if (frame && frame.stats) {
      if (nodesExploredEl) nodesExploredEl.textContent = frame.stats.nodesExplored;
      if (frontierSizeEl) frontierSizeEl.textContent = frame.stats.frontierSize;
      if (peakFrontierEl) peakFrontierEl.textContent = frame.stats.peakFrontier;
      if (pathCostEl) pathCostEl.textContent = frame.cost !== undefined ? frame.cost : '-';
      if (pathFoundEl) {
        if (frame.success) {
          pathFoundEl.innerHTML = '<span class="status-badge success">Goal Reached</span>';
        } else if (frame.isComplete && !frame.success) {
          pathFoundEl.innerHTML = '<span class="status-badge failure">No Path</span>';
        } else {
          pathFoundEl.innerHTML = '<span class="status-badge searching">Exploring...</span>';
        }
      }
    } else {
      if (nodesExploredEl) nodesExploredEl.textContent = '0';
      if (frontierSizeEl) frontierSizeEl.textContent = '0';
      if (peakFrontierEl) peakFrontierEl.textContent = '0';
      if (pathCostEl) pathCostEl.textContent = '-';
      if (pathFoundEl) pathFoundEl.innerHTML = '<span class="status-badge idle">Idle</span>';
    }

    // 3. Update Data Structure Visualizer
    this.renderDataStructureInspector(frame);
  }

  renderDataStructureInspector(frame) {
    const container = document.getElementById('data-structure-content');
    const typeTitle = document.getElementById('ds-type-title');
    const dsBadge = document.getElementById('ds-badge');

    if (!container) return;

    if (this.selectedAlgorithm === 'BFS') {
      if (typeTitle) typeTitle.textContent = 'FIFO Queue';
      if (dsBadge) dsBadge.textContent = 'Frontier (Queue)';
    } else if (this.selectedAlgorithm === 'DFS') {
      if (typeTitle) typeTitle.textContent = 'LIFO Stack';
      if (dsBadge) dsBadge.textContent = 'Frontier (Stack)';
    } else if (this.selectedAlgorithm === 'UCS') {
      if (typeTitle) typeTitle.textContent = 'Min-Priority Queue';
      if (dsBadge) dsBadge.textContent = 'Frontier (Priority Heap)';
    }

    if (!frame || !frame.frontier || frame.frontier.length === 0) {
      container.innerHTML = '<div class="ds-empty">Frontier is currently empty.</div>';
      return;
    }

    let itemsHtml = '';
    const frontier = frame.frontier;

    if (this.selectedAlgorithm === 'BFS') {
      // FIFO: First item is Head (Next to dequeue)
      itemsHtml = frontier.map((item, idx) => {
        const isHead = idx === 0;
        const label = this.graph.getNodeLabel(item.id);
        const pathPreview = item.path ? item.path.map(id => this.graph.getNodeLabel(id)).join(' → ') : '';
        return `
          <div class="ds-item queue-item ${isHead ? 'is-head' : ''}">
            <div class="ds-tag">${isHead ? 'HEAD' : '#' + (idx + 1)}</div>
            <div class="ds-node-name">${label}</div>
            <div class="ds-path-preview" title="${pathPreview}">${pathPreview}</div>
          </div>
        `;
      }).join('');
    } else if (this.selectedAlgorithm === 'DFS') {
      // LIFO: Last item is Top of Stack (Next to pop)
      // Display top to bottom
      const reversed = [...frontier].reverse();
      itemsHtml = reversed.map((item, idx) => {
        const isTop = idx === 0;
        const label = this.graph.getNodeLabel(item.id);
        const pathPreview = item.path ? item.path.map(id => this.graph.getNodeLabel(id)).join(' → ') : '';
        return `
          <div class="ds-item stack-item ${isTop ? 'is-top' : ''}">
            <div class="ds-tag">${isTop ? 'TOP (LIFO)' : '#' + (reversed.length - idx)}</div>
            <div class="ds-node-name">${label}</div>
            <div class="ds-path-preview" title="${pathPreview}">${pathPreview}</div>
          </div>
        `;
      }).join('');
    } else if (this.selectedAlgorithm === 'UCS') {
      // Min-Priority Queue: items ordered by path cost g(n)
      itemsHtml = frontier.map((item, idx) => {
        const isMin = idx === 0;
        const label = this.graph.getNodeLabel(item.id);
        const pathPreview = item.path ? item.path.map(id => this.graph.getNodeLabel(id)).join(' → ') : '';
        return `
          <div class="ds-item pq-item ${isMin ? 'is-min' : ''}">
            <div class="ds-tag">${isMin ? 'MIN' : '#' + (idx + 1)}</div>
            <div class="ds-node-info">
              <span class="ds-node-name">${label}</span>
              <span class="ds-node-cost">cost: ${item.cost}</span>
            </div>
            <div class="ds-path-preview" title="${pathPreview}">${pathPreview}</div>
          </div>
        `;
      }).join('');
    }

    container.innerHTML = `<div class="ds-list ${this.selectedAlgorithm.toLowerCase()}">${itemsHtml}</div>`;
  }

  startRenderLoop() {
    const loop = (timestamp) => {
      this.pulseAngle = (this.pulseAngle + 0.05) % (Math.PI * 2);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  render() {
    const ctx = this.ctx;
    ctx.save();

    // Clear background
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // Apply Camera Transform
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.scale, this.transform.scale);

    // Render Grid Background
    this.renderGrid(ctx);

    const frame = this.getCurrentFrame();
    const visitedSet = new Set(frame ? frame.visited : []);
    const frontierSet = new Set(frame && frame.frontier ? frame.frontier.map(f => f.id) : []);
    const treeEdgeSet = new Set(frame ? frame.treeEdges : []);
    const activeEdge = frame ? frame.activeEdge : null;
    const finalPath = frame && frame.path ? frame.path : null;
    const currentNode = frame ? frame.currentNode : null;

    // 1. Render Edges
    this.renderEdges(ctx, treeEdgeSet, activeEdge, finalPath);

    // 2. Render Draft Edge (if in add-edge mode)
    if (this.edgeDraftSource && this.graph.nodes.has(this.edgeDraftSource)) {
      const srcNode = this.graph.nodes.get(this.edgeDraftSource);
      ctx.beginPath();
      ctx.moveTo(srcNode.x, srcNode.y);
      // Draw to hovered node or cursor
      if (this.hoveredNodeId && this.graph.nodes.has(this.hoveredNodeId)) {
        const destNode = this.graph.nodes.get(this.hoveredNodeId);
        ctx.lineTo(destNode.x, destNode.y);
      }
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Render Nodes
    this.renderNodes(ctx, visitedSet, frontierSet, currentNode, finalPath);

    ctx.restore();
  }

  renderGrid(ctx) {
    const gridSize = 40;
    // Calculate visible boundaries
    const startX = Math.floor((-this.transform.x / this.transform.scale) / gridSize) * gridSize - gridSize;
    const endX = startX + Math.ceil(this.cssWidth / this.transform.scale) + gridSize * 2;
    const startY = Math.floor((-this.transform.y / this.transform.scale) / gridSize) * gridSize - gridSize;
    const endY = startY + Math.ceil(this.cssHeight / this.transform.scale) + gridSize * 2;

    ctx.fillStyle = this.colors.grid;
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  }

  renderEdges(ctx, treeEdgeSet, activeEdge, finalPath) {
    // Build set of path edges if solution exists
    const pathEdgeSet = new Set();
    if (finalPath && finalPath.length > 1) {
      for (let i = 0; i < finalPath.length - 1; i++) {
        pathEdgeSet.add(this.graph.getEdgeKey(finalPath[i], finalPath[i + 1]));
      }
    }

    for (const [key, edge] of this.graph.edges.entries()) {
      const u = this.graph.nodes.get(edge.from);
      const v = this.graph.nodes.get(edge.to);
      if (!u || !v) continue;

      const isPathEdge = pathEdgeSet.has(key);
      const isActiveEdge = activeEdge && this.graph.getEdgeKey(activeEdge[0], activeEdge[1]) === key;
      const isTreeEdge = treeEdgeSet.has(key);
      const isHovered = this.hoveredEdgeId === key;

      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      const curve = edge.curve || 0;
      const px = -ny;
      const py = nx;
      const ctrlX = (u.x + v.x) / 2 + px * curve;
      const ctrlY = (u.y + v.y) / 2 + py * curve;

      const badgeX = curve ? 0.25 * u.x + 0.5 * ctrlX + 0.25 * v.x : (u.x + v.x) / 2;
      const badgeY = curve ? 0.25 * u.y + 0.5 * ctrlY + 0.25 * v.y : (u.y + v.y) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      if (curve) {
        ctx.quadraticCurveTo(ctrlX, ctrlY, v.x, v.y);
      } else {
        ctx.lineTo(v.x, v.y);
      }

      if (isPathEdge) {
        // Glowing gold/amber path edge
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 14;
        ctx.stroke();

        // Second glowing stroke
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fef08a';
        ctx.stroke();
      } else if (isActiveEdge) {
        // Glowing active pulse edge
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
        ctx.stroke();
      } else if (isTreeEdge) {
        // Exploration tree edge
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        // Default edge
        ctx.strokeStyle = isHovered ? '#94a3b8' : this.colors.edgeDefault;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
      }

      ctx.restore();

      // Render directed arrow head
      if (edge.directed || this.graph.isDirected) {
        const nodeRadius = 24;
        let tangentX = nx;
        let tangentY = ny;
        let arrowTipX = v.x - nx * nodeRadius;
        let arrowTipY = v.y - ny * nodeRadius;

        if (curve) {
          const tdx = v.x - ctrlX;
          const tdy = v.y - ctrlY;
          const tdist = Math.hypot(tdx, tdy) || 1;
          tangentX = tdx / tdist;
          tangentY = tdy / tdist;
          arrowTipX = v.x - tangentX * nodeRadius;
          arrowTipY = v.y - tangentY * nodeRadius;
        }

        const angle = Math.atan2(tangentY, tangentX);
        const arrowLen = 11;
        const arrowAngle = Math.PI / 7;

        ctx.save();
        ctx.fillStyle = isPathEdge ? '#f59e0b' : isActiveEdge ? '#38bdf8' : isTreeEdge ? '#818cf8' : isHovered ? '#94a3b8' : '#64748b';
        ctx.beginPath();
        ctx.moveTo(arrowTipX, arrowTipY);
        ctx.lineTo(
          arrowTipX - arrowLen * Math.cos(angle - arrowAngle),
          arrowTipY - arrowLen * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
          arrowTipX - (arrowLen * 0.6) * Math.cos(angle),
          arrowTipY - (arrowLen * 0.6) * Math.sin(angle)
        );
        ctx.lineTo(
          arrowTipX - arrowLen * Math.cos(angle + arrowAngle),
          arrowTipY - arrowLen * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Render edge weight badge
      this.renderEdgeBadge(ctx, badgeX, badgeY, edge.weight, isPathEdge, isActiveEdge);
    }
  }

  renderEdgeBadge(ctx, badgeX, badgeY, weight, isPathEdge, isActiveEdge) {
    const text = String(weight);
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const paddingX = 7;
    const paddingY = 4;
    const badgeW = textWidth + paddingX * 2;
    const badgeH = 18;

    ctx.save();
    ctx.translate(badgeX, badgeY);

    // Pill background
    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 9);
    ctx.fillStyle = isPathEdge ? '#451a03' : isActiveEdge ? '#082f49' : '#0f172a';
    ctx.fill();

    ctx.strokeStyle = isPathEdge ? '#f59e0b' : isActiveEdge ? '#38bdf8' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Weight text
    ctx.fillStyle = isPathEdge ? '#fef08a' : isActiveEdge ? '#bae6fd' : '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  renderNodes(ctx, visitedSet, frontierSet, currentNode, finalPath) {
    const pathNodeSet = new Set(finalPath || []);

    for (const [id, node] of this.graph.nodes.entries()) {
      const isStart = id === this.startNodeId;
      const isGoal = id === this.goalNodeId;
      const isCurrent = id === currentNode;
      const isFrontier = frontierSet.has(id);
      const isVisited = visitedSet.has(id);
      const isPath = pathNodeSet.has(id);
      const isHovered = id === this.hoveredNodeId;
      const isDraftSource = id === this.edgeDraftSource;

      const radius = 22;

      ctx.save();
      ctx.translate(node.x, node.y);

      // Radar pulse for Current Node
      if (isCurrent) {
        const pulseR = radius + 6 + Math.sin(this.pulseAngle * 2) * 5;
        ctx.beginPath();
        ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Outer Glow for Start / Goal / Path
      if (isPath) {
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 18;
      } else if (isStart) {
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 16;
      } else if (isGoal) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 16;
      } else if (isFrontier) {
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10;
      }

      // Circle Base Fill
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);

      let fillColor = this.colors.nodeDefault;
      let strokeColor = this.colors.nodeBorder;
      let strokeWidth = 2.5;

      if (isPath) {
        fillColor = '#78350f';
        strokeColor = '#f59e0b';
        strokeWidth = 3.5;
      } else if (isStart) {
        fillColor = '#064e3b';
        strokeColor = '#10b981';
        strokeWidth = 3;
      } else if (isGoal) {
        fillColor = '#7f1d1d';
        strokeColor = '#ef4444';
        strokeWidth = 3;
      } else if (isCurrent) {
        fillColor = '#0c4a6e';
        strokeColor = '#38bdf8';
        strokeWidth = 3.5;
      } else if (isFrontier) {
        fillColor = '#164e63';
        strokeColor = '#06b6d4';
        strokeWidth = 2.5;
      } else if (isVisited) {
        fillColor = '#312e81';
        strokeColor = '#818cf8';
        strokeWidth = 2;
      }

      if (isDraftSource) {
        strokeColor = '#06b6d4';
        strokeWidth = 4;
      } else if (isHovered && !isPath && !isStart && !isGoal) {
        strokeColor = '#60a5fa';
        strokeWidth = 3;
      }

      ctx.fillStyle = fillColor;
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Node Label Text
      ctx.shadowBlur = 0;
      ctx.fillStyle = isPath ? '#fef08a' : '#ffffff';
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, 0, 0);

      // Start/Goal/Frontier badge pin above node
      if (isStart) {
        this.renderNodePin(ctx, 'START', '#10b981', -radius - 12);
      } else if (isGoal) {
        this.renderNodePin(ctx, 'GOAL', '#ef4444', -radius - 12);
      } else if (isCurrent) {
        this.renderNodePin(ctx, 'ACTIVE', '#38bdf8', -radius - 12);
      } else if (isFrontier) {
        this.renderNodePin(ctx, 'FRONTIER', '#06b6d4', -radius - 12);
      }

      ctx.restore();
    }
  }

  renderNodePin(ctx, text, color, yOffset) {
    ctx.save();
    ctx.font = '900 9px Inter, system-ui, sans-serif';
    const textW = ctx.measureText(text).width;
    const paddingX = 6;
    const pinW = textW + paddingX * 2;
    const pinH = 14;

    ctx.beginPath();
    ctx.roundRect(-pinW / 2, yOffset - pinH / 2, pinW, pinH, 4);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, yOffset);
    ctx.restore();
  }
}

// Global export for browser & testing environments
if (typeof window !== 'undefined') {
  window.Graph = Graph;
  window.Visualizer = Visualizer;
}
if (typeof globalThis !== 'undefined') {
  globalThis.Graph = Graph;
  globalThis.Visualizer = Visualizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Graph, Visualizer };
}
