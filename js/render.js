// js/render.js

function renderAll() { renderBoundary(); renderCF(); renderEdges(); renderNodes(); }

// ── Tree boundary ─────────────────────────────────────────────
// Nodes are centered at their (x,y) with transform: translate(-50%,-50%).
// A node at (0,0) has its icon spanning from -60px to +60px in each axis.
// We offset the boundary by -NODE_HALF so the node at grid (0,0) is fully inside.
const NODE_HALF = 60; // half of node visual size (icon 96px + label, generous margin)

function renderBoundary() {
  let el = document.getElementById('tree-boundary');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tree-boundary';
    // Corner label
    const corner = document.createElement('div');
    corner.className = 'boundary-origin-label';
    corner.textContent = '0,0';
    el.appendChild(corner);
    document.getElementById('world').appendChild(el);
  }
  // Start the boundary half a node-size before world origin so (0,0) node sits inside
  const ox = -NODE_HALF;
  const oy = -NODE_HALF;
  el.style.left   = ox + 'px';
  el.style.top    = oy + 'px';
  el.style.width  = (7800 - ox) + 'px';
  el.style.height = (5800 - oy) + 'px';
}

// ── Continuous Focus zone ─────────────────────────────────────
function renderCF() {
  let el = document.getElementById('cf-zone');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cf-zone';
    el.innerHTML = '<div class="cf-label">CONTINUOUS FOCUS</div>';
    document.getElementById('world').appendChild(el);
  }
  el.style.left = state.treeMeta.cfX + 'px';
  el.style.top  = state.treeMeta.cfY + 'px';

  el.onmousedown = e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    state.cfDragging  = true;
    state.cfDragStart = { x: e.clientX, y: e.clientY };
    state.cfOrigin    = { x: state.treeMeta.cfX, y: state.treeMeta.cfY };
    document.addEventListener('mousemove', onCFDragMove);
    document.addEventListener('mouseup',   onCFDragUp);
  };
}

function onCFDragMove(e) {
  if (!state.cfDragging) return;
  state.treeMeta.cfX = Math.round(state.cfOrigin.x + (e.clientX - state.cfDragStart.x) / state.zoom);
  state.treeMeta.cfY = Math.round(state.cfOrigin.y + (e.clientY - state.cfDragStart.y) / state.zoom);
  const el = document.getElementById('cf-zone');
  if (el) { el.style.left = state.treeMeta.cfX + 'px'; el.style.top = state.treeMeta.cfY + 'px'; }
  syncTreePanel();
}
function onCFDragUp() {
  state.cfDragging = false;
  document.removeEventListener('mousemove', onCFDragMove);
  document.removeEventListener('mouseup',   onCFDragUp);
}

// ── SVG edges ─────────────────────────────────────────────────
function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

function renderEdges() {
  const svg = document.getElementById('svg-layer');
  svg.innerHTML = `<defs>
    <marker id="arr"     markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#4a3a20"/>
    </marker>
    <marker id="arr-bad" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#8b2020"/>
    </marker>
    <marker id="arr-or"  markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#2a5a8a"/>
    </marker>
  </defs>`;

  const badNodes = getInvalidPrereqNodes();

  Object.values(state.nodes).forEach(n => {
    const groups = n.prerequisite_groups || [];
    groups.forEach(group => {
      const isOR = group.length > 1;
      group.forEach(pid => {
        const f = state.nodes[pid];
        if (!f) return;
        drawRequire(svg, f, n, badNodes.has(n.id), isOR);
      });
    });
  });

  const seen = new Set();
  Object.values(state.nodes).forEach(n => {
    (n.mutually_exclusive || []).forEach(eid => {
      if (state.nodes[eid]) {
        const key = [n.id, eid].sort().join('|');
        if (!seen.has(key)) { seen.add(key); drawExclusive(svg, n, state.nodes[eid]); }
      }
    });
  });
}

function drawRequire(svg, f, t, isBad, isOR) {
  const x1=f.x, y1=f.y+48, x2=t.x, y2=t.y-48, my=(y1+y2)/2;
  const p = svgEl('path');
  p.setAttribute('d', `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`);
  let stroke = '#4a3a20', marker = 'url(#arr)';
  if (isBad)       { stroke = '#8b2020'; marker = 'url(#arr-bad)'; }
  else if (isOR)   { stroke = '#2a5a8a'; marker = 'url(#arr-or)'; }
  p.setAttribute('stroke', stroke);
  p.setAttribute('stroke-width', '1.5');
  p.setAttribute('fill', 'none');
  p.setAttribute('marker-end', marker);
  if (isBad)     p.setAttribute('stroke-dasharray', '4,3');
  else if (isOR) p.setAttribute('stroke-dasharray', '6,3');
  svg.appendChild(p);
}

function drawExclusive(svg, f, t) {
  const lx1=f.x+(f.x<=t.x?48:-48), lx2=t.x+(f.x<=t.x?-48:48);
  const line = svgEl('line');
  line.setAttribute('x1',lx1); line.setAttribute('y1',f.y);
  line.setAttribute('x2',lx2); line.setAttribute('y2',t.y);
  line.setAttribute('stroke','#7a2020'); line.setAttribute('stroke-width','1.5');
  line.setAttribute('stroke-dasharray','5,4');
  svg.appendChild(line);
  const mx=(lx1+lx2)/2, my=(f.y+t.y)/2;
  const bg = svgEl('circle');
  bg.setAttribute('cx',mx); bg.setAttribute('cy',my); bg.setAttribute('r','7');
  bg.setAttribute('fill','#2a1010'); bg.setAttribute('stroke','#7a2020'); bg.setAttribute('stroke-width','1');
  svg.appendChild(bg);
  const tx = svgEl('text');
  tx.setAttribute('x',mx); tx.setAttribute('y',my+4);
  tx.setAttribute('text-anchor','middle'); tx.setAttribute('fill','#c05050');
  tx.setAttribute('font-size','10'); tx.setAttribute('font-family','serif');
  tx.textContent = '✕';
  svg.appendChild(tx);
}

// ── Node elements ─────────────────────────────────────────────
function getNodeIconSrc(n) {
  if (n.gfxIcon && SPRITE_MAP[n.gfxIcon]) return SPRITE_MAP[n.gfxIcon];
  return SPRITE_MAP[DEFAULT_ICON] || '';
}

const TYPE_BADGE = {
  [FOCUS_TYPE_SHARED]: { text: 'SHR', bg: '#1a3a5a', border: '#2a6a9a', color: '#6ab0e0' },
  [FOCUS_TYPE_JOINT]:  { text: 'JNT', bg: '#2a1a4a', border: '#5a2a9a', color: '#a080e0' },
};

function renderNodes() {
  const world = document.getElementById('world');
  world.querySelectorAll('.node, .node-add-btn').forEach(el => el.remove());

  const badNodes = getInvalidPrereqNodes();

  Object.values(state.nodes).forEach(n => {
    const isSel        = state.selectedId === n.id;
    const isMultiSel   = state.selectedIds.includes(n.id);
    const hasEx        = (n.mutually_exclusive || []).some(eid => state.nodes[eid]);
    const isBad        = badNodes.has(n.id);
    const imgSrc       = getNodeIconSrc(n);
    const label        = getNodeLabel(n);
    const typeBadge    = TYPE_BADGE[n.focusType];
    // A node is "outside" if its HoI4 grid coords are negative
    const hx = Math.round(n.x / GRID_SIZE);
    const hy = Math.round(n.y / (GRID_SIZE * 2));
    const isOutside = hx < 0 || hy < 0;

    const el = document.createElement('div');
    el.className = `node${isSel ? ' selected' : ''}${isMultiSel && !isSel ? ' multi-selected' : ''}${isBad ? ' invalid-prereq' : ''}${isOutside ? ' node-outside' : ''}`;
    el.id = 'node-' + n.id;
    el.style.left = n.x + 'px';
    el.style.top  = n.y + 'px';

    const badgeBadge = typeBadge
      ? `<div class="node-type-badge" style="background:${typeBadge.bg};border-color:${typeBadge.border};color:${typeBadge.color}">${typeBadge.text}</div>`
      : '';

    el.innerHTML = `
      <div class="node-icon">
        ${imgSrc ? `<img src="${imgSrc}" alt="${n.gfxIcon||''}" draggable="false" onerror="this.style.display='none'">` : ''}
        ${hasEx ? '<div class="node-ex-badge">✕</div>' : ''}
        ${badgeBadge}
      </div>
      <div class="node-label">${label}</div>`;

    el.addEventListener('mousedown', ev => onNodeMouseDown(ev, n.id));
    el.addEventListener('contextmenu', ev => onNodeRightClick(ev, n.id));
    el.addEventListener('mouseenter', () => showTooltip(n));
    el.addEventListener('mouseleave', hideTooltip);
    world.appendChild(el);

    if (isSel) {
      const btn = document.createElement('div');
      btn.className = 'node-add-btn';
      btn.textContent = '+';
      btn.title = 'Add child focus';
      btn.style.left = (n.x - 11) + 'px';
      btn.style.top  = (n.y + 48 + GRID_SIZE + 5) + 'px';
      btn.addEventListener('mousedown', ev => { ev.stopPropagation(); ev.preventDefault(); });
      btn.addEventListener('click', ev => { ev.stopPropagation(); onAddChildClicked(n.id); });
      world.appendChild(btn);
    }
  });

  // Update coords display if panel is open
  if (state.selectedId && state.nodes[state.selectedId]) {
    const n = state.nodes[state.selectedId];
    const coordsEl = document.getElementById('ep-coords');
    if (coordsEl) {
      const hx = Math.round(n.x / GRID_SIZE);
      const hy = Math.round(n.y / (GRID_SIZE * 2));
      coordsEl.textContent = `x = ${hx}  y = ${hy}  (px: ${n.x}, ${n.y})`;
    }
  }
}

// ── Tooltip ───────────────────────────────────────────────────
function showTooltip(n) {
  const t = document.getElementById('tooltip');
  const hx = Math.round(n.x / GRID_SIZE);
  const hy = Math.round(n.y / (GRID_SIZE * 2));
  const days = n.cost ? `<br><span style="color:var(--gold-dim);font-size:10px">Cost: ${n.cost} × 7 = ${n.cost*7} days</span>` : '';
  const icon = n.gfxIcon ? `<br><span style="color:var(--text-dim);font-size:10px">${n.gfxIcon}</span>` : '';
  const typeLabel = n.focusType !== FOCUS_TYPE_NORMAL
    ? `<br><span style="color:#6ab0e0;font-size:10px">${n.focusType}</span>` : '';
  const coords = `<br><span style="color:var(--text-dim);font-size:10px">x=${hx} y=${hy}</span>`;
  const bad = (n.prerequisite_groups || []).some(g => g.some(pid => state.nodes[pid] && state.nodes[pid].y >= n.y))
    ? `<br><span style="color:#c05050;font-size:10px">⚠ Invalid prerequisite</span>` : '';
  const label = getNodeLabel(n);
  t.innerHTML = `<strong style="font-family:'Cinzel',serif;color:var(--gold);font-size:11px">${label}</strong><br><span style="color:var(--text-dim);font-size:10px">${n.id}</span>${typeLabel}${icon}${coords}${days}${bad}`;
  t.style.display = 'block';
  document.addEventListener('mousemove', _moveTooltip);
}
function _moveTooltip(e) {
  const t = document.getElementById('tooltip');
  t.style.left = (e.clientX + 14) + 'px'; t.style.top = (e.clientY + 14) + 'px';
}
function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
  document.removeEventListener('mousemove', _moveTooltip);
}
