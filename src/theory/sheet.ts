import { type Chord, parseChord, transposeChord, chordToString, chordQuality, nashville } from './chords';
import { type Key, type KeyScore, ALL_KEYS, diatonicTriads, withConfidence, parseKey, keyName } from './keys';
import { mod12 } from './notes';

export interface Seg { chord: string | null; text: string }
export type Line =
  | { kind: 'lyric'; segs: Seg[] }
  | { kind: 'chords'; items: { col: number; token: string }[] }
  | { kind: 'directive'; name: string; value: string }
  | { kind: 'text'; text: string };
export interface Sheet { lines: Line[]; format: 'chordpro' | 'text' }

const FILLER = /^(\|+:?|:?\|+|\/+|-+|\.+|%|x\d+|\(x?\d+x?\)|\d+x|N\.?C\.?|\(|\)|\*+)$/i;

function tokensWithCols(line: string): { col: number; token: string }[] {
  const out: { col: number; token: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push({ col: m.index, token: m[0] });
  return out;
}

/** Strip wrapping parentheses e.g. "(D)" → "D" for detection purposes. */
const unwrap = (t: string) => t.replace(/^\((.+)\)$/, '$1');

export function isChordLine(line: string): boolean {
  const toks = tokensWithCols(line);
  if (!toks.length) return false;
  let chords = 0;
  for (const { token } of toks) {
    if (parseChord(unwrap(token))) chords++;
    else if (!FILLER.test(token)) return false;
  }
  return chords > 0;
}

const INLINE_RE = /\[([^\]]+)\]/g;
const hasInlineChord = (line: string) => {
  for (const m of line.matchAll(INLINE_RE)) if (parseChord(m[1].trim())) return true;
  return false;
};

function parseInline(line: string): Seg[] {
  const segs: Seg[] = [];
  let last = 0;
  let cur: Seg = { chord: null, text: '' };
  for (const m of line.matchAll(INLINE_RE)) {
    const inner = m[1].trim();
    if (!parseChord(inner) && !FILLER.test(inner)) continue; // e.g. [Chorus] label stays as text
    cur.text += line.slice(last, m.index);
    if (cur.chord !== null || cur.text) segs.push(cur);
    cur = { chord: inner, text: '' };
    last = m.index! + m[0].length;
  }
  cur.text += line.slice(last);
  segs.push(cur);
  return segs;
}

function mergeChordLyric(chordLine: string, lyric: string): Seg[] {
  const items = tokensWithCols(chordLine);
  const maxCol = items.length ? items[items.length - 1].col : 0;
  const ly = lyric.length < maxCol ? lyric.padEnd(maxCol) : lyric;
  const segs: Seg[] = [];
  if (items[0]?.col > 0) segs.push({ chord: null, text: ly.slice(0, items[0].col) });
  items.forEach((it, i) => {
    const end = i + 1 < items.length ? items[i + 1].col : ly.length;
    segs.push({ chord: it.token, text: ly.slice(it.col, Math.max(end, it.col)) });
  });
  if (!items.length) segs.push({ chord: null, text: ly });
  return segs;
}

/** Parse chords-over-lyrics text, ChordPro, or a mix of both. */
export function parseSheet(src: string): Sheet {
  const raw = src.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const lines: Line[] = [];
  let chordpro = false;
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i].replace(/\s+$/, '');
    const dir = /^\s*\{\s*([A-Za-z_-]+)\s*(?::\s*(.*?))?\s*\}\s*$/.exec(l);
    if (dir) { chordpro = true; lines.push({ kind: 'directive', name: dir[1].toLowerCase(), value: dir[2] ?? '' }); continue; }
    if (hasInlineChord(l)) { chordpro = true; lines.push({ kind: 'lyric', segs: parseInline(l) }); continue; }
    if (isChordLine(l)) {
      const next = raw[i + 1]?.replace(/\s+$/, '');
      if (next !== undefined && next.trim() && !isChordLine(next) && !hasInlineChord(next) && !/^\s*\{.*\}\s*$/.test(next) && !/^\s*\[[^\]]*\]\s*$/.test(next)) {
        lines.push({ kind: 'lyric', segs: mergeChordLyric(l, next) });
        i++;
      } else lines.push({ kind: 'chords', items: tokensWithCols(l) });
      continue;
    }
    lines.push({ kind: 'text', text: l });
  }
  return { lines, format: chordpro ? 'chordpro' : 'text' };
}

/** Map every chord token in a sheet. */
export function mapChords(sheet: Sheet, fn: (token: string) => string): Sheet {
  const t = (tok: string) => {
    const inner = unwrap(tok);
    if (!parseChord(inner)) return tok;
    return tok === inner ? fn(inner) : `(${fn(inner)})`;
  };
  return {
    format: sheet.format,
    lines: sheet.lines.map((l): Line => {
      if (l.kind === 'lyric') return { kind: 'lyric', segs: l.segs.map((s) => ({ chord: s.chord === null ? null : t(s.chord), text: s.text })) };
      if (l.kind === 'chords') return { kind: 'chords', items: l.items.map((it) => ({ col: it.col, token: t(it.token) })) };
      return l;
    }),
  };
}

export function transposeSheet(sheet: Sheet, n: number, target: Key | boolean): Sheet {
  const out = mapChords(sheet, (tok) => chordToString(transposeChord(parseChord(tok)!, n, target)));
  // update {key:} directive
  out.lines = out.lines.map((l) => {
    if (l.kind === 'directive' && l.name === 'key') {
      const k = parseKey(l.value);
      if (k) {
        const nk = { tonic: mod12(k.tonic + n), mode: k.mode };
        return { ...l, value: typeof target === 'boolean' ? keyName(nk, true) : keyName({ ...nk }, true) };
      }
    }
    return l;
  });
  return out;
}

export function toNashville(sheet: Sheet, key: Key): Sheet {
  return mapChords(sheet, (tok) => nashville(parseChord(tok)!, key));
}

/** Render a chord row + lyric row for one lyric line, pushing chords apart when they would collide. */
function renderPair(segs: Seg[]): [string, string] {
  let chordLine = '', lyric = '';
  for (const s of segs) {
    if (s.chord !== null) {
      const needed = chordLine.length === 0 ? 0 : chordLine.length + 1;
      if (lyric.length < needed) lyric = lyric.padEnd(needed);
      chordLine = chordLine.padEnd(lyric.length) + s.chord;
    }
    lyric += s.text;
  }
  return [chordLine.trimEnd(), lyric.trimEnd()];
}

function renderChordItems(items: { col: number; token: string }[]): string {
  let out = '';
  for (const it of items) {
    const col = out.length === 0 ? it.col : Math.max(it.col, out.length + 1);
    out = out.padEnd(col) + it.token;
  }
  return out;
}

export type RenderRow = { type: 'chord' | 'lyric' | 'directive' | 'text'; text: string };

export function renderRows(sheet: Sheet): RenderRow[] {
  const rows: RenderRow[] = [];
  for (const l of sheet.lines) {
    if (l.kind === 'lyric') {
      const [c, ly] = renderPair(l.segs);
      if (c) rows.push({ type: 'chord', text: c });
      if (ly.trim() || !c) rows.push({ type: 'lyric', text: ly });
    } else if (l.kind === 'chords') rows.push({ type: 'chord', text: renderChordItems(l.items) });
    else if (l.kind === 'directive') rows.push({ type: 'directive', text: directiveLabel(l.name, l.value) });
    else rows.push({ type: 'text', text: l.text });
  }
  return rows;
}

function directiveLabel(name: string, value: string): string {
  const map: Record<string, string> = { t: 'title', st: 'subtitle', c: 'comment', soc: 'start_of_chorus', eoc: 'end_of_chorus', sov: 'start_of_verse', eov: 'end_of_verse' };
  const n = map[name] ?? name;
  if (n === 'title' || n === 'subtitle') return value;
  if (n === 'comment' || n === 'comment_italic' || n === 'ci') return value;
  if (n === 'start_of_chorus') return value || 'Chorus:';
  if (n === 'start_of_verse') return value || 'Verse:';
  if (n === 'start_of_bridge' || n === 'sob') return value || 'Bridge:';
  if (n.startsWith('end_of') || /^eo[a-z]$/.test(n)) return '';
  return `${n[0].toUpperCase() + n.slice(1)}: ${value}`;
}

/** Plain-text chords-over-lyrics export. */
export function toText(sheet: Sheet): string {
  return renderRows(sheet).map((r) => r.text).join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** ChordPro export. */
export function toChordPro(sheet: Sheet): string {
  const out: string[] = [];
  for (const l of sheet.lines) {
    if (l.kind === 'directive') out.push(l.value ? `{${l.name}: ${l.value}}` : `{${l.name}}`);
    else if (l.kind === 'text') out.push(l.text);
    else if (l.kind === 'lyric') out.push(l.segs.map((s) => (s.chord !== null ? `[${s.chord}]` : '') + s.text).join('').trimEnd());
    else {
      let s = '', pos = 0;
      for (const it of l.items) { s += ' '.repeat(Math.max(it.col - pos, s ? 1 : 0)) + `[${it.token}]`; pos = it.col + it.token.length; }
      out.push(s);
    }
  }
  return out.join('\n').trimEnd() + '\n';
}

export function sheetChords(sheet: Sheet): Chord[] {
  const out: Chord[] = [];
  for (const l of sheet.lines) {
    const toks = l.kind === 'lyric' ? l.segs.map((s) => s.chord) : l.kind === 'chords' ? l.items.map((i) => i.token) : [];
    for (const t of toks) { const c = t ? parseChord(unwrap(t)) : null; if (c) out.push(c); }
  }
  return out;
}

export function declaredKey(sheet: Sheet): Key | null {
  for (const l of sheet.lines) if (l.kind === 'directive' && l.name === 'key') return parseKey(l.value);
  return null;
}

/** Score chords against the diatonic triads of all 24 keys. */
export function detectKeyFromChords(chords: Chord[]): KeyScore[] {
  if (!chords.length) return [];
  const res = ALL_KEYS.map((key) => {
    const tri = diatonicTriads(key);
    if (key.mode === 'minor') tri.push({ root: mod12(key.tonic + 7), q: 'maj' }); // harmonic-minor V
    let score = 0, total = 0;
    chords.forEach((c, i) => {
      const w = 1 + (i === 0 ? 1 : 0) + (i === chords.length - 1 ? 1.5 : 0);
      total += w;
      const q = chordQuality(c);
      const qn = q === 'sus2' || q === 'sus4' || q === 'power' ? null : q;
      const hits = tri.filter((t) => t.root === c.root);
      if (hits.some((t) => qn === null || t.q === qn)) score += w;
      else if (hits.length) score += 0.3 * w;
      else score -= w;
      if (c.root === key.tonic && (qn === null || qn === (key.mode === 'major' ? 'maj' : 'min'))) score += 0.6 * w;
    });
    return { key, score: score / total, confidence: 0 };
  });
  return withConfidence(res, 0.12);
}
