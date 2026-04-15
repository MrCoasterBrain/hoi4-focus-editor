// js/panel.js

// ── Focus ID picker widget ────────────────────────────────────
// Creates a standalone picker: wraps an existing element or builds into a -wrap div
function buildFocusPicker(inputId, onSelect) {
  const wrap = document.getElementById(inputId + '-wrap');
  if (!wrap) return;
  _buildPickerInto(wrap, inputId, onSelect);
}

function _buildPickerInto(wrap, inputId, onSelect) {
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

  function openDropdown(filter) {
    // Close all OTHER dropdowns, but not this one
    document.querySelectorAll('.focus-picker-dropdown').forEach(d => {
      if (d !== dropdown) d.style.display = 'none';
    });
    _fillDropdown(dropdown, input, filter, onSelect);
  }

  btn.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    if (dropdown.style.display !== 'none') {
      dropdown.style.display = 'none';
    } else {
      openDropdown('');
    }
  });

  input.addEventListener('input', () => { openDropdown(input.value.toLowerCase()); });
  input.addEventListener('focus', () => { openDropdown(input.value.toLowerCase()); });
  input.addEventListener('blur', () => {
    // Delay so mousedown on dropdown items fires first
    setTimeout(() => { dropdown.style.display = 'none'; }, 150);
  });

  row.appendChild(input);
  row.appendChild(btn);
  wrap.appendChild(row);
  wrap.appendChild(dropdown);
}

function _fillDropdown(dropdown, input, filter, onSelect) {
  const ids = Object.keys(state.nodes).sort();
  const filtered = filter
    ? ids.filter(id => id.toLowerCase().includes(filter) ||
        (state.nodes[id] && (state.nodes[id].label || '').toLowerCase().includes(filter)))
    : ids;

  dropdown.innerHTML = '';

  if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

  const clearItem = document.createElement('div');
  clearItem.className = 'focus-picker-item focus-picker-clear';
  clearItem.textContent = '— clear —';
  clearItem.addEventListener('mousedown', e => {
    e.preventDefault();
    input.value = '';
    onSelect('');
    dropdown.style.display = 'none';
  });
  dropdown.appendChild(clearItem);

  filtered.slice(0, 80).forEach(id => {
    const n = state.nodes[id];
    if (!n) return;
    const item = document.createElement('div');
    item.className = 'focus-picker-item';
    const lbl = n.label && n.label.trim()
      ? `<span class="fpi-id">${id}</span><span class="fpi-lbl">${n.label}</span>`
      : `<span class="fpi-id">${id}</span>`;
    item.innerHTML = lbl;
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      input.value = id;
      onSelect(id);
      dropdown.style.display = 'none';
    });
    dropdown.appendChild(item);
  });

  if (filtered.length > 80) {
    const more = document.createElement('div');
    more.className = 'focus-picker-item focus-picker-more';
    more.textContent = `+${filtered.length - 80} more — type to filter`;
    dropdown.appendChild(more);
  }

  dropdown.style.display = 'block';
}

// Close all dropdowns on outside click
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.focus-picker-row') && !e.target.closest('.focus-picker-dropdown')) {
    document.querySelectorAll('.focus-picker-dropdown').forEach(d => { d.style.display = 'none'; });
  }
});

// ── Panel router ──────────────────────────────────────────────
function openFocusPanel(id) {
  if (!state.nodes[id]) return;
  state.selectedId = id;
  document.getElementById('panel-focus').style.display = 'flex';
  document.getElementById('panel-tree').style.display  = 'none';
  document.getElementById('edit-panel').classList.add('open');
  // FIX: call refreshFocusPanel AFTER panel is visible so prereq groups render correctly
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
  document.querySelectorAll('.focus-picker-dropdown').forEach(d => { d.style.display = 'none'; });
  deselectAll();
}

// ── Prerequisite groups UI ────────────────────────────────────
function renderPrereqGroups(nodeId) {
  const container = document.getElementById('prereq-groups-container');
  if (!container) return;
  container.innerHTML = '';

  const n = state.nodes[nodeId];
  if (!n) return;
  if (!n.prerequisite_groups) n.prerequisite_groups = [];
  const groups = n.prerequisite_groups;

  groups.forEach((group, gi) => {
    const isOR = group.length > 1;

    const groupEl = document.createElement('div');
    groupEl.className = 'prereq-group' + (isOR ? ' prereq-group-or' : '');

    // ── Header ──
    const header = document.createElement('div');
    header.className = 'prereq-group-header';

    const labelEl = document.createElement('span');
    labelEl.className = 'prereq-group-label';
    labelEl.textContent = isOR ? `OR-group ${gi + 1}` : `AND ${gi + 1}`;
    labelEl.style.color = isOR ? '#6ab0e0' : 'var(--gold-dim)';

    const delGroupBtn = document.createElement('button');
    delGroupBtn.className = 'prereq-del-group-btn';
    delGroupBtn.textContent = '✕';
    delGroupBtn.title = 'Remove this prerequisite group';
    delGroupBtn.addEventListener('click', () => {
      groups.splice(gi, 1);
      renderPrereqGroups(nodeId);
      renderAll(); selectNode(nodeId);
    });

    header.appendChild(labelEl);
    header.appendChild(delGroupBtn);
    groupEl.appendChild(header);

    // ── Entries ──
    group.forEach((pid, idx) => {
      const entryEl = document.createElement('div');
      entryEl.className = 'prereq-entry';

      // Inline picker (not via buildFocusPicker to avoid -wrap requirement)
      const entryWrapId = `prereq-g${gi}-i${idx}`;
      const entryWrap = document.createElement('div');
      entryWrap.id = entryWrapId + '-wrap';
      entryWrap.className = 'prereq-entry-picker';
      entryEl.appendChild(entryWrap);

      _buildPickerInto(entryWrap, entryWrapId, val => {
        if (val !== undefined) {
          group[idx] = val;
          // Re-render label only, not full groups (avoids losing focus)
          labelEl.textContent = group.length > 1 ? `OR-group ${gi + 1}` : `AND ${gi + 1}`;
          renderAll(); selectNode(nodeId);
        }
      });

      const inp = document.getElementById(entryWrapId);
      if (inp) {
        inp.value = pid;
        inp.addEventListener('blur', () => {
          const v = inp.value.trim();
          if (v !== group[idx]) {
            group[idx] = v;
            renderAll(); selectNode(nodeId);
          }
        });
      }

      // Remove-from-OR button (only when multiple entries)
      if (group.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.className = 'prereq-del-entry-btn';
        delBtn.textContent = '−';
        delBtn.title = 'Remove from OR-group';
        delBtn.addEventListener('click', () => {
          group.splice(idx, 1);
          if (group.length === 0) groups.splice(gi, 1);
          renderPrereqGroups(nodeId);
          renderAll(); selectNode(nodeId);
        });
        entryEl.appendChild(delBtn);
      }

      groupEl.appendChild(entryEl);
    });

    // ── Add OR entry button ──
    const addOrBtn = document.createElement('button');
    addOrBtn.className = 'prereq-add-or-btn';
    addOrBtn.textContent = '+ OR';
    addOrBtn.title = 'Add another focus ID to this OR-group';
    addOrBtn.addEventListener('click', () => {
      group.push('');
      renderPrereqGroups(nodeId);
    });
    groupEl.appendChild(addOrBtn);

    container.appendChild(groupEl);
  });

  // ── Add AND prerequisite button ──
  const addAndBtn = document.createElement('button');
  addAndBtn.className = 'prereq-add-and-btn';
  addAndBtn.textContent = '+ Add prerequisite (AND)';
  addAndBtn.addEventListener('click', () => {
    groups.push(['']);
    renderPrereqGroups(nodeId);
  });
  container.appendChild(addAndBtn);
}

// ── Panel init ────────────────────────────────────────────────
function initFocusPanelPickers() {
  buildFocusPicker('ep-mutex', val => {
    if (!state.selectedId || !val) return;
    const mutexEl = document.getElementById('ep-mutex');
    const existing = (mutexEl.value || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    if (!existing.includes(val)) {
      mutexEl.value = existing.concat(val).join(', ');
    }
    updateRelationProp('mutually_exclusive', mutexEl.value);
  });

  buildFocusPicker('ep-rel-pos', val => {
    if (!state.selectedId) return;
    const el = document.getElementById('ep-rel-pos');
    if (el) el.value = val;
    updateRelativePositionId(val);
  });

  buildFocusPicker('tp-initial-focus', val => {
    const el = document.getElementById('tp-initial-focus');
    if (el) el.value = val;
    updateTreeMeta('initialShowFocus', val);
  });
}

// ── Focus panel ───────────────────────────────────────────────
function refreshFocusPanel(id) {
  const n = state.nodes[id]; if (!n) return;

  document.getElementById('ep-label').value    = n.label || '';
  document.getElementById('ep-focus-id').value = n.id;
  document.getElementById('ep-gfx').value      = n.gfxIcon || '';
  document.getElementById('ep-cost').value     = n.cost;
  document.getElementById('ep-cost-days').textContent = (n.cost || 0) * 7 + ' days';

  // Coordinates display
  const hx = Math.round(n.x / GRID_SIZE);
  const hy = Math.round(n.y / (GRID_SIZE * 2));
  const coordsEl = document.getElementById('ep-coords');
  if (coordsEl) coordsEl.textContent = `x = ${hx}  y = ${hy}  (px: ${n.x}, ${n.y})`;

  const typeEl = document.getElementById('ep-focus-type');
  if (typeEl) typeEl.value = n.focusType || FOCUS_TYPE_NORMAL;

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

  // FIX: always re-render prereq groups to reflect current state
  renderPrereqGroups(id);

  // Close any open dropdowns when switching focus
  document.querySelectorAll('.focus-picker-dropdown').forEach(d => { d.style.display = 'none'; });
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

function updateFocusType(val) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  state.nodes[state.selectedId].focusType = val;
  renderAll(); selectNode(state.selectedId);
}

function updateRelativePositionId(rawVal) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const val = (rawVal || '').trim();
  if (val && !state.nodes[val]) AppConsole.warn(`relative_position_id: focus "${val}" not found`);
  state.nodes[state.selectedId].relative_position_id = val;
  renderAll(); selectNode(state.selectedId);
}

function updateRelationProp(key, rawVal) {
  if (!state.selectedId || !state.nodes[state.selectedId]) return;
  const n = state.nodes[state.selectedId];
  const newIds = (rawVal || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);

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
      if (other && !(other.mutually_exclusive || []).includes(n.id)) {
        if (!other.mutually_exclusive) other.mutually_exclusive = [];
        other.mutually_exclusive.push(n.id);
      }
    });
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
    !k.includes('fast_overlay') && !k.includes('shine_test')
  );
  const filtered = filter ? focusKeys.filter(k => k.toLowerCase().includes(filter)) : focusKeys;
  filtered.slice(0, 120).forEach(gfxName => {
    const btn = document.createElement('div');
    btn.className = 'icon-btn'; btn.title = gfxName; btn.dataset.gfx = gfxName;
    const imgSrc = SPRITE_MAP[gfxName];
    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc; img.alt = gfxName; img.draggable = false;
      img.onerror = () => { img.style.display='none'; btn.textContent='?'; };
      btn.appendChild(img);
    } else { btn.textContent = '?'; }
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
  document.getElementById('tp-tree-id').value = state.treeMeta.treeId;
  document.getElementById('tp-country').value = state.treeMeta.countryBlock || '';
  const initEl = document.getElementById('tp-initial-focus');
  if (initEl) initEl.value = state.treeMeta.initialShowFocus || '';
  document.getElementById('tp-cf-x').value = state.treeMeta.cfX;
  document.getElementById('tp-cf-y').value = state.treeMeta.cfY;
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
  setTimeout(() => { document.addEventListener('mousedown', _onOutsideCtxClick); }, 0);
}

function _onOutsideCtxClick(e) {
  const m = document.getElementById('ctx-menu');
  if (m && !m.contains(e.target)) closeCtxMenu();
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
