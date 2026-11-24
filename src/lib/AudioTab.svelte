<script lang="ts">
  import { onDestroy } from 'svelte';
  import ShiftControl from './ShiftControl.svelte';
  import KeyResults from './KeyResults.svelte';
  import ChordTimeline from './ChordTimeline.svelte';
  import { channelsOf, monoOf, bufferFrom, downloadBytes, downloadText, peaks } from './audio';
  import { decodeAny, ACCEPT } from './decode';
  import { originalFormat } from './formats';
  import { detectKeyInWorker, shiftInWorker, encodeInWorker, detectChordsInWorker } from './workers';
  import { Player } from './player';
  import { app } from './state.svelte';
  import { keyName, sameKey, transposeKey, relativeOf, type KeyScore, type Key } from '../theory/keys';
  import { intervalName } from '../theory/transpose';
  import { parseChord, transposeChordString } from '../theory/chords';
  import { parseSheet, toText } from '../theory/sheet';
  import { chartLines, chartChordPro } from '../audio/chordChart';
  import type { ChordResult } from '../audio/chordDetect';

  let fileName = $state('');
  let via = $state('');
  let warnings = $state<string[]>([]);
  let original = $state.raw<AudioBuffer | null>(null);
  let rendered = $state.raw<AudioBuffer | null>(null);
  let renderedShift = $state(0);
  let shift = $state(2);
  let side = $state<'A' | 'B'>('A');
  let playing = $state(false);
  let pos = $state(0);
  let progress = $state(0);
  let busy = $state('');
  let error = $state('');
  let keyBefore = $state<KeyScore[] | null>(null);
  let keyAfter = $state<KeyScore[] | null>(null);
  let engine = $state('');
  let chords = $state<ChordResult | null>(null);
  let chordBusy = $state(false);
  let selected = $state(-1);
  let editText = $state('');
  let editErr = $state('');
  let meter = $state(4);
  let canvas: HTMLCanvasElement | undefined = $state();
  const player = new Player();
  player.onend = () => { playing = false; pos = 0; };
  let raf = 0;
  let gen = 0;
  let renderGen = 0;
  let chordGen = 0;
  let peakCache: { buf: AudioBuffer; buckets: number; pk: Float32Array } | null = null;
  const tick = () => { pos = player.position; if (player.playing) raf = requestAnimationFrame(tick); };
  const startTick = () => { cancelAnimationFrame(raf); tick(); };

  const stale = $derived(rendered !== null && renderedShift !== shift);
  const expected = $derived(keyBefore ? transposeKey(keyBefore[0].key, renderedShift) : null);
  const verified = $derived(keyAfter && expected ? sameKey(keyAfter[0].key, expected) : null);
  const verifiedRel = $derived(keyAfter && expected ? sameKey(keyAfter[0].key, relativeOf(expected)) : null);
  const durDiff = $derived(original && rendered ? Math.abs(rendered.duration - original.duration) / original.duration * 100 : 0);
  const songKey = $derived<Key | null>(keyBefore ? keyBefore[0].key : null);
  // chords shown follow what you hear: side B shows the shifted chords
  const dispShift = $derived(side === 'B' ? (rendered && !stale ? renderedShift : shift) : 0);
  const dispKey = $derived<Key | null>(songKey ? transposeKey(songKey, dispShift) : null);
  const ofmt = $derived(originalFormat(fileName));
  const meterN = $derived(Number(meter) || 4);
  const dispSegs = $derived(chords ? chords.segments.map((s) => ({ ...s, label: s.label === 'N.C.' ? s.label : transposeChordString(s.label, dispShift, dispKey ?? dispShift < 0) })) : []);
  const chart = $derived(chords ? chartLines(dispSegs, chords.beats, meterN) : []);
  const nowChord = $derived(dispSegs.find((s) => pos >= s.start && pos < s.end)?.label ?? '');
  const nextChord = $derived(dispSegs.find((s) => s.start > pos)?.label ?? '');
  const baseName = $derived(fileName.replace(/\.[^.]+$/, '') || 'audio');

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    input.value = '';
    const my = ++gen; renderGen++; chordGen++;
    player.cancel(); playing = false; pos = 0; cancelAnimationFrame(raf);
    error = ''; warnings = []; rendered = null; keyBefore = null; keyAfter = null; chords = null; selected = -1; chordBusy = false; busy = '';
    fileName = f.name; progress = 0; original = null;
    try {
      const d = await decodeAny(f, (msg, p) => { if (my === gen) { busy = msg; if (p !== undefined) progress = p; } });
      if (my !== gen) return;
      original = d.buffer; via = d.via === 'native' ? 'browser decoder' : 'ffmpeg.wasm'; warnings = d.warnings;
      busy = 'Detecting key…';
      const r = await detectKeyInWorker(monoOf(original), original.sampleRate);
      if (my !== gen) return;
      keyBefore = r.top;
      engine = r.engine === 'essentia' ? 'Essentia.js' : 'Meyda + profiles (fallback)';
      busy = '';
      void runChords(my);
    } catch (err) {
      if (my !== gen) return;
      error = String(err).replace(/^Error: /, ''); original = null; busy = '';
    }
  }

  async function runChords(expectedGen = gen) {
    if (!original) return;
    const myChord = ++chordGen;
    chordBusy = true;
    try {
      const res = await detectChordsInWorker(monoOf(original), original.sampleRate, songKey ? { ...songKey } : null);
      if (expectedGen !== gen || myChord !== chordGen) return;
      chords = res;
    } catch (err) {
      if (expectedGen !== gen || myChord !== chordGen) return;
      error = 'Chord detection failed: ' + err;
    } finally {
      if (myChord === chordGen) chordBusy = false;
    }
  }

  async function render() {
    if (!original) return;
    const myFile = gen;
    const my = ++renderGen;
    error = ''; progress = 0; busy = 'Rendering with Rubber Band…'; keyAfter = null;
    const wasPlaying = player.playing; player.stop(); playing = false;
    try {
      const out = await shiftInWorker(channelsOf(original), original.sampleRate, shift, (p) => { if (my === renderGen && myFile === gen) progress = p; });
      if (my !== renderGen || myFile !== gen) return;
      rendered = bufferFrom(out, original.sampleRate);
      renderedShift = shift;
      side = 'B';
      busy = 'Verifying key…';
      keyAfter = (await detectKeyInWorker(monoOf(rendered), rendered.sampleRate)).top;
      if (my !== renderGen || myFile !== gen) return;
    } catch (err) {
      if (my !== renderGen || myFile !== gen) return;
      error = /memory|allocation|RangeError/i.test(String(err)) ? 'Ran out of memory while rendering. Trim the file or try on a computer.' : 'Render failed: ' + err;
    }
    if (my !== renderGen || myFile !== gen) return;
    busy = '';
    if (wasPlaying) toggle();
  }

  async function toggle() {
    if (!original) return;
    if (player.playing) { player.stop(); playing = false; cancelAnimationFrame(raf); return; }
    const useRendered = side === 'B' && rendered && !stale;
    const playGen = gen;
    await player.play(useRendered ? rendered! : original, pos, side === 'B' && !useRendered ? shift : null);
    if (playGen !== gen) return;
    playing = true; startTick();
  }
  async function setSide(s: 'A' | 'B') {
    side = s;
    if (player.playing) { player.stop(); playing = false; await toggle(); }
  }
  async function seekTo(t: number) {
    if (!original) return;
    const was = player.playing;
    player.stop(); player.seek(t); pos = t; playing = false;
    if (was) await toggle();
  }
  const seek = (e: MouseEvent) => { if (original && canvas) { const r = canvas.getBoundingClientRect(); seekTo(((e.clientX - r.left) / r.width) * original.duration); } };

  function select(i: number) { selected = i; editText = dispSegs[i]?.label ?? ''; editErr = ''; }
  function saveEdit(all = false) {
    if (!chords || selected < 0) return;
    const t = editText.trim();
    const isNC = /^N\.?C\.?$/i.test(t);
    const c = isNC ? null : parseChord(t);
    if (!isNC && !c) { editErr = `"${t}" isn't a chord symbol I can read (try C, Am7, F#m, Bb/D, N.C.)`; return; }
    // store in the original key: undo the display shift
    const stored = isNC ? 'N.C.' : transposeChordString(t, -dispShift, songKey ?? false);
    const old = chords.segments[selected].label;
    chords = { ...chords, segments: chords.segments.map((s, i) => (i === selected || (all && s.label === old) ? { ...s, label: stored, root: c ? parseChord(stored)!.root : -1, suffix: c ? parseChord(stored)!.suffix : '' } : s)) };
    editErr = '';
  }

  const proText = () => chartChordPro(baseName + (dispShift ? ` (${dispShift > 0 ? '+' : ''}${dispShift})` : ''), dispKey ? keyName(dispKey, true) : null, chords?.bpm ?? 0, chart);
  function sendToChords() {
    if (!chords) return;
    app.sheet = chartChordPro(baseName, songKey ? keyName(songKey, true) : null, chords.bpm, chartLines(chords.segments, chords.beats, meterN));
    if (songKey) app.fromKey = songKey;
    app.shift = side === 'B' ? dispShift : 0;
    app.tab = 'chords';
  }

  async function exportAs(fmt: 'wav' | 'mp3' | 'orig') {
    if (!rendered) return;
    const my = gen;
    busy = `Encoding ${fmt === 'orig' ? (ofmt?.label ?? 'audio') : fmt.toUpperCase()}…`; progress = 0;
    const suffix = `(${renderedShift > 0 ? '+' : ''}${renderedShift})`;
    try {
      if (fmt === 'orig') {
        const { originalFormat, encodeWith, loadFFmpeg } = await import('./ffmpeg');
        const of = originalFormat(fileName);
        if (!of) throw new Error('no matching format');
        const wav = await encodeInWorker(channelsOf(rendered), rendered.sampleRate, 'wav');
        busy = 'Loading the converter (first time only)…'; await loadFFmpeg();
        busy = `Encoding ${of.ext.toUpperCase()}…`;
        const bytes = await encodeWith(wav, of.ext, of.args, (p) => (progress = p));
        downloadBytes(bytes, `${baseName} ${suffix}.${of.ext}`, of.mime);
      } else {
        const bytes = await encodeInWorker(channelsOf(rendered), rendered.sampleRate, fmt, (p) => (progress = p));
        downloadBytes(bytes, `${baseName} ${suffix}.${fmt}`, fmt === 'mp3' ? 'audio/mpeg' : 'audio/wav');
      }
    } catch (err) { if (my === gen) error = 'Export failed: ' + err; }
    if (my === gen) busy = '';
  }

  $effect(() => {
    const b = side === 'B' && rendered ? rendered : original;
    if (!canvas || !b) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const g = canvas.getContext('2d')!;
    g.scale(dpr, dpr);
    const buckets = Math.max(50, Math.floor(w));
    if (!peakCache || peakCache.buf !== b || peakCache.buckets !== buckets) peakCache = { buf: b, buckets, pk: peaks(b, buckets) };
    const pk = peakCache.pk;
    const played = (pos / b.duration) * w;
    for (let i = 0; i < pk.length; i++) {
      const x = (i / pk.length) * w, hh = Math.max(1, pk[i] * h * 0.95);
      g.fillStyle = x < played ? (side === 'B' ? '#ffb86b' : '#7c9cff') : '#3a3f55';
      g.fillRect(x, (h - hh) / 2, Math.max(1, w / pk.length - 0.5), hh);
    }
    g.fillStyle = '#fff'; g.fillRect(played, 0, 1.5, h);
  });
  onDestroy(() => { cancelAnimationFrame(raf); player.cancel(); });
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
</script>

<section class="card">
  <h2>Audio transpose</h2>
  <p class="muted">MP3, WAV, M4A/AAC, FLAC, OGG/Opus, AIFF, or a video (MP4, MOV, WebM, MKV). Everything runs on this device; nothing is uploaded.</p>
  <input type="file" accept={ACCEPT} onchange={onFile} data-testid="audio-file" />
  {#if original}
    <p class="muted small" data-testid="audio-info">{fileName} · {fmt(original.duration)} · {original.sampleRate} Hz · {original.numberOfChannels} ch · via <span data-testid="decoded-via">{via}</span></p>
  {/if}
  {#each warnings as w}<p class="warn" data-testid="warning">{w}</p>{/each}
  {#if busy && !original}
    <p class="status">{busy}</p>
    <div class="progress" data-testid="decode-progress"><i style="width:{Math.round(progress * 100)}%"></i></div>
  {/if}
  {#if error}<p class="error" data-testid="error">{error}</p>{/if}
</section>

{#if original}
  <section class="card">
    <canvas bind:this={canvas} class="wave" onclick={seek} aria-label="Waveform (click to seek)" data-testid="waveform"></canvas>
    {#if chords}
      <ChordTimeline segments={dispSegs} duration={original.duration} {pos} {selected} onseek={seekTo} onselect={select} />
    {:else if chordBusy}<p class="muted small">Detecting chords…</p>{/if}
    <div class="row wrap transport">
      <button class="play" onclick={toggle} data-testid="play">{playing ? '❚❚ Pause' : '▶ Play'}</button>
      <div class="ab" role="group" aria-label="A/B">
        <button class:on={side === 'A'} onclick={() => setSide('A')}>A · Original</button>
        <button class:on={side === 'B'} onclick={() => setSide('B')} data-testid="side-b">B · Shifted</button>
      </div>
      <span class="muted small">{fmt(pos)} / {fmt(original.duration)}</span>
      {#if nowChord}<span class="nowchord" data-testid="now-chord">{nowChord}{#if nextChord}<small> → {nextChord}</small>{/if}</span>{/if}
    </div>
    {#if side === 'B'}
      <p class="muted small">{rendered && !stale ? `Playing the Rubber Band render (${renderedShift > 0 ? '+' : ''}${renderedShift}).` : `Live preview via SoundTouch (${shift > 0 ? '+' : ''}${shift}); render for full quality.`}</p>
    {/if}
  </section>

  <section class="card">
    <ShiftControl bind:value={shift} id="audio-shift" />
    {#if keyBefore}<p>Detected key: <b>{keyName(keyBefore[0].key)}</b> → after shift: <b class="accent">{keyName(transposeKey(keyBefore[0].key, shift))}</b> · {intervalName(shift)}</p>{/if}
    <div class="row wrap">
      <button class="primary" onclick={render} disabled={!!busy || shift === 0} data-testid="render">Render {shift > 0 ? '+' : ''}{shift}</button>
      <button onclick={() => exportAs('wav')} disabled={!rendered || stale || !!busy} data-testid="export-wav">Export WAV</button>
      <button onclick={() => exportAs('mp3')} disabled={!rendered || stale || !!busy} data-testid="export-mp3">Export MP3</button>
      {#if ofmt}<button onclick={() => exportAs('orig')} disabled={!rendered || stale || !!busy} data-testid="export-orig">Export {ofmt.label} (audio)</button>{/if}
    </div>
    {#if busy && original}
      <p class="status">{busy}</p>
      <div class="progress" data-testid="progress"><i style="width:{Math.round(progress * 100)}%"></i></div>
    {/if}
  </section>

  {#if chords}
    <section class="card" data-testid="chord-chart">
      <h3>Chords {dispKey ? `in ${keyName(dispKey)}` : ''} <small class="muted">· {chords.bpm} bpm · {chords.beatSource === 'essentia' ? 'beats by Essentia' : 'fixed 0.5 s grid'} · rough, check by ear</small>
        <select bind:value={meter} aria-label="Beats per bar" data-testid="meter" class="meter"><option value={4}>4/4</option><option value={3}>3/4</option><option value={6}>6/8 (6 beats)</option><option value={2}>2/4</option></select></h3>
      {#if selected >= 0 && chords.segments[selected]}
        <div class="row wrap edit">
          <span class="muted small">Chord at {fmt(chords.segments[selected].start)}:</span>
          <input bind:value={editText} aria-label="Chord" data-testid="chord-edit" onkeydown={(e) => e.key === 'Enter' && saveEdit()} />
          <button class="small" onclick={() => saveEdit()} data-testid="chord-save">Save</button>
          <button class="small" onclick={() => saveEdit(true)}>Change all "{dispSegs[selected]?.label}"</button>
          <button class="small" onclick={() => (selected = -1)}>Done</button>
          {#if editErr}<span class="error small">{editErr}</span>{/if}
        </div>
      {:else}<p class="muted small">Tap a chord in the timeline to play from there and edit it.</p>{/if}
      <pre class="sheet chart" data-testid="chart">{#each chart as l}<span class="chord">{l}</span>
{/each}</pre>
      <div class="row wrap">
        <button onclick={sendToChords} data-testid="send-chords">Open in Chords tab</button>
        <button onclick={() => downloadText(proText(), `${baseName} chords${dispShift ? ` (${dispShift > 0 ? '+' : ''}${dispShift})` : ''}.pro`)} data-testid="chords-pro">Export .pro</button>
        <button onclick={() => downloadText(toText(parseSheet(proText())), `${baseName} chords${dispShift ? ` (${dispShift > 0 ? '+' : ''}${dispShift})` : ''}.txt`)}>Export .txt</button>
        <button onclick={() => runChords()} disabled={chordBusy}>Re-detect</button>
      </div>
    </section>
  {/if}

  {#if keyBefore}
    <section class="card">
      <h3>Key check <small class="muted">({engine})</small></h3>
      <div class="cols">
        <div><h4>Original</h4><KeyResults results={keyBefore} /></div>
        {#if keyAfter}<div><h4>Rendered ({renderedShift > 0 ? '+' : ''}{renderedShift})</h4><KeyResults results={keyAfter} /></div>{/if}
      </div>
      {#if keyAfter && expected}
        <p data-testid="verify" class={verified || verifiedRel ? 'ok' : 'error'}>
          {verified ? '✓' : verifiedRel ? '≈' : '✗'} Expected {keyName(expected)}, detected {keyName(keyAfter[0].key)}{verifiedRel ? ' (relative key)' : ''}. Duration change {durDiff.toFixed(2)}%.
        </p>
      {/if}
    </section>
  {/if}
{/if}
