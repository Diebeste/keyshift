import { mod12, noteToPc, spellPc } from './notes';

export type Mode = 'major' | 'minor';
export interface Key { tonic: number; mode: Mode }

/** Major keys that use flats (by tonic pc): F, Bb, Eb, Ab, Db, Gb. */
const FLAT_MAJOR_PCS = new Set([5, 10, 3, 8, 1, 6]);

export const relativeOf = (k: Key): Key =>
  k.mode === 'major' ? { tonic: mod12(k.tonic + 9), mode: 'minor' } : { tonic: mod12(k.tonic + 3), mode: 'major' };

/** Flat keys: F Bb Eb Ab Db Gb majors and their relative minors (Dm Gm Cm Fm Bbm Ebm). Sharps otherwise. */
export function keyUsesFlats(k: Key): boolean {
  const majorTonic = k.mode === 'major' ? k.tonic : mod12(k.tonic + 3);
  return FLAT_MAJOR_PCS.has(majorTonic);
}

export function keyName(k: Key, short = false): string {
  const t = spellPc(k.tonic, keyUsesFlats(k));
  if (short) return k.mode === 'minor' ? t + 'm' : t;
  return `${t} ${k.mode}`;
}

/** Parse "C", "Am", "F# minor", "Bb major", "ebm" */
export function parseKey(s: string): Key | null {
  const m = /^\s*([A-Ga-g](?:#|b|♯|♭)?)\s*(m|min|minor|maj|major|M)?\s*$/.exec(s);
  if (!m) return null;
  const pc = noteToPc(m[1][0].toUpperCase() + m[1].slice(1));
  if (pc === null) return null;
  const q = m[2];
  const mode: Mode = q && (q === 'm' || q.startsWith('min')) ? 'minor' : 'major';
  return { tonic: pc, mode };
}

export const ALL_KEYS: Key[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ tonic: i, mode: 'major' as Mode })),
  ...Array.from({ length: 12 }, (_, i) => ({ tonic: i, mode: 'minor' as Mode })),
];

export const sameKey = (a: Key, b: Key) => a.tonic === b.tonic && a.mode === b.mode;
export const transposeKey = (k: Key, n: number): Key => ({ tonic: mod12(k.tonic + n), mode: k.mode });

export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** Diatonic triads: [semitone offset from tonic, quality] */
export type TriadQ = 'maj' | 'min' | 'dim';
export function diatonicTriads(k: Key): { root: number; q: TriadQ }[] {
  const scale = k.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
  const qs: TriadQ[] = k.mode === 'major'
    ? ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']
    : ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
  return scale.map((s, i) => ({ root: mod12(k.tonic + s), q: qs[i] }));
}

// ---- Key profiles for chroma-based estimation ----
export const PROFILES = {
  krumhansl: {
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17],
  },
  temperley: {
    major: [5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0],
    minor: [5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0],
  },
};

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export interface KeyScore { key: Key; score: number; confidence: number }

/** Score a 12-bin chroma vector (index 0 = C) against all 24 keys, averaging KS and Temperley. Sorted best first. */
export function rankKeysFromChroma(chroma: ArrayLike<number>): KeyScore[] {
  const c = Array.from(chroma);
  const out = ALL_KEYS.map((key) => {
    let s = 0;
    for (const p of Object.values(PROFILES)) {
      const prof = p[key.mode];
      const rot = c.map((_, i) => prof[mod12(i - key.tonic)]);
      s += pearson(c, rot);
    }
    return { key, score: s / 2, confidence: 0 };
  });
  return withConfidence(out);
}

/** Softmax-ish confidence over scores (temperature tuned so clear cases give > 50%). */
export function withConfidence(list: { key: Key; score: number; confidence: number }[], temp = 0.08): KeyScore[] {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  const max = sorted[0]?.score ?? 0;
  const exps = sorted.map((x) => Math.exp((x.score - max) / temp));
  const sum = exps.reduce((s, x) => s + x, 0);
  return sorted.map((x, i) => ({ ...x, confidence: exps[i] / sum }));
}
