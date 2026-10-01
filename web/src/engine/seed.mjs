// Campaign seeds: unsigned 64-bit integers kept as decimal strings. A number typed on the start screen is
// used as it is; any other text is hashed with MurmurHash3 (x64, 128-bit, seed 0) over its UTF-8 bytes and
// the first 64 bits kept. Each system draws from its own stream of the seed (terrain, crew, loot, ...).
import { hashSeed } from './survivors.mjs';

const MASK = (1n << 64n) - 1n, MAX_U64 = MASK;
const C1 = 0x87c37b91114253d5n, C2 = 0x4cf5ad432745937fn;
const rotl = (x, r) => ((x << BigInt(r)) | (x >> BigInt(64 - r))) & MASK;
const mul = (a, b) => (a * b) & MASK;
const fmix = k => {
  k ^= k >> 33n; k = mul(k, 0xff51afd7ed558ccdn);
  k ^= k >> 33n; k = mul(k, 0xc4ceb9fe1a85ec53n);
  return k ^ (k >> 33n);
};
const u64 = (bytes, at, n = 8) => { let v = 0n; for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(bytes[at + i] ?? 0); return v; };

// MurmurHash3_x64_128: returns [h1, h2] as BigInts.
export function murmur3x64(bytes, seed = 0n) {
  let h1 = BigInt(seed) & MASK, h2 = h1;
  const blocks = Math.floor(bytes.length / 16);
  for (let i = 0; i < blocks; i++) {
    let k1 = u64(bytes, i * 16), k2 = u64(bytes, i * 16 + 8);
    k1 = mul(rotl(mul(k1, C1), 31), C2); h1 ^= k1; h1 = rotl(h1, 27); h1 = (h1 + h2) & MASK; h1 = (mul(h1, 5n) + 0x52dce729n) & MASK;
    k2 = mul(rotl(mul(k2, C2), 33), C1); h2 ^= k2; h2 = rotl(h2, 31); h2 = (h2 + h1) & MASK; h2 = (mul(h2, 5n) + 0x38495ab5n) & MASK;
  }
  const tail = blocks * 16, rest = bytes.length & 15;
  if (rest > 8) { const k2 = mul(rotl(mul(u64(bytes, tail + 8, rest - 8), C2), 33), C1); h2 ^= k2; }
  if (rest > 0) { const k1 = mul(rotl(mul(u64(bytes, tail, Math.min(8, rest)), C1), 31), C2); h1 ^= k1; }
  const len = BigInt(bytes.length);
  h1 ^= len; h2 ^= len;
  h1 = (h1 + h2) & MASK; h2 = (h2 + h1) & MASK;
  h1 = fmix(h1); h2 = fmix(h2);
  h1 = (h1 + h2) & MASK; h2 = (h2 + h1) & MASK;
  return [h1, h2];
}

// The campaign seed for what the player typed: a whole number up to 2^64 - 1 as is, other text hashed.
// Blank text takes `random` (a 0-1 source) for a fresh seed. Returns the seed as a decimal string.
export function seedFromText(text, random = Math.random) {
  const t = String(text ?? '').trim();
  if (!t) return String((BigInt(Math.floor(random() * 2 ** 32)) << 32n) | BigInt(Math.floor(random() * 2 ** 32)));
  if (/^\d{1,20}$/.test(t) && BigInt(t) <= MAX_U64) return BigInt(t).toString();
  return murmur3x64(new TextEncoder().encode(t))[0].toString();
}

// A 32-bit stream seed drawn from the campaign seed for one system (and attempt, if any).
export const seedStream = (seed, name, ...parts) => hashSeed('campaign', seed, name, ...parts);

// The region code CentroCom files the deployment under, such as "NV-4471".
export function regionIdOf(seed, letters = 'ABCDEFGHJKLMNPRSTUVWXZ') {
  const h = seedStream(seed, 'region');
  return letters[h % letters.length] + letters[Math.floor(h / letters.length) % letters.length] + '-' + String(1000 + (Math.floor(h / 997) % 9000));
}
