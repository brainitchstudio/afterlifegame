// How the HUD shows each ledger resource: label, icon and a line about it, and the groups the
// supplies card and the stockpile sort a campaign's twelve resources into.
export const RESOURCE_INFO = {
  wood: { label: 'WOOD', icon: 'icon_wood', about: 'Builds and repairs structures. Survivors gather it from timber and fallen trees.' },
  scrap_metal: { label: 'SCRAP', icon: 'icon_metal', about: 'Salvaged metal for structures, tools and ammunition. Gathered from debris; the Salvage Yard sorts more from raw salvage.' },
  food: { label: 'FOOD', icon: 'icon_food', about: 'Every resident eats one ration a day. Gardens and farms grow more; scavenging runs bring some home.' },
  ammo: { label: 'AMMO', icon: 'icon_damage', about: 'Handgun rounds. Guards with pistols use it and switch to melee when it runs out.' },
  medical_supplies: { label: 'MED SUPPLIES', icon: 'icon_medicine', about: 'Sterile consumables a Medic uses while treating patients: one per four patient-hours.' },
  cloth: { label: 'CLOTH', icon: 'icon_bed', about: 'Tents, bandages, medical supplies and shelters.' },
  components: { label: 'COMPONENTS', icon: 'icon_research', about: 'Electronics and fittings for the radio, the operations board, the clinic and ammunition. Scarce.' },
  seed_packets: { label: 'SEEDS', icon: 'icon_yield', about: 'One plants a garden plot or field farm for good; harvests do not use them up.' },
  raw_salvage: { label: 'RAW SALVAGE', icon: 'icon_carry', about: 'Unsorted junk from scavenging runs. The Salvage Yard turns it into scrap.' },
  planks: { label: 'PLANKS', icon: 'icon_build', about: 'Workshop-cut timber for Phase 2 structures.' },
  metal_parts: { label: 'METAL PARTS', icon: 'icon_repair', about: 'Workshop-made fittings for Phase 2 structures and pistols.' },
};
export const LEGACY_RESOURCES = ['wood', 'scrap_metal', 'food'];
export const RESOURCE_GROUPS = [
  { label: 'ESSENTIALS', ids: ['wood', 'scrap_metal', 'food'] },
  { label: 'RAW', ids: ['cloth', 'raw_salvage', 'seed_packets'] },
  { label: 'MANUFACTURED', ids: ['planks', 'metal_parts', 'components'] },
  { label: 'MUNITIONS & MEDICAL', ids: ['ammo', 'medical_supplies'] },
];
