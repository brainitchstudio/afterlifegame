// The supply ledger. Installed onto Game.prototype by model.mjs.
//   owned      `resources`: everything the settlement holds, including what is set aside.
//   reserved   resources set aside (escrow) for blueprints, craft queues and missions. Available = owned - reserved.
//   storage    campaign only: owned stock weighs (count x unit weight, plus spare equipment) against the capacity
//              of working storage. Stock beyond it is overflow: still owned and spendable, but while there is
//              any, production and gathering stop delivering. Legacy runs have no cap.
import { CAMPAIGN, CAMPAIGN_TYPE, campaignBuilding } from './campaignState.mjs';
import { buildingMaxHP } from './rules.mjs';

const T = CAMPAIGN.tuning.ledger;
const WEIGHT = Object.fromEntries(Object.entries(CAMPAIGN.resources).map(([id, r]) => [id, r.weight]));
export { CAMPAIGN_TYPE, campaignBuilding };
// Ledger resources held as counts; equipment is counted from the item stock instead.
export const LEDGER_RESOURCES = Object.keys(CAMPAIGN.resources).filter(r => r !== 'equipment');
export const LEGACY_RESOURCES = ['wood', 'scrap_metal', 'food'];
export const emptyLedger = (ids = LEDGER_RESOURCES) => Object.fromEntries(ids.map(r => [r, 0]));

export class Ledger {
  get ledgerResources() { return this.campaign ? LEDGER_RESOURCES : LEGACY_RESOURCES; }
  available(r) { return (this.resources[r] || 0) - (this.reserved?.[r] || 0); }
  get availableResources() { return Object.fromEntries(this.ledgerResources.map(r => [r, this.available(r)])); }
  afford(cost) { return Object.entries(cost || {}).every(([r, n]) => this.available(r) >= n - 1e-9); }
  spend(cost) {
    if (!this.afford(cost)) return false;
    for (const [r, n] of Object.entries(cost)) this.resources[r] -= n;
    return true;
  }

  // ---- Escrow: a reservation sets a cost aside now and is either committed (spent) or released (refunded).
  reserve(cost, kind = 'build', ref = null) {
    if (!this.afford(cost)) return null;
    const id = 'tx' + this.nextTxId++;
    for (const [r, n] of Object.entries(cost)) this.reserved[r] = (this.reserved[r] || 0) + n;
    this.reservations[id] = { cost: { ...cost }, kind, ref };
    return id;
  }
  // The work finished: what was set aside is consumed.
  commitReservation(id) {
    const tx = this.reservations[id];
    if (!tx) return false;
    for (const [r, n] of Object.entries(tx.cost)) { this.reserved[r] -= n; this.resources[r] -= n; }
    delete this.reservations[id];
    return true;
  }
  // Cancelled: unstarted work refunds everything; work in progress refunds floor(cost x (1 - 0.5 x progress)).
  // Returns what came back to available stock.
  releaseReservation(id, progress = 0) {
    const tx = this.reservations[id];
    if (!tx) return null;
    const p = Math.min(1, Math.max(0, progress)), refund = {};
    for (const [r, n] of Object.entries(tx.cost)) {
      refund[r] = p > 0 ? Math.floor(n * (1 - T.cancelInProgressRefundLoss * p)) : n;
      this.reserved[r] -= n;
      this.resources[r] -= n - refund[r];
    }
    delete this.reservations[id];
    return refund;
  }
  // Demolishing a finished structure returns 40% of its structural materials; a destroyed one leaves a ruin
  // holding 25% of them. Cloth, components and seeds are never recovered.
  demolitionRefund(cost) { return this.structuralShare(cost, T.demolishRefund); }
  ruinStock(cost) { return this.structuralShare(cost, T.ruinShare); }
  structuralShare(cost, share) {
    return Object.fromEntries(Object.entries(cost || {}).filter(([r]) => T.demolishRefundResources.includes(r)).map(([r, n]) => [r, Math.floor(n * share)]).filter(([, n]) => n > 0));
  }

  // ---- Storage
  // Working: built (not a blueprint) and above a quarter of its integrity.
  operational(b) { return !b.blueprint && b.hp > buildingMaxHP(b) * CAMPAIGN.tuning.construction.operationalHpShare; }
  get storageCapacity() {
    if (!this.campaign) return Infinity;
    return this.buildings.reduce((n, b) => n + (this.operational(b) ? campaignBuilding(b.type)?.capacity?.storage || 0 : 0), 0);
  }
  // Spare equipment weighs in the stores; equipment someone carries does not.
  get storedWeight() {
    const goods = this.ledgerResources.reduce((n, r) => n + Math.max(0, this.resources[r] || 0) * (WEIGHT[r] ?? 1), 0);
    const spare = (T.equippedItemsCountTowardWeight ? this.items.length : this.items.filter(i => i.holder == null).length) + Object.values(this.campaign?.stock || {}).reduce((a, b) => a + b, 0);
    return goods + spare * WEIGHT.equipment;
  }
  get overflow() { return Math.max(0, this.storedWeight - this.storageCapacity); }
  get outputBlocked() { return this.overflow > 1e-9; }
  // Production and gathering deliver through here and stop while anything overflows. Rewards, refunds and
  // mission cargo pass `force` and land in overflow if they must, so nothing earned is lost.
  deposit(r, n, force = false) {
    if (!(n > 0)) return 0;
    if (!force && this.outputBlocked) { this.blockedOutput = true; return 0; }
    this.resources[r] = (this.resources[r] || 0) + n;
    return n;
  }
  depositAll(amounts, force = true) { for (const [r, n] of Object.entries(amounts || {})) this.deposit(r, n, force); }

  ledgerSummary() {
    return {
      owned: { ...this.resources }, reserved: { ...this.reserved }, available: this.availableResources,
      capacity: Number.isFinite(this.storageCapacity) ? this.storageCapacity : null, weight: this.storedWeight, overflow: this.overflow, outputBlocked: this.outputBlocked,
    };
  }
}
