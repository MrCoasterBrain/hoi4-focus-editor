// js/panel.js

// ── Panel router ──────────────────────────────────────────────
function openFocusPanel(id) {
  if (!state.nodes[id]) return;
  state.selectedId = id;
  document.getElementById('panel-focus').style.display = 'flex';
  document.getElementById('panel-tree').style.display  = 'none';
  document.getElementById('edit-panel').classList.add('open');
  refreshFocusPanel(id);
  renderNodes();
}

function openTreePanel() {
  state.selectedId = null;
  document.getElementById('panel-focus').style.display = 'none';
  document.getElementById('panel-tree').style.display  = 'flex';
  document.getElementById('edit-panel').classList.add('open');
  refreshTreePanel();
  renderNodes();
}

function closePanel() {
  document.getElementById('edit-panel').classList.remove('open');
  deselectAll();
}

// ── Focus panel ───────────────────────────────────────────────
function refreshFocusPanel(id) {
  const n = state.nodes[id]; if (!n) return;
  document.getElementById('ep-label').value     = n.label;
  document.getElementById('ep-focus-id').value  = n.id;
  document.getElementById('ep-gfx').value        = n.gfxIcon || '';
  document.getElementById('ep-cost').value       = n.cost;
  document.getElementById('ep-cost-days').textContent = (n.cost || 0) * 7 + ' days';
  document.getElementById('ep-prereq').value     = (n.prerequisite       || []).join(', ');
  document.getElementById('ep-mutex').value      = (n.mutually_exclusive || []).join(', ');
  document.getElementById('ep-reward').value     = n.completion_reward || '';
  document.getElementById('ep-available').value  = n.available || '';
  document.getElementById('ep-bypass').value     = n.bypass    || '';
  document.getElementById('ep-cancel').checked   = n.cancel_if_invalid || false;
  document.querySelectorAll('.filter-tag').forEach(b =>
    b.classList.toggle('active-filter', (n.search_filters || []).includes(b.dataset.f)));
  refreshIconPicker(n.gfxIcon);
}

function updateFocusId(newId) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const ok = renameFocus(state.selectedId, newId);
  if (ok) { renderAll(); refreshFocusPanel(state.selectedId); }
}

function updateNodeProp(key, val) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  state.nodes[state.selectedId][key] = val;
  if (key === 'cost') document.getElementById('ep-cost-days').textContent = (val || 0) * 7 + ' days';
  if (key === 'gfxIcon') refreshIconPicker(val);
  renderAll(); selectNode(state.selectedId);
}

function updateRelationProp(key, rawVal) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const n = state.nodes[state.selectedId];
  const newIds = rawVal.split(/[\s,]+/).map(s => s.trim()).filter(s => s);

  if (key === 'mutually_exclusive') {
    // Remove old symmetric links
    (n.mutually_exclusive || []).forEach(eid => {
      const other = state.nodes[eid];
      if (other) other.mutually_exclusive = (other.mutually_exclusive || []).filter(x => x !== n.id);
    });
    const valid   = newIds.filter(id => state.nodes[id]);
    const invalid = newIds.filter(id => id && !state.nodes[id]);
    if (invalid.length) AppConsole.warn(`mutually_exclusive: unknown IDs: ${invalid.join(', ')}`);
    n.mutually_exclusive = valid;
    // Add symmetric links
    valid.forEach(eid => {
      const other = state.nodes[eid];
      if (other && !other.mutually_exclusive.includes(n.id)) other.mutually_exclusive.push(n.id);
    });
  } else {
    const valid   = newIds.filter(id => state.nodes[id]);
    const invalid = newIds.filter(id => id && !state.nodes[id]);
    if (invalid.length) AppConsole.warn(`prerequisite: unknown IDs: ${invalid.join(', ')}`);
    n[key] = valid;
  }

  renderAll(); selectNode(state.selectedId);
}

function toggleFilter(f) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const arr = state.nodes[state.selectedId].search_filters || [];
  const i = arr.indexOf(f); if (i === -1) arr.push(f); else arr.splice(i, 1);
  state.nodes[state.selectedId].search_filters = arr;
  document.querySelectorAll('.filter-tag').forEach(b => b.classList.toggle('active-filter', arr.includes(b.dataset.f)));
}

// ── Icon picker ───────────────────────────────────────────────
let _iconFilterTimeout = null;

function buildIconPicker() {
  const input  = document.getElementById('ep-icon-search');
  const grid   = document.getElementById('ep-icon-grid');
  if (!input || !grid) return;

  input.addEventListener('input', () => {
    clearTimeout(_iconFilterTimeout);
    _iconFilterTimeout = setTimeout(() => renderIconGrid(input.value.trim().toLowerCase()), 150);
  });
  renderIconGrid('');
}

function renderIconGrid(filter) {
  const grid = document.getElementById('ep-icon-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const keys = Object.keys(SPRITE_MAP);
  // Only show GFX_focus_* and GFX_goal_* entries for focus icons
  const focusKeys = keys.filter(k =>
    (k.startsWith('GFX_focus_') || k.startsWith('GFX_goal_')) &&
    !k.includes('fast_overlay') &&
    !k.includes('shine_test')
  );

  const filtered = filter
    ? focusKeys.filter(k => k.toLowerCase().includes(filter))
    : focusKeys;

  const shown = filtered.slice(0, 120); // max 120 to avoid lag

  shown.forEach(gfxName => {
    const btn = document.createElement('div');
    btn.className = 'icon-btn';
    btn.title = gfxName;
    btn.dataset.gfx = gfxName;

    const imgSrc = SPRITE_MAP[gfxName];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc; img.alt = gfxName; img.draggable = false;
      img.onerror = () => { img.style.display='none'; btn.textContent = '?'; };
      btn.appendChild(img);
    } else {
      btn.textContent = '?';
    }

    btn.onclick = () => {
      updateNodeProp('gfxIcon', gfxName);
      document.getElementById('ep-gfx').value = gfxName;
    };
    grid.appendChild(btn);
  });

  if (filtered.length > 120) {
    const info = document.createElement('div');
    info.style.cssText = 'grid-column:1/-1;font-size:10px;color:var(--text-dim);padding:4px;text-align:center;font-family:Cinzel,serif';
    info.textContent = `${filtered.length - 120} more — refine search`;
    grid.appendChild(info);
  }
}

function refreshIconPicker(currentGfx) {
  document.querySelectorAll('#ep-icon-grid .icon-btn').forEach(b =>
    b.classList.toggle('active-icon', b.dataset.gfx === currentGfx));
}

// ── Tree panel ────────────────────────────────────────────────
function refreshTreePanel() {
  document.getElementById('tp-tree-id').value      = state.treeMeta.treeId;
  document.getElementById('tp-country').value       = state.treeMeta.countryBlock || '';
  document.getElementById('tp-mtth').value           = state.treeMeta.mtth || '';
  document.getElementById('tp-initial-focus').value  = state.treeMeta.initialShowFocus || '';
  document.getElementById('tp-cf-x').value           = state.treeMeta.cfX;
  document.getElementById('tp-cf-y').value           = state.treeMeta.cfY;
}

function syncTreePanel() {
  const px = document.getElementById('tp-cf-x');
  const py = document.getElementById('tp-cf-y');
  if (px) px.value = state.treeMeta.cfX;
  if (py) py.value = state.treeMeta.cfY;
}

function updateTreeMeta(key, val) {
  state.treeMeta[key] = val;
  if (key === 'cfX' || key === 'cfY') renderCF();
}

// ── Context menu ──────────────────────────────────────────────
function showCtxMenu(x, y) {
  const m = document.getElementById('ctx-menu');
  m.style.display = 'block';
  m.style.left = Math.min(x, window.innerWidth  - 210) + 'px';
  m.style.top  = Math.min(y, window.innerHeight - 100) + 'px';
  document.addEventListener('mousedown', closeCtxMenu, { once: true });
}
function closeCtxMenu() { document.getElementById('ctx-menu').style.display = 'none'; }
function ctxEdit()   { closeCtxMenu(); selectNode(state.ctxNodeId); openFocusPanel(state.ctxNodeId); }
function ctxDelete() { deleteNode(state.ctxNodeId); state.ctxNodeId = null; closeCtxMenu(); renderAll(); }

// ── Filter tags builder ───────────────────────────────────────
function buildFilterTags() {
  const wrap = document.getElementById('filter-wrap');
  SEARCH_FILTERS.forEach(f => {
    const t = document.createElement('div');
    t.className = 'filter-tag'; t.textContent = f.replace('FOCUS_FILTER_', ''); t.dataset.f = f;
    t.onclick = () => toggleFilter(f);
    wrap.appendChild(t);
  });
}