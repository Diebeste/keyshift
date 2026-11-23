<script lang="ts">
  import { keyName, relativeOf, type KeyScore, type Key } from '../theory/keys';
  let { results, onpick }: { results: KeyScore[]; onpick?: (k: Key) => void } = $props();
</script>
<ol class="keys" data-testid="key-results">
  {#each results.slice(0, 3) as r, i}
    <li class:best={i === 0}>
      <div class="kname">{keyName(r.key)}</div>
      <div class="kmeta">{r.key.mode} · relative {keyName(relativeOf(r.key))}</div>
      <div class="bar"><i style="width:{Math.round(r.confidence * 100)}%"></i></div>
      <div class="pct">{Math.round(r.confidence * 100)}%</div>
      {#if onpick}<button class="small" onclick={() => onpick?.(r.key)}>Use</button>{/if}
    </li>
  {/each}
</ol>
