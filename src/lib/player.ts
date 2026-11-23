// A/B player: original, live SoundTouch preview (AudioWorklet), or the Rubber Band render.
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import processorUrl from '@soundtouchjs/audio-worklet/processor?url';
import { audioCtx } from './audio';

let registered: Promise<boolean> | null = null;
export function ensureSoundTouch(): Promise<boolean> {
  registered ??= SoundTouchNode.register(audioCtx(), processorUrl).then(() => true).catch(() => false);
  return registered;
}

export class Player {
  private src: AudioBufferSourceNode | null = null;
  private st: SoundTouchNode | null = null;
  private startedAt = 0;
  private offset = 0;
  playing = false;
  buffer: AudioBuffer | null = null;
  onend: (() => void) | null = null;

  get position(): number {
    if (!this.buffer) return 0;
    const p = this.playing ? this.offset + (audioCtx().currentTime - this.startedAt) : this.offset;
    return Math.min(p, this.buffer.duration);
  }

  async play(buffer: AudioBuffer, at: number, liveSemitones: number | null) {
    this.stop(false);
    const ctx = audioCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    this.buffer = buffer;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (liveSemitones !== null && liveSemitones !== 0 && (await ensureSoundTouch())) {
      this.st = new SoundTouchNode({ context: ctx });
      this.st.pitchSemitones.value = liveSemitones;
      src.connect(this.st);
      this.st.connect(ctx.destination);
    } else src.connect(ctx.destination);
    src.onended = () => { if (this.src === src) { this.playing = false; this.offset = 0; this.onend?.(); } };
    this.offset = Math.max(0, Math.min(at, buffer.duration - 0.01));
    this.startedAt = ctx.currentTime;
    src.start(0, this.offset);
    this.src = src;
    this.playing = true;
  }

  stop(keepPos = true) {
    const pos = this.position;
    if (this.src) { this.src.onended = null; try { this.src.stop(); } catch { /* not started */ } this.src.disconnect(); }
    this.st?.disconnect();
    this.src = null; this.st = null;
    this.playing = false;
    if (keepPos) this.offset = pos;
  }

  seek(t: number) { this.offset = t; }
}
