// ffmpeg.wasm, single-thread core (no SharedArrayBuffer / cross-origin isolation needed, so it works on GitHub Pages).
// Lazy-loaded only when the browser can't decode a file natively or when exporting to the original format.
// Files are processed in memory in a Web Worker; nothing is uploaded.
import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

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

const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? 'bin').toLowerCase();

/** Extract/convert any audio or video file to 16-bit WAV bytes. */
export async function toWav(file: File, onProgress?: (p: number) => void): Promise<Uint8Array> {
  const f = await loadFFmpeg();
  const inName = 'in.' + extOf(file.name);
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

/** Output format for "export in the original format": extension + ffmpeg audio codec args. */
export function originalFormat(name: string): { ext: string; args: string[]; mime: string } | null {
  const e = extOf(name);
  const map: Record<string, { ext: string; args: string[]; mime: string }> = {
    flac: { ext: 'flac', args: ['-c:a', 'flac'], mime: 'audio/flac' },
    ogg: { ext: 'ogg', args: ['-c:a', 'libvorbis', '-q:a', '6'], mime: 'audio/ogg' },
    oga: { ext: 'ogg', args: ['-c:a', 'libvorbis', '-q:a', '6'], mime: 'audio/ogg' },
    opus: { ext: 'opus', args: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', '160k'], mime: 'audio/ogg' },
    m4a: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4' },
    aac: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4' },
    aif: { ext: 'aiff', args: ['-c:a', 'pcm_s16be'], mime: 'audio/aiff' },
    aiff: { ext: 'aiff', args: ['-c:a', 'pcm_s16be'], mime: 'audio/aiff' },
    // video: export the audio track in the container's usual audio codec (audio only)
    mp4: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4' },
    mov: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4' },
    webm: { ext: 'webm', args: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', '160k'], mime: 'audio/webm' },
    mkv: { ext: 'mka', args: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', '160k'], mime: 'audio/x-matroska' },
  };
  return map[e] ?? null;
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
