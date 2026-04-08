// js/nodes.js
function snap(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

function makeFocusId(base) {
  const tag = (state.treeMeta.countryBlock.match(/original_tag\s*=\s*(\w+)/) || [])[1] || 'TAG';
  let id = base || `${tag}_new_focus`;
  let c = 2;
  while (state.nodes[id]) { id = (base || `${tag}_new_focus`) + '_' + c++; }
  return id;
}

function makeNode(gx, gy, focusId, label, gfxIcon) {
  const fid = focusId || makeFocusId();
  state.nodes[fid] = {
    id:                   fid,
    x:                    snap(gx),
    y:                    snap(gy),
    label:                label   || fid,
    gfxIcon:              gfxIcon || DEFAULT_ICON,
    cost:                 10,
    search_filters:       [],
    prerequisite:         [],
    mutually_exclusive:   [],
    relative_position_id: '',
    completion_reward:    '',
    available:            '',
    bypass:               '',
    cancel_if_invalid:    false,
  };
  AppConsole.log(`Created focus: ${fid}`);
  return fid;
}

function renameFocus(oldId, newId) {
  newId = newId.trim();
  if (!newId || newId === oldId || !state.nodes[oldId]) return false;
  if (state.nodes[newId]) { AppConsole.error(`Cannot rename: "${newId}" already exists.`); return false; }
  state.nodes[newId] = { ...state.nodes[oldId], id: newId };
  delete state.nodes[oldId];
  Object.values(state.nodes).forEach(n => {
    n.prerequisite         = (n.prerequisite         || []).map(x => x === oldId ? newId : x);
    n.mutually_exclusive   = (n.mutually_exclusive   || []).map(x => x === oldId ? newId : x);
    if (n.relative_position_id === oldId) n.relative_position_id = newId;
  });
  if (state.treeMeta.initialShowFocus === oldId) state.treeMeta.initialShowFocus = newId;
  if (state.selectedId === oldId) state.selectedId = newId;
  AppConsole.log(`Renamed: ${oldId} → ${newId}`);
  return true;
}

function deleteNode(id) {
  if (!id || !state.nodes[id]) return;
  Object.values(state.nodes).forEach(n => {
    n.prerequisite         = (n.prerequisite         || []).filter(x => x !== id);
    n.mutually_exclusive   = (n.mutually_exclusive   || []).filter(x => x !== id);
    if (n.relative_position_id === id) n.relative_position_id = '';
  });
  if (state.treeMeta.initialShowFocus === id) state.treeMeta.initialShowFocus = '';
  delete state.nodes[id];
  AppConsole.log(`Deleted: ${id}`);
}

function getEdges() {
  const result = [], seen = new Set();
  Object.values(state.nodes).forEach(n => {
    (n.prerequisite || []).forEach(pid => {
      if (state.nodes[pid]) result.push({ from: pid, to: n.id, type: 'require' });
    });
    (n.mutually_exclusive || []).forEach(eid => {
      if (state.nodes[eid]) {
        const key = [n.id, eid].sort().join('|');
        if (!seen.has(key)) { seen.add(key); result.push({ from: n.id, to: eid, type: 'exclusive' }); }
      }
    });
  });
  return result;
}

function getInvalidPrereqNodes() {
  const bad = new Set();
  Object.values(state.nodes).forEach(n => {
    (n.prerequisite || []).forEach(pid => {
      const parent = state.nodes[pid];
      if (parent && parent.y >= n.y) {
        bad.add(n.id);
        AppConsole.warn(`Invalid prereq: "${n.id}" depends on "${pid}" (y=${parent.y} >= y=${n.y})`);
      }
    });
  });
  return bad;
}

function addChildNode(parentId) {
  const p = state.nodes[parentId]; if (!p) return null;
  const candidates = [
    { x: p.x,             y: p.y + GRID_SIZE * 2 },
    { x: p.x - GRID_SIZE, y: p.y + GRID_SIZE * 2 },
    { x: p.x + GRID_SIZE, y: p.y + GRID_SIZE * 2 },
    { x: p.x,             y: p.y + GRID_SIZE * 4 },
    { x: p.x - GRID_SIZE*2, y: p.y + GRID_SIZE * 2 },
    { x: p.x + GRID_SIZE*2, y: p.y + GRID_SIZE * 2 },
  ];
  const pos = candidates.find(c =>
    !Object.values(state.nodes).find(n => n.x === c.x && n.y === c.y)
  ) || { x: p.x, y: p.y + GRID_SIZE * 4 };

  const id = makeNode(pos.x, pos.y);
  state.nodes[id].prerequisite = [parentId];
  return id;
}
