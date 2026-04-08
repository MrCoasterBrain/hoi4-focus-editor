// js/panel.js

// ── Focus ID picker widget ────────────────────────────────────
// Creates a combo: text input + dropdown button that shows all focus IDs
function buildFocusPicker(inputId, onSelect) {
  const wrap = document.getElementById(inputId + '-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'focus-picker-row';

  const input = document.createElement('input');
  input.className = 'field-input focus-picker-input';
  input.id = inputId;
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;

  const btn = document.createElement('button');
  btn.className = 'focus-picker-btn';
  btn.title = 'Choose from list';
  btn.textContent = '▾';
  btn.type = 'button';

  const dropdown = document.createElement('div');
  dropdown.className = 'focus-picker-dropdown';
  dropdown.style.display = 'none';

  btn.addEventListener('mousedown', e => {
    e.preventDefault();
    const isOpen = dropdown.style.display !== 'none';
    closeAllFocusDropdowns();
    if (!isOpen) openFocusDropdown(dropdown, input, onSelect);
  });

  input.addEventListener('input', () => {
    openFocusDropdown(dropdown, input, onSelect, input.value.toLowerCase());
  });

  input.addEventListener('focus', () => {
    openFocusDropdown(dropdown, input, onSelect, input.value.toLowerCase());
  });

  row.appendChild(input);
  row.appendChild(btn);
  wrap.appendChild(row);
  wrap.appendChild(dropdown);
}

function openFocusDropdown(dropdown, input, onSelect, filter) {
  closeAllFocusDropdowns();
  const ids = Object.keys(state.nodes).sort();
  const filtered = filter
    ? ids.filter(id => id.toLowerCase().includes(filter) || (state.nodes[id].label || '').toLowerCase().includes(filter))
    : ids;

  if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = '';
  // Clear option
  const clearItem = document.createElement('div');
  clearItem.className = 'focus-picker-item focus-picker-clear';
  clearItem.textContent = '— clear —';
  clearItem.addEventListener('mousedown', e => {
    e.preventDefault();
    input.value = '';
    onSelect('');
    closeAllFocusDropdowns();
  });
  dropdown.appendChild(clearItem);

  filtered.slice(0, 60).forEach(id => {
    const item = document.createElement('div');
    item.className = 'focus-picker-item';
    const lbl = state.nodes[id].label && state.nodes[id].label !== id
      ? `<span class="fpi-id">${id}</span><span class="fpi-lbl">${state.nodes[id].label}</span>`
      : `<span class="fpi-id">${id}</span>`;
    item.innerHTML = lbl;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = id;
      onSelect(id);
      closeAllFocusDropdowns();
    });
    dropdown.appendChild(item);
  });

  if (filtered.length > 60) {
    const more = document.createElement('div');
    more.className = 'focus-picker-item focus-picker-more';
    more.textContent = `+${filtered.length - 60} more — type to filter`;
    dropdown.appendChild(more);
  }

  dropdown.style.display = 'block';
  dropdown._input = input;
}

function closeAllFocusDropdowns() {
  document.querySelectorAll('.focus-picker-dropdown').forEach(d => {
    d.style.display = 'none';
  });
}

// Close dropdowns on outside click
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.focus-picker-row') && !e.target.closest('.focus-picker-dropdown')) {
    closeAllFocusDropdowns();
  }
});

// Refresh all picker inputs when panel is shown
function refreshAllFocusPickers() {
  // Close any open dropdowns so stale data doesn't show
  closeAllFocusDropdowns();
}

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
  closeAllFocusDropdowns();
  deselectAll();
}

// ── Focus panel ───────────────────────────────────────────────
function initFocusPanelPickers() {
  // prerequisite picker (comma-separated, so we just set the first pick;
  // user can still type manually for multiple)
  buildFocusPicker('ep-prereq', val => {
    if (!state.selectedId) return;
    const cur = document.getElementById('ep-prereq').value;
    // append if there's already content
    const existing = cur.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    if (val === '') {
      document.getElementById('ep-prereq').value = '';
    } else if (!existing.includes(val)) {
      document.getElementById('ep-prereq').value = existing.concat(val).join(', ');
    }
    updateRelationProp('prerequisite', document.getElementById('ep-prereq').value);
  });

  buildFocusPicker('ep-mutex', val => {
    if (!state.selectedId) return;
    const cur = document.getElementById('ep-mutex').value;
    const existing = cur.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    if (val === '') {
      document.getElementById('ep-mutex').value = '';
    } else if (!existing.includes(val)) {
      document.getElementById('ep-mutex').value = existing.concat(val).join(', ');
    }
    updateRelationProp('mutually_exclusive', document.getElementById('ep-mutex').value);
  });

  buildFocusPicker('ep-rel-pos', val => {
    if (!state.selectedId) return;
    document.getElementById('ep-rel-pos').value = val;
    updateRelativePositionId(val);
  });

  // Tree panel picker
  buildFocusPicker('tp-initial-focus', val => {
    document.getElementById('tp-initial-focus').value = val;
    updateTreeMeta('initialShowFocus', val);
  });
}

function refreshFocusPanel(id) {
  const n = state.nodes[id]; if (!n) return;
  document.getElementById('ep-label').value    = n.label;
  document.getElementById('ep-focus-id').value = n.id;
  document.getElementById('ep-gfx').value      = n.gfxIcon || '';
  document.getElementById('ep-cost').value     = n.cost;
  document.getElementById('ep-cost-days').textContent = (n.cost || 0) * 7 + ' days';

  const prereqEl = document.getElementById('ep-prereq');
  if (prereqEl) prereqEl.value = (n.prerequisite || []).join(', ');

  const mutexEl = document.getElementById('ep-mutex');
  if (mutexEl) mutexEl.value = (n.mutually_exclusive || []).join(', ');

  const relPosEl = document.getElementById('ep-rel-pos');
  if (relPosEl) relPosEl.value = n.relative_position_id || '';

  document.getElementById('ep-reward').value    = n.completion_reward || '';
  document.getElementById('ep-available').value = n.available || '';
  document.getElementById('ep-bypass').value    = n.bypass    || '';
  document.getElementById('ep-cancel').checked  = n.cancel_if_invalid || false;

  document.querySelectorAll('.filter-tag').forEach(b =>
    b.classList.toggle('active-filter', (n.search_filters || []).includes(b.dataset.f)));

  refreshIconPicker(n.gfxIcon);
  closeAllFocusDropdowns();
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

function updateRelativePositionId(rawVal) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const val = (rawVal || '').trim();
  if (val && !state.nodes[val]) {
    AppConsole.warn(`relative_position_id: focus "${val}" not found`);
  }
  state.nodes[state.selectedId].relative_position_id = val;
  renderAll(); selectNode(state.selectedId);
}

function updateRelationProp(key, rawVal) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const n = state.nodes[state.selectedId];
  const newIds = rawVal.split(/[\s,]+/).map(s => s.trim()).filter(s => s);

  if (key === 'mutually_exclusive') {
    (n.mutually_exclusive || []).forEach(eid => {
      const other = state.nodes[eid];
      if (other) other.mutually_exclusive = (other.mutually_exclusive || []).filter(x => x !== n.id);
    });
    const valid   = newIds.filter(id => state.nodes[id]);
    const invalid = newIds.filter(id => id && !state.nodes[id]);
    if (invalid.length) AppConsole.warn(`mutually_exclusive: unknown IDs: ${invalid.join(', ')}`);
    n.mutually_exclusive = valid;
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
  const input = document.getElementById('ep-icon-search');
  const grid  = document.getElementById('ep-icon-grid');
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
  const focusKeys = keys.filter(k =>
    (k.startsWith('GFX_focus_') || k.startsWith('GFX_goal_')) &&
    !k.includes('fast_overlay') &&
    !k.includes('shine_test')
  );

  const filtered = filter ? focusKeys.filter(k => k.toLowerCase().includes(filter)) : focusKeys;
  const shown = filtered.slice(0, 120);

  shown.forEach(gfxName => {
    const btn = document.createElement('div');
    btn.className = 'icon-btn';
    btn.title = gfxName;
    btn.dataset.gfx = gfxName;

    const imgSrc = SPRITE_MAP[gfxName];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc; img.alt = gfxName; img.draggable = false;
      img.onerror = () => { img.style.display = 'none'; btn.textContent = '?'; };
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
  document.getElementById('tp-tree-id').value     = state.treeMeta.treeId;
  document.getElementById('tp-country').value     = state.treeMeta.countryBlock || '';
  const initEl = document.getElementById('tp-initial-focus');
  if (initEl) initEl.value = state.treeMeta.initialShowFocus || '';
  document.getElementById('tp-cf-x').value        = state.treeMeta.cfX;
  document.getElementById('tp-cf-y').value        = state.treeMeta.cfY;
  closeAllFocusDropdowns();
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
let _ctxMenuOpen = false;

function showCtxMenu(x, y) {
  const m = document.getElementById('ctx-menu');
  m.style.display = 'block';
  m.style.left = Math.min(x, window.innerWidth  - 210) + 'px';
  m.style.top  = Math.min(y, window.innerHeight - 100) + 'px';
  _ctxMenuOpen = true;

  // setTimeout so this mousedown event doesn't immediately close the menu
  setTimeout(() => {
    document.addEventListener('mousedown', _onOutsideCtxClick);
  }, 0);
}

function _onOutsideCtxClick(e) {
  const m = document.getElementById('ctx-menu');
  if (m && !m.contains(e.target)) {
    closeCtxMenu();
  }
}

function closeCtxMenu() {
  if (!_ctxMenuOpen) return;
  _ctxMenuOpen = false;
  document.getElementById('ctx-menu').style.display = 'none';
  document.removeEventListener('mousedown', _onOutsideCtxClick);
}

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
