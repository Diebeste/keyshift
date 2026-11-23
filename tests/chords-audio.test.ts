import { describe, it, expect, beforeAll } from 'vitest';
import { detectChords, QUALITIES } from '../src/audio/chordDetect';
import { chartLines } from '../src/audio/chordChart';
import { renderStabs, voicing } from '../src/audio/synth';
import { shiftWithRubberBand } from '../src/audio/rubberband';
import { detectAudioKey, type EssentiaLike } from '../src/audio/keyAudio';
import { parseChord, chordIntervals, transposeChordString } from '../src/theory/chords';
import { parseSheet, sheetChords, transposeSheet, toText } from '../src/theory/sheet';
import { transposeKey } from '../src/theory/keys';
import { noteToPc, mod12 } from '../src/theory/notes';
import { loadEssentia, loadRubberBand } from './helpers';
import type { RubberBandInterface } from 'rubberband-wasm';

const SR = 44100, BPM = 120, BPC = 4;
let ess: EssentiaLike, rb: RubberBandInterface;
beforeAll(async () => { ess = await loadEssentia(); rb = await loadRubberBand(); });

const TRIADS = ['C', 'Am', 'F', 'G', 'Dm', 'Em', 'G', 'C'];
const EXTENDED = ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Gsus4', 'G', 'Bdim', 'C'];
const COLOR = ['Dsus2', 'D', 'Caug', 'C', 'Gsus4', 'G', 'Em7', 'Em'];

const render = (names: string[]) => renderStabs(names.map((n) => { const c = parseChord(n)!; return voicing(c.root, chordIntervals(c)); }), BPM, BPC, SR, 2);
const truthAt = (names: string[], t: number) => { const seq = [...names, ...names]; return seq[Math.min(seq.length - 1, Math.floor(t / ((60 / BPM) * BPC)))]; };
const samePc = (a: string, b: string) => {
  const A = parseChord(a), B = parseChord(b);
  return !!A && !!B && A.root === B.root && normQ(A.suffix) === normQ(B.suffix);
};
const normQ = (s: string) => s;

/** fraction of beats (measured at each detected beat interval midpoint inside the music) whose chord matches */
function perBeatAccuracy(res: ReturnType<typeof detectChords>, names: string[], shift = 0): number {
  const total = names.length * 2 * BPC * (60 / BPM);
  let ok = 0, n = 0;
  for (const seg of res.segments) {
    // weight by duration in beats
    for (let t = seg.start + 0.125; t < Math.min(seg.end, total); t += 60 / BPM) {
      const want = transposeChordString(truthAt(names, t), shift, false);
      n++; if (samePc(seg.label, want)) ok++;
    }
  }
  return ok / n;
}

describe('chord detection from audio (synthetic, known chords)', () => {
  const results: Record<string, number> = {};
  for (const [name, prog] of [['triads', TRIADS], ['sevenths/sus/dim', EXTENDED], ['sus2/aug/m7', COLOR]] as const) {
    it(`${name}: per-beat accuracy`, () => {
      const x = render(prog as unknown as string[]);
      const key = detectAudioKey(x, SR, ess).top[0].key;
      const res = detectChords(x, SR, key, ess);
      expect(res.beatSource).toBe('essentia');
      expect(Math.abs(res.bpm - BPM)).toBeLessThanOrEqual(3);
      const acc = perBeatAccuracy(res, prog as unknown as string[]);
      results[name] = acc;
      console.log(`[chords] ${name}: ${(acc * 100).toFixed(1)}% per-beat, ${res.beats.length} beats @ ${res.bpm} bpm, segments: ${res.segments.map((s) => s.label).join(' ')}`);
      if (name === 'triads') expect(acc).toBeGreaterThanOrEqual(0.8);
      else expect(acc).toBeGreaterThanOrEqual(0.6);
    });
  }

  it('after a +2 Rubber Band shift, detected chords line up with the transposed truth', () => {
    const x = render(TRIADS);
    const k0 = detectAudioKey(x, SR, ess).top[0].key;
    const [y] = shiftWithRubberBand(rb, [x], SR, 2);
    const k1 = detectAudioKey(y, SR, ess).top[0].key;
    expect(k1).toEqual(transposeKey(k0, 2));
    const r0 = detectChords(x, SR, k0, ess), r1 = detectChords(y, SR, k1, ess);
    const acc = perBeatAccuracy(r1, TRIADS, 2);
    console.log(`[chords] +2 shift: ${(acc * 100).toFixed(1)}% per-beat vs transposed truth`);
    expect(acc).toBeGreaterThanOrEqual(0.8);
    // original detection transposed by +2 ≈ detection on the shifted audio (beat by beat)
    let agree = 0;
    r0.beatChords.forEach((c, i) => { const t = r1.beatChords[i]; if (t && samePc(transposeChordString(c, 2, false), t)) agree++; });
    expect(agree / r0.beatChords.length).toBeGreaterThanOrEqual(0.8);
  });

  it('builds a bar chart that parses as a chord sheet and transposes', () => {
    const x = render(TRIADS);
    const key = detectAudioKey(x, SR, ess).top[0].key;
    const res = detectChords(x, SR, key, ess);
    const lines = chartLines(res.segments, res.beats);
    expect(lines.length).toBeGreaterThan(0);
    const sheet = parseSheet(lines.join('\n'));
    const chords = sheetChords(sheet).map((c) => mod12(c.root));
    expect(chords.length).toBeGreaterThanOrEqual(8);
    const up = toText(transposeSheet(sheet, 2, transposeKey(key, 2)));
    expect(sheetChords(parseSheet(up)).map((c) => c.root)).toEqual(chords.map((r) => mod12(r + 2)));
    expect(noteToPc('C')).toBe(0);
    expect(QUALITIES).toHaveLength(9);
  });
});

describe('chart downbeat guess', () => {
  it('puts chord changes on beat 1 even when the first tracked beat is a pickup', () => {
    const beats = Array.from({ length: 17 }, (_, i) => 0.5 + i * 0.5); // first beat is the 2nd beat of bar 1
    const segs = [{ start: 0, end: 1.5, label: 'C' }, { start: 1.5, end: 3.5, label: 'Am' }, { start: 3.5, end: 5.5, label: 'F' }, { start: 5.5, end: 9, label: 'G' }];
    const lines = chartLines(segs, beats);
    expect(lines.join(' ').replace(/\s+/g, ' ')).toBe('| C | Am | F | G | | G |');
  });
});
