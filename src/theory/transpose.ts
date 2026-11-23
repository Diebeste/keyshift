import { type Chord, transposeChord } from './chords';
import { type Key, keyName, transposeKey, diatonicTriads, keyUsesFlats } from './keys';
import { mod12, noteToPc, spellPc } from './notes';
import { guitarEase } from './diagrams';

const INTERVALS = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone', 'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th', 'octave'];

export function intervalName(n: number): string {
  const a = Math.abs(n);
  if (a === 0) return 'no change (unison)';
  const name = a === 12 ? 'octave' : INTERVALS[a % 12] + (a > 12 ? ' + octave' : '');
  return `${name} ${n > 0 ? 'up' : 'down'}`;
}

/** Shortest shift from one key to another, in -6..+6 (prefers + for the tritone). */
export function shiftBetween(from: Key, to: Key): number {
  const d = mod12(to.tonic - from.tonic);
  return d > 6 ? d - 12 : d;
}

export function clampShift(n: number): number {
  return Math.max(-12, Math.min(12, Math.round(n)));
}

export interface CapoOption { capo: number; shapeKey: Key; shapes: string[]; cost: number }

/** Rank capo 0–7 by how easy the resulting chord shapes are. Uses the sheet's chords, or the key's I IV V vi when none. */
export function capoSuggestions(target: Key, chords?: Chord[], maxCapo = 7): CapoOption[] {
  const base: Chord[] = chords && chords.length ? chords : diatonicTriads(target)
    .filter((_, i) => (target.mode === 'major' ? [0, 3, 4, 5] : [0, 2, 3, 6]).includes(i))
    .map((t) => ({ root: t.root, rootName: spellPc(t.root, keyUsesFlats(target)), suffix: t.q === 'min' ? 'm' : t.q === 'dim' ? 'dim' : '', bass: null, bassName: null }));
  const uniq = new Map<string, Chord>();
  for (const c of base) uniq.set(`${c.root}|${c.suffix}|${c.bass}`, c);
  const list = [...uniq.values()];
  const out: CapoOption[] = [];
  for (let capo = 0; capo <= maxCapo; capo++) {
    const shapeKey = transposeKey(target, -capo);
    const shaped = list.map((c) => transposeChord(c, -capo, shapeKey));
    const cost = shaped.reduce((s, c) => s + guitarEase(c), 0) / shaped.length + capo * 0.04;
    out.push({ capo, shapeKey, shapes: shaped.map((c) => c.rootName + c.suffix), cost });
  }
  return out.sort((a, b) => a.cost - b.cost);
}

const NOTE_RE = /^([A-Ga-g](?:#|b)?)(-?\d)$/;
export function parseSciNote(s: string): number | null {
  const m = NOTE_RE.exec(s.trim());
  if (!m) return null;
  const pc = noteToPc(m[1][0].toUpperCase() + m[1].slice(1));
  return pc === null ? null : (parseInt(m[2], 10) + 1) * 12 + pc;
}
export function midiToName(m: number, flats = false): string {
  return spellPc(mod12(m), flats) + (Math.floor(m / 12) - 1);
}

/** Plain-language vocal guidance for a shift; optional song range (e.g. "A3", "D5"). */
export function vocalHint(n: number, target?: Key, low?: string, high?: string): string[] {
  const out: string[] = [];
  if (n === 0) out.push('Same key: no change for the singer.');
  else out.push(`The melody moves ${intervalName(n)} (${n > 0 ? '+' : ''}${n} semitones): ${n > 0 ? 'higher, brighter, more strain on top notes' : 'lower, warmer, easier on top notes'}.`);
  if (Math.abs(n) > 6) {
    const alt = n > 0 ? n - 12 : n + 12;
    out.push(`Tip: ${n > 0 ? '+' : ''}${n} lands on the same key as ${alt > 0 ? '+' : ''}${alt}; singing it ${alt < 0 ? 'down' : 'up'} ${Math.abs(alt)} instead may suit the voice better.`);
  }
  const lo = low ? parseSciNote(low) : null, hi = high ? parseSciNote(high) : null;
  if (lo !== null && hi !== null) {
    const flats = target ? keyUsesFlats(target) : false;
    const nl = lo + n, nh = hi + n;
    out.push(`Song range ${midiToName(lo)}–${midiToName(hi)} becomes ${midiToName(nl, flats)}–${midiToName(nh, flats)}.`);
    if (nh > 79) out.push('Top note is above G5: demanding for most voices; consider a lower key.');
    else if (nh > 74) out.push('Top note above D5: comfortable for sopranos/tenors (tenor an octave below), tough for altos/baritones.');
    if (nl < 43) out.push('Low note is below G2: may be too low for most singers.');
  }
  if (target) out.push(`New key: ${keyName(target)}.`);
  return out;
}
