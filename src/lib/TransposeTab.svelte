<script lang="ts">
  import { app } from './state.svelte';
  import KeyPicker from './KeyPicker.svelte';
  import ShiftControl from './ShiftControl.svelte';
  import { keyName, keyUsesFlats, transposeKey, relativeOf, type Key } from '../theory/keys';
  import { intervalName, shiftBetween, capoSuggestions, vocalHint } from '../theory/transpose';
  import { parseSheet, sheetChords } from '../theory/sheet';
  import { transposeChord } from '../theory/chords';

  let useSheet = $state(true);
  let low = $state('');
  let high = $state('');
  const target = $derived(transposeKey(app.fromKey, app.shift));
  let targetSel = $state<Key>({ tonic: 7, mode: 'major' });
  $effect(() => { targetSel = target; });
  function pickTarget(k: Key) { app.shift = shiftBetween(app.fromKey, k); }
  const chords = $derived(useSheet ? sheetChords(parseSheet(app.sheet)).map((c) => transposeChord(c, app.shift, target)) : undefined);
  const capos = $derived(capoSuggestions(target, chords).slice(0, 3));
  const hints = $derived(vocalHint(app.shift, target, low, high));
</script>

<section class="card">
  <div class="row">
    <KeyPicker bind:value={app.fromKey} label="Original key" id="from-key" />
    <label class="field"><span>Target key</span>
      <select id="target-key" value={target.tonic} onchange={(e) => pickTarget({ tonic: +(e.currentTarget as HTMLSelectElement).value, mode: app.fromKey.mode })}>
        {#each Array(12) as _, pc}<option value={pc}>{keyName({ tonic: pc, mode: app.fromKey.mode })}</option>{/each}
      </select>
    </label>
  </div>
  <ShiftControl bind:value={app.shift} />
  <div class="summary" data-testid="transpose-summary">
    <div><b>{keyName(app.fromKey)}</b> → <b class="accent">{keyName(target)}</b></div>
    <div>{intervalName(app.shift)} · {app.shift > 0 ? '+' : ''}{app.shift} semitones</div>
    <div class="muted">Spelled with {keyUsesFlats(target) ? 'flats' : 'sharps'} · relative {keyName(relativeOf(target))}</div>
  </div>
</section>

<section class="card">
  <h2>Capo suggestions</h2>
  <label class="check"><input type="checkbox" bind:checked={useSheet} /> Use the chords from my chord sheet</label>
  <table class="capo" data-testid="capo-table">
    <thead><tr><th>Capo</th><th>Play shapes in</th><th>Shapes</th></tr></thead>
    <tbody>
      {#each capos as c, i}
        <tr class:best={i === 0}><td>{c.capo === 0 ? 'none' : c.capo}</td><td>{keyName(c.shapeKey)}</td><td>{[...new Set(c.shapes)].slice(0, 8).join(' ')}</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<section class="card">
  <h2>Vocal range</h2>
  <div class="row">
    <label class="field"><span>Lowest note (e.g. G3)</span><input bind:value={low} placeholder="G3" /></label>
    <label class="field"><span>Highest note (e.g. D5)</span><input bind:value={high} placeholder="D5" /></label>
  </div>
  <ul class="hints">{#each hints as h}<li>{h}</li>{/each}</ul>
</section>
