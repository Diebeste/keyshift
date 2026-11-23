<script lang="ts">
  import { ALL_KEYS, keyName, type Key } from '../theory/keys';
  let { value = $bindable(), label = 'Key', modeLock = null, id = '' }: { value: Key; label?: string; modeLock?: 'major' | 'minor' | null; id?: string } = $props();
  const options = $derived(ALL_KEYS.filter((k) => !modeLock || k.mode === modeLock));
  const idx = $derived(ALL_KEYS.findIndex((k) => k.tonic === value.tonic && k.mode === value.mode));
</script>
<label class="field">
  <span>{label}</span>
  <select {id} value={idx} onchange={(e) => (value = ALL_KEYS[+(e.currentTarget as HTMLSelectElement).value])}>
    {#each options as k}
      <option value={ALL_KEYS.indexOf(k)}>{keyName(k)}</option>
    {/each}
  </select>
</label>
