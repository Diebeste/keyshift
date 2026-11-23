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
  const labels = grid.map((t) => labelAt(t + 0.01));
  // guess the downbeat: the bar phase where most chord changes land on beat 1
  let phase = 0, bestScore = -1;
  for (let p = 0; p < beatsPerBar; p++) {
    let sc = 0;
    for (let i = 1; i < labels.length; i++) if (labels[i] !== labels[i - 1] && (i - p) % beatsPerBar === 0) sc++;
    if (sc > bestScore) { bestScore = sc; phase = p; }
  }
  const bars: string[][] = [];
  const starts = phase > 0 ? [0] : [];
  for (let i = phase; i < labels.length; i += beatsPerBar) starts.push(i);
  starts.forEach((st, bi) => {
    const en = bi + 1 < starts.length ? starts[bi + 1] : labels.length;
    const cells: string[] = [];
    for (let j = st; j < en; j++) if (j === st || labels[j] !== labels[j - 1]) cells.push(labels[j]);
    bars.push(cells);
  });
  const lines: string[] = [];
  for (let i = 0; i < bars.length; i += barsPerLine) {
    lines.push('| ' + bars.slice(i, i + barsPerLine).map((b) => b.join(' ').padEnd(8)).join(' | ') + ' |');
  }
  return lines;
}

export function chartChordPro(title: string, keyShort: string | null, bpm: number, lines: string[]): string {
  const head = [`{title: ${title}}`, keyShort ? `{key: ${keyShort}}` : '', bpm ? `{tempo: ${bpm}}` : '', '{comment: Detected from audio by Key Shift (rough: check by ear)}'].filter(Boolean);
  return [...head, ...lines].join('\n') + '\n';
}

export type { ChordSegment };
