// Audio key detection core. Runs in a Web Worker in the app and in Node for tests.
import Meyda from 'meyda';
import { type KeyScore, rankKeysFromChroma, sameKey, type Key, parseKey } from '../theory/keys';

export function mixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length, out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}

/** Crude anti-aliased decimation by an integer factor (box filter). */
export function decimate(x: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return x;
  const n = Math.floor(x.length / factor), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < factor; j++) s += x[i * factor + j];
    out[i] = s / factor;
  }
  return out;
}

/** Average Meyda chroma over the signal (fallback path). Index 0 = C. */
export function meydaChroma(mono: Float32Array, sampleRate: number): number[] {
  const factor = Math.max(1, Math.floor(sampleRate / 11025));
  const x = decimate(mono, factor);
  const sr = sampleRate / factor;
  const N = 4096;
  const M: any = Meyda;
  M.bufferSize = N;
  M.sampleRate = sr;
  M.windowingFunction = 'hanning';
  const acc = new Array(12).fill(0);
  let frames = 0;
  for (let i = 0; i + N <= x.length; i += N / 2) {
    const frame = x.subarray(i, i + N);
    let e = 0;
    for (let k = 0; k < N; k += 8) e += frame[k] * frame[k];
    if (e < 1e-6) continue; // skip silence
    const c = M.extract('chroma', frame) as number[] | null;
    if (!c) continue;
    for (let k = 0; k < 12; k++) acc[k] += c[k] * Math.sqrt(e);
    frames++;
  }
  return frames ? acc.map((v) => v / frames) : acc;
}

export interface EssentiaLike {
  arrayToVector(a: Float32Array): unknown;
  KeyExtractor(...args: unknown[]): { key: string; scale: string; strength: number };
}

export function essentiaKey(e: EssentiaLike, mono: Float32Array, sampleRate: number): { key: Key; strength: number } | null {
  const factor = sampleRate >= 88200 ? 2 : 1; // keep sample rate sane
  const x = decimate(mono, factor);
  const r = e.KeyExtractor(e.arrayToVector(x), true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', sampleRate / factor, 0.0001, 440, 'cosine', 'hann');
  const k = parseKey(r.key + (r.scale === 'minor' ? 'm' : ''));
  return k ? { key: k, strength: r.strength } : null;
}

export interface AudioKeyResult {
  top: KeyScore[];          // best 3
  engine: 'essentia' | 'meyda-profiles';
  essentia?: { key: Key; strength: number };
  chroma: number[];
}

/** Detect key: Essentia KeyExtractor when available, Meyda chroma + Krumhansl/Temperley profiles otherwise (always computed for the ranking). */
export function detectAudioKey(mono: Float32Array, sampleRate: number, essentia?: EssentiaLike | null): AudioKeyResult {
  const chroma = meydaChroma(mono, sampleRate);
  const ranked = rankKeysFromChroma(chroma);
  let ess: { key: Key; strength: number } | null = null;
  if (essentia) {
    try { ess = essentiaKey(essentia, mono, sampleRate); } catch { ess = null; }
  }
  if (!ess) return { top: ranked.slice(0, 3), engine: 'meyda-profiles', chroma };
  const rest = ranked.filter((r) => !sameKey(r.key, ess!.key));
  const top: KeyScore[] = [{ key: ess.key, score: 1, confidence: Math.max(0, Math.min(1, ess.strength)) }, ...rest.slice(0, 2)];
  return { top, engine: 'essentia', essentia: ess, chroma };
}
