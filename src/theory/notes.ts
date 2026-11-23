// Pure pitch-class + spelling helpers. No UI / DOM dependencies.
export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/** Parse a note name such as C, F#, Bb, E♭, Cb, B#, Fx/F## into a pitch class, or null. */
export function noteToPc(name: string): number | null {
  const m = /^([A-Ga-g])((?:#|♯|b|♭|x|##|bb)?)$/.exec(name.trim());
  if (!m) return null;
  let pc = LETTER_PC[m[1].toUpperCase()];
  const acc = m[2].replace('♯', '#').replace('♭', 'b');
  if (acc === '#') pc += 1;
  else if (acc === '##' || acc === 'x') pc += 2;
  else if (acc === 'b') pc -= 1;
  else if (acc === 'bb') pc -= 2;
  return mod12(pc);
}

export function spellPc(pc: number, useFlats: boolean): string {
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)];
}
