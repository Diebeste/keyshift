// Shared "export in the original format" table. Kept out of ffmpeg.ts so the UI can
// decide whether that button applies without loading ffmpeg.wasm.

export interface OriginalFormat {
  ext: string;
  args: string[];
  mime: string;
  label: string;
}

const map: Record<string, OriginalFormat> = {
  flac: { ext: 'flac', args: ['-c:a', 'flac'], mime: 'audio/flac', label: 'FLAC' },
  ogg: { ext: 'ogg', args: ['-c:a', 'libvorbis', '-q:a', '6'], mime: 'audio/ogg', label: 'OGG' },
  oga: { ext: 'ogg', args: ['-c:a', 'libvorbis', '-q:a', '6'], mime: 'audio/ogg', label: 'OGG' },
  opus: { ext: 'opus', args: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', '160k'], mime: 'audio/ogg', label: 'Opus' },
  m4a: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4', label: 'M4A' },
  aac: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4', label: 'M4A' },
  aif: { ext: 'aiff', args: ['-c:a', 'pcm_s16be'], mime: 'audio/aiff', label: 'AIFF' },
  aiff: { ext: 'aiff', args: ['-c:a', 'pcm_s16be'], mime: 'audio/aiff', label: 'AIFF' },
  // video: export the audio track in the container's usual audio codec (audio only)
  mp4: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4', label: 'M4A' },
  m4v: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4', label: 'M4A' },
  mov: { ext: 'm4a', args: ['-c:a', 'aac', '-b:a', '192k'], mime: 'audio/mp4', label: 'M4A' },
  webm: { ext: 'webm', args: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', '160k'], mime: 'audio/webm', label: 'WebM' },
  mkv: { ext: 'mka', args: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', '160k'], mime: 'audio/x-matroska', label: 'MKA' },
};

export const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();

/** Output format for "export in the original format": extension + ffmpeg audio codec args. */
export function originalFormat(name: string): OriginalFormat | null {
  const e = extOf(name);
  return e ? map[e] ?? null : null;
}

export const isOriginalExportable = (name: string) => originalFormat(name) !== null;
