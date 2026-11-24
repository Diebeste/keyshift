// ffmpeg.wasm, single-thread core (no SharedArrayBuffer / cross-origin isolation needed, so it works on GitHub Pages).
// Lazy-loaded only when the browser can't decode a file natively or when exporting to the original format.
// Files are processed in memory in a Web Worker; nothing is uploaded.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import { extOf } from './formats';

export { originalFormat } from './formats';

let inst: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let progressCb: ((p: number) => void) | null = null;

export function loadFFmpeg(): Promise<FFmpeg> {
  if (inst) return Promise.resolve(inst);
  loading ??= (async () => {
    const f = new FFmpeg();
    f.on('progress', ({ progress }) => progressCb?.(Math.max(0, Math.min(1, progress))));
    // absolute URLs: the ffmpeg worker resolves relative URLs against its own location
    await f.load({ coreURL: new URL(coreURL, location.href).href, wasmURL: new URL(wasmURL, location.href).href });
    inst = f;
    return f;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

/** Extract/convert any audio or video file to 16-bit WAV bytes. */
export async function toWav(file: File, onProgress?: (p: number) => void): Promise<Uint8Array> {
  const f = await loadFFmpeg();
  const inName = 'in.' + (extOf(file.name) || 'bin');
  await f.writeFile(inName, new Uint8Array(await file.arrayBuffer()));
  progressCb = onProgress ?? null;
  try {
    const code = await f.exec(['-i', inName, '-vn', '-sn', '-dn', '-ac', '2', '-c:a', 'pcm_s16le', '-f', 'wav', 'out.wav']);
    if (code !== 0) throw new Error('ffmpeg could not find an audio track in this file');
    return (await f.readFile('out.wav')) as Uint8Array;
  } finally {
    progressCb = null;
    await f.deleteFile(inName).catch(() => {});
    await f.deleteFile('out.wav').catch(() => {});
  }
}

/** Encode WAV bytes into another format. */
export async function encodeWith(wav: Uint8Array, outExt: string, args: string[], onProgress?: (p: number) => void): Promise<Uint8Array> {
  const f = await loadFFmpeg();
  await f.writeFile('src.wav', wav);
  progressCb = onProgress ?? null;
  const out = 'out.' + outExt;
  try {
    const code = await f.exec(['-i', 'src.wav', ...args, out]);
    if (code !== 0) throw new Error('ffmpeg encode failed');
    return (await f.readFile(out)) as Uint8Array;
  } finally {
    progressCb = null;
    await f.deleteFile('src.wav').catch(() => {});
    await f.deleteFile(out).catch(() => {});
  }
}
