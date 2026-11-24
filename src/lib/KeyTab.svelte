<script lang="ts">
  import { app } from './state.svelte';
  import KeyResults from './KeyResults.svelte';
  import { monoOf } from './audio';
  import { decodeAny, ACCEPT } from './decode';
  import { detectKeyInWorker } from './workers';
  import { parseSheet, sheetChords, detectKeyFromChords } from '../theory/sheet';
  import type { Key, KeyScore } from '../theory/keys';

  let audioRes = $state<KeyScore[] | null>(null);
  let engine = $state('');
  let status = $state('');
  let error = $state('');
  let warnings = $state<string[]>([]);
  let fileName = $state('');
  let gen = 0;
  const textRes = $derived(detectKeyFromChords(sheetChords(parseSheet(app.sheet))));
  const chordCount = $derived(sheetChords(parseSheet(app.sheet)).length);

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    input.value = '';
    const my = ++gen;
    fileName = f.name; audioRes = null; error = ''; warnings = []; status = 'Decoding…';
    try {
      const decoded = await decodeAny(f, (m) => { if (my === gen) status = m; });
      if (my !== gen) return;
      warnings = decoded.warnings;
      status = `Analysing ${decoded.buffer.duration.toFixed(1)} s…`;
      const r = await detectKeyInWorker(monoOf(decoded.buffer), decoded.buffer.sampleRate);
      if (my !== gen) return;
      audioRes = r.top;
      engine = r.engine === 'essentia' ? 'Essentia.js KeyExtractor (wasm)' : 'Meyda chroma + Krumhansl/Temperley profiles (fallback)';
      status = '';
    } catch (err) {
      if (my !== gen) return;
      error = String(err).replace(/^Error: /, '');
      status = '';
    }
  }
  const use = (k: Key) => { app.fromKey = k; };
</script>

<section class="card">
  <h2>From audio</h2>
  <p class="muted">Audio or video files (MP3, WAV, M4A, FLAC, OGG, AIFF, MP4, MOV, WebM, MKV). Analysed on this device; nothing is uploaded.</p>
  <input type="file" accept={ACCEPT} onchange={onFile} data-testid="key-file" />
  {#if fileName}<p class="muted">{fileName}</p>{/if}
  {#each warnings as w}<p class="warn" data-testid="warning">{w}</p>{/each}
  {#if status}<p class="status">{status}</p>{/if}
  {#if error}<p class="error" data-testid="error">{error}</p>{/if}
  {#if audioRes}
    <KeyResults results={audioRes} onpick={use} />
    <p class="muted small">Engine: {engine}</p>
  {/if}
</section>

<section class="card">
  <h2>From a chord sheet</h2>
  <p class="muted">Paste chords-over-lyrics or ChordPro. {chordCount} chords found.</p>
  <textarea bind:value={app.sheet} rows="8" spellcheck="false" data-testid="key-text"></textarea>
  {#if textRes.length}<KeyResults results={textRes} onpick={use} />{/if}
</section>
