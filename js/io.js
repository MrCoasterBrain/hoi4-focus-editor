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
      AppConsole.log(`Imported JSON: ${Object.keys(state.nodes).length} focuses.`);
    } catch(e) { AppConsole.error('Import JSON: ' + e.message); }
  });
}

// ── HoI4 .txt export ─────────────────────────────────────────
function exportHoI4() {
  try {
    const m = state.treeMeta;
    const T = '    ';
    let out = `focus_tree = {\n`;
    out += `${T}id = ${m.treeId}\n`;
    // country block — output raw as given
    if (m.countryBlock && m.countryBlock.trim()) {
      out += `${T}country = {\n`;
      m.countryBlock.split('\n').forEach(line => { out += `${T}${T}${line.trim()}\n`; });
      out += `${T}}\n`;
    }
    if (m.mtth && m.mtth.trim()) {
      out += `${T}mean_time_to_happen = {\n`;
      m.mtth.split('\n').forEach(line => { out += `${T}${T}${line.trim()}\n`; });
      out += `${T}}\n`;
    }
    out += `${T}continuous_focus_position = { x = ${m.cfX} y = ${m.cfY} }\n`;
    if (m.initialShowFocus) out += `${T}initial_show_position = { focus = ${m.initialShowFocus} }\n`;
    out += `\n`;

    Object.values(state.nodes).forEach(n => {
      const hx = Math.round(n.x / GRID_SIZE * 2);
      const hy = Math.round(n.y / GRID_SIZE);
      out += `${T}focus = {\n`;
      out += `${T}${T}id = ${n.id}\n`;
      out += `${T}${T}x = ${hx}\n`;
      out += `${T}${T}y = ${hy}\n`;
      out += `${T}${T}icon = ${n.gfxIcon || DEFAULT_ICON}\n`;
      out += `${T}${T}cost = ${n.cost}\n`;
      if (n.search_filters && n.search_filters.length)
        out += `${T}${T}search_filters = { ${n.search_filters.join(' ')} }\n`;
      (n.prerequisite       || []).forEach(pid => { out += `${T}${T}prerequisite = { focus = ${pid} }\n`; });
      (n.mutually_exclusive || []).forEach(eid => { out += `${T}${T}mutually_exclusive = { focus = ${eid} }\n`; });
      if (n.available)         out += `${T}${T}available = {\n${T}${T}${T}${n.available.trim()}\n${T}${T}}\n`;
      if (n.bypass)            out += `${T}${T}bypass = {\n${T}${T}${T}${n.bypass.trim()}\n${T}${T}}\n`;
      if (n.cancel_if_invalid) out += `${T}${T}cancel_if_invalid = yes\n`;
      if (n.completion_reward) out += `${T}${T}completion_reward = {\n${T}${T}${T}${n.completion_reward.trim()}\n${T}${T}}\n`;
      out += `${T}}\n\n`;
    });
    out += `}\n`;

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
      AppConsole.log(`Imported HoI4: ${Object.keys(state.nodes).length} focuses.`);
    } catch(e) { AppConsole.error('Import HoI4: ' + e.message); }
  });
}

// ── HoI4 parser ───────────────────────────────────────────────
function parseHoI4FocusTree(text) {
  const src    = text.replace(/#[^\n]*/g, '');
  const tokens = tokeniseClausewitz(src);
  const root   = parseBlock(tokens, 0).block;

  const treeMeta = {
    treeId: '', countryBlock: '', mtth: '',
    initialShowFocus: '', cfX: 100, cfY: 1230,
  };
  const nodes = {};

  root.forEach(item => {
    if (!item || item.type !== 'assign') return;
    switch (item.key) {
      case 'id':
        treeMeta.treeId = item.value; break;
      case 'country':
        treeMeta.countryBlock = blockToRaw(item.block || [], ''); break;
      case 'mean_time_to_happen':
        treeMeta.mtth = blockToRaw(item.block || [], ''); break;
      case 'continuous_focus_position': {
        const blk  = item.block || [];
        const xIt  = blk.find(b => b.key === 'x'), yIt = blk.find(b => b.key === 'y');
        if (xIt) treeMeta.cfX = Math.round(+xIt.value * GRID_SIZE / 2);
        if (yIt) treeMeta.cfY = Math.round(+yIt.value * GRID_SIZE / 2);
        break;
      }
      case 'initial_show_position': {
        const fIt = (item.block || []).find(b => b.key === 'focus');
        if (fIt) treeMeta.initialShowFocus = fIt.value;
        break;
      }
      case 'focus': {
        const blk = item.block || [];
        const g = k => { const it = blk.find(b => b.key === k); return it ? it.value : ''; };
        const fid = g('id'); if (!fid) { AppConsole.warn('Focus block with no id, skipped'); break; }

        const rawX = +g('x') || 0, rawY = +g('y') || 0;
        const node = {
          id:                 fid,
          x:                  snap(Math.round(rawX * GRID_SIZE / 2)),
          y:                  snap(rawY * GRID_SIZE),
          label:              fid,
          gfxIcon:            g('icon') || DEFAULT_ICON,
          cost:               +g('cost') || 10,
          search_filters:     [],
          prerequisite:       [],
          mutually_exclusive: [],
          completion_reward:  '',
          available:          '',
          bypass:             '',
          cancel_if_invalid:  false,
        };

        blk.forEach(it => {
          if (it.type !== 'assign') return;
          switch (it.key) {
            case 'prerequisite': {
              const f = (it.block || []).find(b => b.key === 'focus');
              if (f && !node.prerequisite.includes(f.value)) node.prerequisite.push(f.value);
              break;
            }
            case 'mutually_exclusive': {
              const f = (it.block || []).find(b => b.key === 'focus');
              if (f && !node.mutually_exclusive.includes(f.value)) node.mutually_exclusive.push(f.value);
              break;
            }
            case 'search_filters': {
              (it.block || []).forEach(t => {
                if (t.type === 'value' && !node.search_filters.includes(t.value)) node.search_filters.push(t.value);
              });
              break;
            }
            case 'completion_reward': node.completion_reward = blockToRaw(it.block || [], ''); break;
            case 'available':        node.available          = blockToRaw(it.block || [], ''); break;
            case 'bypass':           node.bypass             = blockToRaw(it.block || [], ''); break;
            case 'cancel_if_invalid': node.cancel_if_invalid = it.value === 'yes'; break;
          }
        });
        nodes[fid] = node;
        break;
      }
    }
  });

  AppConsole.log(`Parsed: treeId="${treeMeta.treeId}", ${Object.keys(nodes).length} focuses.`);
  return { nodes, treeMeta };
}

// ── Clausewitz tokeniser ──────────────────────────────────────
function tokeniseClausewitz(src) {
  const re = /("[^"]*")|([{}=])|([^\s{}="]+)/g;
  const tokens = []; let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) tokens.push({ type: 'string', val: m[1].slice(1,-1) });
    else if (m[2]) tokens.push({ type: m[2] });
    else tokens.push({ type: 'word', val: m[3] });
  }
  return tokens;
}

function parseBlock(tokens, pos) {
  const block = [];
  while (pos < tokens.length) {
    const t = tokens[pos];
    if (!t) { pos++; continue; }
    if (t.type === '}') { pos++; break; }
    if ((t.type === 'word' || t.type === 'string') && tokens[pos+1] && tokens[pos+1].type === '=') {
      const key = t.val; pos += 2;
      const next = tokens[pos];
      if (!next) { block.push({ type:'assign', key, value:'', block:null }); break; }
      if (next.type === '{') {
        pos++;
        const sub = parseBlock(tokens, pos); pos = sub.pos;
        block.push({ type:'assign', key, value:'', block:sub.block });
      } else {
        block.push({ type:'assign', key, value: next.val || '', block:null }); pos++;
      }
    } else if (t.type === 'word' || t.type === 'string') {
      block.push({ type:'value', value: t.val || '' }); pos++;
    } else { pos++; }
  }
  return { block, pos };
}

function blockToRaw(block, indent) {
  if (indent === undefined) indent = '\t';
  return block.map(item => {
    if (item.type === 'value') return indent + item.value;
    if (!item.block) return `${indent}${item.key} = ${item.value}`;
    const inner = blockToRaw(item.block, indent + '\t');
    return `${indent}${item.key} = {\n${inner}\n${indent}}`;
  }).join('\n');
}

// ── Helpers ───────────────────────────────────────────────────
function _download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

function _pickFile(accept, callback) {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = accept;
  input.onchange = ev => {
    const file = ev.target.files[0]; if (!file) return;
    const fr = new FileReader();
    fr.onload = e => callback(e.target.result);
    fr.readAsText(file);
  };
  input.click();
}