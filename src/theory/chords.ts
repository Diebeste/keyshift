import { mod12, noteToPc, spellPc } from './notes';
import { type Key, keyUsesFlats, relativeOf } from './keys';

export interface Chord {
  root: number;        // pitch class
  rootName: string;    // as written
  suffix: string;      // quality/extensions as written, e.g. "m7", "maj7", "7b9", "sus4"
  bass: number | null; // slash bass pc
  bassName: string | null;
}

const ROOT = '([A-G](?:#|b|♯|♭)?)';
// quality/extension vocabulary; must consume the whole suffix
const SUFFIX_TOKEN = '(?:maj|Maj|MA|ma|M|min|mi|m|dim|aug|sus|add|alt|no|omit|ø|°|o(?=7)|\\+|-|Δ|[0-9]+|b(?=[0-9])|#(?=[0-9])|♭(?=[0-9])|♯(?=[0-9])|\\(|\\)|,|\\/(?=[0-9]))';
const CHORD_RE = new RegExp(`^${ROOT}(${SUFFIX_TOKEN}*)(?:\\/${ROOT})?$`);

/** Parse a chord symbol. Returns null if the token is not a chord. */
export function parseChord(token: string): Chord | null {
  const t = token.trim();
  const m = CHORD_RE.exec(t);
  if (!m) return null;
  const root = noteToPc(m[1]);
  if (root === null) return null;
  const suffix = m[2] ?? '';
  // reject unbalanced parentheses
  if ((suffix.match(/\(/g)?.length ?? 0) !== (suffix.match(/\)/g)?.length ?? 0)) return null;
  const bassName = m[3] ?? null;
  const bass = bassName ? noteToPc(bassName) : null;
  return { root, rootName: m[1], suffix, bass, bassName };
}

export const isChord = (token: string) => parseChord(token) !== null;

export function chordToString(c: Chord): string {
  return c.rootName + c.suffix + (c.bassName ? '/' + c.bassName : '');
}

/** Transpose by n semitones, spelling with the target key's signature (or a sharp/flat preference). */
export function transposeChord(c: Chord, n: number, target: Key | boolean): Chord {
  const flats = typeof target === 'boolean' ? target : keyUsesFlats(target);
  const root = mod12(c.root + n);
  const bass = c.bass === null ? null : mod12(c.bass + n);
  return { root, rootName: spellPc(root, flats), suffix: c.suffix, bass, bassName: bass === null ? null : spellPc(bass, flats) };
}

export function transposeChordString(s: string, n: number, target: Key | boolean): string {
  const c = parseChord(s);
  return c ? chordToString(transposeChord(c, n, target)) : s;
}

export type Quality = 'maj' | 'min' | 'dim' | 'aug' | 'sus2' | 'sus4' | 'power';

/** Normalise suffix spelling variants to a canonical form. */
export function normSuffix(suffix: string): string {
  return suffix
    .replace(/♭/g, 'b').replace(/♯/g, '#').replace(/Δ/g, 'maj')
    .replace(/^(Maj|MA|ma)(?!j)/, 'maj').replace(/^Maj/, 'maj').replace(/^M(?=[0-9]|$)/, 'maj')
    .replace(/^(min|mi)/, 'm').replace(/^-/, 'm')
    .replace(/^[°o]/, 'dim').replace(/ø7?/, 'm7b5').replace(/^\+/, 'aug')
    .replace(/[()]/g, '').replace(/,/g, '');
}

/** Basic triad quality from the suffix. */
export function chordQuality(c: Chord): Quality {
  const s = normSuffix(c.suffix);
  if (/^dim/.test(s)) return 'dim';
  if (/^m7b5/.test(s)) return 'dim';
  if (/^aug/.test(s) || /^(7|9)?#5/.test(s)) return 'aug';
  if (/^m(?!aj)/.test(s)) return 'min';
  if (s === '5') return 'power';
  if (/sus2/.test(s)) return 'sus2';
  if (/sus/.test(s)) return 'sus4';
  return 'maj';
}

/** Chord tones as semitone intervals above the root. */
export function chordIntervals(c: Chord): number[] {
  const s = normSuffix(c.suffix);
  const q = chordQuality(c);
  const base: Record<Quality, number[]> = {
    maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], power: [0, 7],
  };
  const set = new Set<number>(base[q]);
  // strip the quality prefix to look at extensions
  const rest = s.replace(/^(dim|aug|m(?!aj))/, '');
  const ext = /(?:^|[^b#d\d/])(13|11|9|7)/.exec(rest.replace(/add\d+/g, ''));
  if (/^m7b5/.test(s)) set.add(10);
  else if (q === 'dim' && /^7/.test(rest)) set.add(9);
  else if (/^maj(7|9|11|13)?/.test(rest) && rest.startsWith('maj')) set.add(11);
  else if (ext) set.add(10);
  if (/(^|\/)6/.test(rest) && !/b6|#6/.test(rest)) set.add(9);
  const natural = (n: string) => new RegExp(`(^|[^b#\\d])${n}`).test(rest);
  const ext9 = ext && ['9', '11', '13'].includes(ext[1]);
  if (natural('9') || natural('add9') || ext9 || /add2/.test(rest) || /6\/9/.test(rest)) set.add(2);
  if (natural('11') || /add4|add11/.test(rest)) set.add(5);
  if (natural('13')) set.add(9);
  const alt = (re: RegExp, del: number | null, add: number) => { if (re.test(rest)) { if (del !== null) set.delete(del); set.add(add); } };
  alt(/b9/, /(^|[^b#])9/.test(rest.replace(/b9|#9/g, '')) ? null : 2, 1);
  alt(/#9/, /(^|[^b#])9/.test(rest.replace(/b9|#9/g, '')) ? null : 2, 3);
  alt(/#11/, 5, 6);
  alt(/b13/, 9, 8);
  if (/b5/.test(rest) && !/^m7b5/.test(s)) { set.delete(7); set.add(6); }
  if (/#5/.test(rest) && q !== 'aug') { set.delete(7); set.add(8); }
  if (/alt/.test(rest)) { set.add(10); set.add(1); set.add(3); }
  return [...set].sort((a, b) => a - b);
}

export function chordPcs(c: Chord): number[] {
  const pcs = chordIntervals(c).map((i) => mod12(c.root + i));
  if (c.bass !== null && !pcs.includes(c.bass)) pcs.unshift(c.bass);
  return pcs;
}

const DEGREE = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/** Nashville number for a chord relative to a key (minor keys numbered from their relative major, the common Nashville convention). */
export function nashville(c: Chord, key: Key): string {
  const tonic = key.mode === 'major' ? key.tonic : relativeOf(key).tonic;
  const n = DEGREE[mod12(c.root - tonic)];
  const suf = c.suffix.replace(/^(min|mi)(?!aj)/, 'm').replace(/^-/, 'm');
  return n + suf + (c.bass !== null ? '/' + DEGREE[mod12(c.bass - tonic)] : '');
}
