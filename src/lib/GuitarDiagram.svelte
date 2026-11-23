<script lang="ts">
  import type { GuitarShape } from '../theory/diagrams';
  let { shape, label }: { shape: GuitarShape; label: string } = $props();
  const W = 90, H = 110, x0 = 15, y0 = 22, sw = 12, fh = 16;
  const rel = (f: number) => f - shape.baseFret + 1;
</script>
<figure class="diagram">
  <svg viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label="Guitar diagram {label}">
    {#each Array(6) as _, s}<line x1={x0 + s * sw} y1={y0} x2={x0 + s * sw} y2={y0 + 5 * fh} stroke="currentColor" stroke-width="1" />{/each}
    {#each Array(6) as _, f}<line x1={x0} y1={y0 + f * fh} x2={x0 + 5 * sw} y2={y0 + f * fh} stroke="currentColor" stroke-width={f === 0 && shape.baseFret === 1 ? 3 : 1} />{/each}
    {#if shape.baseFret > 1}<text x="2" y={y0 + 11} font-size="9" fill="currentColor">{shape.baseFret}</text>{/if}
    {#each shape.frets as f, s}
      {#if f < 0}<text x={x0 + s * sw - 3} y={y0 - 6} font-size="9" fill="currentColor">×</text>
      {:else if f === 0}<circle cx={x0 + s * sw} cy={y0 - 9} r="3" fill="none" stroke="currentColor" />
      {:else}<circle cx={x0 + s * sw} cy={y0 + (rel(f) - 0.5) * fh} r="5" fill="var(--accent)" />{/if}
    {/each}
  </svg>
  <figcaption>{label}</figcaption>
</figure>
