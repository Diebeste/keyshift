<script lang="ts">
  let { notes, bass, label }: { notes: number[]; bass: number | null; label: string } = $props();
  const start = 60, octaves = 2, ww = 11;
  const WHITE = [0, 2, 4, 5, 7, 9, 11], BLACKX: Record<number, number> = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };
  const fold = (n: number) => { while (n >= start + 12 * octaves) n -= 12; while (n < start) n += 12; return n; };
  const on = $derived(new Set(notes.map(fold)));
  const bassPc = $derived(bass === null ? null : ((bass % 12) + 12) % 12);
  const whites = Array.from({ length: 7 * octaves }, (_, i) => start + Math.floor(i / 7) * 12 + WHITE[i % 7]);
  const blacks = Array.from({ length: octaves }, (_, o) => Object.entries(BLACKX).map(([pc, x]) => ({ n: start + o * 12 + +pc, x: (o * 7 + x) * ww - 3.5 }))).flat();
</script>
<figure class="diagram">
  <svg viewBox="0 0 {7 * octaves * ww + 1} 60" width={7 * octaves * ww + 1} height="60" role="img" aria-label="Piano diagram {label}">
    {#each whites as n, i}<rect x={i * ww + 0.5} y="0.5" width={ww} height="58" fill={on.has(n) ? 'var(--accent)' : '#fff'} stroke="#333" />{/each}
    {#each blacks as b}<rect x={b.x} y="0.5" width="7" height="36" fill={on.has(b.n) ? 'var(--accent2)' : '#222'} stroke="#111" />{/each}
  </svg>
  <figcaption>{label}{bassPc !== null ? ' (bass in left hand)' : ''}</figcaption>
</figure>
