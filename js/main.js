// js/main.js

function init() {
  AppConsole.install();
  buildFilterTags();
  buildIconPicker();
  setupCanvas();
  initFocusPanelPickers();

  // Sample tree
  makeNode(5*GRID_SIZE*2, 1*GRID_SIZE*2, 'GER_national_unity',     'National Unity',    'GFX_focus_generic_the_giant_wakes');
  makeNode(5*GRID_SIZE*2, 3*GRID_SIZE*2, 'GER_industrial_base',    'Industrial Base',   'GFX_goal_generic_production');
  makeNode(4*GRID_SIZE*2, 5*GRID_SIZE*2, 'GER_civilian_industry',  'Civilian Industry', 'GFX_focus_generic_steel');
  makeNode(6*GRID_SIZE*2, 5*GRID_SIZE*2, 'GER_military_industry',  'Military Industry', 'GFX_focus_generic_military_mission');
  makeNode(3*GRID_SIZE*2, 7*GRID_SIZE*2, 'GER_steel_production',   'Steel Production',  'GFX_focus_generic_steel');
  makeNode(5*GRID_SIZE*2, 7*GRID_SIZE*2, 'GER_factory_expansion',  'Factory Expansion', 'GFX_goal_generic_production');
  makeNode(7*GRID_SIZE*2, 7*GRID_SIZE*2, 'GER_arms_manufacturing', 'Arms Manufacturing','GFX_focus_generic_military_mission');

  state.nodes['GER_national_unity'].cost     = 7;
  state.nodes['GER_industrial_base'].cost    = 10;
  state.nodes['GER_civilian_industry'].cost  = 10;
  state.nodes['GER_military_industry'].cost  = 10;
  state.nodes['GER_steel_production'].cost   = 5;
  state.nodes['GER_factory_expansion'].cost  = 5;
  state.nodes['GER_arms_manufacturing'].cost = 10;

  state.nodes['GER_industrial_base'].prerequisite    = ['GER_national_unity'];
  state.nodes['GER_civilian_industry'].prerequisite  = ['GER_industrial_base'];
  state.nodes['GER_military_industry'].prerequisite  = ['GER_industrial_base'];
  state.nodes['GER_steel_production'].prerequisite   = ['GER_civilian_industry'];
  state.nodes['GER_factory_expansion'].prerequisite  = ['GER_civilian_industry'];
  state.nodes['GER_arms_manufacturing'].prerequisite = ['GER_military_industry'];

  state.nodes['GER_civilian_industry'].mutually_exclusive = ['GER_military_industry'];
  state.nodes['GER_military_industry'].mutually_exclusive = ['GER_civilian_industry'];

  state.treeMeta.treeId           = 'GER_focus_tree';
  state.treeMeta.countryBlock     = 'base = 0\nmodifier = {\n    tag = 25\n    original_tag = GER\n}';
  state.treeMeta.initialShowFocus = 'GER_national_unity';

  renderAll();
  resetView();
  AppConsole.log('Focus Tree Editor ready.');
}

document.addEventListener('DOMContentLoaded', init);
