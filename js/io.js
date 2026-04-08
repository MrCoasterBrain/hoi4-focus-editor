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
    let out = 'focus_tree = {\n';
    out += T + 'id = ' + m.treeId + '\n';
    if (m.countryBlock && m.countryBlock.trim()) {
      out += T + 'country = {\n';
      m.countryBlock.split('\n').forEach(line => { out += T + T + line.trim() + '\n'; });
      out += T + '}\n';
    }
    if (m.mtth && m.mtth.trim()) {
      out += T + 'mean_time_to_happen = {\n';
      m.mtth.split('\n').forEach(line => { out += T + T + line.trim() + '\n'; });
      out += T + '}\n';
    }
    out += T + 'continuous_focus_position = { x = ' + m.cfX + ' y = ' + m.cfY + ' }\n';
    if (m.initialShowFocus) out += T + 'initial_show_position = { focus = ' + m.initialShowFocus + ' }\n';
    out += '\n';

    Object.values(state.nodes).forEach(n => {
      const hx = Math.round(n.x / GRID_SIZE);
      const hy = Math.round(n.y / (GRID_SIZE * 2));
      out += T + 'focus = {\n';
      out += T+T + 'id = ' + n.id + '\n';
      // Use relative_position_id if set, otherwise use absolute x/y
      if (n.relative_position_id && state.nodes[n.relative_position_id]) {
        const rel = state.nodes[n.relative_position_id];
        const dx = Math.round((n.x - rel.x) / GRID_SIZE);
        const dy = Math.round((n.y - rel.y) / (GRID_SIZE * 2));
        out += T+T + 'x = ' + dx + '\n';
        out += T+T + 'y = ' + dy + '\n';
        out += T+T + 'relative_position_id = ' + n.relative_position_id + '\n';
      } else {
        out += T+T + 'x = ' + hx + '\n';
        out += T+T + 'y = ' + hy + '\n';
      }
      out += T+T + 'icon = ' + (n.gfxIcon || DEFAULT_ICON) + '\n';
      out += T+T + 'cost = ' + n.cost + '\n';
      if (n.search_filters && n.search_filters.length)
        out += T+T + 'search_filters = { ' + n.search_filters.join(' ') + ' }\n';
      (n.prerequisite       || []).forEach(pid => { out += T+T + 'prerequisite = { focus = ' + pid + ' }\n'; });
      (n.mutually_exclusive || []).forEach(eid => { out += T+T + 'mutually_exclusive = { focus = ' + eid + ' }\n'; });
      if (n.available)         out += T+T + 'available = {\n' + T+T+T + n.available.trim() + '\n' + T+T + '}\n';
      if (n.bypass)            out += T+T + 'bypass = {\n' + T+T+T + n.bypass.trim() + '\n' + T+T + '}\n';
      if (n.cancel_if_invalid) out += T+T + 'cancel_if_invalid = yes\n';
      if (n.completion_reward) out += T+T + 'completion_reward = {\n' + T+T+T + n.completion_reward.trim() + '\n' + T+T + '}\n';
      out += T + '}\n\n';
    });
    out += '}\n';

    _download(out, 'focus_tree.txt', 'text/plain');
    AppConsole.log('Exported HoI4 .txt.');
  } catch(e) { AppConsole.error('Export HoI4: ' + e.message); }
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
  // Unwrap focus_tree = { ... } wrapper if present
  var root;
  if (outerBlock.length === 1 && outerBlock[0].key === 'focus_tree' && outerBlock[0].block) {
    root = outerBlock[0].block;
    AppConsole.log('Unwrapped focus_tree block.');
  } else {
    root = outerBlock;
  }

  var treeMeta = {
    treeId: '', countryBlock: '', mtth: '',
    initialShowFocus: '', cfX: 100, cfY: 1230,
  };
  var nodes = {};
  // Store raw relative positioning info for second pass
  var rawFocuses = []; // { id, relId, rawX, rawY }

  root.forEach(function(item) {
    if (!item || item.type !== 'assign') return;

    if (item.key === 'id') {
      treeMeta.treeId = item.value;

    } else if (item.key === 'country') {
      treeMeta.countryBlock = blockToRaw(item.block || [], '');

    } else if (item.key === 'mean_time_to_happen') {
      treeMeta.mtth = blockToRaw(item.block || [], '');

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
      var blk = item.block || [];

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
        x:                    snap(Math.round(rawX * GRID_SIZE)),
        y:                    snap(rawY * GRID_SIZE * 2),
        label:                fid,
        gfxIcon:              gv('icon') || DEFAULT_ICON,
        cost:                 parseFloat(gv('cost')) || 10,
        search_filters:       [],
        prerequisite:         [],
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
          var focusItems = (it.block || []).filter(function(b){ return b.key === 'focus'; });
          focusItems.forEach(function(f) {
            if (f.value && node.prerequisite.indexOf(f.value) === -1)
              node.prerequisite.push(f.value);
          });

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
  });

  // Second pass: resolve relative_position_id
  var maxPasses = 30;
  var unresolved = rawFocuses.filter(function(r){ return r.relId; });

  while (unresolved.length > 0 && maxPasses-- > 0) {
    var stillUnresolved = [];
    var progressMade = false;

    unresolved.forEach(function(r) {
      var parent = nodes[r.relId];
      if (!parent) {
        AppConsole.warn('relative_position_id "' + r.relId + '" not found for "' + r.id + '" — using absolute coords');
        progressMade = true;
        return;
      }
      var parentEntry = rawFocuses.find(function(p){ return p.id === r.relId && p.relId; });
      if (parentEntry && stillUnresolved.indexOf(parentEntry) !== -1) {
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

  if (unresolved.length > 0) {
    AppConsole.warn(unresolved.length + ' focuses could not resolve relative_position_id');
  }

  var cnt = Object.keys(nodes).length;
  AppConsole.log('Parsed: treeId="' + treeMeta.treeId + '", ' + cnt + ' focuses.');
  if (cnt === 0) AppConsole.warn('No focuses found — check file format.');
  return { nodes: nodes, treeMeta: treeMeta };
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
