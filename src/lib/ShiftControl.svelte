<script lang="ts">
  let { value = $bindable(0), id = 'shift' }: { value: number; id?: string } = $props();
  const set = (n: number) => (value = Math.max(-12, Math.min(12, n)));
</script>
<div class="shift">
  <span class="lbl">Shift</span>
  <button class="sq" aria-label="Down a semitone" onclick={() => set(value - 1)}>−</button>
  <input {id} type="range" min="-12" max="12" step="1" bind:value aria-label="Semitone shift" />
  <button class="sq" aria-label="Up a semitone" onclick={() => set(value + 1)}>+</button>
  <output class="val" data-testid="shift-value">{value > 0 ? '+' : ''}{value}</output>
</div>
