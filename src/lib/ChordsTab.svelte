<script lang="ts">
  import { app } from './state.svelte';
  import KeyPicker from './KeyPicker.svelte';
  import ShiftControl from './ShiftControl.svelte';
  import GuitarDiagram from './GuitarDiagram.svelte';
  import PianoDiagram from './PianoDiagram.svelte';
  import { keyName, transposeKey } from '../theory/keys';
  import { parseSheet, transposeSheet, renderRows, toText, toChordPro, toNashville, sheetChords, detectKeyFromChords, declaredKey } from '../theory/sheet';
  import { chordToString, parseChord } from '../theory/chords';
  import { guitarShape, pianoNotes } from '../theory/diagrams';
  import { downloadText } from './audio';

  let nashville = $state(false);
  let diagrams = $state<'none' | 'guitar' | 'piano'>('guitar');
  let copied = $state('');
  const sheet = $derived(parseSheet(app.sheet));
  const target = $derived(transposeKey(app.fromKey, app.shift));
  const shifted = $derived(transposeSheet(sheet, app.shift, target));
  const origRows = $derived(renderRows(sheet));
  const newRows = $derived(renderRows(shifted));
  const nashRows = $derived(renderRows(toNashville(sheet, app.fromKey)));
  const uniq = $derived([...new Map(sheetChords(shifted).map((c) => [chordToString(c), c])).values()]);

  function autoKey() {
    app.fromKey = declaredKey(sheet) ?? detectKeyFromChords(sheetChords(sheet))[0]?.key ?? app.fromKey;
  }
  async function copy() {
    const txt = toText(shifted);
    try { await navigator.clipboard.writeText(txt); copied = 'Copied'; } catch { copied = 'Copy blocked: select the text instead'; }
    setTimeout(() => (copied = ''), 2000);
  }
  const base = $derived((/\{(?:title|t):\s*([^}]+)\}/.exec(app.sheet)?.[1]?.trim() || 'song').replace(/[^\w\- ]+/g, '') + ` (${keyName(target, true)})`);
</script>

<section class="card noprint">
  <textarea bind:value={app.sheet} rows="9" spellcheck="false" aria-label="Chord sheet" data-testid="sheet-input"></textarea>
  <div class="row">
    <KeyPicker bind:value={app.fromKey} label="Original key" id="chords-from" />
    <button class="small" onclick={autoKey}>Detect key</button>
  </div>
  <ShiftControl bind:value={app.shift} id="chords-shift" />
  <div class="row wrap">
    <label class="check"><input type="checkbox" bind:checked={nashville} data-testid="nashville" /> Nashville numbers</label>
    <label class="field inline"><span>Diagrams</span>
      <select bind:value={diagrams}><option value="none">None</option><option value="guitar">Guitar</option><option value="piano">Piano</option></select>
    </label>
  </div>
  <div class="row wrap">
    <button onclick={copy}>Copy</button>
    <button onclick={() => window.print()}>Print</button>
    <button onclick={() => downloadText(toText(shifted), base + '.txt')}>Export .txt</button>
    <button onclick={() => downloadText(toChordPro(shifted), base + '.pro')}>Export .pro</button>
    {#if copied}<span class="status">{copied}</span>{/if}
  </div>
</section>

<div class="panes" class:three={nashville}>
  <section class="card pane noprint-pane">
    <h3>Original · {keyName(app.fromKey)}</h3>
    <pre class="sheet">{#each origRows as r}<span class={r.type}>{r.text}</span>
{/each}</pre>
  </section>
  <section class="card pane printme" data-testid="transposed">
    <h3>Transposed · {keyName(target)} <small>({app.shift > 0 ? '+' : ''}{app.shift})</small></h3>
    <pre class="sheet">{#each newRows as r}<span class={r.type}>{r.text}</span>
{/each}</pre>
  </section>
  {#if nashville}
    <section class="card pane noprint-pane" data-testid="nashville-pane">
      <h3>Nashville numbers</h3>
      <pre class="sheet">{#each nashRows as r}<span class={r.type}>{r.text}</span>
{/each}</pre>
    </section>
  {/if}
</div>

{#if diagrams !== 'none' && uniq.length}
  <section class="card noprint">
    <h3>{diagrams === 'guitar' ? 'Guitar' : 'Piano'} chords in {keyName(target)}</h3>
    <div class="diagrams">
      {#each uniq as c}
        {#if diagrams === 'guitar'}<GuitarDiagram shape={guitarShape(c)} label={chordToString(c)} />
        {:else}{@const p = pianoNotes(c)}<PianoDiagram notes={p.notes} bass={p.bass} label={chordToString(c)} />{/if}
      {/each}
    </div>
  </section>
{/if}
