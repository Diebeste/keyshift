import { it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { detectChords } from '../src/audio/chordDetect';
import { detectAudioKey } from '../src/audio/keyAudio';
import { keyName } from '../src/theory/keys';
import { loadEssentia } from './helpers';
it.skipIf(!existsSync('/tmp/gym.f32'))('real mp3 chords', async () => {
  const b = readFileSync('/tmp/gym.f32');
  const x = new Float32Array(b.buffer, b.byteOffset, b.length / 4);
  const ess = await loadEssentia();
  const t0 = Date.now();
  const key = detectAudioKey(x, 44100, ess).top[0].key;
  const r = detectChords(x, 44100, key, ess);
  console.log(`[real] key ${keyName(key)} bpm ${r.bpm} beats ${r.beats.length} segs ${r.segments.length} in ${Date.now() - t0}ms`);
  console.log('[real] first 60s: ' + r.segments.filter((s) => s.start < 60).map((s) => `${s.start.toFixed(1)}:${s.label}`).join(' '));
  const counts: Record<string, number> = {};
  r.segments.forEach((s) => (counts[s.label] = (counts[s.label] ?? 0) + (s.end - s.start)));
  console.log('[real] time per chord: ' + Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(0)}s`).join(', '));
});
