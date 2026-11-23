import { type Chord, chordIntervals, chordQuality, normSuffix } from './chords';
import { mod12, SHARP_NAMES } from './notes';

export interface GuitarShape { frets: number[]; baseFret: number; name: string; open: boolean; approx: boolean }

const x = -1;
// Open-position shapes, strings low E → high E. Keys: sharp root + category.
const OPEN: Record<string, number[]> = {
  'C': [x, 3, 2, 0, 1, 0], 'C7': [x, 3, 2, 3, 1, 0], 'Cmaj7': [x, 3, 2, 0, 0, 0], 'Cadd9': [x, 3, 2, 0, 3, 0],
  'D': [x, x, 0, 2, 3, 2], 'Dm': [x, x, 0, 2, 3, 1], 'D7': [x, x, 0, 2, 1, 2], 'Dm7': [x, x, 0, 2, 1, 1],
  'Dmaj7': [x, x, 0, 2, 2, 2], 'Dsus4': [x, x, 0, 2, 3, 3], 'Dsus2': [x, x, 0, 2, 3, 0],
  'E': [0, 2, 2, 1, 0, 0], 'Em': [0, 2, 2, 0, 0, 0], 'E7': [0, 2, 0, 1, 0, 0], 'Em7': [0, 2, 2, 0, 3, 0],
  'Esus4': [0, 2, 2, 2, 0, 0], 'Emaj7': [0, 2, 1, 1, 0, 0],
  'G': [3, 2, 0, 0, 0, 3], 'G7': [3, 2, 0, 0, 0, 1], 'Gmaj7': [3, 2, 0, 0, 0, 2], 'Gsus4': [3, x, 0, 0, 1, 3],
  'A': [x, 0, 2, 2, 2, 0], 'Am': [x, 0, 2, 2, 1, 0], 'A7': [x, 0, 2, 0, 2, 0], 'Am7': [x, 0, 2, 0, 1, 0],
  'Amaj7': [x, 0, 2, 1, 2, 0], 'Asus4': [x, 0, 2, 2, 3, 0], 'Asus2': [x, 0, 2, 2, 0, 0],
  'Fmaj7': [x, x, 3, 2, 1, 0], 'B7': [x, 2, 1, 2, 0, 2],
};
// Movable shapes relative to the root fret.
const E_SHAPE: Record<string, number[]> = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
  maj7: [0, x, 1, 1, 0, x], sus4: [0, 2, 2, 2, 0, 0], '6': [0, x, -1, 1, 0, x], m6: [0, x, -1, 0, 0, x],
};
const A_SHAPE: Record<string, number[]> = {
  '': [x, 0, 2, 2, 2, 0], m: [x, 0, 2, 2, 1, 0], '7': [x, 0, 2, 0, 2, 0], m7: [x, 0, 2, 0, 1, 0],
  maj7: [x, 0, 2, 1, 2, 0], sus4: [x, 0, 2, 2, 3, 0], sus2: [x, 0, 2, 2, 0, 0], dim: [x, 0, 1, 2, 1, x],
  m7b5: [x, 0, 1, 0, 1, x], dim7: [x, 0, 1, -1, 1, x], aug: [x, 0, 3, 2, 2, 1], '6': [x, 0, 2, 2, 2, 2],
  m6: [x, 0, 2, 2, 1, 2], '9': [x, 0, -1, 0, 0, 0], add9: [x, 0, 2, 4, 2, 0], m9: [x, 0, -2, 0, 0, 0],
};

/** Reduce any suffix to a category we have shapes for. */
export function shapeCategory(c: Chord): { cat: string; approx: boolean } {
  const s = normSuffix(c.suffix);
  const known = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', 'dim', 'dim7', 'aug', '6', 'm6', '9', 'm9', 'm7b5'];
  if (known.includes(s)) return { cat: s, approx: false };
  if (s === 'sus' || s === '7sus4' ) return { cat: 'sus4', approx: s !== 'sus' };
  const iv = chordIntervals(c);
  const q = chordQuality(c);
  const tri = q === 'min' ? 'm' : q === 'dim' ? 'dim' : q === 'aug' ? 'aug' : q === 'sus2' ? 'sus2' : q === 'sus4' ? 'sus4' : '';
  let cat = tri;
  if (iv.includes(11) && (tri === '' || tri === 'm')) cat = tri === 'm' ? 'm7' : 'maj7';
  else if (iv.includes(10) && (tri === '' || tri === 'm')) cat = tri + '7';
  return { cat, approx: true };
}

export function guitarShape(c: Chord): GuitarShape {
  const { cat, approx } = shapeCategory(c);
  const name = SHARP_NAMES[c.root] + cat;
  if (OPEN[name]) return { frets: OPEN[name], baseFret: 1, name, open: true, approx };
  const eFret = mod12(c.root - 4) || 12, aFret = mod12(c.root - 9) || 12;
  const opts: { rel: number[]; fret: number }[] = [];
  if (E_SHAPE[cat]) opts.push({ rel: E_SHAPE[cat], fret: eFret });
  if (A_SHAPE[cat]) opts.push({ rel: A_SHAPE[cat], fret: aFret });
  if (!opts.length) opts.push({ rel: A_SHAPE[cat.startsWith('m') ? 'm' : ''], fret: aFret });
  // prefer lower position, but avoid shapes that would need negative frets
  opts.sort((a, b) => a.fret - b.fret);
  const pick = opts.find((o) => o.rel.every((r) => r === x || o.fret + r >= 1)) ?? { ...opts[0], fret: opts[0].fret + 12 };
  const frets = pick.rel.map((r) => (r === x ? x : pick.fret + r));
  const played = frets.filter((f) => f > 0);
  const min = Math.min(...played);
  return { frets, baseFret: Math.max(1, Math.max(...played) <= 5 ? 1 : min), name, open: false, approx };
}

/** 0 = easy open chord, 1.5 = common barre (F, Bm), 2.5 = other barre/movable. */
export function guitarEase(c: Chord): number {
  const s = guitarShape(c);
  if (s.open) return s.approx ? 0.3 : 0;
  const lowest = Math.min(...s.frets.filter((f) => f > 0));
  return lowest <= 2 ? 1.5 : 2.5;
}

/** Piano voicing: MIDI notes from root around C4 upward, bass an octave below. */
export function pianoNotes(c: Chord): { notes: number[]; bass: number | null } {
  const root = 60 + c.root;
  const notes = chordIntervals(c).map((i) => root + i);
  const bass = c.bass !== null ? 48 + c.bass : null;
  return { notes, bass };
}
