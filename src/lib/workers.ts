// Thin promise wrappers around the audio workers. All processing stays on this device.
import KeyWorker from '../workers/key.worker.ts?worker';
import ShiftWorker from '../workers/shift.worker.ts?worker';
import type { AudioKeyResult } from '../audio/keyAudio';
import type { ChordResult } from '../audio/chordDetect';
import type { Key } from '../theory/keys';

let keyW: Worker | null = null;
let shiftW: Worker | null = null;
let seq = 0;

function transferCopy(src: Float32Array): { copy: Float32Array; transfer: Transferable[] } {
  const copy = src.slice();
  return { copy, transfer: [copy.buffer] };
}

function once<T>(worker: () => Worker, payload: Record<string, unknown>, transfer: Transferable[], onProgress?: (p: number) => void, pick?: (data: any) => T): Promise<T> {
  const w = worker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      w.removeEventListener('message', on);
      w.removeEventListener('error', onErr);
      w.removeEventListener('messageerror', onMsgErr);
    };
    const fail = (msg: string) => { cleanup(); reject(new Error(msg)); };
    const on = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      if (e.data.type === 'progress') { onProgress?.(e.data.p); return; }
      cleanup();
      if (e.data.ok === true || e.data.type === 'done') resolve(pick ? pick(e.data) : e.data);
      else reject(new Error(e.data.error ?? 'Audio worker failed'));
    };
    const onErr = (e: ErrorEvent) => fail(e.message || 'Audio worker failed');
    const onMsgErr = () => fail('Audio worker could not read a message');
    w.addEventListener('message', on);
    w.addEventListener('error', onErr);
    w.addEventListener('messageerror', onMsgErr);
    w.postMessage({ id, ...payload }, transfer);
  });
}

const keyWorker = () => (keyW ??= new KeyWorker());
const shiftWorker = () => (shiftW ??= new ShiftWorker());

export function detectKeyInWorker(mono: Float32Array, sampleRate: number, forceFallback = false): Promise<AudioKeyResult & { essentiaError?: string }> {
  const { copy, transfer } = transferCopy(mono);
  return once(keyWorker, { mono: copy, sampleRate, forceFallback }, transfer, undefined, (d) => ({ ...d.res, essentiaError: d.essentiaError }));
}

export function detectChordsInWorker(mono: Float32Array, sampleRate: number, key: Key | null): Promise<ChordResult> {
  const { copy, transfer } = transferCopy(mono);
  return once(keyWorker, { type: 'chords', mono: copy, sampleRate, key }, transfer, undefined, (d) => d.res);
}

export async function shiftInWorker(channels: Float32Array[], sampleRate: number, semitones: number, onProgress?: (p: number) => void, finer = false) {
  const copies = channels.map((c) => c.slice());
  const r = await once<{ channels: Float32Array[] }>(shiftWorker, { type: 'shift', channels: copies, sampleRate, semitones, finer }, copies.map((c) => c.buffer), onProgress);
  return r.channels;
}

export async function encodeInWorker(channels: Float32Array[], sampleRate: number, format: 'wav' | 'mp3', onProgress?: (p: number) => void) {
  const copies = channels.map((c) => c.slice());
  const r = await once<{ bytes: Uint8Array }>(shiftWorker, { type: 'encode', channels: copies, sampleRate, format }, copies.map((c) => c.buffer), onProgress);
  return r.bytes;
}
