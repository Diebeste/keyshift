/// <reference lib="webworker" />
import { detectAudioKey, type EssentiaLike } from '../audio/keyAudio';
import { detectChords } from '../audio/chordDetect';

let essentia: EssentiaLike | null = null;
let essentiaError = '';
const ready = (async () => {
  try {
    const [{ EssentiaWASM }, { default: Essentia }] = await Promise.all([
      // @ts-ignore - untyped ES build of essentia.js (wasm embedded)
      import('essentia.js/dist/essentia-wasm.es.js'),
      // @ts-ignore
      import('essentia.js/dist/essentia.js-core.es.js'),
    ]);
    const M: any = EssentiaWASM;
    await new Promise<void>((r, j) => {
      if (M.calledRun) return r();
      const t = setTimeout(() => j(new Error('Essentia init timeout')), 20000);
      M.onRuntimeInitialized = () => { clearTimeout(t); r(); };
    });
    essentia = new Essentia(M);
  } catch (e) {
    essentiaError = String(e);
    essentia = null; // fall back to Meyda + profiles
  }
})();

self.onmessage = async (ev: MessageEvent) => {
  const { id, mono, sampleRate, forceFallback, type, key } = ev.data as { id: number; mono: Float32Array; sampleRate: number; forceFallback?: boolean; type?: string; key?: any };
  try {
    await ready;
    if (type === 'chords') {
      (self as any).postMessage({ id, ok: true, res: detectChords(mono, sampleRate, key ?? null, essentia) });
      return;
    }
    const res = detectAudioKey(mono, sampleRate, forceFallback ? null : essentia);
    (self as any).postMessage({ id, ok: true, res, essentiaError });
  } catch (e) {
    (self as any).postMessage({ id, ok: false, error: String(e) });
  }
};
