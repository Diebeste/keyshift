import { describe, it, expect, beforeAll } from 'vitest';
import { detectAudioKey, type EssentiaLike } from '../src/audio/keyAudio';
import { shiftWithRubberBand } from '../src/audio/rubberband';
import { encodeWav, encodeMp3 } from '../src/audio/encode';
import { renderProgression, C_MAJOR_PROG, A_MINOR_PROG } from '../src/audio/synth';
import { keyName, relativeOf, sameKey, transposeKey, type Key } from '../src/theory/keys';
import { loadEssentia, loadRubberBand } from './helpers';
import type { RubberBandInterface } from 'rubberband-wasm';

const SR = 44100;
let ess: EssentiaLike;
let rb: RubberBandInterface;
beforeAll(async () => { ess = await loadEssentia(); rb = await loadRubberBand(); });

const okOrRelative = (got: Key, want: Key) => sameKey(got, want) || sameKey(got, relativeOf(want));

describe('key detection on synthetic progressions', () => {
  const cmaj = renderProgression(C_MAJOR_PROG, 1.5, SR);
  const amin = renderProgression(A_MINOR_PROG, 1.5, SR);
  for (const engine of ['essentia', 'fallback'] as const) {
    it(`C major progression → C major (or relative) [${engine}]`, () => {
      const r = detectAudioKey(cmaj, SR, engine === 'essentia' ? ess : null);
      expect(r.engine).toBe(engine === 'essentia' ? 'essentia' : 'meyda-profiles');
      expect(r.top).toHaveLength(3);
      expect(okOrRelative(r.top[0].key, { tonic: 0, mode: 'major' }), keyName(r.top[0].key)).toBe(true);
    });
    it(`A minor progression → A minor (or relative) [${engine}]`, () => {
      const r = detectAudioKey(amin, SR, engine === 'essentia' ? ess : null);
      expect(okOrRelative(r.top[0].key, { tonic: 9, mode: 'minor' }), keyName(r.top[0].key)).toBe(true);
    });
  }
});

describe('round-trip pitch shift with Rubber Band', () => {
  for (const [name, prog, key] of [['C major', C_MAJOR_PROG, { tonic: 0, mode: 'major' }], ['A minor', A_MINOR_PROG, { tonic: 9, mode: 'minor' }]] as const) {
    it(`${name}: +2 semitones moves the detected key by 2 and keeps duration within 1%`, () => {
      const x = renderProgression(prog as number[][], 1.5, SR);
      const before = detectAudioKey(x, SR, ess).top[0].key;
      let lastP = 0;
      const [y] = shiftWithRubberBand(rb, [x], SR, 2, (p) => { lastP = p; });
      expect(lastP).toBe(1);
      expect(Math.abs(y.length - x.length) / x.length).toBeLessThan(0.01);
      const rms = Math.sqrt(y.reduce((s, v) => s + v * v, 0) / y.length);
      expect(rms).toBeGreaterThan(0.01);
      const after = detectAudioKey(y, SR, ess).top[0].key;
      expect(sameKey(after, transposeKey(before, 2)), `${keyName(before)} → ${keyName(after)}`).toBe(true);
      expect(okOrRelative(after, transposeKey(key as Key, 2))).toBe(true);
      const fb0 = detectAudioKey(x, SR, null).top[0].key, fb1 = detectAudioKey(y, SR, null).top[0].key;
      expect(sameKey(fb1, transposeKey(fb0, 2)), `${keyName(fb0)} → ${keyName(fb1)}`).toBe(true);
    });
  }
  it('stereo shift keeps channel count and length; -3 semitones also tracks', () => {
    const x = renderProgression(C_MAJOR_PROG, 1, SR, 1);
    const out = shiftWithRubberBand(rb, [x, x.slice()], SR, -3);
    expect(out).toHaveLength(2);
    expect(out[0].length).toBe(x.length);
    expect(sameKey(detectAudioKey(out[0], SR, ess).top[0].key, transposeKey(detectAudioKey(x, SR, ess).top[0].key, -3))).toBe(true);
  });
});

describe('encoders', () => {
  const x = renderProgression(C_MAJOR_PROG, 0.5, SR, 1);
  it('WAV header and size', () => {
    const w = encodeWav([x, x], SR);
    expect(new TextDecoder().decode(w.slice(0, 4))).toBe('RIFF');
    expect(w.length).toBe(44 + x.length * 4);
  });
  it('MP3 frames', () => {
    const m = encodeMp3([x, x], SR, 128);
    expect(m.length).toBeGreaterThan(1000);
    expect(m[0]).toBe(0xff);
    expect(m[1] & 0xe0).toBe(0xe0);
  });
});
