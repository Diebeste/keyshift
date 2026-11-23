import type { Key } from '../theory/keys';

export const SAMPLE = `{title: Amazing Grace (sample)}
{key: G}
Verse 1:
G          G7        C        G
Amazing grace, how sweet the sound
G               Em      D   D7
That saved a wretch like me
G        G7       C         G
I once was lost, but now am found
G     D/F#  Em    D    G
Was blind, but now I see`;

export const app = $state({
  tab: 'key' as 'key' | 'transpose' | 'chords' | 'audio',
  fromKey: { tonic: 7, mode: 'major' } as Key,
  shift: 0,
  sheet: SAMPLE,
});
