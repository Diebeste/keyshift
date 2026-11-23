<script lang="ts">
  let { segments, duration, pos, selected = -1, onseek, onselect }: {
    segments: { start: number; end: number; label: string }[]; duration: number; pos: number; selected?: number;
    onseek: (t: number) => void; onselect: (i: number) => void;
  } = $props();
  let box: HTMLDivElement | undefined = $state();
  const width = $derived(Math.max(1, duration) * 46);
  const cur = $derived(segments.findIndex((s) => pos >= s.start && pos < s.end));
  $effect(() => {
    if (!box || cur < 0) return;
    const x = (segments[cur].start / duration) * width;
    if (x < box.scrollLeft + 20 || x > box.scrollLeft + box.clientWidth - 80) box.scrollLeft = Math.max(0, x - box.clientWidth / 3);
  });
</script>
<div class="ctl" bind:this={box} data-testid="chord-timeline">
  <div class="ctl-inner" style="width:{width}px">
    {#each segments as s, i}
      <button
        class="seg" class:cur={i === cur} class:sel={i === selected} class:nc={s.label === 'N.C.'}
        style="left:{(s.start / duration) * 100}%;width:{((s.end - s.start) / duration) * 100}%"
        title="{s.label} at {s.start.toFixed(1)} s: click to play from here, double-click to edit"
        onclick={() => { onseek(s.start); onselect(i); }}
      >{s.label}</button>
    {/each}
    <i class="ph" style="left:{(pos / Math.max(0.001, duration)) * 100}%"></i>
  </div>
</div>
