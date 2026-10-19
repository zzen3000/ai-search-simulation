/**
 * Core Search Algorithms for AI Search Simulation
 * Uninformed search algorithms: Breadth-First Search (BFS), Depth-First Search (DFS),
 * and Uniform Cost Search (UCS).
 * 
 * Each algorithm produces a list of step-by-step simulation frames for visualization,
 * allowing scrubbing, stepping backwards/forwards, and live inspection of data structures.
 */

// Priority Queue for UCS with strict alphabetical tie-breaking
class MinPriorityQueue {
  constructor() {
    this.heap = [];
  }

  _compare(a, b) {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const labelA = a.item?.id || a.item?.label || '';
    const labelB = b.item?.id || b.item?.label || '';
    return String(labelA).localeCompare(String(labelB));
  }

  enqueue(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const min = this.heap[0];
    const end = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this._sinkDown(0);
    }
    return min;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  size() {
    return this.heap.length;
  }

  toArray() {
    // Return sorted shallow copy for live inspection
    return [...this.heap].sort((a, b) => this._compare(a, b));
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIndex];
      if (this._compare(element, parent) >= 0) break;
      this.heap[index] = parent;
      index = parentIndex;
    }
    this.heap[index] = element;
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];
    while (true) {
      let leftChildIndex = 2 * index + 1;
      let rightChildIndex = 2 * index + 2;
      let swap = null;

      if (leftChildIndex < length) {
        if (this._compare(this.heap[leftChildIndex], element) < 0) {
          swap = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const compareTarget = swap === null ? element : this.heap[leftChildIndex];
        if (this._compare(this.heap[rightChildIndex], compareTarget) < 0) {
          swap = rightChildIndex;
        }
      }

      if (swap === null) break;
      this.heap[index] = this.heap[swap];
      index = swap;
    }
    this.heap[index] = element;
  }
}

/**
 * Standardized Search Trace Runner
 * Generates an array of UI frames representing the step-by-step search progression.
 */
class SearchEngine {
  /**
   * Run Breadth-First Search (BFS)
   * Queue-based (FIFO). Explores shallowest unvisited nodes first.
   * Guarantees shortest path in unweighted/unit-cost graphs.
   */
  static runBFS(graph, startId, goalId) {
    const frames = [];
    let peakFrontier = 0;

    // Snapshot helper
    const addFrame = (params) => {
      peakFrontier = Math.max(peakFrontier, params.frontier.length);
      frames.push({
        step: frames.length,
        algorithm: 'BFS',
        currentNode: params.currentNode || null,
        activeEdge: params.activeEdge || null,
        visited: Array.from(params.visited),
        frontier: params.frontier.map(f => ({ ...f })), // Shallow copy
        treeEdges: Array.from(params.treeEdges),
        action: params.action || 'STEP',
        message: params.message || '',
        path: params.path || null,
        cost: params.cost || 0,
        isComplete: !!params.isComplete,
        success: !!params.success,
        stats: {
          nodesExplored: params.visited.size,
          frontierSize: params.frontier.length,
          peakFrontier: peakFrontier,
          pathLength: params.path ? params.path.length : 0,
          totalCost: params.cost || 0
        }
      });
    };

    if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
      addFrame({
        visited: new Set(),
        frontier: [],
        treeEdges: new Set(),
        action: 'ERROR',
        message: 'Start or goal node does not exist in graph.',
        isComplete: true,
        success: false
      });
      return frames;
    }

    // Queue entries: { id: string, path: string[], cost: number }
    const queue = [{ id: startId, path: [startId], cost: 0 }];
    const visited = new Set();
    const queuedSet = new Set([startId]);
    const treeEdges = new Set();

    addFrame({
      currentNode: startId,
      visited,
      frontier: queue,
      treeEdges,
      action: 'INIT',
      message: `Initialized BFS. Enqueued start node [${graph.getNodeLabel(startId)}] into FIFO queue.`
    });

    while (queue.length > 0) {
      const currentItem = queue.shift();
      const currentId = currentItem.id;
      const currentPath = currentItem.path;
      const currentCost = currentItem.cost;

      visited.add(currentId);

      addFrame({
        currentNode: currentId,
        visited,
        frontier: queue,
        treeEdges,
        action: 'DEQUEUE',
        message: `Dequeued node [${graph.getNodeLabel(currentId)}] from front of queue.`
      });

      // Goal test
      if (currentId === goalId) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: queue,
          treeEdges,
          path: currentPath,
          cost: currentCost,
          action: 'GOAL_FOUND',
          message: `Goal node [${graph.getNodeLabel(goalId)}] reached! Optimal hop-path found.`,
          isComplete: true,
          success: true
        });
        return frames;
      }

      // Explore neighbors in deterministic order
      const neighbors = graph.getNeighbors(currentId);

      if (neighbors.length === 0) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: queue,
          treeEdges,
          action: 'DEAD_END',
          message: `Node [${graph.getNodeLabel(currentId)}] has no outgoing connections.`
        });
      }

      for (const edge of neighbors) {
        const neighborId = edge.target;
        const edgeWeight = edge.weight || 1;
        const edgeKey = graph.getEdgeKey(currentId, neighborId);

        if (!visited.has(neighborId) && !queuedSet.has(neighborId)) {
          queuedSet.add(neighborId);
          treeEdges.add(edgeKey);
          const nextPath = [...currentPath, neighborId];
          const nextCost = currentCost + edgeWeight;
          queue.push({ id: neighborId, path: nextPath, cost: nextCost });

          addFrame({
            currentNode: currentId,
            activeEdge: [currentId, neighborId],
            visited,
            frontier: queue,
            treeEdges,
            action: 'ENQUEUE',
            message: `Discovered unvisited neighbor [${graph.getNodeLabel(neighborId)}]. Enqueued into FIFO frontier.`
          });
        } else {
          addFrame({
            currentNode: currentId,
            activeEdge: [currentId, neighborId],
            visited,
            frontier: queue,
            treeEdges,
            action: 'SKIP',
            message: `Skipped neighbor [${graph.getNodeLabel(neighborId)}] (already visited or in frontier).`
          });
        }
      }
    }

    addFrame({
      visited,
      frontier: queue,
      treeEdges,
      action: 'NO_PATH',
      message: `Queue exhausted. No path found between [${graph.getNodeLabel(startId)}] and [${graph.getNodeLabel(goalId)}].`,
      isComplete: true,
      success: false
    });

    return frames;
  }

  /**
   * Run Depth-First Search (DFS)
   * Stack-based (LIFO). Explores left/first branch deeply before backtracking.
   */
  static runDFS(graph, startId, goalId) {
    const frames = [];
    let peakFrontier = 0;

    const addFrame = (params) => {
      peakFrontier = Math.max(peakFrontier, params.frontier.length);
      frames.push({
        step: frames.length,
        algorithm: 'DFS',
        currentNode: params.currentNode || null,
        activeEdge: params.activeEdge || null,
        visited: Array.from(params.visited),
        frontier: params.frontier.map(f => ({ ...f })),
        treeEdges: Array.from(params.treeEdges),
        action: params.action || 'STEP',
        message: params.message || '',
        path: params.path || null,
        cost: params.cost || 0,
        isComplete: !!params.isComplete,
        success: !!params.success,
        stats: {
          nodesExplored: params.visited.size,
          frontierSize: params.frontier.length,
          peakFrontier: peakFrontier,
          pathLength: params.path ? params.path.length : 0,
          totalCost: params.cost || 0
        }
      });
    };

    if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
      addFrame({
        visited: new Set(),
        frontier: [],
        treeEdges: new Set(),
        action: 'ERROR',
        message: 'Start or goal node does not exist in graph.',
        isComplete: true,
        success: false
      });
      return frames;
    }

    // Stack entries: { id: string, path: string[], cost: number }
    const stack = [{ id: startId, path: [startId], cost: 0 }];
    const visited = new Set();
    const treeEdges = new Set();

    addFrame({
      currentNode: startId,
      visited,
      frontier: stack,
      treeEdges,
      action: 'INIT',
      message: `Initialized DFS. Pushed start node [${graph.getNodeLabel(startId)}] onto LIFO stack.`
    });

    while (stack.length > 0) {
      const currentItem = stack.pop();
      const currentId = currentItem.id;
      const currentPath = currentItem.path;
      const currentCost = currentItem.cost;

      if (visited.has(currentId)) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: stack,
          treeEdges,
          action: 'SKIP_POPPED',
          message: `Popped [${graph.getNodeLabel(currentId)}], but it was already visited along another branch. Skipping.`
        });
        continue;
      }

      visited.add(currentId);

      addFrame({
        currentNode: currentId,
        visited,
        frontier: stack,
        treeEdges,
        action: 'POP',
        message: `Popped node [${graph.getNodeLabel(currentId)}] from top of stack.`
      });

      // Goal test
      if (currentId === goalId) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: stack,
          treeEdges,
          path: currentPath,
          cost: currentCost,
          action: 'GOAL_FOUND',
          message: `Goal node [${graph.getNodeLabel(goalId)}] reached! DFS path found.`,
          isComplete: true,
          success: true
        });
        return frames;
      }

      // To explore left/first subtrees first in DFS, we push neighbors in reverse order onto the stack
      const neighbors = graph.getNeighbors(currentId);

      if (neighbors.length === 0) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: stack,
          treeEdges,
          action: 'BACKTRACK',
          message: `Dead end at [${graph.getNodeLabel(currentId)}]. Backtracking to previous branch point.`
        });
      }

      // Reverse order so that first neighbor is at the top of the stack
      const reversedNeighbors = [...neighbors].reverse();

      for (const edge of reversedNeighbors) {
        const neighborId = edge.target;
        const edgeWeight = edge.weight || 1;
        const edgeKey = graph.getEdgeKey(currentId, neighborId);

        if (!visited.has(neighborId)) {
          treeEdges.add(edgeKey);
          const nextPath = [...currentPath, neighborId];
          const nextCost = currentCost + edgeWeight;
          stack.push({ id: neighborId, path: nextPath, cost: nextCost });

          addFrame({
            currentNode: currentId,
            activeEdge: [currentId, neighborId],
            visited,
            frontier: stack,
            treeEdges,
            action: 'PUSH',
            message: `Pushed unvisited neighbor [${graph.getNodeLabel(neighborId)}] onto LIFO stack.`
          });
        } else {
          addFrame({
            currentNode: currentId,
            activeEdge: [currentId, neighborId],
            visited,
            frontier: stack,
            treeEdges,
            action: 'SKIP',
            message: `Skipped neighbor [${graph.getNodeLabel(neighborId)}] (cycle prevention / already visited).`
          });
        }
      }
    }

    addFrame({
      visited,
      frontier: stack,
      treeEdges,
      action: 'NO_PATH',
      message: `Stack exhausted. No path found between [${graph.getNodeLabel(startId)}] and [${graph.getNodeLabel(goalId)}].`,
      isComplete: true,
      success: false
    });

    return frames;
  }

  /**
   * Run Uniform Cost Search (UCS)
   * Priority-Queue based (min cumulative path cost g(n)).
   * Guarantees optimal path when edge weights are non-negative.
   */
  static runUCS(graph, startId, goalId) {
    const frames = [];
    let peakFrontier = 0;

    const addFrame = (params) => {
      peakFrontier = Math.max(peakFrontier, params.frontier.length);
      frames.push({
        step: frames.length,
        algorithm: 'UCS',
        currentNode: params.currentNode || null,
        activeEdge: params.activeEdge || null,
        visited: Array.from(params.visited),
        frontier: params.frontier.map(f => ({ ...f })), // Shallow copy
        treeEdges: Array.from(params.treeEdges),
        action: params.action || 'STEP',
        message: params.message || '',
        path: params.path || null,
        cost: params.cost || 0,
        isComplete: !!params.isComplete,
        success: !!params.success,
        stats: {
          nodesExplored: params.visited.size,
          frontierSize: params.frontier.length,
          peakFrontier: peakFrontier,
          pathLength: params.path ? params.path.length : 0,
          totalCost: params.cost || 0
        }
      });
    };

    if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
      addFrame({
        visited: new Set(),
        frontier: [],
        treeEdges: new Set(),
        action: 'ERROR',
        message: 'Start or goal node does not exist in graph.',
        isComplete: true,
        success: false
      });
      return frames;
    }

    const pq = new MinPriorityQueue();
    // Element: { id: string, path: string[], cost: number }
    pq.enqueue({ id: startId, path: [startId], cost: 0 }, 0);

    const visited = new Set();
    const bestCostToNode = new Map();
    bestCostToNode.set(startId, 0);
    const treeEdges = new Set();

    const getPqFrontierList = () => {
      return pq.toArray().map(entry => ({
        id: entry.item.id,
        path: entry.item.path,
        cost: entry.priority
      }));
    };

    addFrame({
      currentNode: startId,
      visited,
      frontier: getPqFrontierList(),
      treeEdges,
      cost: 0,
      action: 'INIT',
      message: `Initialized UCS. Enqueued [${graph.getNodeLabel(startId)}] with initial cost g=0 into Min-Priority Queue.`
    });

    while (!pq.isEmpty()) {
      const minEntry = pq.dequeue();
      const currentItem = minEntry.item;
      const currentPriority = minEntry.priority;
      const currentId = currentItem.id;
      const currentPath = currentItem.path;

      // In UCS graph search, if node already expanded with a lower or equal cost, skip
      if (visited.has(currentId)) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: getPqFrontierList(),
          treeEdges,
          cost: currentPriority,
          action: 'SKIP_SUBOPTIMAL',
          message: `Dequeued [${graph.getNodeLabel(currentId)}] (cost: ${currentPriority}), but already expanded with optimal cost. Skipping.`
        });
        continue;
      }

      visited.add(currentId);

      addFrame({
        currentNode: currentId,
        visited,
        frontier: getPqFrontierList(),
        treeEdges,
        cost: currentPriority,
        action: 'DEQUEUE_MIN',
        message: `Extracted minimum cost node [${graph.getNodeLabel(currentId)}] with g(n) = ${currentPriority}.`
      });

      // CRITICAL: Goal test is performed when node is popped from priority queue!
      if (currentId === goalId) {
        addFrame({
          currentNode: currentId,
          visited,
          frontier: getPqFrontierList(),
          treeEdges,
          path: currentPath,
          cost: currentPriority,
          action: 'GOAL_FOUND',
          message: `Goal node [${graph.getNodeLabel(goalId)}] expanded! Proven lowest cumulative cost path: ${currentPriority}.`,
          isComplete: true,
          success: true
        });
        return frames;
      }

      const neighbors = graph.getNeighbors(currentId);

      for (const edge of neighbors) {
        const neighborId = edge.target;
        const edgeWeight = Number(edge.weight) || 1;
        const newCost = currentPriority + edgeWeight;
        const edgeKey = graph.getEdgeKey(currentId, neighborId);

        const currentBest = bestCostToNode.get(neighborId);

        if (!visited.has(neighborId)) {
          if (currentBest === undefined || newCost < currentBest) {
            bestCostToNode.set(neighborId, newCost);
            treeEdges.add(edgeKey);
            const nextPath = [...currentPath, neighborId];
            pq.enqueue({ id: neighborId, path: nextPath, cost: newCost }, newCost);

            addFrame({
              currentNode: currentId,
              activeEdge: [currentId, neighborId],
              visited,
              frontier: getPqFrontierList(),
              treeEdges,
              cost: currentPriority,
              action: 'ENQUEUE_COST',
              message: `Evaluated [${graph.getNodeLabel(neighborId)}]: path cost g = ${currentPriority} + ${edgeWeight} = ${newCost}. Added to Priority Queue.`
            });
          } else {
            addFrame({
              currentNode: currentId,
              activeEdge: [currentId, neighborId],
              visited,
              frontier: getPqFrontierList(),
              treeEdges,
              cost: currentPriority,
              action: 'SKIP_WORSE',
              message: `Evaluated [${graph.getNodeLabel(neighborId)}]: path cost ${newCost} is worse than known cost ${currentBest}. Skipped.`
            });
          }
        } else {
          addFrame({
            currentNode: currentId,
            activeEdge: [currentId, neighborId],
            visited,
            frontier: getPqFrontierList(),
            treeEdges,
            cost: currentPriority,
            action: 'SKIP_VISITED',
            message: `Neighbor [${graph.getNodeLabel(neighborId)}] already expanded in closed set.`
          });
        }
      }
    }

    addFrame({
      visited,
      frontier: [],
      treeEdges,
      action: 'NO_PATH',
      message: `Priority queue exhausted. No path found between [${graph.getNodeLabel(startId)}] and [${graph.getNodeLabel(goalId)}].`,
      isComplete: true,
      success: false
    });

    return frames;
  }

  /**
   * Generates formatted traces and table data specifically structured for Assignment 1
   */
  static generateAssignmentReport(graph, startId = 'S', goalId = 'G') {
    const bfsFrames = this.runBFS(graph, startId, goalId);
    const dfsFrames = this.runDFS(graph, startId, goalId);
    const ucsFrames = this.runUCS(graph, startId, goalId);

    const bfsExpanded = bfsFrames.filter(f => f.action === 'DEQUEUE').map(f => graph.getNodeLabel(f.currentNode));
    const bfsResult = bfsFrames[bfsFrames.length - 1];

    const dfsExpanded = dfsFrames.filter(f => f.action === 'POP').map(f => graph.getNodeLabel(f.currentNode));
    const dfsResult = dfsFrames[dfsFrames.length - 1];

    // UCS Steps: filter to when nodes are dequeued
    const ucsActions = ucsFrames.filter(f => f.action === 'DEQUEUE_MIN' || f.action === 'SKIP_SUBOPTIMAL' || f.action === 'GOAL_FOUND');
    const filteredSteps = [];
    
    for (const frame of ucsActions) {
      if (frame.action === 'GOAL_FOUND') {
        if (filteredSteps.length > 0 && filteredSteps[filteredSteps.length - 1].currentNode === frame.currentNode) {
          filteredSteps[filteredSteps.length - 1].isGoal = true;
          continue;
        }
      }
      filteredSteps.push(frame);
    }

    const ucsTable = [];
    for (let i = 0; i < filteredSteps.length; i++) {
      const curFrame = filteredSteps[i];
      const isSkip = curFrame.action === 'SKIP_SUBOPTIMAL';
      const isGoal = curFrame.isGoal || curFrame.action === 'GOAL_FOUND';

      let frontierAfter = [];
      const curIndex = ucsFrames.indexOf(curFrame);
      let nextDeqIndex = ucsFrames.length - 1;
      for (let j = curIndex + 1; j < ucsFrames.length; j++) {
        if (ucsFrames[j].action === 'DEQUEUE_MIN' || ucsFrames[j].action === 'SKIP_SUBOPTIMAL' || ucsFrames[j].action === 'GOAL_FOUND') {
          nextDeqIndex = j - 1;
          break;
        }
      }
      frontierAfter = ucsFrames[nextDeqIndex].frontier.map(item => `${graph.getNodeLabel(item.id)}(${item.cost})`);

      ucsTable.push({
        step: i + 1,
        node: `${graph.getNodeLabel(curFrame.currentNode)} (${curFrame.cost})`,
        action: isSkip ? 'Skip' : isGoal ? 'Goal (Stop)' : 'Expand',
        frontier: frontierAfter.length > 0 ? frontierAfter.join(', ') : 'Empty'
      });
    }

    const ucsResult = ucsFrames[ucsFrames.length - 1];
    const ucsExpanded = filteredSteps.filter(f => f.action !== 'SKIP_SUBOPTIMAL').map(f => graph.getNodeLabel(f.currentNode));

    return {
      bfs: {
        expansionOrder: bfsExpanded,
        path: bfsResult.path ? bfsResult.path.map(id => graph.getNodeLabel(id)) : [],
        cost: bfsResult.cost
      },
      dfs: {
        expansionOrder: dfsExpanded,
        path: dfsResult.path ? dfsResult.path.map(id => graph.getNodeLabel(id)) : [],
        cost: dfsResult.cost
      },
      ucs: {
        table: ucsTable,
        expansionOrder: ucsExpanded,
        path: ucsResult.path ? ucsResult.path.map(id => graph.getNodeLabel(id)) : [],
        cost: ucsResult.cost
      }
    };
  }
}

// Global export for browser & testing environments
if (typeof window !== 'undefined') {
  window.SearchEngine = SearchEngine;
  window.MinPriorityQueue = MinPriorityQueue;
}
if (typeof globalThis !== 'undefined') {
  globalThis.SearchEngine = SearchEngine;
  globalThis.MinPriorityQueue = MinPriorityQueue;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SearchEngine, MinPriorityQueue };
}
