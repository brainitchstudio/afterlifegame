// Production rates, the trader and the weapon stockpile. Installed onto Game.prototype by model.mjs.
import { TUNING as T, WEAPONS, GEAR_PREFERENCE, statFactor } from './survivors.mjs';
import { DAY_SECONDS, describeTrade, jobOf, has } from './data.mjs';

export class Economy {
  trade() {
    if (!this.trader || this.status !== 'playing' || !this.afford(this.trader.give)) return false;
    this.spend(this.trader.give);
    for (const [r, n] of Object.entries(this.trader.get)) this.resources[r] += n;
    this.notify('Trade complete', describeTrade(this.trader) + ' · done.', 'good');
    this.trader = null;
    this.traderTimer = 150 + this.random() * 120;
    return true;
  }
  dismissTrader() {
    if (!this.trader) return false;
    this.trader = null;
    this.traderTimer = 150 + this.random() * 120;
    return true;
  }

  // How much the stores are built to hold: a base stockpile plus each Storage Depot. Shown on the supplies
  // card; the simulation does not cap resources, so stock beyond it simply overflows the shelves.
  get storage() {
    const cap = { wood: 300, metal: 150, food: 250 };
    for (const b of this.buildings) if (b.type === 'storage') {
      const k = has(b, 'bulk_bins') ? 1.5 : 1;
      cap.wood += 200 * k; cap.metal += 100 * k; cap.food += 150 * k * (has(b, 'refrigeration') ? 1.2 : 1);
    }
    for (const r of ['wood', 'metal', 'food']) cap[r] = Math.round(cap[r]);
    return cap;
  }

  rates() {
    // A refuge's HQ salvages a trickle of wood; a camp only has the wood it fells. Scavenged metal comes in either way.
    const rates = { wood: this.buildings.some(b => b.type === 'core') ? .07 : 0, metal: .025, food: -this.survivors.length * T.food.perSurvivorPerSecond };
    for (const b of this.buildings) {
      if (b.type === 'farm') rates.food += .23 * (1 + (has(b, 'irrigation') ? .5 : 0) + (has(b, 'storage') ? .25 : 0) + (has(b, 'greenhouse') ? .75 : 0) + (has(b, 'harvest') ? .75 : 0)) * (this.night && !has(b, 'greenhouse') ? .4 : 1) * this.farmLabor(b);
      if (b.type === 'workshop') {
        rates.wood += .27 * (1 + (has(b, 'sawbench') ? .6 : 0) + (has(b, 'machinery') ? 1 : 0));
        rates.metal += .12 * (1 + (has(b, 'forge') ? .7 : 0) + (has(b, 'recycling') ? 1 : 0));
      }
      if (b.type === 'lumber_mill') {
        rates.wood += .35 * (1 + (has(b, 'circular_saw') ? .4 : 0) + (has(b, 'steam_engine') ? .7 : 0)) * this.loggerLabor(b);
      }
    }
    return rates;
  }
  // Farmers at work raise a farm's output; Intelligence makes them better at it.
  farmLabor(b) { return 1 + this.staffOf(b).filter(s => this.active(s) && !s.fighting).reduce((n, s) => n + T.farming.farmerBonus * statFactor(s.stats.int, T.effects.workPerIntelligence), 0); }
  // Loggers at work harvest wood at the sawmill / lumber mill; Strength speeds timber processing.
  loggerLabor(b) { return 1 + this.staffOf(b).filter(s => this.active(s) && !s.fighting).reduce((n, s) => n + .35 * statFactor(s.stats.str, T.effects.workPerIntelligence || .1), 0); }
  get dailyFoodDemand() { return this.survivors.length * T.food.perSurvivorPerSecond * DAY_SECONDS; }
  // Equipment: a shared stock of weapons, each reserved by at most one survivor.
  addItem(type) { const item = { id: this.nextId++, type, holder: null }; this.items.push(item); return item; }
  equip(s, item) {
    const old = s.weapon != null && this.items.find(i => i.id === s.weapon);
    if (old) old.holder = null;
    s.weapon = item ? item.id : null; s.gear = item ? item.type : null;
    if (item) item.holder = s.id;
  }
  // Hands out free gear by job preference. A survivor only swaps for something better,
  // so assignments stay stable between events.
  equipAll() {
    const rank = s => ({ sentry: 0, guard: 1, patrol: 2 }[s.role] ?? 3);
    for (const s of this.survivors.filter(s => !s.expedition && s.condition !== 'downed').sort((a, b) => rank(a) - rank(b) || a.id - b.id)) {
      const prefs = GEAR_PREFERENCE[jobOf(s)] || GEAR_PREFERENCE.default, score = type => type ? prefs.indexOf(type) : Infinity;
      const free = this.items.filter(i => i.holder == null).sort((a, b) => score(a.type) - score(b.type))[0];
      if (free && score(free.type) < score(s.gear)) this.equip(s, free);
    }
  }
  fabricate(type) {
    const weapon = WEAPONS[type];
    if (this.status !== 'playing' || !weapon?.cost || !this.buildings.some(b => b.type === 'workshop' || b.type === 'armory') || !this.spend(weapon.cost)) return false;
    this.addItem(type);
    this.equipAll();
    const holder = this.survivors.find(s => s.gear === type && this.items.find(i => i.id === s.weapon)?.id === this.items.at(-1).id);
    this.notify(weapon.name + ' made', holder ? holder.name + ' took it.' : 'It is in the stockpile.', 'good');
    return true;
  }
}
