// js/state.js
const state = {
  nodes: {},
  treeMeta: {
    treeId:           'GER_focus_tree',
    countryBlock:     'base = 0\nmodifier = {\n    tag = 25\n    original_tag = GER\n}',
    mtth:             '',
    initialShowFocus: '',
    cfX:              100,
    cfY:              1230,
  },

  selectedId:   null,
  ctxNodeId:    null,

  panX: 0, panY: 0, zoom: 1,
  isPanning: false, panStart: {x:0,y:0}, panOrigin: {x:0,y:0},

  dragId: null, dragOffset: {x:0,y:0}, dragMoved: false, dragStart0: {x:0,y:0},
  cfDragging: false, cfDragStart: {x:0,y:0}, cfOrigin: {x:0,y:0},
};