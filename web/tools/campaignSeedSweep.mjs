// Deploys many campaign seeds and reports how the regional audit holds up: surveys needed, fallbacks and
// why, sites placed outside their distance band, and any unreachable site or missing debris.
// Run from web/:  node tools/campaignSeedSweep.mjs [seeds per size, default 1000] [sizes, default all]
//   node tools/campaignSeedSweep.mjs 200 standard
import { Game } from '../src/engine/model.mjs';
import { CAMPAIGN } from '../src/engine/campaignState.mjs';

const count = Number(process.argv[2]) || 1000;
const sizes = process.argv[3] ? process.argv[3].split(',') : Object.keys(CAMPAIGN.tuning.world.mapSizes);
const quota = Object.values(CAMPAIGN.tuning.deployment.guaranteedLocal).reduce((a, b) => a + b, 0);
let problems = 0;

for (const mapSize of sizes) {
  const started = Date.now(), reasons = {};
  let surveys = 0, fallbacks = 0, outOfBand = 0, maxSurveys = 0;
  for (let i = 0; i < count; i++) {
    const seed = `sweep-${mapSize}-${i}`, g = new Game();
    g.beginCampaign({ seed, mapSize });
    let step; do step = g.advanceWorldGeneration(); while (!step.done);
    const r = g.campaign.region;
    surveys += r.attempt + 1; maxSurveys = Math.max(maxSurveys, r.attempt + 1);
    if (r.fallback) { fallbacks++; reasons[r.fallback.reason] = (reasons[r.fallback.reason] || 0) + 1; }
    outOfBand += r.sites.filter(s => !s.inBand).length;
    const debris = g.debris.reduce((n, d) => n + d.stock, 0);
    if (r.sites.length !== 11 || r.sites.some(s => !(s.walkTiles > 0)) || debris !== quota || r.patches.length !== 3) {
      problems++;
      console.log(`  PROBLEM ${seed}: ${r.sites.length} sites, ${debris}/${quota} debris, ${r.patches.length} patches`);
    }
    if ((i + 1) % 100 === 0) process.stdout.write(`  ${mapSize}: ${i + 1}/${count}\r`);
  }
  console.log(`${mapSize.padEnd(9)} ${count} seeds · ${((Date.now() - started) / count).toFixed(0)} ms each · ${(surveys / count).toFixed(2)} surveys on average (max ${maxSurveys}) · ` +
    `${fallbacks} fallbacks${fallbacks ? ' ' + JSON.stringify(reasons) : ''} · ${(outOfBand / count / 11 * 100).toFixed(1)}% of sites outside their band`);
}
process.exitCode = problems ? 1 : 0;
