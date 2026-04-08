// js/io.js

// ── JSON ──────────────────────────────────────────────────────
function exportJSON() {
  try {
    const data = JSON.stringify({ nodes: state.nodes, treeMeta: state.treeMeta }, null, 2);
    _download(data, 'focus_tree.json', 'application/json');
    AppConsole.log('Exported JSON.');
  } catch(e) { AppConsole.error('Export JSON: ' + e.message); }
}

function importJSON() {
  _pickFile('.json', text => {
    try {
      const d = JSON.parse(text);
      state.nodes    = d.nodes    || {};
      state.treeMeta = { ...state.treeMeta, ...(d.treeMeta || {}) };
      migrateAllNodes();
      state.selectedId = null;
      closePanel(); renderAll();
      AppConsole.log('Imported JSON: ' + Object.keys(state.nodes).length + ' focuses.');
    } catch(e) { AppConsole.error('Import JSON: ' + e.message); }
  });
}

// ── HoI4 .txt export ─────────────────────────────────────────
function exportHoI4() {
  try {
    const m = state.treeMeta;
    const T = '    ';
    let out = '';

    // ── Localisation comment for custom labels ──
    const customLabels = Object.values(state.nodes).filter(n => hasCustomLabel(n));
    if (customLabels.length > 0) {
      out += '# l_russian:\n';
      customLabels.forEach(n => {
        out += `#  ${n.id}: "${n.label}"\n`;
      });
      out += '\n';
    }

    // Group nodes by focusType
    const normalNodes = Object.values(state.nodes).filter(n => (n.focusType || FOCUS_TYPE_NORMAL) === FOCUS_TYPE_NORMAL);
    const sharedNodes = Object.values(state.nodes).filter(n => n.focusType === FOCUS_TYPE_SHARED);
    const jointNodes  = Object.values(state.nodes).filter(n => n.focusType === FOCUS_TYPE_JOINT);

    // ── focus_tree block (normal + joint) ──
    if (normalNodes.length > 0 || jointNodes.length > 0) {
      out += 'focus_tree = {\n';
      out += T + 'id = ' + m.treeId + '\n';
      if (m.countryBlock && m.countryBlock.trim()) {
        out += T + 'country = {\n';
        m.countryBlock.split('\n').forEach(line => { out += T + T + line.trim() + '\n'; });
        out += T + '}\n';
      }
      out += T + 'continuous_focus_position = { x = ' + m.cfX + ' y = ' + m.cfY + ' }\n';
      if (m.initialShowFocus) out += T + 'initial_show_position = { focus = ' + m.initialShowFocus + ' }\n';
      out += '\n';

      normalNodes.forEach(n => { out += _serializeFocus(n, T, 'focus'); });
      jointNodes.forEach(n  => { out += _serializeFocus(n, T, 'joint_focus'); });

      out += '}\n\n';
    }

    // ── shared_focus blocks (top-level, outside focus_tree) ──
    sharedNodes.forEach(n => { out += _serializeFocus(n, '', 'shared_focus'); });

    _download(out, 'focus_tree.txt', 'text/plain');
    AppConsole.log('Exported HoI4 .txt.');
  } catch(e) { AppConsole.error('Export HoI4: ' + e.message); }
}

function _serializeFocus(n, indent, keyword) {
  const T = '    ';
  const I = indent;
  const II = indent + T;
  let out = '';

  const hx = Math.round(n.x / GRID_SIZE);
  const hy = Math.round(n.y / (GRID_SIZE * 2));

  out += I + keyword + ' = {\n';
  out += II + 'id = ' + n.id + '\n';

  if (n.relative_position_id && state.nodes[n.relative_position_id]) {
    const rel = state.nodes[n.relative_position_id];
    const dx = Math.round((n.x - rel.x) / GRID_SIZE);
    const dy = Math.round((n.y - rel.y) / (GRID_SIZE * 2));
    out += II + 'x = ' + dx + '\n';
    out += II + 'y = ' + dy + '\n';
    out += II + 'relative_position_id = ' + n.relative_position_id + '\n';
  } else {
    out += II + 'x = ' + hx + '\n';
    out += II + 'y = ' + hy + '\n';
  }

  if (n.gfxIcon && n.gfxIcon !== DEFAULT_ICON) out += II + 'icon = ' + n.gfxIcon + '\n';
  out += II + 'cost = ' + n.cost + '\n';

  if (n.search_filters && n.search_filters.length)
    out += II + 'search_filters = { ' + n.search_filters.join(' ') + ' }\n';

  // prerequisite_groups: each group is one prerequisite = { } block
  (n.prerequisite_groups || []).forEach(group => {
    out += II + 'prerequisite = {';
    group.forEach(pid => { out += ' focus = ' + pid; });
    out += ' }\n';
  });

  (n.mutually_exclusive || []).forEach(eid => {
    out += II + 'mutually_exclusive = { focus = ' + eid + ' }\n';
  });

  if (n.available)         out += II + 'available = {\n' + II + T + n.available.trim() + '\n' + II + '}\n';
  if (n.bypass)            out += II + 'bypass = {\n'    + II + T + n.bypass.trim()    + '\n' + II + '}\n';
  if (n.cancel_if_invalid) out += II + 'cancel_if_invalid = yes\n';
  if (n.completion_reward) out += II + 'completion_reward = {\n' + II + T + n.completion_reward.trim() + '\n' + II + '}\n';

  out += I + '}\n\n';
  return out;
}

// ── HoI4 .txt import ─────────────────────────────────────────
function importHoI4() {
  _pickFile('.txt,.hoi4', text => {
    try {
      const result = parseHoI4FocusTree(text);
      state.nodes    = result.nodes;
      state.treeMeta = { ...state.treeMeta, ...result.treeMeta };
      state.selectedId = null;
      closePanel(); renderAll();
      AppConsole.log('Imported HoI4: ' + Object.keys(state.nodes).length + ' focuses.');
    } catch(e) { AppConsole.error('Import HoI4: ' + e.message); }
  });
}

// ── HoI4 parser ───────────────────────────────────────────────
function parseHoI4FocusTree(text) {
  // Strip line comments
  var src    = text.replace(/#[^\n]*/g, '');
  var tokens = tokeniseClausewitz(src);
  var outerBlock = parseBlock(tokens, 0).block;

  var treeMeta = {
    treeId: '', countryBlock: '', initialShowFocus: '', cfX: 100, cfY: 1230,
  };
  var nodes = {};
  var rawFocuses = [];

  // Process top-level items
  outerBlock.forEach(function(item) {
    if (!item || item.type !== 'assign') return;

    if (item.key === 'focus_tree') {
      // Process focus_tree block
      _parseFocusTreeBlock(item.block || [], treeMeta, nodes, rawFocuses, FOCUS_TYPE_NORMAL);

    } else if (item.key === 'shared_focus') {
      _parseSingleFocus(item.block || [], nodes, rawFocuses, FOCUS_TYPE_SHARED);

    } else if (item.key === 'joint_focus') {
      _parseSingleFocus(item.block || [], nodes, rawFocuses, FOCUS_TYPE_JOINT);

    } else if (item.key === 'focus') {
      // top-level focus without focus_tree wrapper
      _parseSingleFocus(item.block || [], nodes, rawFocuses, FOCUS_TYPE_NORMAL);
    }
  });

  _resolveRelativePositions(nodes, rawFocuses);

  var cnt = Object.keys(nodes).length;
  AppConsole.log('Parsed: treeId="' + treeMeta.treeId + '", ' + cnt + ' focuses.');
  if (cnt === 0) AppConsole.warn('No focuses found — check file format.');
  return { nodes: nodes, treeMeta: treeMeta };
}

function _parseFocusTreeBlock(root, treeMeta, nodes, rawFocuses, defaultType) {
  root.forEach(function(item) {
    if (!item || item.type !== 'assign') return;

    if (item.key === 'id') {
      treeMeta.treeId = item.value;
    } else if (item.key === 'country') {
      treeMeta.countryBlock = blockToRaw(item.block || [], '');
    } else if (item.key === 'continuous_focus_position') {
      var blk = item.block || [];
      var xIt = blk.find(function(b){ return b.key === 'x'; });
      var yIt = blk.find(function(b){ return b.key === 'y'; });
      if (xIt) treeMeta.cfX = parseFloat(xIt.value) || 100;
      if (yIt) treeMeta.cfY = parseFloat(yIt.value) || 1230;
    } else if (item.key === 'initial_show_position') {
      var fIt = (item.block || []).find(function(b){ return b.key === 'focus'; });
      if (fIt) treeMeta.initialShowFocus = fIt.value;
    } else if (item.key === 'focus') {
      _parseSingleFocus(item.block || [], nodes, rawFocuses, defaultType);
    } else if (item.key === 'joint_focus') {
      _parseSingleFocus(item.block || [], nodes, rawFocuses, FOCUS_TYPE_JOINT);
    } else if (item.key === 'shared_focus') {
      _parseSingleFocus(item.block || [], nodes, rawFocuses, FOCUS_TYPE_SHARED);
    }
  });
}

function _parseSingleFocus(blk, nodes, rawFocuses, focusType) {
  function gv(k) {
    var it = blk.find(function(b){ return b.key === k; });
    return it ? it.value : '';
  }

  var fid = gv('id');
  if (!fid) { AppConsole.warn('Focus block with no id — skipped'); return; }

  var rawX = parseFloat(gv('x')) || 0;
  var rawY = parseFloat(gv('y')) || 0;
  var relId = gv('relative_position_id') || '';

  var node = {
    id:                   fid,
    focusType:            focusType,
    x:                    snap(Math.round(rawX * GRID_SIZE)),
    y:                    snap(rawY * GRID_SIZE * 2),
    label:                '',
    gfxIcon:              gv('icon') || DEFAULT_ICON,
    cost:                 parseFloat(gv('cost')) || 10,
    search_filters:       [],
    prerequisite_groups:  [],
    mutually_exclusive:   [],
    relative_position_id: relId,
    completion_reward:    '',
    available:            '',
    bypass:               '',
    cancel_if_invalid:    false,
  };

  blk.forEach(function(it) {
    if (it.type !== 'assign') return;

    if (it.key === 'prerequisite') {
      // Each prerequisite block = one group; multiple focus = entries within = OR
      var focusItems = (it.block || []).filter(function(b){ return b.key === 'focus'; });
      var group = focusItems.map(function(f){ return f.value; }).filter(Boolean);
      if (group.length > 0) node.prerequisite_groups.push(group);

    } else if (it.key === 'mutually_exclusive') {
      var focusItems = (it.block || []).filter(function(b){ return b.key === 'focus'; });
      focusItems.forEach(function(f) {
        if (f.value && node.mutually_exclusive.indexOf(f.value) === -1)
          node.mutually_exclusive.push(f.value);
      });

    } else if (it.key === 'search_filters') {
      (it.block || []).forEach(function(t) {
        if (t.type === 'value' && node.search_filters.indexOf(t.value) === -1)
          node.search_filters.push(t.value);
      });

    } else if (it.key === 'completion_reward') {
      node.completion_reward = blockToRaw(it.block || [], '');
    } else if (it.key === 'available') {
      node.available = blockToRaw(it.block || [], '');
    } else if (it.key === 'bypass') {
      node.bypass = blockToRaw(it.block || [], '');
    } else if (it.key === 'cancel_if_invalid') {
      node.cancel_if_invalid = it.value === 'yes';
    }
  });

  nodes[fid] = node;
  rawFocuses.push({ id: fid, relId: relId, rawX: rawX, rawY: rawY });
}

function _resolveRelativePositions(nodes, rawFocuses) {
  var maxPasses = 30;
  var unresolved = rawFocuses.filter(function(r){ return r.relId; });

  while (unresolved.length > 0 && maxPasses-- > 0) {
    var stillUnresolved = [];
    var progressMade = false;

    unresolved.forEach(function(r) {
      var parent = nodes[r.relId];
      if (!parent) {
        AppConsole.warn('relative_position_id "' + r.relId + '" not found for "' + r.id + '"');
        progressMade = true;
        return;
      }
      var parentEntry = rawFocuses.find(function(p){ return p.id === r.relId && p.relId; });
      if (parentEntry && stillUnresolved.find(function(u){ return u.id === parentEntry.id; })) {
        stillUnresolved.push(r);
        return;
      }
      nodes[r.id].x = snap(parent.x + Math.round(r.rawX * GRID_SIZE));
      nodes[r.id].y = snap(parent.y + r.rawY * GRID_SIZE * 2);
      progressMade = true;
    });

    if (!progressMade) break;
    unresolved = stillUnresolved;
  }

  if (unresolved.length > 0)
    AppConsole.warn(unresolved.length + ' focuses could not resolve relative_position_id');
}

// ── Clausewitz tokeniser ──────────────────────────────────────
function tokeniseClausewitz(src) {
  var re = /("[^"]*")|([{}=])|([^\s{}="]+)/g;
  var tokens = []; var m;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) tokens.push({ type: 'string', val: m[1].slice(1,-1) });
    else if (m[2]) tokens.push({ type: m[2] });
    else tokens.push({ type: 'word', val: m[3] });
  }
  return tokens;
}

function parseBlock(tokens, pos) {
  var block = [];
  while (pos < tokens.length) {
    var t = tokens[pos];
    if (!t) { pos++; continue; }
    if (t.type === '}') { pos++; break; }
    if ((t.type === 'word' || t.type === 'string') && tokens[pos+1] && tokens[pos+1].type === '=') {
      var key = t.val; pos += 2;
      var next = tokens[pos];
      if (!next) { block.push({ type:'assign', key:key, value:'', block:null }); break; }
      if (next.type === '{') {
        pos++;
        var sub = parseBlock(tokens, pos); pos = sub.pos;
        block.push({ type:'assign', key:key, value:'', block:sub.block });
      } else {
        block.push({ type:'assign', key:key, value: next.val || '', block:null }); pos++;
      }
    } else if (t.type === 'word' || t.type === 'string') {
      block.push({ type:'value', value: t.val || '' }); pos++;
    } else { pos++; }
  }
  return { block: block, pos: pos };
}

function blockToRaw(block, indent) {
  if (indent === undefined) indent = '\t';
  return block.map(function(item) {
    if (item.type === 'value') return indent + item.value;
    if (!item.block) return indent + item.key + ' = ' + item.value;
    var inner = blockToRaw(item.block, indent + '\t');
    return indent + item.key + ' = {\n' + inner + '\n' + indent + '}';
  }).join('\n');
}

// ── Helpers ───────────────────────────────────────────────────
function _download(content, filename, mime) {
  var blob = new Blob([content], { type: mime });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function _pickFile(accept, callback) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = accept;
  input.onchange = function(ev) {
    var file = ev.target.files[0]; if (!file) return;
    var fr = new FileReader();
    fr.onload = function(e) { callback(e.target.result); };
    fr.readAsText(file);
  };
  input.click();
}
