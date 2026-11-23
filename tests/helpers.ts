import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { RubberBandInterface } from 'rubberband-wasm';
import type { EssentiaLike } from '../src/audio/keyAudio';

const require = createRequire(import.meta.url);

export async function loadEssentia(): Promise<EssentiaLike> {
  const M = require('essentia.js/dist/essentia-wasm.umd.js');
  const Essentia = require('essentia.js/dist/essentia.js-core.umd.js');
  await new Promise<void>((r) => (M.calledRun ? r() : (M.onRuntimeInitialized = () => r())));
  return new Essentia(M) as EssentiaLike;
}

export async function loadRubberBand(): Promise<RubberBandInterface> {
  const bytes = readFileSync(require.resolve('rubberband-wasm/dist/rubberband.wasm'));
  return RubberBandInterface.initialize(await WebAssembly.compile(bytes));
}
