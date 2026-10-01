// Procedural Survivor Generator Engine - Refined 16-Bit Studio Edition
// Produces infinitely varied, deterministic survivor sprites (24×28 frames, 8 directions × 4 walk frames = 96×224 sheet),
// complete with layered anatomy (skin, hair, facial hair, marks, headgear, tops, outerwear/vests, bottoms, footwear, back accessories, holstered tools)
// and full RPG stat integration matching the game simulation.
// Strictly compliant with ZombieBaseKit 16-bit pixel guidelines (16px = 1 world unit, bottom-center footprint pivot).

import { Spr, OL, W, DW, PN, G, D, R, L, M, S, X, draw } from './ui-kit/pixel-assets-v2.js';
import { generateStats, STAT_KEYS, STAT_NAMES, STAT_USES, TUNING } from './survivors.mjs';

export const FRAME_W = 24;
export const FRAME_H = 28;
export const SHEET_W = 96;  // 4 frames * 24px
export const SHEET_H = 224; // 8 directions * 28px
export const DIRS = ['s', 'n', 'e', 'w', 'se', 'sw', 'ne', 'nw'];

// Canonical outline & accent tones matching ZombieBaseKit official assets (guard.png, doctor.png, mechanic.png)
export const OUTLINE_DARK = '#1a1e16'; // Deep warm charcoal outline
export const SHADOW_DEEP   = '#0b090e'; // Contact shadow / boot sole
export const EYE_PUPIL     = '#1c1a18'; // Dark eye pupil
export const EYE_SCLERA    = '#e8e4dc'; // Eye catchlight / sclera
export const BOOT_TOE      = '#2c2a24'; // Boot leather cap
export const BOOT_SOLE     = '#0b090e'; // Lugged sole base

// ---------------------------------------------------------------------------
// PRNG and Seeding utilities
// ---------------------------------------------------------------------------
export function hashStringSeed(...parts) {
  const text = parts.join('|');
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 ^ h1) >>> 0;
}

export function prngStream(seed) {
  let a = (typeof seed === 'number' ? seed : hashStringSeed(String(seed))) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (weights) => {
      const total = weights.reduce((sum, w) => sum + w, 0);
      let roll = next() * total;
      for (let i = 0; i < weights.length; i++) {
        if (weights[i] > 0 && roll < weights[i]) return i;
        roll -= weights[i];
      }
      return weights.length - 1;
    },
    bool: (chance = 0.5) => next() < chance,
  };
}

// ---------------------------------------------------------------------------
// Curated 16-Bit Color Palettes (Top-down 4-tone directional ramps)
// ---------------------------------------------------------------------------
export const SKIN_PALETTES = {
  fair:         { name: 'Fair / Pale',      tones: ['#5a3a28', '#8a5e42', '#b58e70', '#dcb898'] },
  rosy:         { name: 'Rosy Peach',       tones: ['#633830', '#8e544a', '#b87c72', '#deb2a6'] },
  tan:          { name: 'Sun-Tanned',       tones: ['#553828', '#7a5438', '#a07a5e', '#c49a78'] },
  warm_olive:   { name: 'Warm Olive',       tones: ['#493922', '#6b5736', '#917b50', '#b5a176'] },
  medium_brown: { name: 'Medium Brown',     tones: ['#3d281a', '#5f412c', '#825c40', '#a88062'] },
  rich_bronze:  { name: 'Rich Bronze',      tones: ['#331f13', '#523422', '#754d35', '#986e4e'] },
  dark_umber:   { name: 'Dark Umber',       tones: ['#28180e', '#412719', '#5e3c28', '#7d533b'] },
  deep_espresso:{ name: 'Deep Espresso',    tones: ['#1c100a', '#301c12', '#472b1d', '#633e2c'] },
  weathered_ash:{ name: 'Weathered Ash',    tones: ['#3e3c38', '#5c5852', '#7e7972', '#a09c95'] },
};

export const HAIR_PALETTES = {
  jet_black:    { name: 'Jet Black',        tones: ['#101012', '#1f2024', '#34363d'] },
  dark_brown:   { name: 'Dark Brown',       tones: ['#21150e', '#38251a', '#543b2b'] },
  chestnut:     { name: 'Chestnut Brown',   tones: ['#301c10', '#4d3220', '#6e4a32'] },
  auburn:       { name: 'Auburn / Mahogany',tones: ['#38140c', '#572317', '#7d3827'] },
  fiery_ginger: { name: 'Fiery Ginger',     tones: ['#4a1908', '#732d12', '#9e4620'] },
  honey_blonde: { name: 'Honey Blonde',     tones: ['#4f3d19', '#78602c', '#a68742'] },
  platinum:     { name: 'Platinum Ash',     tones: ['#696761', '#8e8b83', '#b8b4ab'] },
  salt_pepper:  { name: 'Salt & Pepper',    tones: ['#2e2d2a', '#4f4e4a', '#787670'] },
  silver_grey:  { name: 'Silver Slate',     tones: ['#404347', '#64696e', '#8d9399'] },
  pure_white:   { name: 'White / Pale',     tones: ['#737980', '#9ea4ab', '#cbd1d6'] },
  toxic_teal:   { name: 'Punk Teal (Dyed)', tones: ['#132c2a', '#224a46', '#35736d'] },
  faded_red:    { name: 'Punk Crimson',     tones: ['#3b1116', '#5e1e26', '#87303c'] },
};

export const CLOTH_PALETTES = {
  tactical_olive:{ name: 'Tactical Olive',  tones: ['#1d2b1f', '#273a28', '#324a31', '#415d3c'] },
  camo_drab:    { name: 'Camo Drab',        tones: ['#282c1e', '#393f2b', '#4d553b', '#656f4e'] },
  hazard_rust:  { name: 'Hazard Rust',      tones: ['#4a2420', '#6a342a', '#844438', '#a35749'] },
  denim_navy:   { name: 'Denim Navy',       tones: ['#1a222e', '#262c36', '#354050', '#4a5466'] },
  scavenger_grey:{ name: 'Scavenger Grey',  tones: ['#24231f', '#36342e', '#4d4a42', '#666359'] },
  medic_white:  { name: 'Sanitary White',   tones: ['#616361', '#7e7b68', '#9c9882', '#b5b19a'] },
  medic_cyan:   { name: 'Field Medic Teal', tones: ['#1a2e2e', '#294545', '#3d6161', '#548282'] },
  worn_leather: { name: 'Worn Leather',     tones: ['#302316', '#473523', '#634b33', '#826446'] },
  khaki_tan:    { name: 'Khaki Tan',        tones: ['#383424', '#4f4a35', '#6b6449', '#8a8261'] },
  hi_vis_amber: { name: 'Industrial Amber', tones: ['#47330c', '#694c14', '#8f681d', '#b88729'] },
  raider_burgundy:{ name: 'Wasteland Maroon', tones: ['#2e0f14', '#471820', '#63252f', '#853643'] },
  stealth_black:{ name: 'Charcoal Black',   tones: ['#141517', '#1f2124', '#2d3036', '#40444d'] },
  flannel_red:  { name: 'Red Check Flannel',tones: ['#3d1310', '#5e1e19', '#802b24', '#a63c32'] },
  forest_pine:  { name: 'Forest Pine',      tones: ['#152117', '#203324', '#2e4733', '#3f5e45'] },
};

export const VEST_PALETTES = {
  tactical_black:{ name: 'Tactical Kevlar', tones: ['#121417', '#1c2024', '#292f36', '#3a424a'] },
  patrol_olive:  { name: 'Field Vest Green',tones: ['#1d261b', '#2c3b29', '#3e523b', '#526b4e'] },
  biker_leather: { name: 'Heavy Leather',   tones: ['#24180e', '#382618', '#523824', '#6e4c32'] },
  hi_vis_safety: { name: 'Hi-Vis Orange',   tones: ['#4f2008', '#73300f', '#9c4317', '#c75922'] },
  scrap_plated:  { name: 'Scrap Metal Plate',tones: ['#282d30', '#3b4247', '#525b61', '#6d777e'] },
  hunting_tan:   { name: 'Utility Pocket Tan',tones: ['#332e22', '#4a4433', '#665e47', '#857b5f'] },
  medic_red:     { name: 'Medic Trauma Red', tones: ['#3d1111', '#5c1a1a', '#802626', '#a63535'] },
};

export const HEADWEAR_PALETTES = {
  camo_green:   { name: 'Military Olive',   tones: ['#19241a', '#253627', '#344a37', '#47634a'] },
  tactical_dark:{ name: 'Blackened Steel',  tones: ['#16171a', '#222429', '#32363d', '#464a52'] },
  field_tan:    { name: 'Patrol Tan',       tones: ['#332e22', '#4a4433', '#665e47', '#857b5f'] },
  scav_crimson: { name: 'Blood Bandana',    tones: ['#381110', '#541c19', '#752824', '#993732'] },
  steel_grey:   { name: 'Armored Grey',     tones: ['#282e33', '#3c454d', '#535f69', '#6d7c8a'] },
};

// ---------------------------------------------------------------------------
// Survivor Archetypes & Name Generator Data
// ---------------------------------------------------------------------------
export const FIRST_NAMES = {
  M: ['Marcus', 'Derrick', 'Jack', 'Caleb', 'Liam', 'Vance', 'Silas', 'Owen', 'Garrison', 'Cole', 'Wyatt', 'Leon', 'Frank', 'Travis', 'Milo', 'Ezekiel', 'Ray', 'Samson', 'Hank', 'Gus'],
  F: ['Maya', 'Nora', 'Elena', 'Tess', 'Sadie', 'Rowan', 'Claire', 'Veda', 'Mara', 'Faye', 'Iris', 'Greta', 'Chloe', 'Naomi', 'Kira', 'Hattie', 'Zoe', 'Beatrix', 'Cass', 'Astrid'],
  NB: ['Ash', 'Rowan', 'Morgan', 'Quinn', 'Jules', 'Val', 'Reese', 'Robin', 'Blythe', 'Shiloh', 'River', 'Sloan']
};

export const SURNAMES = [
  'Cross', 'Mercer', 'Vance', 'Holloway', 'Sterling', 'Blackwood', 'Boone', 'Reyes', 'Torres',
  'Thorne', 'Carver', 'Frost', 'Sinclair', 'Strickland', 'Bishop', 'Keller', 'Gentry', 'Pike', 'Crane', 'West'
];

export const CALLSIGNS = [
  'Ghost', 'Sparks', 'Deadeye', 'Brick', 'Doc', 'Anvil', 'Rook', 'Rust', 'Hawk', 'Wrench',
  'Echo', 'Stitch', 'Timber', 'Matches', 'Shadow', 'Baron', 'Grizzly', 'Zero', 'Scraps', 'Viper'
];

export const ARCHETYPES = {
  guard: {
    label: 'Colony Enforcer',
    role: 'guard',
    sexBias: null,
    builds: ['stocky', 'brawler', 'athletic'],
    hairStyles: ['buzz', 'short', 'mohawk', 'high_ponytail'],
    facialHairBias: 0.5,
    faceMarks: ['scar_slash', 'scar_cross', 'eyepatch_r', 'none'],
    eyebrowMood: 'furrowed',
    tops: ['jacket', 'hoodie', 'tshirt'],
    topColors: ['tactical_olive', 'stealth_black', 'denim_navy'],
    vests: ['tactical', 'scrap_pauldron', 'bandolier'],
    vestColors: ['tactical_black', 'scrap_plated'],
    bottoms: ['combat_fatigues', 'cargo_pants'],
    bottomColors: ['tactical_olive', 'stealth_black'],
    headwears: ['tactical_helmet', 'cap_fwd', 'bandana', 'none'],
    holster: 'holster_pistol',
    backGears: ['none', 'radio_pack', 'backpack_bedroll'],
    kneepads: true,
    bigArms: true,
    forcedPrimaryStat: 'str',
    forcedSecondaryStat: 'end',
    quotes: [
      'Nothing breaches the perimeter while I draw breath.',
      'Stay behind my shield. Keep your head down.',
      'Ammo is precious, but colony blood is priceless.'
    ]
  },
  medic: {
    label: 'Field Surgeon',
    role: 'medic',
    sexBias: null,
    builds: ['lean', 'athletic', 'average'],
    hairStyles: ['short', 'top_bun', 'high_ponytail', 'low_ponytail'],
    facialHairBias: 0.25,
    faceMarks: ['bandage_cheek', 'none', 'none'],
    eyebrowMood: 'calm',
    tops: ['labcoat', 'tshirt', 'hoodie'],
    topColors: ['medic_white', 'medic_cyan', 'scavenger_grey'],
    vests: ['medic_cross', 'hunting_pocket', 'none'],
    vestColors: ['medic_red', 'hunting_tan'],
    bottoms: ['cargo_pants', 'jeans'],
    bottomColors: ['denim_navy', 'medic_cyan', 'scavenger_grey'],
    headwears: ['cap_bwd', 'bandana', 'none'],
    holster: 'holster_medkit',
    backGears: ['medic_pack', 'none'],
    kneepads: false,
    bigArms: false,
    forcedPrimaryStat: 'int',
    forcedSecondaryStat: 'agi',
    quotes: [
      'Tourniquet tight, infection checked. You’ll live.',
      'Hold still. Pain means the nerves are still firing.',
      'I keep people breathing. That’s my only creed.'
    ]
  },
  engineer: {
    label: 'Combat Machinist',
    role: 'engineer',
    sexBias: null,
    builds: ['athletic', 'stocky', 'average'],
    hairStyles: ['buzz', 'messy', 'short', 'dreads'],
    facialHairBias: 0.45,
    faceMarks: ['bandage_cheek', 'dirt_smudge', 'none'],
    eyebrowMood: 'alert',
    tops: ['overalls', 'flannel', 'tank'],
    topColors: ['hazard_rust', 'flannel_red', 'worn_leather'],
    vests: ['tool_vest', 'hi_vis', 'none'],
    vestColors: ['hi_vis_safety', 'hunting_tan', 'biker_leather'],
    bottoms: ['work_pants', 'jeans'],
    bottomColors: ['khaki_tan', 'scavenger_grey', 'denim_navy'],
    headwears: ['welding_goggles', 'cap_bwd', 'beanie', 'none'],
    holster: 'holster_wrench',
    backGears: ['radio_pack', 'backpack_bedroll', 'none'],
    kneepads: true,
    bigArms: false,
    forcedPrimaryStat: 'int',
    forcedSecondaryStat: 'str',
    quotes: [
      'Give me scrap metal and twenty minutes; I’ll fix it.',
      'Colony walls only stand as long as the bracing holds.',
      'If it sparks before the collapse, I can make it hum.'
    ]
  },
  scavenger: {
    label: 'Wasteland Scout',
    role: 'scavenger',
    sexBias: null,
    builds: ['lanky', 'athletic', 'lean'],
    hairStyles: ['messy', 'dreads', 'long', 'mohawk', 'high_ponytail'],
    facialHairBias: 0.35,
    faceMarks: ['eyepatch_l', 'scar_slash', 'warpaint', 'none'],
    eyebrowMood: 'alert',
    tops: ['hoodie', 'tshirt', 'tank'],
    topColors: ['scavenger_grey', 'hazard_rust', 'camo_drab'],
    vests: ['bandolier', 'scrap_pauldron', 'hunting_pocket'],
    vestColors: ['scrap_plated', 'biker_leather'],
    bottoms: ['shorts', 'cargo_pants'],
    bottomColors: ['scavenger_grey', 'camo_drab'],
    headwears: ['beanie', 'boonie', 'gas_mask', 'bandana'],
    holster: 'holster_knife',
    backGears: ['backpack_bedroll', 'weapon_sling', 'none'],
    kneepads: true,
    bigArms: false,
    forcedPrimaryStat: 'agi',
    forcedSecondaryStat: 'cha',
    quotes: [
      'Quiet footsteps keep your throat intact out there.',
      'Found a stash beyond the tree line. Moving out.',
      'If it’s not bolted down, it belongs to the refuge.'
    ]
  },
  farmer: {
    label: 'Homestead Cultivator',
    role: 'farmer',
    sexBias: null,
    builds: ['average', 'stocky', 'athletic'],
    hairStyles: ['short', 'buzz', 'low_ponytail', 'top_bun'],
    facialHairBias: 0.55,
    faceMarks: ['none', 'dirt_smudge', 'bandage_cheek'],
    eyebrowMood: 'calm',
    tops: ['flannel', 'overalls', 'tshirt'],
    topColors: ['flannel_red', 'forest_pine', 'khaki_tan'],
    vests: ['hunting_pocket', 'none'],
    vestColors: ['hunting_tan'],
    bottoms: ['work_pants', 'jeans'],
    bottomColors: ['khaki_tan', 'denim_navy'],
    headwears: ['boonie', 'cap_fwd', 'none'],
    holster: 'holster_shears',
    backGears: ['backpack_bedroll', 'none'],
    kneepads: false,
    bigArms: false,
    forcedPrimaryStat: 'end',
    forcedSecondaryStat: 'int',
    quotes: [
      'Guns buy time, but crops buy tomorrow.',
      'Soil remembers how to feed us if we treat it right.',
      'Clean water and hearty potatoes keep the camp alive.'
    ]
  },
  hunter: {
    label: 'Wilderness Ranger',
    role: 'hunter',
    sexBias: null,
    builds: ['athletic', 'lean', 'lanky'],
    hairStyles: ['short', 'long', 'messy', 'low_ponytail'],
    facialHairBias: 0.45,
    faceMarks: ['scar_slash', 'eyepatch_r', 'none'],
    eyebrowMood: 'alert',
    tops: ['jacket', 'hoodie', 'flannel'],
    topColors: ['hazard_rust', 'forest_pine', 'camo_drab'],
    vests: ['hunting_pocket', 'bandolier'],
    vestColors: ['hunting_tan', 'biker_leather'],
    bottoms: ['cargo_pants', 'combat_fatigues'],
    bottomColors: ['tactical_olive', 'camo_drab', 'denim_navy'],
    headwears: ['boonie', 'cap_fwd', 'bandana', 'none'],
    holster: 'holster_knife',
    backGears: ['weapon_sling', 'backpack_bedroll'],
    kneepads: true,
    bigArms: false,
    forcedPrimaryStat: 'agi',
    forcedSecondaryStat: 'str',
    quotes: [
      'Wind from the west. Game is moving south.',
      'One shot in the fog is all you get. Make it count.',
      'The wild doesn’t forgive hesitation.'
    ]
  },
  raider_defector: {
    label: 'Renegade Outrider',
    role: 'guard',
    sexBias: null,
    builds: ['brawler', 'athletic'],
    hairStyles: ['mohawk', 'dreads', 'buzz'],
    facialHairBias: 0.5,
    faceMarks: ['warpaint', 'eyepatch_r', 'scar_cross'],
    eyebrowMood: 'furrowed',
    tops: ['tank', 'jacket'],
    topColors: ['raider_burgundy', 'stealth_black'],
    vests: ['scrap_pauldron', 'bandolier'],
    vestColors: ['biker_leather', 'scrap_plated'],
    bottoms: ['combat_fatigues', 'shorts'],
    bottomColors: ['stealth_black', 'hazard_rust'],
    headwears: ['bandana', 'gas_mask', 'none'],
    holster: 'holster_pistol',
    backGears: ['weapon_sling', 'none'],
    kneepads: true,
    bigArms: true,
    forcedPrimaryStat: 'str',
    forcedSecondaryStat: 'agi',
    quotes: [
      'Turned my back on the raider warlords. This camp is real.',
      'I know how the wolves hunt because I used to run with them.',
      'Point me at the breach. Let me earn my keep.'
    ]
  }
};

// ---------------------------------------------------------------------------
// Procedural Survivor Generator (DNA Creation)
// ---------------------------------------------------------------------------
export function generateProceduralSurvivor(seedInput = null, archetypeKey = null) {
  const seed = seedInput != null
    ? (typeof seedInput === 'number' ? seedInput : hashStringSeed(String(seedInput)))
    : Math.floor(Math.random() * 0x7fffffff);
  const rng = prngStream(seed);

  const archetypesList = Object.keys(ARCHETYPES);
  const chosenArchetypeKey = archetypeKey && ARCHETYPES[archetypeKey] ? archetypeKey : rng.pick(archetypesList);
  const arch = ARCHETYPES[chosenArchetypeKey];

  // Sex & Identity
  const sexRoll = rng.next();
  const sex = arch.sexBias ? arch.sexBias : (sexRoll < 0.47 ? 'M' : sexRoll < 0.94 ? 'F' : 'NB');
  const firstName = sex === 'NB' ? rng.pick(FIRST_NAMES.NB) : rng.pick(FIRST_NAMES[sex]);
  const surname = rng.pick(SURNAMES);
  const callsign = rng.pick(CALLSIGNS);
  const name = `${firstName} "${callsign}" ${surname}`;
  const quote = rng.pick(arch.quotes);

  // Proportions and Body Build
  const build = rng.pick(arch.builds);
  let tw = 3, torsoH = 8, legLen = 7, legW = 2, lean = 0, bigArms = arch.bigArms;
  if (build === 'stocky') { tw = 4; torsoH = 8; legLen = 6; legW = 3; }
  else if (build === 'brawler') { tw = 4; torsoH = 9; legLen = 7; legW = 3; bigArms = true; }
  else if (build === 'lanky') { tw = 3; torsoH = 8; legLen = 8; legW = 2; lean = 1; }
  else if (build === 'lean') { tw = 3; torsoH = 7; legLen = 7; legW = 2; }
  else if (sex === 'F' && build === 'average') { torsoH = 7; }

  // Skin Palette (4 Tones: deep shadow, shadow, base, highlight)
  const skinKeys = Object.keys(SKIN_PALETTES);
  const skinKey = rng.pick(skinKeys);
  const skin = SKIN_PALETTES[skinKey].tones;

  // Hair Style and Color
  const hairStyle = rng.pick(arch.hairStyles);
  const hairColorKey = rng.pick(Object.keys(HAIR_PALETTES));
  const hairC = HAIR_PALETTES[hairColorKey].tones;

  // Facial Hair
  const hasFacialHair = (sex === 'M' || sex === 'NB') && rng.bool(arch.facialHairBias);
  const facialHairStyles = ['stubble', 'goatee', 'full_beard', 'mustache', 'mutton_chops'];
  const facialHair = hasFacialHair ? rng.pick(facialHairStyles) : 'clean';
  const facialHairC = hairC;

  // Face Distinguishing Mark & Eyebrow Mood
  const faceMark = rng.pick(arch.faceMarks);
  const eyebrowMood = arch.eyebrowMood || 'alert';

  // Upper Body Clothing
  const topStyle = rng.pick(arch.tops);
  const topColorKey = rng.pick(arch.topColors);
  const top = CLOTH_PALETTES[topColorKey]?.tones || CLOTH_PALETTES.denim_navy.tones;
  const sleeve = topStyle === 'tank' ? 0 : topStyle === 'tshirt' ? 3 : 5;

  // Outerwear / Vest
  const vestStyle = rng.pick(arch.vests);
  const vestColorKey = rng.pick(arch.vestColors);
  const vest = vestStyle !== 'none' ? (VEST_PALETTES[vestColorKey]?.tones || VEST_PALETTES.tactical_black.tones) : null;

  // Lower Body Clothing
  const bottomStyle = rng.pick(arch.bottoms);
  const bottomColorKey = rng.pick(arch.bottomColors);
  const bot = CLOTH_PALETTES[bottomColorKey]?.tones || CLOTH_PALETTES.scavenger_grey.tones;
  const shorts = bottomStyle === 'shorts';
  const kneepads = arch.kneepads && rng.bool(0.7);

  // Headwear
  const headwear = rng.pick(arch.headwears);
  const headwearColorKey = rng.pick(Object.keys(HEADWEAR_PALETTES));
  const hatC = headwear !== 'none' ? HEADWEAR_PALETTES[headwearColorKey].tones : null;

  // Holstered Side Tool / Weapon
  const holster = arch.holster || 'none';

  // Back Gear
  const backGear = rng.pick(arch.backGears || ['none', 'backpack_bedroll']);

  // Walk Animation FPS Tuning
  const fps = rng.pick([1.1, 1.2, 1.3]);

  // Simulation Stats Generation (Fully compatible with game model!)
  const statOptions = {
    forcedPrimaryStat: arch.forcedPrimaryStat,
    forcedSecondaryStat: arch.forcedSecondaryStat,
    qualityFloor: 5,
    qualityShift: rng.int(-2, 3),
    levelOverride: 1,
  };
  let statsObj;
  try {
    statsObj = generateStats(seed, 1, 'recruit', statOptions);
  } catch (err) {
    statsObj = {
      stats: { str: 5, agi: 5, end: 5, int: 5, cha: 5 },
      aptitudes: { primary: arch.forcedPrimaryStat || 'str', secondary: arch.forcedSecondaryStat || 'end', weak: 'cha' },
      quality: 10,
      budget: 20
    };
  }

  return {
    id: `proc_${seed.toString(16)}`,
    seed,
    name,
    firstName,
    surname,
    callsign,
    sex,
    build,
    role: arch.role,
    archetype: arch.label,
    archetypeKey: chosenArchetypeKey,
    quote,

    // Anatomy & Proportions
    tw,
    torsoH,
    legLen,
    legW,
    lean,
    bigArms,
    shadow: tw > 3 ? 6 : 5,
    fps,
    human: true,

    // Skin & Head
    skinKey,
    skin,
    hairStyle,
    hairColorKey,
    hairC,
    facialHair,
    facialHairC,
    faceMark,
    eyebrowMood,

    // Clothing
    topStyle,
    topColorKey,
    top,
    sleeve,
    vestStyle,
    vestColorKey,
    vest,
    bottomStyle,
    bottomColorKey,
    bot,
    shorts,
    kneepads,

    // Headwear & Gear
    headwear,
    headwearColorKey,
    hatC,
    holster,
    backGear,

    // Gameplay Attributes
    stats: statsObj.stats,
    aptitudes: statsObj.aptitudes,
    quality: statsObj.quality,
    budget: statsObj.budget,
    level: 1,
    condition: 'healthy',
    hp: 60 + statsObj.stats.end * 9,
    maxHP: 60 + statsObj.stats.end * 9,
  };
}

// ---------------------------------------------------------------------------
// Pixel-Level Procedural Frame Renderer (24×28 Top-Down 3/4 Frame)
// ---------------------------------------------------------------------------
export function renderSurvivorFrame(dna, dir, f) {
  const s = new Spr(FRAME_W, FRAME_H);
  const cx = 12;
  const FT = 26; // Ground contact baseline (feet at rows 25-26)
  const sk = dna.skin;

  // Walk Cycle Rhythm:
  // Frame 0: Idle contact stance (both feet planted, bob = 0)
  // Frame 1: Left leg forward stride (bob = -1, head rises 1px to row 3)
  // Frame 2: Passing frame (bob = 0)
  // Frame 3: Right leg forward stride (bob = -1, head rises 1px to row 3)
  const CW = [1, 0, -1, 0][f];  // Arm swing direction
  const SW = [0, 1, 0, -1][f];  // Leg stride lift
  const bob = (f % 2 === 1) ? -1 : 0; // 1px authentic bob matching official walk cycle

  const hipY = FT - dna.legLen + 1;
  const legTop = hipY + bob;
  const shY = hipY - dna.torsoH + bob;
  const hdY = shY - 7; // Head starts at row 4 (or 3 during bob)

  const P = (x, y, c) => s.set(x, y, c);
  const R = (x0, y0, x1, y1, fn) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        P(x, y, typeof fn === 'function' ? fn(x, y) : fn);
      }
    }
  };
  const seg = (x0, y0, x1, y1, w, fn) => {
    s.line(x0, y0, x1, y1, (x, y) => {
      for (let i = 0; i < w; i++) P(x + i, y, fn(x + i, y, i));
    });
  };

  // Top directional lighting helper (light from top-left)
  const topColor = (x, y, k) => {
    if (dna.topStyle === 'flannel') {
      // 2-tone checked plaid pattern
      const isCheck = (x + y) % 2 === 0;
      return isCheck ? dna.top[Math.min(3, k + 1)] : dna.top[k];
    }
    return dna.top ? dna.top[k] : sk[k];
  };

  // 1. Ground Drop Shadow (Translucent elliptical footprint shadow)
  s.ellipseShadow(12, 26, dna.shadow, 1.8, 0.35);

  const front = dir === 's' || dir === 'se';
  const back = dir === 'n' || dir === 'ne';
  const side = dir === 'e';
  const dg = dir.length === 2 ? 1 : 0;
  const hc = cx + dg;

  if (!side) {
    // -----------------------------------------------------------------------
    // FRONT / BACK / DIAGONAL RENDERING (s, n, se, ne)
    // -----------------------------------------------------------------------

    // Back Gear (Drawn behind body in north and back-diagonal views)
    if (back && dna.backGear && dna.backGear !== 'none') {
      renderBackGear(s, dna, cx, shY, hipY, true);
    }

    // Legs & Feet (Front / Back / Diagonal)
    // In Frame 0: both feet grounded at y=25..26.
    // In Frame 1: left leg stepped/lifted (SW > 0), right leg planted.
    // In Frame 3: right leg stepped/lifted (SW < 0), left leg planted.
    const leftLift = (SW > 0 ? 1 : 0);
    const rightLift = (SW < 0 ? 1 : 0);

    const legs = [
      { x0: cx - dna.tw + (dg ? 1 : 0), lift: leftLift, isLeft: true },
      { x0: cx + dna.tw - dna.legW + (dg ? 1 : 0), lift: rightLift, isLeft: false }
    ];

    for (const { x0, lift, isLeft } of legs) {
      const footBottom = FT - lift;
      for (let y = legTop; y <= footBottom; y++) {
        for (let i = 0; i < dna.legW; i++) {
          const x = x0 + i;
          // Left-to-right lighting ramp (2 = highlight/base, 0 = shadow)
          const k = i === 0 ? 2 : i === dna.legW - 1 ? 0 : 1;
          
          let c;
          if (y >= footBottom - 1) {
            // 2-tone Combat boot: lugged sole base + leather toe cap
            c = (y === footBottom) ? BOOT_SOLE : BOOT_TOE;
          } else if (dna.shorts && y > legTop + 2) {
            // Bare legs with shorts
            c = sk[k];
          } else {
            // Trousers / Fatigues
            c = dna.bot[k];
          }

          // Tactical kneepad overlay (front view only)
          if (dna.kneepads && front && y === legTop + 3 && !dna.shorts) {
            c = DW[1]; // Tough dark polymer kneepad
          }

          P(x, y, c);
        }
      }
    }

    // Torso Base (Chest & Abdomen)
    const torsoLeft = cx - dna.tw + (dg ? 1 : 0);
    const torsoRight = cx + dna.tw - 1 + (dg ? 1 : 0);
    R(torsoLeft, shY, torsoRight, hipY - 1 + bob, (x, y) => {
      // Shading ramp: highlight on left edge, base in center, shadow on right edge
      let k = (x === torsoLeft) ? 3 : (x === torsoRight) ? 1 : 2;
      if (y === hipY - 1 + bob) k = Math.max(0, k - 1); // Beltline shadow
      return topColor(x, y, k);
    });

    // Open Doctor / Medic Lab Coat (authentic to canonical doctor.png!)
    if (dna.topStyle === 'labcoat' && front) {
      const undershirtColor = CLOTH_PALETTES.denim_navy.tones[1];
      // Undershirt visible down the center chest
      R(cx, shY + 2, cx + 1, hipY - 2 + bob, undershirtColor);
      // Lab coat lapels (flared open on sides)
      P(cx - 1, shY + 2, dna.top[3]);
      P(cx + 2, shY + 2, dna.top[1]);
      // Lab coat bottom hem extends slightly over thighs
      R(torsoLeft, hipY + bob, torsoLeft + 1, hipY + 1 + bob, dna.top[2]);
      R(torsoRight - 1, hipY + bob, torsoRight, hipY + 1 + bob, dna.top[0]);
    }

    // Overalls Bib & Straps (authentic to canonical mechanic.png!)
    if (dna.topStyle === 'overalls' && front) {
      const overallC = dna.bot;
      // Shoulder suspender straps
      P(torsoLeft + 1, shY, overallC[2]);
      P(torsoLeft + 1, shY + 1, overallC[2]);
      P(torsoRight - 1, shY, overallC[1]);
      P(torsoRight - 1, shY + 1, overallC[1]);
      // Front bib
      R(torsoLeft + 1, shY + 2, torsoRight - 1, hipY - 1 + bob, overallC[2]);
      // Brass buckles on straps
      P(torsoLeft + 1, shY + 2, '#c5a044');
      P(torsoRight - 1, shY + 2, '#c5a044');
    }

    // Arms & Hands (Front / Back / Diagonal)
    const aw = dna.bigArms ? 3 : 2;
    const armSwing = CW;
    const leftArmX = torsoLeft - aw;
    const rightArmX = torsoRight + 1;
    const armLen = dna.torsoH - 1;

    // Left Arm (Swings forward when armSwing > 0)
    renderArm(s, dna, leftArmX, shY + 1 + Math.max(0, -armSwing), armLen, aw, false, false);
    // Right Arm (Swings forward when armSwing < 0)
    renderArm(s, dna, rightArmX, shY + 1 + Math.max(0, armSwing), armLen, aw, true, false);

    // Vest / Outerwear Overlay
    if (dna.vest && dna.vestStyle !== 'none') {
      const v = dna.vest;
      R(torsoLeft + 1, shY + 1, torsoRight - 1, hipY - 2 + bob, (x, y) => {
        if (dna.vestStyle === 'bandolier') {
          // Diagonal ammunition belt across torso
          const diagOffset = (x - torsoLeft) - (y - shY);
          if (Math.abs(diagOffset) <= 1) {
            // Ammunition brass shell dots
            return (y % 2 === 0) ? '#d4af37' : v[1];
          }
          return topColor(x, y, 2);
        }
        if (dna.vestStyle === 'scrap_pauldron') {
          // Heavy steel shoulder plate on left side
          if (x <= torsoLeft + 2 && y <= shY + 3) return (x === torsoLeft + 1 && y === shY + 1) ? '#8fa1ad' : v[2];
          return topColor(x, y, 2);
        }
        if (dna.vestStyle === 'hi_vis') {
          // Horizontal reflective silver strip across chest
          if (y === shY + 3) return '#e8f0f8';
          return v[2];
        }
        if (dna.vestStyle === 'medic_cross' && front) {
          // White medical harness with red cross patch
          if (y === shY + 3 && x === cx) return '#c42e2e'; // Red horizontal bar
          if ((y === shY + 2 || y === shY + 4) && x === cx) return '#c42e2e'; // Red vertical bar
          if (Math.abs(x - cx) <= 1 && Math.abs(y - (shY + 3)) <= 1) return '#ffffff'; // White square
          return v[1];
        }
        // Tactical vest base
        return (x === torsoLeft + 1) ? v[3] : (x === torsoRight - 1) ? v[0] : v[2];
      });

      // Tactical front ammo pouches
      if (front && dna.vestStyle === 'tactical') {
        P(cx - 2, shY + 4, v[0]);
        P(cx - 1, shY + 4, v[1]);
        P(cx + 1, shY + 4, v[0]);
        P(cx + 2, shY + 4, v[1]);
      }
    }

    // Holstered Tool / Side Weapon (Belt line)
    if (front && dna.holster && dna.holster !== 'none') {
      renderHolster(s, dna, torsoRight, hipY - 2 + bob);
    }

    // Neck Connection (Connects head to torso, preventing floating head)
    R(hc - 1, hdY + 6, hc, hdY + 6, sk[1]);

    // Head Base (Row hdY to hdY + 5)
    // Rounded oval shape with top-left highlight
    R(hc - 3, hdY, hc + 2, hdY + 5, (x, y) => {
      if (y === hdY + 5) return sk[1]; // Chin shadow
      if (x === hc - 3) return sk[3];  // Left highlight
      if (x === hc + 2) return sk[1];  // Right shade
      return sk[2];                    // Center base
    });

    // Face Rendering (Eyes, Brows, Lips, Scars)
    if (front) {
      renderFaceFront(s, dna, dg, hc, hdY, sk);
    }

    // Facial Hair (Front View)
    if (dna.facialHair && dna.facialHair !== 'clean' && front) {
      renderFacialHairFront(s, dna, dg, hc, hdY);
    }

    // Hair & Headwear (Front & Back)
    renderHairAndHeadwearFB(s, dna, front, dg, hc, hdY);

  } else {
    // -----------------------------------------------------------------------
    // SIDE PROFILE RENDERING (dir === 'e')
    // -----------------------------------------------------------------------
    const L = dna.lean;
    const hw = dna.tw > 3 ? 4 : 2;
    const sx = cx + L;

    // Back Gear (Drawn on back side of character)
    if (dna.backGear && dna.backGear !== 'none') {
      renderBackGear(s, dna, sx - hw, shY, hipY, false);
    }

    // Scissoring Legs (Far Leg & Near Leg)
    // Near leg swings forward with SW > 0; Far leg swings opposite
    const legC = (far) => (x, y, i) => {
      if (y >= FT - 1) return (y === FT) ? BOOT_SOLE : BOOT_TOE;
      if (dna.shorts && y > legTop + 2) return sk[far ? 1 : 2];
      return dna.bot[far ? 0 : (i === 0 ? 2 : 1)];
    };

    // Far Leg (Drawn in background shadow)
    const farFootX = sx - 3 * CW;
    const farLift = (SW < 0 ? 1 : 0);
    seg(sx - 1, legTop, farFootX, FT - farLift, dna.legW, legC(true));
    P(farFootX + dna.legW - 1, FT - farLift, BOOT_SOLE);

    // Far Arm (Drawn in background shadow)
    const aw = dna.bigArms ? 3 : 2;
    renderArm(s, dna, sx, shY + 1, dna.torsoH - 1, aw, false, true, 3 * CW);

    // Torso (Side Profile)
    R(sx - hw, shY, sx + hw - 1, hipY - 1 + bob, (x, y) => {
      let k = (x === sx - hw) ? 2 : (x === sx + hw - 1) ? 0 : 1;
      if (y === hipY - 1 + bob) k = 0; // Beltline shadow
      return topColor(x, y, k);
    });

    // Side Vest Overlay
    if (dna.vest && dna.vestStyle !== 'none') {
      R(sx - hw, shY + 1, sx + hw - 1, hipY - 2 + bob, (x, y) => {
        return (x === sx + hw - 1) ? dna.vest[0] : (x === sx - hw) ? dna.vest[3] : dna.vest[1];
      });
    }

    // Near Leg (Drawn in foreground)
    const nearFootX = sx + 3 * CW;
    const nearLift = (SW > 0 ? 1 : 0);
    seg(sx, legTop, nearFootX, FT - nearLift, dna.legW, legC(false));
    P(nearFootX + dna.legW - 1, FT - nearLift, BOOT_SOLE);

    // Near Arm (Drawn in foreground)
    renderArm(s, dna, sx - 1, shY + 1, dna.torsoH - 1, aw, false, false, -3 * CW);

    // Holstered Side Tool (Visible on side profile)
    if (dna.holster && dna.holster !== 'none') {
      renderHolster(s, dna, sx + hw - 1, hipY - 2 + bob);
    }

    // Head (Side Profile)
    const hx = sx - 2;
    R(hx, hdY, hx + 4, hdY + 5, (x, y) => {
      if (y === hdY + 5) return sk[1]; // Chin/jaw
      if (x === hx) return sk[1];     // Back of head
      if (x === hx + 4) return sk[3]; // Nose/brow highlight
      return sk[2];
    });

    // Ear definition on side profile
    P(hx + 1, hdY + 3, sk[1]);

    // Eye, Nose, Lip Profile
    renderFaceSide(s, dna, hx, hdY, sk);

    // Facial Hair (Side Profile)
    if (dna.facialHair && dna.facialHair !== 'clean') {
      renderFacialHairSide(s, dna, hx, hdY);
    }

    // Hair & Headwear (Side Profile)
    renderHairAndHeadwearSide(s, dna, hx, hdY);
  }

  // Final Outline: Warm dark charcoal outline (#1a1e16) with corner rounding
  s.outline(OUTLINE_DARK);
  return s;
}

// ---------------------------------------------------------------------------
// Arm Rendering Helper (Handles sleeve length, skin tones, swinging)
// ---------------------------------------------------------------------------
function renderArm(s, dna, x0, y0, len, aw, isRight, isFar, swingOffset = 0) {
  const sk = dna.skin;
  const P = (x, y, c) => s.set(x, y, c);

  for (let j = 0; j < len; j++) {
    const y = y0 + j;
    const dx = Math.round((j / len) * swingOffset);
    for (let i = 0; i < aw; i++) {
      const x = x0 + i + dx;
      const isSleeve = j < (dna.sleeve ?? 3) && dna.top && !dna.bigArms;
      const isHand = j >= len - 2;

      let c;
      if (isFar) {
        c = isHand ? sk[1] : isSleeve ? dna.top[0] : sk[0];
      } else {
        const k = (i === 0) ? 2 : 1;
        c = isHand ? sk[k + 1] : isSleeve ? (dna.top ? dna.top[k] : sk[k]) : sk[k];
      }
      P(x, y, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Face Sub-Renderer (Front & 3/4 Diagonal)
// ---------------------------------------------------------------------------
function renderFaceFront(s, dna, dg, hc, hdY, sk) {
  const P = (x, y, c) => s.set(x, y, c);
  const e = dg;

  // Eyebrows (Expression based on archetype)
  const browC = dna.hairC[0];
  if (dna.eyebrowMood === 'furrowed') {
    P(hc - 2 + e, hdY + 2, browC);
    P(hc - 1 + e, hdY + 2, sk[1]);
    P(hc + e, hdY + 2, sk[1]);
    P(hc + 1 + e, hdY + 2, browC);
  } else {
    P(hc - 2 + e, hdY + 2, browC);
    P(hc + 1 + e, hdY + 2, browC);
  }

  // Eyes: 2-Tone Eye Rendering (Pupil + Sclera / Catchlight)
  P(hc - 2 + e, hdY + 3, EYE_PUPIL);
  P(hc - 1 + e, hdY + 3, EYE_SCLERA); // Left eye sclera catchlight
  if (hc + 1 + e <= hc + 2) {
    P(hc + 1 + e, hdY + 3, EYE_PUPIL);
    P(hc + 2 + e, hdY + 3, EYE_SCLERA); // Right eye sclera catchlight
  }

  // Nose bridge & tip
  P(hc + e, hdY + 3, sk[3]); // Nose highlight
  P(hc + e, hdY + 4, sk[1]); // Nose nostril shadow

  // Lips / Mouth Line
  P(hc - 1 + e, hdY + 5, sk[0]);
  P(hc + e, hdY + 5, sk[1]);

  // Distinguishing Facial Marks
  if (dna.faceMark === 'eyepatch_l') {
    P(hc - 2 + e, hdY + 3, '#141416');
    P(hc - 1 + e, hdY + 3, '#141416');
    P(hc - 2 + e, hdY + 2, '#2c2e33'); // Strap
  } else if (dna.faceMark === 'eyepatch_r') {
    P(hc + 1 + e, hdY + 3, '#141416');
    P(hc + 2 + e, hdY + 3, '#141416');
    P(hc + 1 + e, hdY + 2, '#2c2e33'); // Strap
  } else if (dna.faceMark === 'scar_slash') {
    P(hc - 2 + e, hdY + 1, '#782d25');
    P(hc - 1 + e, hdY + 2, '#8a332a');
    P(hc + e, hdY + 3, '#5c1e18');
  } else if (dna.faceMark === 'scar_cross') {
    P(hc + 1 + e, hdY + 3, '#782d25');
    P(hc + 2 + e, hdY + 3, '#782d25');
    P(hc + 1 + e, hdY + 2, '#782d25');
    P(hc + 1 + e, hdY + 4, '#782d25');
  } else if (dna.faceMark === 'warpaint') {
    P(hc - 2 + e, hdY + 4, '#8a2b22');
    P(hc - 1 + e, hdY + 4, '#8a2b22');
    P(hc + 1 + e, hdY + 4, '#8a2b22');
  } else if (dna.faceMark === 'bandage_cheek') {
    P(hc + 1 + e, hdY + 4, '#d8d4c9');
    P(hc + 2 + e, hdY + 4, '#b0ab9f');
  } else if (dna.faceMark === 'dirt_smudge') {
    P(hc - 2 + e, hdY + 4, '#38342e');
    P(hc - 1 + e, hdY + 4, '#47423b');
  }
}

// ---------------------------------------------------------------------------
// Face Sub-Renderer (Side Profile)
// ---------------------------------------------------------------------------
function renderFaceSide(s, dna, hx, hdY, sk) {
  const P = (x, y, c) => s.set(x, y, c);

  // Brow & Forehead
  P(hx + 3, hdY + 2, dna.hairC[0]);
  // Eye: Pupil + Sclera
  P(hx + 3, hdY + 3, EYE_PUPIL);
  P(hx + 2, hdY + 3, EYE_SCLERA);
  // Nose protrusion
  P(hx + 4, hdY + 3, sk[3]);
  P(hx + 4, hdY + 4, sk[1]);
  // Mouth
  P(hx + 3, hdY + 5, sk[0]);

  // Distinguishing Mark (Side Profile)
  if (dna.faceMark === 'eyepatch_l' || dna.faceMark === 'eyepatch_r') {
    P(hx + 3, hdY + 3, '#141416');
    P(hx + 2, hdY + 3, '#2c2e33');
  } else if (dna.faceMark === 'scar_slash') {
    P(hx + 2, hdY + 2, '#782d25');
    P(hx + 3, hdY + 4, '#782d25');
  } else if (dna.faceMark === 'bandage_cheek') {
    P(hx + 2, hdY + 4, '#d8d4c9');
  }
}

// ---------------------------------------------------------------------------
// Facial Hair Sub-Renderers
// ---------------------------------------------------------------------------
function renderFacialHairFront(s, dna, dg, hc, hdY) {
  const P = (x, y, c) => s.set(x, y, c);
  const R = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  };
  const H = dna.facialHairC;
  const l = hc - 3, r = hc + 2;

  if (dna.facialHair === 'stubble') {
    P(hc - 2, hdY + 4, H[0]);
    P(hc + 1, hdY + 4, H[0]);
    P(hc - 1, hdY + 5, H[0]);
    P(hc, hdY + 5, H[0]);
  } else if (dna.facialHair === 'mustache') {
    R(l + 1, hdY + 4, r - 1, hdY + 4, H[1]);
    P(l + 1, hdY + 5, H[0]);
    P(r - 1, hdY + 5, H[0]);
  } else if (dna.facialHair === 'goatee') {
    P(hc - 1, hdY + 4, H[1]);
    P(hc, hdY + 4, H[1]);
    R(hc - 1, hdY + 5, hc, hdY + 6, H[0]);
  } else if (dna.facialHair === 'full_beard') {
    R(l, hdY + 4, r, hdY + 5, (x, y) => (y === hdY + 4 && (x === hc - 1 + dg || x === hc + dg) ? H[1] : H[0]));
    R(l + 1, hdY + 6, r - 1, hdY + 6, H[0]);
  } else if (dna.facialHair === 'mutton_chops') {
    R(l, hdY + 3, l + 1, hdY + 5, H[0]);
    R(r - 1, hdY + 3, r, hdY + 5, H[0]);
  }
}

function renderFacialHairSide(s, dna, hx, hdY) {
  const P = (x, y, c) => s.set(x, y, c);
  const R = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  };
  const H = dna.facialHairC;

  if (dna.facialHair === 'full_beard' || dna.facialHair === 'goatee') {
    R(hx + 1, hdY + 4, hx + 4, hdY + 5, (x, y) => (x === hx + 4 && y === hdY + 4 ? H[1] : H[0]));
  } else if (dna.facialHair === 'stubble') {
    P(hx + 3, hdY + 4, H[0]);
    P(hx + 2, hdY + 5, H[0]);
  } else if (dna.facialHair === 'mustache') {
    P(hx + 3, hdY + 4, H[1]);
    P(hx + 4, hdY + 4, H[0]);
  }
}

// ---------------------------------------------------------------------------
// Hair & Headwear Sub-Renderers (Front/Back & Side)
// ---------------------------------------------------------------------------
function renderHairAndHeadwearFB(s, dna, front, dg, hc, hdY) {
  const H = dna.hairC;
  const P = (x, y, c) => s.set(x, y, c);
  const R = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  };
  const l = hc - 3, r = hc + 2;
  const st = dna.hairStyle;
  const hc_ = (x, y) => ((x % 3 === 1 && (y + x) % 4 !== 0) ? (H[2] || H[1]) : H[0]);

  if (st === 'buzz') {
    R(l, hdY, r, hdY, hc_);
    if (!front) R(l, hdY + 1, r, hdY + 2, hc_);
  } else if (st === 'short') {
    R(l + 1, hdY - 1, r - 1, hdY - 1, H[2] || H[1]);
    R(l, hdY, r, hdY, hc_);
    if (front) {
      P(l, hdY + 1, H[0]);
      P(r, hdY + 1, H[0]);
      if (!dg) P(l + 1, hdY + 1, H[1]);
    } else {
      R(l, hdY + 1, r, hdY + 3, hc_);
    }
  } else if (st === 'messy') {
    R(l, hdY - 2, r, hdY - 1, (x, y) => ((x + y) % 2 ? (H[2] || H[1]) : H[0]));
    R(l, hdY, r, hdY, hc_);
    if (!front) R(l, hdY + 1, r, hdY + 3, hc_);
    else { P(l, hdY + 1, H[0]); P(r, hdY + 1, H[0]); }
  } else if (st === 'high_ponytail') {
    R(l + 1, hdY - 1, r - 1, hdY - 1, H[1]);
    R(l, hdY, r, hdY, hc_);
    if (front) {
      P(l, hdY + 1, H[0]);
      P(r, hdY + 1, H[0]);
    } else {
      R(hc - 1, hdY + 2, hc, hdY + 8, hc_);
      P(hc - 1, hdY + 1, '#d44a37'); // Hair tie
    }
  } else if (st === 'low_ponytail') {
    R(l + 1, hdY - 1, r - 1, hdY - 1, H[1]);
    R(l, hdY, r, hdY, hc_);
    if (front) {
      P(l, hdY + 1, H[0]);
      P(r, hdY + 1, H[0]);
    } else {
      R(hc - 1, hdY + 4, hc, hdY + 9, hc_);
    }
  } else if (st === 'top_bun') {
    R(l + 1, hdY - 1, r - 1, hdY - 1, H[1]);
    R(l, hdY, r, hdY, hc_);
    R(hc - 2, hdY - 3, hc + 1, hdY - 2, hc_);
    P(hc - 1, hdY - 4, H[1]);
  } else if (st === 'long') {
    R(l + 1, hdY - 1, r - 1, hdY - 1, H[2] || H[1]);
    R(l, hdY, r, hdY, hc_);
    if (front) {
      R(l - 1, hdY + 1, l, hdY + 8, hc_);
      if (!dg) R(r, hdY + 1, r + 1, hdY + 8, hc_);
      else R(r, hdY + 1, r, hdY + 3, hc_);
    } else {
      R(l - 1, hdY + 1, r + 1, hdY + 8, hc_);
    }
  } else if (st === 'dreads') {
    R(l + 1, hdY - 1, r - 1, hdY - 1, H[1]);
    R(l, hdY, r, hdY, hc_);
    if (front) {
      P(l - 1, hdY + 2, H[0]); P(l - 1, hdY + 4, '#c5a044'); P(l - 1, hdY + 6, H[0]);
      P(r + 1, hdY + 2, H[0]); P(r + 1, hdY + 4, '#c5a044'); P(r + 1, hdY + 6, H[0]);
    } else {
      R(l - 1, hdY + 1, r + 1, hdY + 7, (x, y) => (x % 2 === 0 ? H[0] : H[1]));
    }
  } else if (st === 'mohawk') {
    R(hc - 1, hdY - 3, hc, hdY, (x, y) => ((x + y) % 2 ? (H[2] || H[1]) : H[0]));
    if (!front) R(hc - 1, hdY + 1, hc, hdY + 4, H[0]);
  }

  // Headwear Overlay (Front & Back)
  if (dna.headwear && dna.headwear !== 'none') {
    const C = dna.hatC || HEADWEAR_PALETTES.tactical_dark.tones;
    if (dna.headwear === 'beanie') {
      if (!front) R(l, hdY + 2, r, hdY + 3, hc_);
      else { P(l, hdY + 2, H[0]); P(r, hdY + 2, H[0]); }
      R(l + 1, hdY - 2, r - 1, hdY - 2, C[3] || C[2]);
      R(l, hdY - 1, r, hdY + 1, (x, y) => (y === hdY + 1 ? (C[3] || C[2]) : x === r ? C[0] : C[1]));
    } else if (dna.headwear === 'cap_fwd') {
      R(l + 1, hdY - 2, r - 1, hdY - 2, C[3] || C[2]);
      R(l, hdY - 1, r, hdY + 1, (x, y) => (x === r ? C[0] : C[1]));
      if (front) R(l, hdY + 2, r + dg, hdY + 2, C[0]); // Visor rim
      if (!front) R(l, hdY + 2, r, hdY + 3, hc_);
    } else if (dna.headwear === 'cap_bwd') {
      R(l + 1, hdY - 2, r - 1, hdY - 2, C[3] || C[2]);
      R(l, hdY - 1, r, hdY + 1, (x, y) => (x === r ? C[0] : C[1]));
      if (!front) R(l, hdY + 2, r + dg, hdY + 2, C[0]);
      else { P(l, hdY + 2, H[0]); P(r, hdY + 2, H[0]); }
    } else if (dna.headwear === 'boonie') {
      R(l - 1, hdY + 1, r + 1, hdY + 1, C[0]); // 360 degree sun brim
      R(l, hdY - 1, r, hdY, C[1]);
      R(l + 1, hdY - 2, r - 1, hdY - 2, C[2]);
    } else if (dna.headwear === 'bandana') {
      R(l, hdY + 1, r, hdY + 1, C[2]);
      if (!front) P(hc, hdY + 2, C[1]);
    } else if (dna.headwear === 'tactical_helmet') {
      R(l - 1, hdY - 1, r + 1, hdY + 1, (x, y) => (y === hdY - 1 ? (C[3] || C[2]) : C[1]));
      R(l - 1, hdY + 2, r + 1, hdY + 2, C[0]); // Helmet rim
      if (!front) R(l, hdY + 3, r, hdY + 3, C[0]);
    } else if (dna.headwear === 'gas_mask' && front) {
      // Full NBC Gas Mask / Respirator
      R(hc - 2, hdY + 3, hc + 1, hdY + 5, C[0]);
      P(hc - 1, hdY + 3, '#1c1c1f'); // Left glass eye lens
      P(hc, hdY + 3, '#1c1c1f');     // Right glass eye lens
      P(hc - 1, hdY + 5, '#44484d'); // Canister filter
      P(hc, hdY + 5, '#44484d');
    } else if (dna.headwear === 'welding_goggles') {
      R(l, hdY + 1, r, hdY + 1, C[0]);
      P(l + 1, hdY + 1, '#1b3b38'); // Tinted glass
      P(r - 1, hdY + 1, '#1b3b38');
    }
  }
}

function renderHairAndHeadwearSide(s, dna, hx, hdY) {
  const H = dna.hairC;
  const P = (x, y, c) => s.set(x, y, c);
  const R = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  };
  const st = dna.hairStyle;
  const hc_ = (x, y) => ((x % 3 === 1 && (y + x) % 4 !== 0) ? (H[2] || H[1]) : H[0]);

  if (st === 'buzz') {
    R(hx, hdY, hx + 3, hdY, hc_);
    R(hx, hdY + 1, hx, hdY + 2, H[0]);
  } else if (st === 'short') {
    R(hx, hdY - 1, hx + 3, hdY - 1, H[2] || H[1]);
    R(hx, hdY, hx + 4, hdY, hc_);
    R(hx, hdY + 1, hx + 1, hdY + 1, hc_);
    R(hx, hdY + 2, hx, hdY + 3, H[0]);
  } else if (st === 'messy') {
    R(hx - 1, hdY - 2, hx + 3, hdY - 1, (x, y) => ((x + y) % 2 ? (H[2] || H[1]) : H[0]));
    R(hx, hdY, hx + 4, hdY, hc_);
    R(hx, hdY + 1, hx + 1, hdY + 2, H[0]);
  } else if (st === 'high_ponytail' || st === 'low_ponytail') {
    R(hx, hdY - 1, hx + 3, hdY - 1, hc_);
    R(hx, hdY, hx + 4, hdY, hc_);
    R(hx - 2, hdY + 1, hx - 1, hdY + (st === 'high_ponytail' ? 6 : 8), hc_);
  } else if (st === 'top_bun') {
    R(hx, hdY - 1, hx + 3, hdY - 1, hc_);
    R(hx, hdY, hx + 4, hdY, hc_);
    R(hx - 1, hdY - 2, hx, hdY - 1, hc_);
  } else if (st === 'long') {
    R(hx, hdY - 1, hx + 3, hdY - 1, hc_);
    R(hx - 1, hdY, hx + 1, hdY + 8, hc_);
  } else if (st === 'dreads') {
    R(hx - 1, hdY - 1, hx + 3, hdY - 1, hc_);
    R(hx - 2, hdY, hx, hdY + 7, (x, y) => (x % 2 === 0 ? H[0] : H[1]));
  } else if (st === 'mohawk') {
    R(hx, hdY - 3, hx + 2, hdY - 1, (x, y) => ((x + y) % 2 ? (H[2] || H[1]) : H[0]));
  }

  // Headwear Overlay (Side Profile)
  if (dna.headwear && dna.headwear !== 'none') {
    const C = dna.hatC || HEADWEAR_PALETTES.tactical_dark.tones;
    if (dna.headwear === 'beanie') {
      R(hx, hdY + 2, hx, hdY + 3, H[0]);
      R(hx + 1, hdY - 2, hx + 3, hdY - 2, C[3] || C[2]);
      R(hx, hdY - 1, hx + 4, hdY + 1, (x, y) => (y === hdY + 1 ? (C[3] || C[2]) : C[1]));
    } else if (dna.headwear === 'cap_fwd') {
      R(hx + 1, hdY - 2, hx + 3, hdY - 2, C[3] || C[2]);
      R(hx, hdY - 1, hx + 4, hdY + 1, (x, y) => (x === hx + 4 ? C[0] : C[1]));
      R(hx + 5, hdY + 1, hx + 6, hdY + 1, C[0]); // Visor extending forward
    } else if (dna.headwear === 'cap_bwd') {
      R(hx + 1, hdY - 2, hx + 3, hdY - 2, C[3] || C[2]);
      R(hx, hdY - 1, hx + 4, hdY + 1, (x, y) => (x === hx + 4 ? C[0] : C[1]));
      R(hx - 2, hdY + 1, hx - 1, hdY + 1, C[0]); // Visor extending back
    } else if (dna.headwear === 'boonie') {
      R(hx - 2, hdY + 1, hx + 6, hdY + 1, C[0]);
      R(hx, hdY - 1, hx + 4, hdY, C[1]);
      R(hx + 1, hdY - 2, hx + 3, hdY - 2, C[2]);
    } else if (dna.headwear === 'bandana') {
      R(hx, hdY + 1, hx + 4, hdY + 1, C[2]);
      P(hx - 1, hdY + 2, C[1]); // Knot
    } else if (dna.headwear === 'tactical_helmet') {
      R(hx - 1, hdY - 1, hx + 5, hdY + 1, (x, y) => (y === hdY - 1 ? (C[3] || C[2]) : C[1]));
      R(hx - 1, hdY + 2, hx + 5, hdY + 2, C[0]);
    } else if (dna.headwear === 'gas_mask') {
      R(hx + 3, hdY + 3, hx + 5, hdY + 5, C[0]);
    } else if (dna.headwear === 'welding_goggles') {
      R(hx, hdY + 1, hx + 4, hdY + 1, C[0]);
      P(hx + 3, hdY + 1, '#1b3b38');
    }
  }
}

// ---------------------------------------------------------------------------
// Holstered Tool / Side Weapon Sub-Renderer
// ---------------------------------------------------------------------------
function renderHolster(s, dna, x, y) {
  const P = (x, y, c) => s.set(x, y, c);
  const h = dna.holster;

  if (h === 'holster_pistol') {
    P(x, y, '#22252a'); // Holster pouch
    P(x, y + 1, '#15171a');
    P(x + 1, y - 1, '#474c54'); // Pistol grip
  } else if (h === 'holster_wrench') {
    P(x, y, '#4a545e');
    P(x, y + 1, '#7a8591'); // Wrench handle
    P(x + 1, y - 1, '#96a2b0'); // Wrench head
  } else if (h === 'holster_knife') {
    P(x, y, '#473224'); // Leather sheath
    P(x, y + 1, '#332318');
    P(x, y - 1, '#1a1c1e'); // Knife hilt
  } else if (h === 'holster_medkit') {
    P(x, y, '#a62e2e'); // Red medical pouch
    P(x, y + 1, '#ffffff'); // White cross dot
  } else if (h === 'holster_shears') {
    P(x, y, '#423727');
    P(x, y + 1, '#78828f');
  }
}

// ---------------------------------------------------------------------------
// Back Gear Sub-Renderer (North / Back-Diagonal / Side Views)
// ---------------------------------------------------------------------------
function renderBackGear(s, dna, cx, shY, hipY, isBackView) {
  const P = (x, y, c) => s.set(x, y, c);
  const R = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) P(x, y, typeof c === 'function' ? c(x, y) : c);
    }
  };

  if (isBackView) {
    if (dna.backGear === 'backpack_bedroll') {
      // Rugged military pack with top bedroll
      R(cx - dna.tw + 1, shY + 1, cx + dna.tw - 2, hipY - 1, DW[1]);
      // Top rolled bedroll
      R(cx - dna.tw + 1, shY - 1, cx + dna.tw - 2, shY, '#3b5239');
      P(cx - dna.tw + 1, shY - 1, '#253624'); // Bedroll strap
      P(cx + dna.tw - 2, shY - 1, '#253624');
    } else if (dna.backGear === 'radio_pack') {
      // PRC longwave field radio
      R(cx - dna.tw + 1, shY + 1, cx + dna.tw - 2, hipY - 1, '#2c332b');
      // Whip antenna extending up
      P(cx + dna.tw - 2, shY - 3, '#757c85');
      P(cx + dna.tw - 2, shY - 2, '#757c85');
      P(cx + dna.tw - 2, shY - 1, '#757c85');
    } else if (dna.backGear === 'medic_pack') {
      // White medical pack with red cross
      R(cx - dna.tw + 1, shY + 1, cx + dna.tw - 2, hipY - 1, '#e8ecef');
      P(cx - 1, shY + 3, '#ba2d2d'); // Red cross
      P(cx, shY + 3, '#ba2d2d');
      P(cx, shY + 2, '#ba2d2d');
      P(cx, shY + 4, '#ba2d2d');
    } else if (dna.backGear === 'weapon_sling') {
      // Slung rifle across back
      P(cx - dna.tw + 1, shY - 2, '#181b1f'); // Rifle barrel
      P(cx - dna.tw + 2, shY - 1, '#2b3036');
      P(cx - 1, shY + 1, '#543d2b'); // Wooden stock
      P(cx, shY + 2, '#543d2b');
    }
  } else {
    // Side profile view
    if (dna.backGear === 'backpack_bedroll') {
      R(cx - 3, shY + 1, cx - 1, hipY - 2, DW[1]);
      R(cx - 3, shY - 1, cx - 1, shY, '#3b5239'); // Bedroll
    } else if (dna.backGear === 'radio_pack') {
      R(cx - 3, shY + 1, cx - 1, hipY - 2, '#2c332b');
      P(cx - 1, shY - 3, '#757c85'); // Antenna
      P(cx - 1, shY - 2, '#757c85');
    } else if (dna.backGear === 'medic_pack') {
      R(cx - 3, shY + 1, cx - 1, hipY - 2, '#e8ecef');
    } else if (dna.backGear === 'weapon_sling') {
      P(cx - 2, shY - 2, '#181b1f');
      P(cx - 2, shY - 1, '#2b3036');
    }
  }
}

// Horizontal sprite flip helper
function flipSprite(src) {
  const s = new Spr(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const a = y * src.w + x;
      const b = y * src.w + (src.w - 1 - x);
      s.p[a] = src.p[b];
      s.sh[a] = src.sh[b];
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// High-Level Builders: Frames, 96×224 Spritesheet, and HUD Portrait
// ---------------------------------------------------------------------------

// Builds all 32 frames (8 directions × 4 walk frames) for a survivor DNA
export function buildSurvivorFrames(dna) {
  const F = { s: [], n: [], e: [], w: [], se: [], sw: [], ne: [], nw: [] };
  for (let f = 0; f < 4; f++) {
    F.s.push(renderSurvivorFrame(dna, 's', f));
    F.n.push(renderSurvivorFrame(dna, 'n', f));
    F.e.push(renderSurvivorFrame(dna, 'e', f));
    F.w.push(flipSprite(F.e[f]));
    F.se.push(renderSurvivorFrame(dna, 'se', f));
    F.ne.push(renderSurvivorFrame(dna, 'ne', f));
    F.sw.push(flipSprite(F.se[f]));
    F.nw.push(flipSprite(F.ne[f]));
  }
  return F;
}

// Blits all frames into a full 96×224 Spritesheet matching the Unity & Web atlas
export function buildSurvivorSheet(dna, frames = null) {
  const F = frames || buildSurvivorFrames(dna);
  const sheet = new Spr(SHEET_W, SHEET_H);
  DIRS.forEach((dir, rowIndex) => {
    F[dir].forEach((frameSpr, colIndex) => {
      sheet.blit(frameSpr, colIndex * FRAME_W, rowIndex * FRAME_H);
    });
  });
  return sheet;
}

// Head-and-shoulders crop (14×14) of the front-facing frame for HUD cards
export function buildSurvivorPortrait(dna, frames = null) {
  const F = frames || buildSurvivorFrames(dna);
  const frontFrame = F.s[0];
  const portrait = new Spr(14, 14);
  const cropX = 5, cropY = 3;
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 14; x++) {
      portrait.set(x, y, frontFrame.get(cropX + x, cropY + y));
      if (frontFrame.in(cropX + x, cropY + y)) {
        portrait.shade(x, y, frontFrame.sh[(cropY + y) * frontFrame.w + (cropX + x)]);
      }
    }
  }
  return portrait;
}

// Convert any sprite to a high-resolution DataURL
export function spriteToDataURL(sprite, scale = 1) {
  const cv = document.createElement('canvas');
  draw(cv, sprite);
  if (scale === 1) return cv.toDataURL();
  const scaled = document.createElement('canvas');
  scaled.width = sprite.w * scale;
  scaled.height = sprite.h * scale;
  const ctx = scaled.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, 0, 0, scaled.width, scaled.height);
  return scaled.toDataURL();
}
