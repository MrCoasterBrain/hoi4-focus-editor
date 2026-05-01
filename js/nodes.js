// js/nodes.js
function snap(v) { return Math.round(v / GRID_SIZE) * GRID_SIZE; }

function makeFocusId(base) {
  const tag = (state.treeMeta.countryBlock.match(/original_tag\s*=\s*(\w+)/) || [])[1] || 'TAG';
  let id = base || `${tag}_new_focus`;
  let c = 2;
  while (state.nodes[id]) { id = (base || `${tag}_new_focus`) + '_' + c++; }
  return id;
}

// prerequisite is stored as array of groups:
// [ [A, B] ]         → prerequisite = { focus = A focus = B }  (OR group)
// [ [A], [B] ]       → prerequisite = { focus = A }            (AND: two separate blocks)
//                       prerequisite = { focus = B }
// Each group is an array of focus IDs. Multiple groups = AND. IDs within a group = OR.

function makeNode(gx, gy, focusId, label, gfxIcon, focusType) {
  const fid = focusId || makeFocusId();
  state.nodes[fid] = {
    id:                   fid,
    focusType:            focusType || FOCUS_TYPE_NORMAL,
    x:                    snap(gx),
    y:                    snap(gy),
    label:                label || '',          // empty = use id as display
    desc:                 '',                   // description text (TAG_focus_desc)
    gfxIcon:              gfxIcon || DEFAULT_ICON,
    cost:                 10,
    search_filters:       [],
    // prerequisite_groups: array of arrays  [ [idA, idB], [idC] ]
    prerequisite_groups:  [],
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

// Display label: fall back to id if label is empty
function getNodeLabel(n) {
  return (n.label && n.label.trim()) ? n.label : n.id;
}

// Check whether a node has a custom user label
function hasCustomLabel(n) {
  return n.label && n.label.trim() !== '';
}

function renameFocus(oldId, newId) {
  newId = newId.trim();
  if (!newId || newId === oldId || !state.nodes[oldId]) return false;
  if (state.nodes[newId]) { AppConsole.error(`Cannot rename: "${newId}" already exists.`); return false; }
  state.nodes[newId] = { ...state.nodes[oldId], id: newId };
  delete state.nodes[oldId];
  Object.values(state.nodes).forEach(n => {
    // update prerequisite_groups
    if (n.prerequisite_groups) {
      n.prerequisite_groups = n.prerequisite_groups.map(g => g.map(x => x === oldId ? newId : x));
    }
    n.mutually_exclusive   = (n.mutually_exclusive || []).map(x => x === oldId ? newId : x);
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
    if (n.prerequisite_groups) {
      n.prerequisite_groups = n.prerequisite_groups
        .map(g => g.filter(x => x !== id))
        .filter(g => g.length > 0);
    }
    n.mutually_exclusive   = (n.mutually_exclusive || []).filter(x => x !== id);
    if (n.relative_position_id === id) n.relative_position_id = '';
  });
  if (state.treeMeta.initialShowFocus === id) state.treeMeta.initialShowFocus = '';
  delete state.nodes[id];
  AppConsole.log(`Deleted: ${id}`);
}

function clearAllFocuses() {
  const count = Object.keys(state.nodes).length;
  if (count === 0) { AppConsole.warn('No focuses to clear.'); return; }
  state.nodes = {};
  state.selectedId = null;
  closePanel();
  renderAll();
  AppConsole.log(`Cleared all ${count} focuses.`);
}

function getEdges() {
  const result = [], seen = new Set();
  Object.values(state.nodes).forEach(n => {
    // Each group contributes edges from all IDs in it to n
    (n.prerequisite_groups || []).forEach(group => {
      group.forEach(pid => {
        if (state.nodes[pid]) result.push({ from: pid, to: n.id, type: 'require' });
      });
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
    (n.prerequisite_groups || []).forEach(group => {
      group.forEach(pid => {
        const parent = state.nodes[pid];
        if (parent && parent.y >= n.y) {
          bad.add(n.id);
        }
      });
    });
  });
  return bad;
}

function addChildNode(parentId) {
  const p = state.nodes[parentId]; if (!p) return null;
  const candidates = [
    { x: p.x,               y: p.y + GRID_SIZE * 2 },
    { x: p.x - GRID_SIZE,   y: p.y + GRID_SIZE * 2 },
    { x: p.x + GRID_SIZE,   y: p.y + GRID_SIZE * 2 },
    { x: p.x,               y: p.y + GRID_SIZE * 4 },
    { x: p.x - GRID_SIZE*2, y: p.y + GRID_SIZE * 2 },
    { x: p.x + GRID_SIZE*2, y: p.y + GRID_SIZE * 2 },
  ];
  const pos = candidates.find(c =>
    !Object.values(state.nodes).find(n => n.x === c.x && n.y === c.y)
  ) || { x: p.x, y: p.y + GRID_SIZE * 4 };

  // FIX: inherit parent's focus type (shared_focus / joint_focus / normal)
  const inheritedType = p.focusType || FOCUS_TYPE_NORMAL;
  const id = makeNode(pos.x, pos.y, null, '', DEFAULT_ICON, inheritedType);
  // AND-prerequisite: single group with one id
  state.nodes[id].prerequisite_groups = [[parentId]];
  state.nodes[id].relative_position_id = parentId;
  return id;
}

// ── Migration helper: convert old 'prerequisite' flat array to groups ─────
function migrateNodePrereqs(node) {
  if (node.prerequisite_groups) return; // already new format
  if (node.prerequisite && Array.isArray(node.prerequisite)) {
    // old format: flat array → each id becomes its own AND-group
    node.prerequisite_groups = node.prerequisite.map(id => [id]);
    delete node.prerequisite;
  } else {
    node.prerequisite_groups = [];
  }
}

function migrateAllNodes() {
  Object.values(state.nodes).forEach(migrateNodePrereqs);
}
