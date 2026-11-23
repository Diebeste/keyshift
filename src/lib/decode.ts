// Decode any supported audio/video file locally: native decodeAudioData first, ffmpeg.wasm fallback.
import { audioCtx } from './audio';

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

export async function decodeAny(file: File, onStatus: (msg: string, p?: number) => void): Promise<Decoded> {
  const warnings: string[] = [];
  const sizeMB = file.size / MB;
  const warnMB = Number(params().get('warnFileMB')) || LIMITS.warnFileMB;
  if (sizeMB > LIMITS.maxFileMB) throw new Error(`This file is ${sizeMB.toFixed(0)} MB. Files over ${LIMITS.maxFileMB} MB won't fit in browser memory; trim it or export just the audio first.`);
  if (sizeMB > warnMB) warnings.push(`Large file (${sizeMB.toFixed(0)} MB): decoding may take a while and can run out of memory on phones or tablets.`);
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
    const wav = await toWav(file, (p) => onStatus(isVideo ? 'Extracting audio from the video…' : 'Converting…', p));
    try {
      buffer = await audioCtx().decodeAudioData(wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer);
    } catch (e) {
      throw new Error('Converted, but the browser could not read the result: ' + e);
    }
    via = 'ffmpeg';
  }
  const decodedMB = (buffer.length * buffer.numberOfChannels * 4) / MB;
  if (decodedMB > LIMITS.warnDecodedMB) warnings.push(`Decoded audio uses about ${decodedMB.toFixed(0)} MB of memory; rendering needs roughly 3× that. If the tab crashes, trim the file or use a computer.`);
  return { buffer, via, warnings };
}

export const isOriginalExportable = (name: string) => !/\.(mp3|wav)$/i.test(name);
