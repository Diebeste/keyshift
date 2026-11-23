// Turn timed chord segments into a bar-based chord chart that the sheet parser understands.
import type { ChordSegment } from './chordDetect';

/**
 * Bars of `beatsPerBar` beats from the beat grid, 4 bars per line, e.g.
 * | C       | Am      | F   G   | C       |
 */
export function chartLines(segments: { start: number; end: number; label: string }[], beats: number[], beatsPerBar = 4, barsPerLine = 4): string[] {
  if (!segments.length) return [];
  const grid = beats.length >= 2 ? beats : segments.map((s) => s.start);
  const labelAt = (t: number) => segments.find((s) => t >= s.start - 1e-6 && t < s.end)?.label ?? segments[segments.length - 1].label;
  const bars: string[][] = [];
  let prev = '';
  for (let i = 0; i < grid.length; i += beatsPerBar) {
    const cells: string[] = [];
    for (let j = i; j < Math.min(i + beatsPerBar, grid.length); j++) {
      const l = labelAt(grid[j] + 0.01);
      cells.push(l !== prev || j === i ? l : '');
      prev = l;
    }
    // collapse: show each chord once where it starts within the bar
    bars.push(cells.map((c, k) => (k > 0 && c === cells.slice(0, k).filter(Boolean).pop() ? '' : c)));
  }
  const lines: string[] = [];
  for (let i = 0; i < bars.length; i += barsPerLine) {
    lines.push('| ' + bars.slice(i, i + barsPerLine).map((b) => b.filter(Boolean).join(' ').padEnd(8)).join(' | ') + ' |');
  }
  return lines;
}

export function chartChordPro(title: string, keyShort: string | null, bpm: number, lines: string[]): string {
  const head = [`{title: ${title}}`, keyShort ? `{key: ${keyShort}}` : '', bpm ? `{tempo: ${bpm}}` : '', '{comment: Detected from audio by Key Shift (rough: check by ear)}'].filter(Boolean);
  return [...head, ...lines].join('\n') + '\n';
}

export type { ChordSegment };
