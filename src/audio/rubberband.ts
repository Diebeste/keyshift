// Offline Rubber Band pitch shift (tempo preserved). Works in a Worker or Node.
import type { RubberBandInterface } from 'rubberband-wasm';

export const RB_OPTIONS = {
  ProcessOffline: 0,
  PitchHighQuality: 33554432,
  EngineFiner: 536870912,
  FormantPreserved: 16777216,
};

export function shiftWithRubberBand(
  api: RubberBandInterface,
  channels: Float32Array[],
  sampleRate: number,
  semitones: number,
  onProgress?: (p: number) => void,
  opts: { finer?: boolean; formant?: boolean } = {},
): Float32Array[] {
  const len = channels[0].length;
  const options = RB_OPTIONS.ProcessOffline | RB_OPTIONS.PitchHighQuality
    | (opts.finer ? RB_OPTIONS.EngineFiner : 0) | (opts.formant ? RB_OPTIONS.FormantPreserved : 0);
  const st = api.rubberband_new(sampleRate, channels.length, options, 1, Math.pow(2, semitones / 12));
  const block = 4096;
  api.rubberband_set_max_process_size(st, block);
  api.rubberband_set_expected_input_duration(st, len);
  const arrPtr = api.malloc(channels.length * 4);
  const bufPtrs = channels.map((_, i) => {
    const p = api.malloc(block * 4);
    api.memWritePtr(arrPtr + i * 4, p);
    return p;
  });
  const out = channels.map(() => new Float32Array(len + block * 4));
  let last = 0;
  const report = (p: number) => { if (onProgress && (p - last > 0.01 || p === 1)) { last = p; onProgress(p); } };

  // pass 1: study
  for (let read = 0; read < len; ) {
    const n = Math.min(block, len - read);
    channels.forEach((ch, i) => api.memWrite(bufPtrs[i], ch.subarray(read, read + n)));
    read += n;
    api.rubberband_study(st, arrPtr, n, read >= len ? 1 : 0);
    report((read / len) * 0.2);
  }
  // pass 2: process
  let write = 0;
  const retrieve = () => {
    for (;;) {
      const avail = api.rubberband_available(st);
      if (avail < 1) break;
      const n = api.rubberband_retrieve(st, arrPtr, Math.min(block, avail));
      bufPtrs.forEach((p, i) => {
        const data = api.memReadF32(p, n);
        if (write + n > out[i].length) return;
        out[i].set(data, write);
      });
      write += n;
    }
  };
  for (let read = 0; read < len; ) {
    const n = Math.min(block, len - read);
    channels.forEach((ch, i) => api.memWrite(bufPtrs[i], ch.subarray(read, read + n)));
    read += n;
    api.rubberband_process(st, arrPtr, n, read >= len ? 1 : 0);
    retrieve();
    report(0.2 + (read / len) * 0.8);
  }
  retrieve();
  bufPtrs.forEach((p) => api.free(p));
  api.free(arrPtr);
  api.rubberband_delete(st);
  report(1);
  return out.map((o) => o.slice(0, len)); // same length as input: tempo unchanged
}
