import { describe, it, expect } from 'vitest';
import { originalFormat, isOriginalExportable, extOf } from '../src/lib/formats';
import { LIMITS, preflightFile } from '../src/lib/decode';

describe('original-format export list', () => {
  it('is only offered for formats we can actually encode, not MP3/WAV or unknown types', () => {
    expect(isOriginalExportable('song.mp3')).toBe(false);
    expect(isOriginalExportable('song.wav')).toBe(false);
    expect(isOriginalExportable('song.WAV')).toBe(false);
    expect(isOriginalExportable('notes.txt')).toBe(false);
    expect(isOriginalExportable('audio')).toBe(false);
    expect(isOriginalExportable('')).toBe(false);
  });

  it('maps containers to the audio format the Export button advertises', () => {
    const cases: [string, string, string][] = [
      ['hymn.flac', 'flac', 'FLAC'],
      ['hymn.ogg', 'ogg', 'OGG'],
      ['hymn.oga', 'ogg', 'OGG'],
      ['hymn.opus', 'opus', 'Opus'],
      ['hymn.m4a', 'm4a', 'M4A'],
      ['hymn.aac', 'm4a', 'M4A'],
      ['hymn.aif', 'aiff', 'AIFF'],
      ['hymn.aiff', 'aiff', 'AIFF'],
      ['clip.mp4', 'm4a', 'M4A'],
      ['clip.m4v', 'm4a', 'M4A'],
      ['clip.mov', 'm4a', 'M4A'],
      ['clip.webm', 'webm', 'WebM'],
      ['clip.mkv', 'mka', 'MKA'],
    ];
    for (const [name, ext, label] of cases) {
      const of = originalFormat(name);
      expect(of, name).toBeTruthy();
      expect(of!.ext).toBe(ext);
      expect(of!.label).toBe(label);
      expect(of!.args.length).toBeGreaterThan(0);
      expect(isOriginalExportable(name)).toBe(true);
    }
    expect(extOf('Choir Practice.M4A')).toBe('m4a');
  });
});

describe('decode preflight', () => {
  it('rejects empty files', () => {
    expect(() => preflightFile({ size: 0 })).toThrow(/empty/i);
  });

  it('rejects files over the hard memory cap', () => {
    const size = (LIMITS.maxFileMB + 10) * 1024 * 1024;
    expect(() => preflightFile({ size })).toThrow(/won't fit in browser memory/);
  });

  it('warns above the large-file threshold (including the test hook value)', () => {
    const ok = preflightFile({ size: 10 * 1024 * 1024 });
    expect(ok.warnings).toEqual([]);
    const big = preflightFile({ size: (LIMITS.warnFileMB + 1) * 1024 * 1024 });
    expect(big.warnings[0]).toMatch(/Large file/);
    const hooked = preflightFile({ size: 20 * 1024 }, 0.01);
    expect(hooked.warnings[0]).toMatch(/Large file/);
  });
});
