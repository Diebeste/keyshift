// Thin promise wrappers around the audio workers. All processing stays on this device.
import KeyWorker from '../workers/key.worker.ts?worker';
import ShiftWorker from '../workers/shift.worker.ts?worker';
import type { AudioKeyResult } from '../audio/keyAudio';
import type { ChordResult } from '../audio/chordDetect';
import type { Key } from '../theory/keys';

let keyW: Worker | null = null;
let shiftW: Worker | null = null;
let seq = 0;

export function detectKeyInWorker(mono: Float32Array, sampleRate: number, forceFallback = false): Promise<AudioKeyResult & { essentiaError?: string }> {
  keyW ??= new KeyWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const on = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      keyW!.removeEventListener('message', on);
      e.data.ok ? resolve({ ...e.data.res, essentiaError: e.data.essentiaError }) : reject(new Error(e.data.error));
    };
    keyW!.addEventListener('message', on);
    keyW!.postMessage({ id, mono: mono.slice(), sampleRate, forceFallback });
  });
}

export function detectChordsInWorker(mono: Float32Array, sampleRate: number, key: Key | null): Promise<ChordResult> {
  keyW ??= new KeyWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const on = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      keyW!.removeEventListener('message', on);
      e.data.ok ? resolve(e.data.res) : reject(new Error(e.data.error));
    };
    keyW!.addEventListener('message', on);
    keyW!.postMessage({ id, type: 'chords', mono: mono.slice(), sampleRate, key });
  });
}

function shiftCall<T>(msg: Record<string, unknown>, onProgress?: (p: number) => void): Promise<T> {
  shiftW ??= new ShiftWorker();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const on = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      if (e.data.type === 'progress') return onProgress?.(e.data.p);
      shiftW!.removeEventListener('message', on);
      e.data.type === 'done' ? resolve(e.data) : reject(new Error(e.data.error));
    };
    shiftW!.addEventListener('message', on);
    shiftW!.postMessage({ id, ...msg });
  });
}

export async function shiftInWorker(channels: Float32Array[], sampleRate: number, semitones: number, onProgress?: (p: number) => void, finer = false) {
  const r = await shiftCall<{ channels: Float32Array[] }>({ type: 'shift', channels: channels.map((c) => c.slice()), sampleRate, semitones, finer }, onProgress);
  return r.channels;
}

export async function encodeInWorker(channels: Float32Array[], sampleRate: number, format: 'wav' | 'mp3', onProgress?: (p: number) => void) {
  const r = await shiftCall<{ bytes: Uint8Array }>({ type: 'encode', channels: channels.map((c) => c.slice()), sampleRate, format }, onProgress);
  return r.bytes;
}
