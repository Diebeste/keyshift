import { describe, it, expect } from 'vitest';
import {
  ALL_KEYS, keyName, keyUsesFlats, relativeOf, transposeKey, parseKey, noteToPc, spellPc, mod12,
  parseChord, transposeChordString, chordToString, chordIntervals, chordPcs, nashville,
  parseSheet, transposeSheet, toText, toChordPro, renderRows, sheetChords, detectKeyFromChords, isChordLine,
  intervalName, shiftBetween, capoSuggestions, vocalHint, guitarShape,
} from '../src/theory';

const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

describe('pitch classes', () => {
  it('parses enharmonics', () => {
    expect(noteToPc('C#')).toBe(1); expect(noteToPc('Db')).toBe(1); expect(noteToPc('Cb')).toBe(11);
    expect(noteToPc('B#')).toBe(0); expect(noteToPc('E♭')).toBe(3); expect(noteToPc('H')).toBeNull();
  });
  it('mod12 handles negatives', () => { expect(mod12(-1)).toBe(11); expect(mod12(-13)).toBe(11); expect(mod12(25)).toBe(1); });
});

describe('key names and signatures across all 24 keys', () => {
  it('names every key with the expected spelling', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(keyName({ tonic: pc, mode: 'major' }, true)).toBe(MAJOR_NAMES[pc]);
      expect(keyName({ tonic: pc, mode: 'minor' }, true)).toBe(MINOR_NAMES[pc]);
    }
  });
  it('flat keys are F Bb Eb Ab Db Gb and their relative minors; sharps otherwise', () => {
    for (const k of ALL_KEYS) expect(keyUsesFlats(k)).toBe(FLAT_KEYS.has(keyName(k, true)));
  });
  it('relative keys round-trip and share a signature', () => {
    for (const k of ALL_KEYS) {
      const r = relativeOf(k);
      expect(relativeOf(r)).toEqual(k);
      expect(keyUsesFlats(r)).toBe(keyUsesFlats(k));
      expect(r.mode).not.toBe(k.mode);
    }
  });
  it('parses key strings', () => {
    expect(parseKey('F# minor')).toEqual({ tonic: 6, mode: 'minor' });
    expect(parseKey('Bb')).toEqual({ tonic: 10, mode: 'major' });
    expect(parseKey('ebm')).toEqual({ tonic: 3, mode: 'minor' });
  });
});

describe('transposition across all 24 keys and all shifts -12..+12', () => {
  it('transposes the tonic chord of every key to every target and spells it with the target signature', () => {
    for (const k of ALL_KEYS) {
      const tonicChord = keyName(k, true);
      for (let n = -12; n <= 12; n++) {
        const t = transposeKey(k, n);
        const out = transposeChordString(tonicChord, n, t);
        expect(out).toBe(keyName(t, true));
        const c = parseChord(out)!;
        expect(c.root).toBe(mod12(k.tonic + n));
        const accidental = out.slice(1, 2);
        if (keyUsesFlats(t)) expect(accidental).not.toBe('#');
        else expect(accidental).not.toBe('b');
      }
    }
  });
  it('keeps every diatonic note spelled per the target key for each shift', () => {
    for (const k of ALL_KEYS) for (let n = -12; n <= 12; n++) {
      const t = transposeKey(k, n);
      for (let pc = 0; pc < 12; pc++) {
        const name = transposeChordString(spellPc(pc, false) + '7', n, t);
        expect(noteToPc(name.replace('7', ''))).toBe(mod12(pc + n));
        expect(name.includes(keyUsesFlats(t) ? '#' : 'b')).toBe(false);
      }
    }
  });
  it('±12 is identity on pitch class; +n then -n round-trips', () => {
    for (const k of ALL_KEYS) {
      expect(transposeKey(k, 12)).toEqual(k);
      for (let n = -12; n <= 12; n++) expect(transposeKey(transposeKey(k, n), -n)).toEqual(k);
    }
  });
  it('slash chords transpose both parts', () => {
    expect(transposeChordString('D/F#', -2, parseKey('C')!)).toBe('C/E');
    expect(transposeChordString('G/B', 3, parseKey('Bb')!)).toBe('Bb/D');
    expect(transposeChordString('Am7/G', 1, parseKey('Bbm')!)).toBe('Bbm7/Ab');
    expect(transposeChordString('C#m7b5/G', 1, parseKey('D')!)).toBe('Dm7b5/G#');
  });
});

describe('chord parsing', () => {
  const ok = ['C', 'Cm', 'Cm7', 'Cmaj7', 'CM7', 'Csus4', 'Csus2', 'Csus', 'Cadd9', 'Cdim', 'Cdim7', 'C°7', 'Cø7', 'Caug', 'C+',
    'C7b9', 'C7#9', 'C7#11', 'C13', 'C9', 'Cm9', 'C6', 'Cm6', 'C6/9', 'C5', 'C7sus4', 'C(add9)', 'Cmaj9', 'C7alt', 'Cm(maj7)',
    'F#', 'Gb', 'Bbmaj7', 'Ebm7', 'D/F#', 'G/B', 'Am/G', 'C/Bb', 'F#m7b5/C', 'Bbsus2/D', 'E♭', 'C-7', 'CΔ7'];
  for (const s of ok) it(`parses ${s}`, () => {
    const c = parseChord(s);
    expect(c).not.toBeNull();
    expect(chordToString(c!)).toBe(s);
  });
  const bad = ['H', 'Chorus', 'Am I', 'Cx', 'C/H', 'Csus4)', 'Bridge', 'the', 'and', 'Cmajor7th', 'a', 'Do', ''];
  for (const s of bad) it(`rejects "${s}"`, () => expect(parseChord(s)).toBeNull());

  it('computes chord tones', () => {
    const tones = (s: string) => chordIntervals(parseChord(s)!);
    expect(tones('C')).toEqual([0, 4, 7]);
    expect(tones('Cm7')).toEqual([0, 3, 7, 10]);
    expect(tones('Cmaj7')).toEqual([0, 4, 7, 11]);
    expect(tones('Csus4')).toEqual([0, 5, 7]);
    expect(tones('Cadd9')).toEqual([0, 2, 4, 7]);
    expect(tones('Cdim')).toEqual([0, 3, 6]);
    expect(tones('Cdim7')).toEqual([0, 3, 6, 9]);
    expect(tones('Caug')).toEqual([0, 4, 8]);
    expect(tones('C7b9')).toEqual([0, 1, 4, 7, 10]);
    expect(tones('C9')).toEqual([0, 2, 4, 7, 10]);
    expect(tones('C6/9')).toEqual([0, 2, 4, 7, 9]);
    expect(tones('Cm7b5')).toEqual([0, 3, 6, 10]);
    expect(tones('C7sus4')).toEqual([0, 5, 7, 10]);
    expect(chordPcs(parseChord('D/F#')!)).toEqual([2, 6, 9]);
    expect(chordPcs(parseChord('C/Bb')!)).toEqual([10, 0, 4, 7]);
  });
  it('Nashville numbers', () => {
    const C = parseKey('C')!;
    expect(nashville(parseChord('Am7')!, C)).toBe('6m7');
    expect(nashville(parseChord('G/B')!, C)).toBe('5/7');
    expect(nashville(parseChord('Bb')!, C)).toBe('b7');
    expect(nashville(parseChord('E')!, parseKey('Am')!)).toBe('3');
  });
});

describe('chord sheets', () => {
  const sheet = `Verse 1:
G       D/F#     Em7    Cadd9
Amazing grace how sweet the sound
   C        G
That saved a wretch
| G  D | Em  C |`;

  it('detects chord lines vs lyric lines', () => {
    expect(isChordLine('G       D/F#     Em7    Cadd9')).toBe(true);
    expect(isChordLine('| G  D | Em  C |')).toBe(true);
    expect(isChordLine('Amazing grace how sweet the sound')).toBe(false);
    expect(isChordLine('A man')).toBe(false);
    expect(isChordLine('Verse 1:')).toBe(false);
  });
  it('round-trips chords-over-lyrics text exactly', () => {
    expect(toText(parseSheet(sheet))).toBe(sheet + '\n');
  });
  it('keeps chords over the same syllables after transposing', () => {
    const t = toText(transposeSheet(parseSheet(sheet), 2, parseKey('A')!));
    const lines = t.split('\n');
    expect(lines[1]).toBe('A       E/G#     F#m7   Dadd9');
    expect(lines[2]).toBe('Amazing grace how sweet the sound');
    expect(lines[3]).toBe('   D        A');
    expect(lines[5]).toBe('| A  E | F#m D |'); // chord-only lines keep columns
  });
  it('pushes colliding chords apart but keeps lyric text', () => {
    const s = parseSheet('C D\nla la');
    const t = toText(transposeSheet(s, 1, parseKey('Db')!)).split('\n');
    expect(t[0]).toBe('Db Eb');
    expect(t[1].replace(/\s+/g, ' ')).toBe('la la');
    expect(t[0].indexOf('Eb')).toBeGreaterThanOrEqual(3);
  });
  it('converts to ChordPro and back', () => {
    const pro = toChordPro(parseSheet(sheet));
    expect(pro).toContain('[G]Amazing [D/F#]grace how[Em7] sweet [Cadd9]the sound');
    expect(pro).toContain('Tha[C]t saved a[G] wretch');
    expect(toText(parseSheet(pro))).toContain('Amazing grace how sweet the sound');
  });
  it('parses ChordPro with directives and labels, transposes {key}', () => {
    const pro = '{title: Test}\n{key: G}\n[Chorus]\n[G]Hal[C]le[D/F#]lu[Em]jah (x2)';
    const s = parseSheet(pro);
    expect(s.format).toBe('chordpro');
    const t = toChordPro(transposeSheet(s, -2, parseKey('F')!));
    expect(t).toContain('{key: F}');
    expect(t).toContain('[Chorus]');
    expect(t).toContain('[F]Hal[Bb]le[C/E]lu[Dm]jah (x2)');
    const rows = renderRows(s);
    expect(rows.find((r) => r.type === 'chord')!.text).toBe('G  C D/F# Em');
  });
  it('handles empty input, blank lines and N.C.', () => {
    expect(toText(parseSheet(''))).toBe('\n');
    const s = parseSheet('N.C.   G\nWords here\n\n\nEnd');
    expect(sheetChords(s).map((c) => chordToString(c))).toEqual(['G']);
  });
});

describe('key from chords', () => {
  const k = (src: string) => keyName(detectKeyFromChords(sheetChords(parseSheet(src)))[0].key, true);
  it('C major', () => expect(k('C F G C Am F G C')).toBe('C'));
  it('G major with slash chords', () => expect(k('G D/F# Em C G D G')).toBe('G'));
  it('A minor', () => expect(k('Am Dm E Am Dm E7 Am')).toBe('Am'));
  it('Bb major (flat key)', () => expect(k('Bb Eb F Gm Eb F Bb')).toBe('Bb'));
  it('E minor', () => expect(k('Em C D Em Am B7 Em')).toBe('Em'));
  it('returns 24 ranked keys with confidences summing to 1', () => {
    const r = detectKeyFromChords(sheetChords(parseSheet('D G A D')));
    expect(r).toHaveLength(24);
    expect(r.reduce((s, x) => s + x.confidence, 0)).toBeCloseTo(1, 6);
  });
});

describe('transpose helper', () => {
  it('interval names', () => {
    expect(intervalName(2)).toBe('major 2nd up');
    expect(intervalName(-5)).toBe('perfect 4th down');
    expect(intervalName(12)).toBe('octave up');
  });
  it('shortest shift between keys', () => {
    expect(shiftBetween(parseKey('G')!, parseKey('A')!)).toBe(2);
    expect(shiftBetween(parseKey('C')!, parseKey('A')!)).toBe(-3);
  });
  it('suggests capo 1 with E shapes for F major and capo 3 G shapes for Bb', () => {
    const f = capoSuggestions(parseKey('F')!);
    expect(keyName(f[0].shapeKey, true)).toMatch(/^(D|E|C)$/);
    const bb = capoSuggestions(parseKey('Bb')!);
    expect(bb[0].capo).toBeGreaterThan(0);
    expect(['G', 'A']).toContain(keyName(bb[0].shapeKey, true));
    expect(capoSuggestions(parseKey('G')!)[0].capo).toBe(0);
    expect(capoSuggestions(parseKey('Eb')!).every((o) => o.capo >= 0 && o.capo <= 7)).toBe(true);
  });
  it('vocal hint maps a range', () => {
    const h = vocalHint(3, parseKey('Bb')!, 'G3', 'D5').join(' ');
    expect(h).toContain('Bb3–F5');
    expect(vocalHint(10).join(' ')).toContain('-2');
  });
  it('guitar shapes exist for common and extended chords', () => {
    for (const s of ['C', 'F', 'Bm', 'F#m7', 'Bbmaj7', 'C#dim', 'Ebaug', 'Ab7b9', 'D/F#', 'Gsus4', 'Eadd9']) {
      const g = guitarShape(parseChord(s)!);
      expect(g.frets).toHaveLength(6);
      expect(g.frets.some((f) => f >= 0)).toBe(true);
    }
    expect(guitarShape(parseChord('F')!).frets).toEqual([1, 3, 3, 2, 1, 1]);
  });
});
