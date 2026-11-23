// Generates one test file per format from a synthetic C-major chord progression (no third-party audio).
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { renderStabs, voicing } from '../src/audio/synth';
import { encodeWav, encodeMp3 } from '../src/audio/encode';
import { parseChord, chordIntervals } from '../src/theory/chords';

export const FIX = 'e2e/.fixtures';
export const PROG = ['C', 'Am', 'F', 'G', 'Dm', 'Em', 'G', 'C'];

export const FORMATS: { name: string; file: string; args: string[] }[] = [
  { name: 'MP3', file: 'song.mp3', args: ['-c:a', 'libmp3lame', '-b:a', '192k'] },
  { name: 'WAV', file: 'song.wav', args: ['-c:a', 'pcm_s16le'] },
  { name: 'M4A (AAC)', file: 'song.m4a', args: ['-c:a', 'aac', '-b:a', '192k'] },
  { name: 'AAC (ADTS)', file: 'song.aac', args: ['-c:a', 'aac', '-b:a', '192k', '-f', 'adts'] },
  { name: 'FLAC', file: 'song.flac', args: ['-c:a', 'flac'] },
  { name: 'OGG (Vorbis)', file: 'song.ogg', args: ['-c:a', 'libvorbis', '-q:a', '5'] },
  { name: 'Opus', file: 'song.opus', args: ['-c:a', 'libopus', '-b:a', '128k'] },
  { name: 'AIFF', file: 'song.aiff', args: ['-c:a', 'pcm_s16be'] },
  { name: 'MP4 video (H.264+AAC)', file: 'video.mp4', args: ['VIDEO', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'] },
  { name: 'MOV video (H.264+AAC)', file: 'video.mov', args: ['VIDEO', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'] },
  { name: 'WebM video (VP9+Opus)', file: 'video.webm', args: ['VIDEO', '-c:v', 'libvpx-vp9', '-b:v', '200k', '-deadline', 'realtime', '-c:a', 'libopus', '-b:a', '128k'] },
  { name: 'MKV video (H.264+AAC)', file: 'video.mkv', args: ['VIDEO', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'] },
];

export function makeFixtures() {
  mkdirSync(FIX, { recursive: true });
  const base = `${FIX}/base.wav`;
  if (!existsSync(base)) {
    const x = renderStabs(PROG.map((n) => { const c = parseChord(n)!; return voicing(c.root, chordIntervals(c)); }), 120, 4, 44100, 1);
    writeFileSync(base, encodeWav([x, x], 44100));
    writeFileSync(`${FIX}/c-major.mp3`, encodeMp3([x, x], 44100, 192));
  }
  for (const f of FORMATS) {
    const out = `${FIX}/${f.file}`;
    if (existsSync(out)) continue;
    const video = f.args[0] === 'VIDEO';
    const args = video
      ? ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x1d2030:s=320x240:r=15', '-i', base, '-shortest', '-map', '0:v', '-map', '1:a', ...f.args.slice(1), out]
      : ['-y', '-v', 'error', '-i', base, ...f.args, out];
    execFileSync('ffmpeg', args);
  }
}
