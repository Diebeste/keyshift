<script lang="ts">
  import { onDestroy } from 'svelte';
  import ShiftControl from './ShiftControl.svelte';
  import KeyResults from './KeyResults.svelte';
  import { decodeFile, channelsOf, monoOf, bufferFrom, downloadBytes, peaks } from './audio';
  import { detectKeyInWorker, shiftInWorker, encodeInWorker } from './workers';
  import { Player } from './player';
  import { keyName, sameKey, transposeKey, relativeOf, type KeyScore } from '../theory/keys';
  import { intervalName } from '../theory/transpose';

  let fileName = $state('');
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
  let canvas: HTMLCanvasElement | undefined = $state();
  const player = new Player();
  player.onend = () => { playing = false; pos = 0; };
  let raf = 0;
  const tick = () => { pos = player.position; if (player.playing) raf = requestAnimationFrame(tick); };

  const stale = $derived(rendered !== null && renderedShift !== shift);
  const expected = $derived(keyBefore ? transposeKey(keyBefore[0].key, renderedShift) : null);
  const verified = $derived(keyAfter && expected ? sameKey(keyAfter[0].key, expected) : null);
  const verifiedRel = $derived(keyAfter && expected ? sameKey(keyAfter[0].key, relativeOf(expected)) : null);
  const durDiff = $derived(original && rendered ? Math.abs(rendered.duration - original.duration) / original.duration * 100 : 0);

  async function onFile(e: Event) {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    player.stop(false); playing = false; pos = 0;
    error = ''; rendered = null; keyBefore = null; keyAfter = null; fileName = f.name; busy = 'Decoding…';
    try {
      original = await decodeFile(f);
      busy = 'Detecting key…';
      const r = await detectKeyInWorker(monoOf(original), original.sampleRate);
      keyBefore = r.top;
      engine = r.engine === 'essentia' ? 'Essentia.js' : 'Meyda + profiles (fallback)';
    } catch (err) { error = 'Could not decode this file: ' + err; original = null; }
    busy = '';
  }

  async function render() {
    if (!original) return;
    error = ''; progress = 0; busy = 'Rendering with Rubber Band…'; keyAfter = null;
    const wasPlaying = player.playing; player.stop(); playing = false;
    try {
      const out = await shiftInWorker(channelsOf(original), original.sampleRate, shift, (p) => (progress = p));
      rendered = bufferFrom(out, original.sampleRate);
      renderedShift = shift;
      side = 'B';
      busy = 'Verifying key…';
      keyAfter = (await detectKeyInWorker(monoOf(rendered), rendered.sampleRate)).top;
    } catch (err) { error = 'Render failed: ' + err; }
    busy = '';
    if (wasPlaying) toggle();
  }

  async function toggle() {
    if (!original) return;
    if (player.playing) { player.stop(); playing = false; return; }
    const useRendered = side === 'B' && rendered && !stale;
    await player.play(useRendered ? rendered! : original, pos, side === 'B' && !useRendered ? shift : null);
    playing = true; tick();
  }
  async function setSide(s: 'A' | 'B') {
    side = s;
    if (player.playing) { player.stop(); playing = false; await toggle(); }
  }
  async function seek(e: MouseEvent) {
    if (!original || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * original.duration;
    const was = player.playing;
    player.stop(); player.seek(t); pos = t; playing = false;
    if (was) await toggle();
  }
  async function exportAs(fmt: 'wav' | 'mp3') {
    if (!rendered) return;
    busy = `Encoding ${fmt.toUpperCase()}…`; progress = 0;
    try {
      const bytes = await encodeInWorker(channelsOf(rendered), rendered.sampleRate, fmt, (p) => (progress = p));
      const base = fileName.replace(/\.[^.]+$/, '') || 'audio';
      downloadBytes(bytes, `${base} (${renderedShift > 0 ? '+' : ''}${renderedShift}).${fmt}`, fmt === 'mp3' ? 'audio/mpeg' : 'audio/wav');
    } catch (err) { error = 'Export failed: ' + err; }
    busy = '';
  }

  $effect(() => {
    const b = side === 'B' && rendered ? rendered : original;
    if (!canvas || !b) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const g = canvas.getContext('2d')!;
    g.scale(dpr, dpr);
    const pk = peaks(b, Math.max(50, Math.floor(w)));
    const played = (pos / b.duration) * w;
    for (let i = 0; i < pk.length; i++) {
      const x = (i / pk.length) * w, hh = Math.max(1, pk[i] * h * 0.95);
      g.fillStyle = x < played ? (side === 'B' ? '#ffb86b' : '#7c9cff') : '#3a3f55';
      g.fillRect(x, (h - hh) / 2, Math.max(1, w / pk.length - 0.5), hh);
    }
    g.fillStyle = '#fff'; g.fillRect(played, 0, 1.5, h);
  });
  onDestroy(() => { cancelAnimationFrame(raf); player.stop(); });
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
</script>

<section class="card">
  <h2>Audio transpose</h2>
  <p class="muted">Pitch-shift a song while keeping its tempo. Everything runs on this device; audio is never uploaded.</p>
  <input type="file" accept="audio/*,.mp3,.wav,.m4a" onchange={onFile} data-testid="audio-file" />
  {#if original}
    <p class="muted small" data-testid="audio-info">{fileName} · {fmt(original.duration)} · {original.sampleRate} Hz · {original.numberOfChannels} ch</p>
  {/if}
  {#if error}<p class="error">{error}</p>{/if}
</section>

{#if original}
  <section class="card">
    <canvas bind:this={canvas} class="wave" onclick={seek} aria-label="Waveform (click to seek)" data-testid="waveform"></canvas>
    <div class="row wrap transport">
      <button class="play" onclick={toggle} data-testid="play">{playing ? '❚❚ Pause' : '▶ Play'}</button>
      <div class="ab" role="group" aria-label="A/B">
        <button class:on={side === 'A'} onclick={() => setSide('A')}>A · Original</button>
        <button class:on={side === 'B'} onclick={() => setSide('B')} data-testid="side-b">B · Shifted</button>
      </div>
      <span class="muted small">{fmt(pos)} / {fmt(original.duration)}</span>
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
    </div>
    {#if busy}
      <p class="status">{busy}</p>
      <div class="progress" data-testid="progress"><i style="width:{Math.round(progress * 100)}%"></i></div>
    {/if}
  </section>

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
