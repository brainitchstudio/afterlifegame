// The starter camp from the design kit's Starter Camp: a campfire, tents, the overseer's supply
// cache and a wood pile in a clearing. A run starts here instead of inside a walled refuge; wood
// comes from trees the player marks for felling, and quests (progression.mjs) unlock structures.
// Positions are simulation units around the campfire at (0, 0), one tile = 16 units. The world
// generator clears the ground for the same layout, so both read it from here.

// The two footpaths through the camp run along x = 0 and y = 0, two tiles wide; nothing stands on them.
export const PATH_HALF = 16;
export const CAMP = {
  fire: { x: 0, y: 0 },
  tents: [{ x: -72, y: -40 }, { x: 72, y: -40 }, { x: -72, y: 40 }],
  cache: { x: 56, y: 40 },
  // Props: the wood pile survivors carry logs to, and some crates and a backpack by the fire.
  pile: { x: 96, y: 40 },
  props: [{ key: 'deco_crates', x: -32, y: -48 }, { key: 'deco_backpack', x: 32, y: -24 }],
  spawns: [{ x: -24, y: 24 }, { x: 24, y: 24 }, { x: -24, y: -24 }],
  // The trodden clearing around the fire, in tiles.
  clearing: { rx: 8.6, ry: 5.4 },
};

// Art for the camp fixtures' camp/* sprite keys: the kit's decor sprites, and the supply cache,
// which the host draws in the design kit's style (web/src/host/campArt.js).
export const CAMP_ART = {
  'camp/fire': 'decor/deco_campfire', 'camp/tent': 'decor/deco_tent', 'camp/cache': 'camp_cache',
  // The buildables the player learns: drawn in web/src/host/campBuildArt.js, with menu cards and
  // placement ghosts baked by web/tools/bakeBuildableArt.mjs.
  'camp/supply_stash': 'camp_supply_stash', 'camp/garden_plot': 'camp_garden_plot', 'camp/field_workbench': 'camp_field_workbench',
  'camp/aid_station': 'camp_aid_station', 'camp/lookout_post': 'camp_lookout_post', 'camp/guard_post': 'camp_guard_post',
  'camp/radio_kit': 'camp_radio_kit', 'camp/makeshift_shelter': 'camp_makeshift_shelter', 'camp/salvage_pile': 'camp_salvage_pile',
};

// Wood per tree and the seconds of game time it takes to grow back.
export const TREE_YIELD = { tree_pine: 4, tree_oak: 5, tree_dead: 2, nat_s2_birch: 4, nat_s2_apple: 3, nat_s2_willow: 4 };
export const TREE_NAMES = { tree_pine: 'Pine', tree_oak: 'Oak', tree_dead: 'Dead tree', nat_s2_birch: 'Birch', nat_s2_apple: 'Apple tree', nat_s2_willow: 'Willow' };
export const regrowSeconds = k => k === 'tree_dead' ? 90 : 60;
export const CHOP_SECONDS = 3.2;
// A survivor carrying logs walks at this share of their speed.
export const CARRY_SPEED = .8;

