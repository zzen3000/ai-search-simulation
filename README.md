Core Search Algorithms
Uninformed search algorithms process state space graphs blindly without heuristic hints. Implement these three primary traversal methods to generate an ordered array of visited nodes:

1. Breadth-First Search (BFS): Processes all nodes above the shallowest solution using a FIFO queue.
2. Depth-First Search (DFS): Traverses through the left subtree(s) first before moving right, utilizing a LIFO stack.
3. Uniform Cost Search (UCS): Expands nodes based on the lowest cumulative path cost using a priority queue, ensuring optimal paths are found when step costs vary.
