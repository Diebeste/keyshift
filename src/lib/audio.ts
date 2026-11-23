// Browser-side decode + playback helpers. Files are read locally; nothing is uploaded.
let ctx: AudioContext | null = null;
export function audioCtx(): AudioContext {
  ctx ??= new AudioContext();
  return ctx;
}

export async function decodeFile(file: Blob): Promise<AudioBuffer> {
  const data = await file.arrayBuffer();
  return await audioCtx().decodeAudioData(data);
}

export function channelsOf(b: AudioBuffer): Float32Array[] {
  return Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
}

export function monoOf(b: AudioBuffer): Float32Array {
  const ch = channelsOf(b);
  if (ch.length === 1) return ch[0].slice();
  const out = new Float32Array(b.length);
  for (const c of ch) for (let i = 0; i < out.length; i++) out[i] += c[i] / ch.length;
  return out;
}

export function bufferFrom(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const b = audioCtx().createBuffer(channels.length, channels[0].length, sampleRate);
  channels.forEach((c, i) => b.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  return b;
}

export function downloadBytes(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadText(text: string, name: string) {
  downloadBytes(new TextEncoder().encode(text), name, 'text/plain;charset=utf-8');
}

/** Peaks for waveform drawing. */
export function peaks(b: AudioBuffer, buckets: number): Float32Array {
  const ch = channelsOf(b), n = b.length, per = Math.max(1, Math.floor(n / buckets));
  const out = new Float32Array(buckets);
  for (let i = 0; i < buckets; i++) {
    let m = 0;
    for (const c of ch) for (let j = i * per; j < Math.min(n, (i + 1) * per); j += 4) { const v = Math.abs(c[j]); if (v > m) m = v; }
    out[i] = m;
  }
  return out;
}
