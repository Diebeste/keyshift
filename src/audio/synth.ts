// Synthetic chord progressions for tests and demos.
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Render a progression of chords (arrays of MIDI notes), each `secs` long, with a few harmonics and a soft envelope. */
export function renderProgression(chords: number[][], secs = 1.5, sampleRate = 44100, repeats = 2): Float32Array {
  const per = Math.floor(secs * sampleRate);
  const seq = Array.from({ length: repeats }, () => chords).flat();
  const out = new Float32Array(per * seq.length);
  seq.forEach((notes, ci) => {
    for (const m of notes) {
      const f = midiHz(m);
      for (let i = 0; i < per; i++) {
        const t = i / sampleRate;
        const env = Math.min(1, t * 50) * Math.exp(-t * 1.2);
        let s = 0;
        for (let h = 1; h <= 4; h++) if (f * h < sampleRate / 2) s += Math.sin(2 * Math.PI * f * h * t) / (h * h);
        out[ci * per + i] += (s * env * 0.25) / notes.length * 2;
      }
    }
  });
  return out;
}

// I – IV – V – I in C major (with bass), and i – iv – V – i in A minor.
export const C_MAJOR_PROG = [[48, 60, 64, 67], [53, 60, 65, 69], [55, 59, 62, 67], [48, 60, 64, 67]];
export const A_MINOR_PROG = [[45, 57, 60, 64], [50, 57, 62, 65], [52, 56, 59, 64], [45, 57, 60, 64]];
