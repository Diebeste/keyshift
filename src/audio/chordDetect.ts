// Rough chord recognition: beat tracking → beat-synced chroma → template matching → key-biased Viterbi.
// Pure TS + Meyda (+ optional Essentia for beats). Runs in a Worker in the app and in Node for tests.
import Meyda from 'meyda';
import { decimate, type EssentiaLike } from './keyAudio';
import { type Key, diatonicTriads } from '../theory/keys';
import { mod12, spellPc } from '../theory/notes';
import { keyUsesFlats } from '../theory/keys';

export const QUALITIES: { suf: string; iv: number[]; prior: number }[] = [
  { suf: '', iv: [0, 4, 7], prior: 1 },
  { suf: 'm', iv: [0, 3, 7], prior: 1 },
  { suf: '7', iv: [0, 4, 7, 10], prior: 0.96 },
  { suf: 'maj7', iv: [0, 4, 7, 11], prior: 0.95 },
  { suf: 'm7', iv: [0, 3, 7, 10], prior: 0.96 },
  { suf: 'sus2', iv: [0, 2, 7], prior: 0.93 },
  { suf: 'sus4', iv: [0, 5, 7], prior: 0.93 },
  { suf: 'dim', iv: [0, 3, 6], prior: 0.92 },
  { suf: 'aug', iv: [0, 4, 8], prior: 0.9 },
];

export interface ChordState { root: number; q: number } // q = index into QUALITIES, root -1 = no chord
export interface ChordSegment { start: number; end: number; root: number; suffix: string; label: string }
export interface ChordResult { beats: number[]; bpm: number; segments: ChordSegment[]; beatChords: string[]; beatSource: 'essentia' | 'grid' }

export function resampleLinear(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  const n = Math.floor((x.length * to) / from), out = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) {
    const p = i * r, j = Math.floor(p), f = p - j;
    out[i] = (x[j] ?? 0) * (1 - f) + (x[j + 1] ?? x[j] ?? 0) * f;
  }
  return out;
}

/** Beat times in seconds. Essentia BeatTrackerMultiFeature (44.1 kHz) when available; otherwise an onset-free 0.5 s grid. */
export function trackBeats(mono: Float32Array, sampleRate: number, essentia?: EssentiaLike | null): { beats: number[]; source: 'essentia' | 'grid' } {
  const dur = mono.length / sampleRate;
  if (essentia) {
    try {
      const x = resampleLinear(mono, sampleRate, 44100);
      const e: any = essentia;
      const r = e.BeatTrackerMultiFeature(e.arrayToVector(x), 208, 40);
      const ticks: number[] = Array.from(e.vectorToArray(r.ticks) as Float32Array);
      if (ticks.length >= 4) return { beats: ticks, source: 'essentia' };
    } catch { /* fall through */ }
  }
  const beats: number[] = [];
  for (let t = 0; t < dur; t += 0.5) beats.push(t);
  return { beats, source: 'grid' };
}

/** Frame-wise chroma (12 bins, C = 0) at ~11 kHz. */
export function chromaFrames(mono: Float32Array, sampleRate: number): { hopSec: number; frames: number[][]; energy: number[] } {
  const factor = Math.max(1, Math.floor(sampleRate / 11025));
  const x = decimate(mono, factor);
  const sr = sampleRate / factor, N = 4096, hop = 1024;
  const M: any = Meyda;
  M.bufferSize = N; M.sampleRate = sr; M.windowingFunction = 'hanning';
  const frames: number[][] = [], energy: number[] = [];
  const pad = new Float32Array(N);
  for (let i = -N / 2; i < x.length - N / 2; i += hop) {
    let frame: Float32Array;
    if (i < 0 || i + N > x.length) { pad.fill(0); const s = Math.max(0, i); pad.set(x.subarray(s, Math.min(x.length, i + N)), s - i); frame = pad; }
    else frame = x.subarray(i, i + N);
    let e = 0;
    for (let k = 0; k < N; k += 4) e += frame[k] * frame[k];
    energy.push(e / (N / 4));
    frames.push(e > 1e-7 ? (M.extract('chroma', frame) as number[]) : new Array(12).fill(0));
  }
  return { hopSec: hop / sr, frames, energy };
}

function corr(a: number[], b: number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / 12, mb = b.reduce((s, v) => s + v, 0) / 12;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { const x = a[i] - ma, y = b[i] - mb; n += x * y; da += x * x; db += y * y; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}

const TEMPLATES: { root: number; q: number; t: number[] }[] = [];
for (let q = 0; q < QUALITIES.length; q++) for (let root = 0; root < 12; root++) {
  const t = new Array(12).fill(0);
  QUALITIES[q].iv.forEach((iv, i) => (t[mod12(root + iv)] = i === 0 ? 1.15 : 1));
  TEMPLATES.push({ root, q, t });
}

function isDiatonic(root: number, q: number, key: Key): boolean {
  const tri = diatonicTriads(key);
  if (key.mode === 'minor') tri.push({ root: mod12(key.tonic + 7), q: 'maj' });
  const suf = QUALITIES[q].suf;
  const base = suf === '' || suf === '7' || suf === 'maj7' ? 'maj' : suf === 'm' || suf === 'm7' ? 'min' : suf === 'dim' ? 'dim' : null;
  if (base === null) return tri.some((t) => t.root === root); // sus chords: root in key
  return tri.some((t) => t.root === root && t.q === base);
}

export function chordLabel(root: number, suf: string, flats: boolean): string {
  return root < 0 ? 'N.C.' : spellPc(root, flats) + suf;
}

/**
 * Viterbi over beat-synced chroma. stayProb: probability a chord continues to the next beat.
 * keyBias: log-bonus for chords diatonic to the key.
 */
export function decodeChords(beatChroma: number[][], silent: boolean[], key: Key | null, opts: { stayProb?: number; keyBias?: number; sharp?: number } = {}): ChordState[] {
  const stay = opts.stayProb ?? 0.75, bias = opts.keyBias ?? 0.6, sharp = opts.sharp ?? 12;
  const S = TEMPLATES.length + 1; // last = no chord
  const T = beatChroma.length;
  if (!T) return [];
  const emis = beatChroma.map((c, i) => {
    const e = new Float64Array(S);
    for (let s = 0; s < TEMPLATES.length; s++) {
      const tp = TEMPLATES[s];
      e[s] = sharp * corr(c, tp.t) * QUALITIES[tp.q].prior + (key && isDiatonic(tp.root, tp.q, key) ? bias : 0);
    }
    e[S - 1] = silent[i] ? sharp : -sharp;
    return e;
  });
  const lStay = Math.log(stay), lMove = Math.log((1 - stay) / (S - 1));
  let prev = Float64Array.from(emis[0]);
  const back: Int32Array[] = [];
  for (let t = 1; t < T; t++) {
    let best = -Infinity, bi = 0;
    for (let s = 0; s < S; s++) if (prev[s] > best) { best = prev[s]; bi = s; }
    const cur = new Float64Array(S), bp = new Int32Array(S);
    for (let s = 0; s < S; s++) {
      const fromSelf = prev[s] + lStay, fromBest = best + lMove;
      if (fromSelf >= fromBest) { cur[s] = fromSelf + emis[t][s]; bp[s] = s; } else { cur[s] = fromBest + emis[t][s]; bp[s] = bi; }
    }
    back.push(bp); prev = cur;
  }
  let s = 0;
  for (let i = 1; i < S; i++) if (prev[i] > prev[s]) s = i;
  const path = new Array<number>(T);
  path[T - 1] = s;
  for (let t = T - 1; t > 0; t--) { s = back[t - 1][s]; path[t - 1] = s; }
  return path.map((p) => (p === S - 1 ? { root: -1, q: 0 } : { root: TEMPLATES[p].root, q: TEMPLATES[p].q }));
}

/** Full pipeline. */
export function detectChords(mono: Float32Array, sampleRate: number, key: Key | null, essentia?: EssentiaLike | null, beatsIn?: number[]): ChordResult {
  const dur = mono.length / sampleRate;
  const bt = beatsIn ? { beats: beatsIn, source: 'essentia' as const } : trackBeats(mono, sampleRate, essentia);
  // intervals: [0, b0), [b0, b1), ..., [bn, dur)
  const edges = [0, ...bt.beats.filter((b) => b > 0.05 && b < dur - 0.05), dur];
  const { hopSec, frames, energy } = chromaFrames(mono, sampleRate);
  const maxE = Math.max(1e-12, ...energy);
  const bc: number[][] = [], silent: boolean[] = [], starts: number[] = [], ends: number[] = [];
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = Math.floor(edges[i] / hopSec), b = Math.max(a + 1, Math.floor(edges[i + 1] / hopSec));
    const c = new Array(12).fill(0);
    let e = 0, n = 0;
    for (let f = a; f < Math.min(b, frames.length); f++) { for (let k = 0; k < 12; k++) c[k] += frames[f][k]; e += energy[f]; n++; }
    if (edges[i + 1] - edges[i] < 0.08) continue; // skip slivers
    bc.push(c); silent.push(!n || e / n < maxE * 1e-3); starts.push(edges[i]); ends.push(edges[i + 1]);
  }
  const states = decodeChords(bc, silent, key);
  const flats = key ? keyUsesFlats(key) : false;
  const beatChords = states.map((s) => chordLabel(s.root, s.root < 0 ? '' : QUALITIES[s.q].suf, flats));
  const segments: ChordSegment[] = [];
  states.forEach((s, i) => {
    const label = beatChords[i];
    const last = segments[segments.length - 1];
    if (last && last.label === label) last.end = ends[i];
    else segments.push({ start: starts[i], end: ends[i], root: s.root, suffix: s.root < 0 ? '' : QUALITIES[s.q].suf, label });
  });
  const ib = bt.beats.slice(1).map((b, i) => b - bt.beats[i]).filter((d) => d > 0.2 && d < 2).sort((a, b) => a - b);
  const bpm = ib.length ? 60 / ib[Math.floor(ib.length / 2)] : 0;
  return { beats: bt.beats, bpm: Math.round(bpm), segments, beatChords, beatSource: bt.source };
}

/** Chord at time t (seconds). */
export function chordAt(segments: ChordSegment[], t: number): ChordSegment | null {
  let lo = 0, hi = segments.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (t < segments[m].start) hi = m - 1; else if (t >= segments[m].end) lo = m + 1; else return segments[m];
  }
  return null;
}
