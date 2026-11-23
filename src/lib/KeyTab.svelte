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
  let fileName = $state('');
  const textRes = $derived(detectKeyFromChords(sheetChords(parseSheet(app.sheet))));
  const chordCount = $derived(sheetChords(parseSheet(app.sheet)).length);

  async function onFile(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    fileName = f.name; audioRes = null; status = 'Decoding…';
    try {
      const buf = (await decodeAny(f, (m) => (status = m))).buffer;
      status = `Analysing ${buf.duration.toFixed(1)} s…`;
      const r = await detectKeyInWorker(monoOf(buf), buf.sampleRate);
      audioRes = r.top;
      engine = r.engine === 'essentia' ? 'Essentia.js KeyExtractor (wasm)' : 'Meyda chroma + Krumhansl/Temperley profiles (fallback)';
      status = '';
    } catch (err) { status = 'Could not read this file: ' + err; }
  }
  const use = (k: Key) => { app.fromKey = k; };
</script>

<section class="card">
  <h2>From audio</h2>
  <p class="muted">Audio or video files (MP3, WAV, M4A, FLAC, OGG, AIFF, MP4, MOV, WebM, MKV). Analysed on this device; nothing is uploaded.</p>
  <input type="file" accept={ACCEPT} onchange={onFile} data-testid="key-file" />
  {#if fileName}<p class="muted">{fileName}</p>{/if}
  {#if status}<p class="status">{status}</p>{/if}
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
