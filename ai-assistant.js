/**
 * AI Assistant & Study Notes Controller (Google Gemini Integration)
 * Enables natural language Q&A, automatic study note generation,
 * and agentic graph creation / simulation control.
 */

class AIAssistant {
  constructor(visualizer) {
    this.visualizer = visualizer;
    this.history = [];
    this.notes = this.loadNotes();
    this.clientApiKey = localStorage.getItem('gemini_client_api_key') || '';
    this.isOpen = false;
    this.currentTab = 'chat'; // 'chat' | 'notes' | 'settings'

    this.initDOM();
    this.bindEvents();
    this.renderNotesList();
  }

  loadNotes() {
    try {
      const saved = localStorage.getItem('ai_search_study_notes');
      return saved ? JSON.parse(saved) : this.getDefaultNotes();
    } catch (e) {
      return this.getDefaultNotes();
    }
  }

  saveNotes() {
    try {
      localStorage.setItem('ai_search_study_notes', JSON.stringify(this.notes));
    } catch (e) {
      console.error('Failed to save notes to localStorage:', e);
    }
  }

  getDefaultNotes() {
    return [
      {
        id: 'note_default_1',
        title: 'Introduction to Uninformed Search Strategies',
        timestamp: new Date().toISOString(),
        content: `### Core Uninformed Search Overview

Uninformed (blind) search algorithms operate without heuristic hints about goal proximity.

#### 1. Breadth-First Search (BFS)
- **Frontier:** FIFO Queue
- **Completeness:** Yes (if branching factor $b$ is finite)
- **Hop-Optimality:** Yes (finds shallowest solution)
- **Cost-Optimality:** Only if all step costs are equal
- **Time & Space Complexity:** $O(b^d)$ (high memory consumption)

#### 2. Depth-First Search (DFS)
- **Frontier:** LIFO Stack
- **Completeness:** No in cyclic or infinite graphs
- **Optimality:** No
- **Time Complexity:** $O(b^m)$
- **Space Complexity:** $O(b \\cdot m)$ (linear memory efficiency)

#### 3. Uniform Cost Search (UCS)
- **Frontier:** Min-Priority Queue ordered by cumulative path cost $g(n)$
- **Completeness:** Yes (if step costs $\\ge \\epsilon > 0$)
- **Cost-Optimality:** Yes (always finds minimum total cost)
- **Goal Test Rule:** Crucial — goal test must occur upon *dequeue*, not generation!`
      }
    ];
  }

  initDOM() {
    // Drawer element references
    this.drawer = document.getElementById('ai-copilot-drawer');
    this.chatMessagesContainer = document.getElementById('ai-chat-messages');
    this.chatInput = document.getElementById('ai-chat-input');
    this.sendBtn = document.getElementById('ai-send-btn');
    this.notesContainer = document.getElementById('ai-notes-list');
    this.noteDetailModal = document.getElementById('ai-note-detail-modal');
  }

  bindEvents() {
    // Toggle Drawer Button
    const toggleBtn = document.getElementById('ai-copilot-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleDrawer());
    }

    const closeBtn = document.getElementById('ai-drawer-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    // Tab buttons
    document.querySelectorAll('.ai-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Chat Send
    if (this.sendBtn && this.chatInput) {
      this.sendBtn.addEventListener('click', () => this.handleSendMessage());
      this.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    // Quick Prompt Suggestions
    document.querySelectorAll('.quick-prompt-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (this.chatInput) {
          this.chatInput.value = pill.textContent.trim().replace(/^💡|🧪|🌲|📝/, '').trim();
          this.handleSendMessage();
        }
      });
    });

    // Generate Note Button
    const genNoteBtn = document.getElementById('ai-gen-note-btn');
    if (genNoteBtn) {
      genNoteBtn.addEventListener('click', () => this.handleGenerateNote());
    }

    // Client API Key Input
    const keyInput = document.getElementById('client-api-key-input');
    const saveKeyBtn = document.getElementById('save-api-key-btn');
    if (keyInput && saveKeyBtn) {
      keyInput.value = this.clientApiKey;
      saveKeyBtn.addEventListener('click', () => {
        this.clientApiKey = keyInput.value.trim();
        localStorage.setItem('gemini_client_api_key', this.clientApiKey);
        alert('API Key preference saved locally.');
      });
    }
  }

  toggleDrawer() {
    this.isOpen = !this.isOpen;
    if (this.drawer) {
      this.drawer.classList.toggle('open', this.isOpen);
    }
  }

  closeDrawer() {
    this.isOpen = false;
    if (this.drawer) {
      this.drawer.classList.remove('open');
    }
  }

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.ai-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.querySelectorAll('.ai-tab-content').forEach(pane => {
      pane.classList.toggle('active', pane.dataset.pane === tab);
    });
  }

  getSimulationContext() {
    const visualizer = this.visualizer;
    if (!visualizer || !visualizer.graph) return {};

    const nodes = [];
    for (const [id, node] of visualizer.graph.nodes.entries()) {
      nodes.push({ id, label: node.label, x: node.x, y: node.y });
    }

    const edges = [];
    for (const edge of visualizer.graph.edges.values()) {
      edges.push({ from: edge.from, to: edge.to, weight: edge.weight, directed: edge.directed });
    }

    const lastFrame = visualizer.frames && visualizer.frames.length > 0 
      ? visualizer.frames[visualizer.frames.length - 1] 
      : null;

    return {
      algorithm: visualizer.selectedAlgorithm,
      startNode: visualizer.startNodeId ? visualizer.graph.getNodeLabel(visualizer.startNodeId) : null,
      goalNode: visualizer.goalNodeId ? visualizer.graph.getNodeLabel(visualizer.goalNodeId) : null,
      nodes,
      edges,
      lastResult: lastFrame ? {
        success: lastFrame.success,
        path: lastFrame.path ? lastFrame.path.map(id => visualizer.graph.getNodeLabel(id)) : null,
        cost: lastFrame.cost,
        nodesExplored: lastFrame.stats ? lastFrame.stats.nodesExplored : 0,
        peakFrontier: lastFrame.stats ? lastFrame.stats.peakFrontier : 0
      } : null
    };
  }

  async handleSendMessage() {
    const text = this.chatInput ? this.chatInput.value.trim() : '';
    if (!text) return;

    this.chatInput.value = '';
    this.appendMessage('user', text);

    const loadingId = this.appendLoadingMessage();

    try {
      const graphContext = this.getSimulationContext();
      const payload = {
        prompt: text,
        history: this.history,
        graphContext: graphContext,
        mode: 'chat'
      };

      const response = await this.callGeminiAPI(payload);
      this.removeLoadingMessage(loadingId);

      if (response.error) {
        this.appendMessage('assistant', `⚠️ **Error:** ${response.error}`);
        return;
      }

      this.history.push({ role: 'user', text: text });
      this.history.push({ role: 'model', text: response.text });

      // Clean display text (strip out raw simulation_action JSON blocks from chat view)
      const cleanText = response.text.replace(/```simulation_action[\s\S]*?```/g, '').trim();
      this.appendMessage('assistant', cleanText || 'I have configured and started the simulation for you!');

      // Check if Gemini generated a simulation action
      if (response.simulationAction) {
        this.executeSimulationAction(response.simulationAction);
      }

    } catch (err) {
      this.removeLoadingMessage(loadingId);
      this.appendMessage('assistant', `⚠️ **Network / Server Error:** ${err.message}. Ensure the backend server is running.`);
    }
  }

  async handleGenerateNote() {
    this.switchTab('chat');
    this.appendMessage('user', '📝 Generate a structured study note from the current simulation run.');
    const loadingId = this.appendLoadingMessage();

    try {
      const graphContext = this.getSimulationContext();
      const payload = {
        prompt: 'Generate a comprehensive study note for this search simulation.',
        graphContext: graphContext,
        mode: 'note'
      };

      const response = await this.callGeminiAPI(payload);
      this.removeLoadingMessage(loadingId);

      if (response.error) {
        this.appendMessage('assistant', `⚠️ **Error:** ${response.error}`);
        return;
      }

      // Save note to study notebook
      const algo = this.visualizer.selectedAlgorithm || 'Search';
      const noteTitle = `${algo} Simulation Analysis — ${new Date().toLocaleDateString()}`;
      const newNote = {
        id: 'note_' + Date.now(),
        title: noteTitle,
        timestamp: new Date().toISOString(),
        content: response.text
      };

      this.notes.unshift(newNote);
      this.saveNotes();
      this.renderNotesList();

      this.appendMessage('assistant', `✅ **Study Note Generated!**\nSaved **"${noteTitle}"** to your Study Notes tab. You can view, copy, or export it as Markdown.`);
      
    } catch (err) {
      this.removeLoadingMessage(loadingId);
      this.appendMessage('assistant', `⚠️ **Error generating note:** ${err.message}`);
    }
  }

  async callGeminiAPI(payload) {
    // 1. Try backend serverless endpoint first
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        return await res.json();
      }

      const errJson = await res.json().catch(() => ({}));

      // If backend reports no API key configured, and client key is present, try direct call
      if (errJson.error && errJson.error.includes('GEMINI_API_KEY') && this.clientApiKey) {
        return await this.callDirectGeminiClient(payload);
      }

      return { error: errJson.error || `HTTP ${res.status}` };
    } catch (fetchErr) {
      // If server is not reachable, fallback to direct client call if key exists
      if (this.clientApiKey) {
        return await this.callDirectGeminiClient(payload);
      }
      throw fetchErr;
    }
  }

  async callDirectGeminiClient(payload) {
    const apiKey = this.clientApiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    
    const contents = [
      {
        role: 'user',
        parts: [{ text: `Simulation Context: ${JSON.stringify(payload.graphContext)}\n\nUser: ${payload.prompt}` }]
      }
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await res.json();
    if (!res.ok) {
      return { error: data.error?.message || 'Direct Gemini call failed' };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let simulationAction = null;
    const actionMatch = text.match(/```simulation_action\s*([\s\S]*?)\s*```/);
    if (actionMatch && actionMatch[1]) {
      try {
        simulationAction = JSON.parse(actionMatch[1]);
      } catch (e) {}
    }

    return { success: true, text, simulationAction };
  }

  executeSimulationAction(actionData) {
    if (!actionData || !actionData.graph) return;

    const visualizer = this.visualizer;
    visualizer.pause();
    visualizer.graph.clear();

    // Add Nodes
    if (Array.isArray(actionData.graph.nodes)) {
      actionData.graph.nodes.forEach(n => {
        visualizer.graph.addNode(n.id, n.label || n.id, n.x || 300, n.y || 200);
      });
    }

    // Add Edges
    if (Array.isArray(actionData.graph.edges)) {
      actionData.graph.edges.forEach(e => {
        visualizer.graph.addEdge(e.from, e.to, e.weight || 1);
      });
    }

    // Set Start & Goal
    if (actionData.startNode) {
      visualizer.startNodeId = actionData.startNode;
    }
    if (actionData.goalNode) {
      visualizer.goalNodeId = actionData.goalNode;
    }

    // Set Algorithm
    if (actionData.algorithm) {
      visualizer.setAlgorithm(actionData.algorithm);
      // Update Tab UI
      document.querySelectorAll('.algo-tab').forEach(tab => {
        const isActive = tab.dataset.algo === actionData.algorithm;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    } else {
      visualizer.recomputeSearch();
    }

    visualizer.centerGraph();

    if (actionData.autoPlay) {
      setTimeout(() => visualizer.play(), 600);
    }

    visualizer.updateStatusBanner(`✨ Gemini AI loaded custom graph scenario: ${actionData.explanation || 'New simulation started'}`);
  }

  appendMessage(role, text) {
    if (!this.chatMessagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `ai-chat-msg ${role}`;

    const avatar = role === 'user' ? '👤' : '✨';
    const sender = role === 'user' ? 'You' : 'Gemini Copilot';

    msgDiv.innerHTML = `
      <div class="msg-header">
        <span class="msg-avatar">${avatar}</span>
        <span class="msg-sender">${sender}</span>
      </div>
      <div class="msg-body">${this.renderMarkdown(text)}</div>
    `;

    this.chatMessagesContainer.appendChild(msgDiv);
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
  }

  appendLoadingMessage() {
    if (!this.chatMessagesContainer) return null;
    const loadingId = 'loading_' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingId;
    loadingDiv.className = 'ai-chat-msg assistant loading';
    loadingDiv.innerHTML = `
      <div class="msg-header">
        <span class="msg-avatar">✨</span>
        <span class="msg-sender">Gemini Copilot</span>
      </div>
      <div class="msg-body">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    this.chatMessagesContainer.appendChild(loadingDiv);
    this.chatMessagesContainer.scrollTop = this.chatMessagesContainer.scrollHeight;
    return loadingId;
  }

  removeLoadingMessage(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  renderNotesList() {
    if (!this.notesContainer) return;

    if (this.notes.length === 0) {
      this.notesContainer.innerHTML = '<div class="notes-empty">No study notes yet. Click "Generate Note" or ask Gemini in chat!</div>';
      return;
    }

    this.notesContainer.innerHTML = this.notes.map(note => {
      const dateStr = new Date(note.timestamp).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      return `
        <div class="note-card" data-id="${note.id}">
          <div class="note-card-header">
            <h4 class="note-card-title">${note.title}</h4>
            <span class="note-card-date">${dateStr}</span>
          </div>
          <div class="note-card-preview">${note.content.slice(0, 140)}...</div>
          <div class="note-card-actions">
            <button class="note-action-btn view" onclick="window.aiAssistant.openNoteModal('${note.id}')">📖 Read</button>
            <button class="note-action-btn copy" onclick="window.aiAssistant.copyNote('${note.id}')">📋 Copy</button>
            <button class="note-action-btn download" onclick="window.aiAssistant.downloadNote('${note.id}')">💾 Export</button>
            <button class="note-action-btn delete" onclick="window.aiAssistant.deleteNote('${note.id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  openNoteModal(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note || !this.noteDetailModal) return;

    const modalTitle = document.getElementById('note-modal-title');
    const modalBody = document.getElementById('note-modal-body');

    if (modalTitle) modalTitle.textContent = note.title;
    if (modalBody) modalBody.innerHTML = this.renderMarkdown(note.content);

    this.noteDetailModal.classList.add('open');
  }

  closeNoteModal() {
    if (this.noteDetailModal) {
      this.noteDetailModal.classList.remove('open');
    }
  }

  copyNote(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;
    navigator.clipboard.writeText(note.content).then(() => {
      alert('Note copied to clipboard!');
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  }

  downloadNote(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;
    const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  deleteNote(noteId) {
    if (confirm('Delete this study note?')) {
      this.notes = this.notes.filter(n => n.id !== noteId);
      this.saveNotes();
      this.renderNotesList();
    }
  }

  // Lightweight safe markdown renderer
  renderMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/### (.*?)\n/g, '<h3>$1</h3>')
      .replace(/## (.*?)\n/g, '<h2>$1</h2>')
      .replace(/# (.*?)\n/g, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n/g, '<br>');
    return html;
  }
}

if (typeof window !== 'undefined') {
  window.AIAssistant = AIAssistant;
}
