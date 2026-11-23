# Third-party licenses

Key Shift bundles the libraries below into the built app. Everything runs locally in your browser.

| Library | Version | License | Used for |
|---|---|---|---|
| [Essentia.js](https://github.com/MTG/essentia.js) (Essentia, MTG-UPF) | 0.1.3 | **AGPL-3.0** | Audio key detection (KeyExtractor, wasm) |
| [Rubber Band Library](https://breakfastquay.com/rubberband/) via [rubberband-wasm](https://github.com/Daninet/rubberband-wasm) | 3.3.0 | **GPL-2.0** (Rubber Band: GPL-2.0-or-later) | Offline, high-quality pitch shift with tempo kept |
| [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) (@soundtouchjs/audio-worklet, @soundtouchjs/core) | 2.1.1 | MPL-2.0 | Live pitch preview (AudioWorklet) |
| [lamejs](https://github.com/zhuker/lamejs) (@breezystack/lamejs ESM build) | 1.2.7 | LGPL-3.0 | MP3 export |
| [Meyda](https://github.com/meyda/meyda) (+ fftjs, dct) | 5.6.3 | MIT | Chroma features for the fallback key detector |
| [Svelte](https://svelte.dev) | 5.x | MIT | UI |
| [Vite](https://vite.dev), Vitest, Playwright | dev only | MIT / Apache-2.0 | Build and tests (not shipped) |

## Note on AGPL / GPL

Essentia (AGPL-3.0) and Rubber Band (GPL-2.0) are copyleft. That is **fine for personal and
private use** (Brandon's devices, the church team). If Key Shift is ever distributed or offered
publicly as a service, the complete source (this repository) must be made available under a
compatible license, or commercial licenses bought (Rubber Band and Essentia both sell them).

Key Shift's own code: © 2026 Brandon. Personal use.

## Music used for testing

"Gymnopédie No. 1" (Erik Satie, public domain composition), performance by Kevin MacLeod
(incompetech.com), licensed under Creative Commons: By Attribution 4.0. Used only for a local
manual test; not bundled in the app.
