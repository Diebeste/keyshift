<script lang="ts">
  import { app } from './lib/state.svelte';
  import KeyTab from './lib/KeyTab.svelte';
  import TransposeTab from './lib/TransposeTab.svelte';
  import ChordsTab from './lib/ChordsTab.svelte';
  import AudioTab from './lib/AudioTab.svelte';
  import { keyName, transposeKey } from './theory/keys';
  const tabs = [['key', 'Key'], ['transpose', 'Transpose'], ['chords', 'Chords'], ['audio', 'Audio']] as const;
  const version = __APP_VERSION__;
</script>

<header class="top noprint">
  <div class="brand"><img src="./favicon.svg" alt="" width="28" height="28" /> Key Shift</div>
  <div class="cur" data-testid="current-key">{keyName(app.fromKey, true)} → {keyName(transposeKey(app.fromKey, app.shift), true)}</div>
</header>
<nav class="tabs noprint" aria-label="Sections">
  {#each tabs as [id, label]}
    <button class:on={app.tab === id} onclick={() => (app.tab = id)} data-testid="tab-{id}">{label}</button>
  {/each}
</nav>
<main>
  {#if app.tab === 'key'}<KeyTab />
  {:else if app.tab === 'transpose'}<TransposeTab />
  {:else if app.tab === 'chords'}<ChordsTab />
  {:else}<AudioTab />{/if}
</main>
<footer class="noprint"><span data-testid="version">Key Shift v{version}</span> · offline-ready · audio never leaves this device</footer>
