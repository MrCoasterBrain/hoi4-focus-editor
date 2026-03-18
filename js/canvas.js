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
      deselectAll(); closePanel();
    }
  }
}
function onCanvasMove(e) {
  if (!state.isPanning) return;
  state.panX = state.panOrigin.x + (e.clientX - state.panStart.x);
  state.panY = state.panOrigin.y + (e.clientY - state.panStart.y);
  applyTransform();
}
function onCanvasUp(e) {
  if (e.button === 2 && state.isPanning) {
    state.isPanning = false;
    document.getElementById('canvas-wrap').classList.remove('panning');
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
    state.nodes[state.dragId].x = snap(pos.x - state.dragOffset.x);
    state.nodes[state.dragId].y = snap(pos.y - state.dragOffset.y);
    const el = document.getElementById('node-' + state.dragId);
    if (el) { el.style.left = state.nodes[state.dragId].x + 'px'; el.style.top = state.nodes[state.dragId].y + 'px'; }
    renderAll();
  }
}
function onDragUp() {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragUp);
  if (!state.dragMoved) { selectNode(state.dragId); openFocusPanel(state.dragId); }
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
function selectNode(id) { state.selectedId = id; renderNodes(); }
function deselectAll()  { state.selectedId = null; renderNodes(); }

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