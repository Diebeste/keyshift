// Decode any supported audio/video file locally: native decodeAudioData first, ffmpeg.wasm fallback.
import { audioCtx } from './audio';

export { isOriginalExportable } from './formats';

export const ACCEPT = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga,.opus,.aif,.aiff,.mp4,.m4v,.mov,.webm,.mkv';

const MB = 1024 * 1024;
export const LIMITS = {
  warnFileMB: 300,      // above this, warn about memory
  maxFileMB: 1500,      // refuse: browser tabs can't hold this plus decoded audio
  ffmpegMaxMB: 700,     // ffmpeg.wasm (single thread) keeps input + output in wasm memory (max ~2 GB)
  warnDecodedMB: 450,   // decoded PCM above this is risky on phones
};

// Test hooks: ?decoder=ffmpeg forces the ffmpeg.wasm path; ?warnFileMB=N lowers the large-file warning threshold.
const params = () => new URLSearchParams(typeof location !== 'undefined' ? location.search : '');

export interface Decoded { buffer: AudioBuffer; via: 'native' | 'ffmpeg'; warnings: string[] }

/** Size / emptiness checks that can run in Node tests (no AudioContext). */
export function preflightFile(file: { size: number }, warnFileMB = LIMITS.warnFileMB): { sizeMB: number; warnings: string[] } {
  const sizeMB = file.size / MB;
  if (file.size <= 0) throw new Error('This file is empty.');
  if (sizeMB > LIMITS.maxFileMB) throw new Error(`This file is ${sizeMB.toFixed(0)} MB. Files over ${LIMITS.maxFileMB} MB won't fit in browser memory; trim it or export just the audio first.`);
  const warnings: string[] = [];
  if (sizeMB > warnFileMB) warnings.push(`Large file (${sizeMB.toFixed(0)} MB): decoding may take a while and can run out of memory on phones or tablets.`);
  return { sizeMB, warnings };
}

export async function decodeAny(file: File, onStatus: (msg: string, p?: number) => void): Promise<Decoded> {
  const warnMB = Number(params().get('warnFileMB')) || LIMITS.warnFileMB;
  const { sizeMB, warnings } = preflightFile(file, warnMB);
  const isVideo = /^video\//.test(file.type) || /\.(mp4|m4v|mov|webm|mkv)$/i.test(file.name);
  let buffer: AudioBuffer | null = null;
  let via: Decoded['via'] = 'native';
  onStatus(isVideo ? 'Reading the audio track from the video…' : 'Decoding…');
  if (params().get('decoder') !== 'ffmpeg') {
    try {
      buffer = await audioCtx().decodeAudioData(await file.arrayBuffer());
    } catch {
      buffer = null;
    }
  }
  if (!buffer) {
    if (sizeMB > LIMITS.ffmpegMaxMB) throw new Error(`Your browser can't decode this format natively, and at ${sizeMB.toFixed(0)} MB it's too big for the built-in converter (limit ${LIMITS.ffmpegMaxMB} MB). Convert it to MP3/WAV first.`);
    onStatus('Loading the converter (ffmpeg.wasm, about 31 MB, first time only)…', 0);
    const { toWav, loadFFmpeg } = await import('./ffmpeg');
    try { await loadFFmpeg(); } catch (e) { throw new Error('Could not load the converter: ' + e); }
    onStatus(isVideo ? 'Extracting audio from the video…' : 'Converting…', 0);
    try {
      const wav = await toWav(file, (p) => onStatus(isVideo ? 'Extracting audio from the video…' : 'Converting…', p));
      buffer = await audioCtx().decodeAudioData(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer);
    } catch (e) {
      const msg = String(e).replace(/^Error: /, '');
      if (/could not load the converter/i.test(msg)) throw e;
      throw new Error(`Couldn't decode this file (${file.name}). Try exporting it as MP3 or WAV. ${msg}`);
    }
    via = 'ffmpeg';
  }
  const decodedMB = (buffer.length * buffer.numberOfChannels * 4) / MB;
  if (decodedMB > LIMITS.warnDecodedMB) warnings.push(`Decoded audio uses about ${decodedMB.toFixed(0)} MB of memory; rendering needs roughly 3× that. If the tab crashes, trim the file or use a computer.`);
  return { buffer, via, warnings };
}

