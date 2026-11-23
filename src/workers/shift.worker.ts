/// <reference lib="webworker" />
import { RubberBandInterface } from 'rubberband-wasm';
import wasmUrl from 'rubberband-wasm/dist/rubberband.wasm?url';
import { shiftWithRubberBand } from '../audio/rubberband';
import { encodeMp3, encodeWav } from '../audio/encode';

let api: RubberBandInterface | null = null;
async function getApi() {
  if (!api) {
    const bytes = await (await fetch(wasmUrl)).arrayBuffer();
    api = await RubberBandInterface.initialize(await WebAssembly.compile(bytes));
  }
  return api;
}

const post = (m: unknown, t: Transferable[] = []) => (self as any).postMessage(m, t);

self.onmessage = async (ev: MessageEvent) => {
  const d = ev.data;
  try {
    if (d.type === 'shift') {
      const rb = await getApi();
      const out = shiftWithRubberBand(rb, d.channels, d.sampleRate, d.semitones, (p) => post({ id: d.id, type: 'progress', p }), { finer: !!d.finer, formant: !!d.formant });
      post({ id: d.id, type: 'done', channels: out }, out.map((c) => c.buffer));
    } else if (d.type === 'encode') {
      const bytes = d.format === 'mp3'
        ? encodeMp3(d.channels, d.sampleRate, d.kbps ?? 192, (p) => post({ id: d.id, type: 'progress', p }))
        : encodeWav(d.channels, d.sampleRate);
      post({ id: d.id, type: 'done', bytes }, [bytes.buffer]);
    }
  } catch (e) {
    post({ id: d.id, type: 'error', error: String(e) });
  }
};
