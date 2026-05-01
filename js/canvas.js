// js/canvas.js

function setupCanvas() {
  const wrap = document.getElementById('canvas-wrap');
  wrap.addEventListener('mousedown', onCanvasDown);
  wrap.addEventListener('mousemove', onCanvasMove);
  wrap.addEventListener('mouseup',   onCanvasUp);
  wrap.addEventListener('wheel', onWheel, { passive: false });
  wrap.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', onKeyDown);
}

// ── Pan ───────────────────────────────────────────────────────
function onCanvasDown(e) {
  if (e.button === 2) {
    state.isPanning  = true;
    state.panStart   = { x: e.clientX, y: e.clientY };
    state.panOrigin  = { x: state.panX, y: state.panY };
    document.getElementById('canvas-wrap').classList.add('panning');
    e.preventDefault();
    return;
  }
  if (e.button === 0) {
    const t = e.target;
    if (t.id === 'canvas-wrap' || t.id === 'world' || t.id === 'svg-layer') {
      // Start rectangular selection
      const worldPos = screenToWorld(e.clientX, e.clientY);
      state.rectSelecting = true;
      state.rectStart = { x: worldPos.x, y: worldPos.y };
      state.rectEnd = { x: worldPos.x, y: worldPos.y };
      // Don't deselect yet - will do on mouseup if no movement
    }
  }
}
function onCanvasMove(e) {
  if (state.isPanning) {
    state.panX = state.panOrigin.x + (e.clientX - state.panStart.x);
    state.panY = state.panOrigin.y + (e.clientY - state.panStart.y);
    applyTransform();
  }
  if (state.rectSelecting) {
    const worldPos = screenToWorld(e.clientX, e.clientY);
    state.rectEnd = { x: worldPos.x, y: worldPos.y };
    renderRectSelection();
    // Update selection in real-time
    updateRectSelection();
  }
}
function onCanvasUp(e) {
  if (e.button === 2 && state.isPanning) {
    state.isPanning = false;
    document.getElementById('canvas-wrap').classList.remove('panning');
  }
  if (e.button === 0 && state.rectSelecting) {
    state.rectSelecting = false;
    const dx = Math.abs(state.rectEnd.x - state.rectStart.x);
    const dy = Math.abs(state.rectEnd.y - state.rectStart.y);
    // If very small movement, treat as click (deselect)
    if (dx < 5 && dy < 5) {
      deselectAll();
      closePanel();
    }
    removeRectOverlay();
    renderNodes();
  }
}

// ── Zoom ──────────────────────────────────────────────────────
function onWheel(e) {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 0.89;
  const rect = document.getElementById('canvas-wrap').getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  const nz = Math.max(0.15, Math.min(3, state.zoom * f));
  state.panX = mx - (mx - state.panX) * (nz / state.zoom);
  state.panY = my - (my - state.panY) * (nz / state.zoom);
  state.zoom = nz;
  applyTransform();
}

function applyTransform() {
  document.getElementById('world').style.transform =
    `translate(${state.panX}px,${state.panY}px) scale(${state.zoom})`;
  document.getElementById('zoom-indicator').textContent = Math.round(state.zoom * 100) + '%';
}

function screenToWorld(sx, sy) {
  const r = document.getElementById('canvas-wrap').getBoundingClientRect();
  return { x: (sx - r.left - state.panX) / state.zoom, y: (sy - r.top - state.panY) / state.zoom };
}

function resetView() { state.zoom = 1; state.panX = 120; state.panY = 120; applyTransform(); }

// ── Node drag/click ───────────────────────────────────────────
function onNodeMouseDown(e, id) {
  if (e.button === 2) { e.stopPropagation(); return; }
  e.stopPropagation();

  // If clicking on a node that's not in the current selection, reset selection to just this node
  // (Shift-click to add to selection could be added later)
  if (!state.selectedIds.includes(id)) {
    state.selectedIds = [id];
    state.selectedId = id;
    renderNodes();
  }

  state.dragId     = id;
  state.dragMoved  = false;
  state.dragStart0 = { x: e.clientX, y: e.clientY };
  const pos = screenToWorld(e.clientX, e.clientY);
  state.dragOffset = { x: pos.x - state.nodes[id].x, y: pos.y - state.nodes[id].y };
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragUp);
}
function onDragMove(e) {
  if (!state.dragId) return;
  if (Math.abs(e.clientX - state.dragStart0.x) > 4 || Math.abs(e.clientY - state.dragStart0.y) > 4)
    state.dragMoved = true;
  if (state.dragMoved) {
    const pos = screenToWorld(e.clientX, e.clientY);
    const newX = snap(pos.x - state.dragOffset.x);
    const newY = snap(pos.y - state.dragOffset.y);

    // Calculate delta from current position
    const dx = newX - state.nodes[state.dragId].x;
    const dy = newY - state.nodes[state.dragId].y;

    // Move all selected nodes by the same delta
    state.selectedIds.forEach(nodeId => {
      if (state.nodes[nodeId]) {
        state.nodes[nodeId].x += dx;
        state.nodes[nodeId].y += dy;
      }
    });

    // Update DOM positions for all selected nodes
    state.selectedIds.forEach(nodeId => {
      const el = document.getElementById('node-' + nodeId);
      if (el) {
        el.style.left = state.nodes[nodeId].x + 'px';
        el.style.top = state.nodes[nodeId].y + 'px';
      }
    });

    renderAll();
  }
}
function onDragUp() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragUp);
  if (!state.dragMoved) {
    selectNode(state.dragId);
    openFocusPanel(state.dragId);
  } else {
    // After drag, ensure selectedId is set to the dragged node
    state.selectedId = state.dragId;
    renderNodes();
  }
  state.dragId = null;
}

function onNodeRightClick(e, id) {
  e.preventDefault(); e.stopPropagation();
  state.ctxNodeId = id;
  showCtxMenu(e.clientX, e.clientY);
}

function onAddChildClicked(parentId) {
  const id = addChildNode(parentId);
  if (id) { renderAll(); selectNode(id); openFocusPanel(id); }
}

// ── Keyboard ──────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedId) { deleteNode(state.selectedId); state.selectedId = null; closePanel(); renderAll(); }
  }
  if (e.key === 'Escape') { deselectAll(); closePanel(); closeCtxMenu(); }
}

// ── Selection helpers ─────────────────────────────────────────
function selectNode(id) {
  state.selectedId = id;
  state.selectedIds = [id];
  renderNodes();
}
function deselectAll() {
  state.selectedId = null;
  state.selectedIds = [];
  renderNodes();
}

// ── Rectangular selection ─────────────────────────────────────
function renderRectSelection() {
  let overlay = document.getElementById('rect-select-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'rect-select-overlay';
    document.getElementById('world').appendChild(overlay);
  }
  const x1 = Math.min(state.rectStart.x, state.rectEnd.x);
  const y1 = Math.min(state.rectStart.y, state.rectEnd.y);
  const x2 = Math.max(state.rectStart.x, state.rectEnd.x);
  const y2 = Math.max(state.rectStart.y, state.rectEnd.y);
  overlay.style.left = x1 + 'px';
  overlay.style.top = y1 + 'px';
  overlay.style.width = (x2 - x1) + 'px';
  overlay.style.height = (y2 - y1) + 'px';
  overlay.style.display = 'block';
}

function removeRectOverlay() {
  const overlay = document.getElementById('rect-select-overlay');
  if (overlay) overlay.remove();
}

function updateRectSelection() {
  const x1 = Math.min(state.rectStart.x, state.rectEnd.x);
  const y1 = Math.min(state.rectStart.y, state.rectEnd.y);
  const x2 = Math.max(state.rectStart.x, state.rectEnd.x);
  const y2 = Math.max(state.rectStart.y, state.rectEnd.y);

  // Skip if too small
  if (x2 - x1 < 5 && y2 - y1 < 5) return;

  const newSelected = [];
  Object.values(state.nodes).forEach(n => {
    if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) {
      newSelected.push(n.id);
    }
  });

  state.selectedIds = newSelected;
  // Set selectedId to the first one for panel display
  if (newSelected.length > 0) {
    state.selectedId = newSelected[0];
  } else {
    state.selectedId = null;
  }
  renderNodes();
}

// ── Multi-drag support ────────────────────────────────────────
// ── Add root focus (toolbar button) ──────────────────────────
function addRootFocus() {
  // Place near viewport center in world space
  const wrap = document.getElementById('canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  const cx = (rect.width  / 2 - state.panX) / state.zoom;
  const cy = (rect.height / 2 - state.panY) / state.zoom;
  const id  = makeNode(snap(cx), snap(cy));
  renderAll(); selectNode(id); openFocusPanel(id);
}