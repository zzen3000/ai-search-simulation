/**
 * Vercel Serverless Function: /api/gemini
 * Proxies user queries and graph simulation commands to Google Gemini API securely.
 * Reads GEMINI_API_KEY from environment variables so the key is never exposed to the client.
 */

const SYSTEM_INSTRUCTION = `You are the AI Professor and Simulation Copilot embedded inside the "AI Search Simulation Studio".
You specialize in Uninformed Search Algorithms:
1. Breadth-First Search (BFS): Explores level-by-level using a FIFO queue. Hop-optimal on unweighted graphs.
2. Depth-First Search (DFS): Explores deep branches first using a LIFO stack. Memory efficient (O(bm)), but not optimal and can loop in cyclic graphs.
3. Uniform Cost Search (UCS): Explores lowest cumulative path cost g(n) first using a Min-Priority Queue. Cost-optimal for non-negative edge weights.

You can assist the user in three primary ways:
1. ANSWER QUESTIONS: Explain search theory, why certain nodes were expanded or skipped, time/space complexity, etc.
2. CREATE STUDY NOTES: When asked or when creating notes, output a comprehensive, structured Markdown study note with headers, complexity comparisons, insights, and key takeaways based on the user's graph and simulation.
3. SIMULATE & CONTROL: When the user asks you to create, modify, test, or simulate a graph (e.g. "Create a graph where BFS finds 2 hops but UCS finds a cheaper 4-hop path", "Make a 5-node city network", "Simulate DFS on a tree"), provide both an explanation AND an executable simulation JSON block.

When providing an executable simulation action, include a fenced JSON block with "simulation_action" format:
\`\`\`simulation_action
{
  "action": "simulate",
  "explanation": "Brief summary of what was configured",
  "graph": {
    "nodes": [
      { "id": "A", "label": "A", "x": 150, "y": 200 },
      { "id": "B", "label": "B", "x": 350, "y": 100 },
      { "id": "C", "label": "C", "x": 350, "y": 300 },
      { "id": "Goal", "label": "Goal", "x": 550, "y": 200 }
    ],
    "edges": [
      { "from": "A", "to": "B", "weight": 8 },
      { "from": "B", "to": "Goal", "weight": 8 },
      { "from": "A", "to": "C", "weight": 2 },
      { "from": "C", "to": "Goal", "weight": 2 }
    ]
  },
  "algorithm": "UCS",
  "startNode": "A",
  "goalNode": "Goal",
  "autoPlay": true
}
\`\`\`
Ensure node coordinates (x, y) fit comfortably on a canvas: x between 80 and 800, y between 60 and 460. Keep edge weights positive integers.`;

module.exports = async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY environment variable is not configured on the server. Please set GEMINI_API_KEY in your environment or .env file.'
    });
  }

  try {
    const { prompt, history = [], graphContext = {}, mode = 'chat' } = req.body;

    if (!prompt && mode !== 'note') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Contextual prefix describing current canvas graph and simulation state
    let contextDescription = `\n--- CURRENT SIMULATION CONTEXT ---\n`;
    if (graphContext.algorithm) {
      contextDescription += `Selected Algorithm: ${graphContext.algorithm}\n`;
    }
    if (graphContext.startNode && graphContext.goalNode) {
      contextDescription += `Start Node: ${graphContext.startNode}, Goal Node: ${graphContext.goalNode}\n`;
    }
    if (graphContext.nodes && graphContext.nodes.length > 0) {
      contextDescription += `Graph Nodes (${graphContext.nodes.length}): ${graphContext.nodes.map(n => n.label || n.id).join(', ')}\n`;
    }
    if (graphContext.edges && graphContext.edges.length > 0) {
      contextDescription += `Graph Edges (${graphContext.edges.length}): ${graphContext.edges.map(e => `${e.from}↔${e.to}(cost:${e.weight})`).join(', ')}\n`;
    }
    if (graphContext.lastResult) {
      const lr = graphContext.lastResult;
      contextDescription += `Last Simulation Run:\n`;
      contextDescription += ` - Success: ${lr.success}\n`;
      contextDescription += ` - Solution Path: ${lr.path ? lr.path.join(' → ') : 'None'}\n`;
      contextDescription += ` - Total Cost: ${lr.cost !== undefined ? lr.cost : 'N/A'}\n`;
      contextDescription += ` - Nodes Explored: ${lr.nodesExplored || 0}\n`;
      contextDescription += ` - Peak Frontier: ${lr.peakFrontier || 0}\n`;
    }
    contextDescription += `--- END CONTEXT ---\n\n`;

    let userMessageText = '';
    if (mode === 'note') {
      userMessageText = `${contextDescription}Please generate a comprehensive, highly-structured Study Note summarizing this current graph search simulation. Include algorithm comparison, why the solution path was chosen, step highlights, time/space complexity analysis, and key takeaways for an AI student.`;
    } else {
      userMessageText = `${contextDescription}User Request: ${prompt}`;
    }

    // Prepare contents payload for Google Gemini API
    const contents = [];

    // Include conversation history if provided
    if (Array.isArray(history) && history.length > 0) {
      history.slice(-6).forEach(msg => {
        contents.push({
          role: msg.role === 'model' || msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.text || msg.content || '' }]
        });
      });
    }

    // Append current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessageText }]
    });

    // Models supported by Google Gemini API - prioritize active high-availability models
    const models = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.8-flash'
    ];
    let lastError = null;

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents,
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          lastError = errData.error?.message || `HTTP ${response.status} from Gemini API (${model})`;
          continue; // Try next model
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || 'No response received from Gemini.';

        // Parse any simulation action embedded in the text
        let simulationAction = null;
        const actionMatch = text.match(/```simulation_action\s*([\s\S]*?)\s*```/);
        if (actionMatch && actionMatch[1]) {
          try {
            simulationAction = JSON.parse(actionMatch[1]);
          } catch (e) {
            console.error('Failed to parse simulation action JSON:', e);
          }
        }

        return res.status(200).json({
          success: true,
          model: model,
          text: text,
          simulationAction: simulationAction
        });
      } catch (err) {
        lastError = err.message;
      }
    }

    return res.status(500).json({
      error: `Gemini API request failed: ${lastError}`
    });

  } catch (error) {
    console.error('API Error in /api/gemini:', error);
    return res.status(500).json({ error: error.message || 'Internal server error.' });
  }
};
