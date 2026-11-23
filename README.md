# Key Shift

Key detection, transposing, chord sheets and audio pitch-shifting in one installable web app (PWA).
Local-first: no server, no account, and **audio never leaves your device**. Works offline after the first visit.

## Features

1. **Key**: drop an MP3/WAV/M4A to get the top 3 keys with confidence, major/minor and the relative key
   (Essentia.js KeyExtractor; falls back to Meyda chroma + Krumhansl-Schmuckler/Temperley profiles).
   Or paste a chord sheet and it scores the chords against all 24 keys.
2. **Transpose**: pick a target key or shift −12…+12. Shows the interval, the 3 easiest capo options (0–7) for the
   chords in your sheet, and a vocal-range hint (enter the song's lowest/highest note to see the new range).
   Spelling follows the target key (flats for F, Bb, Eb, Ab, Db, Gb and their relative minors, sharps otherwise).
3. **Chords**: paste chords-over-lyrics or ChordPro (extensions like m7, maj7, sus4, add9, dim, aug, 7b9 and slash chords
   like D/F#). Original and transposed side by side with lyrics kept aligned, optional Nashville numbers, guitar or piano
   diagrams, Copy, Print (prints just the transposed sheet), Export .txt / .pro.
4. **Audio**: upload a song, shift it n semitones with the tempo unchanged (Rubber Band, in a Web Worker), with live
   preview (SoundTouch AudioWorklet), waveform, play/pause, A/B original vs shifted and a progress bar. Export WAV or MP3,
   and it re-detects the key of the result to confirm it moved by n.

## Run it (from the release zip)

Unzip `KeyShift.zip`, open the `KeyShift` folder, then:

- **Mac**: double-click `serve.command`. The first time, macOS may block it: right-click → Open → Open.
  Uses Python 3 (if the Xcode command line tools are present), Node or the built-in Ruby, whichever it finds.
- **Windows**: double-click `serve.bat`. Uses Python (`py`), Node, or built-in PowerShell as a last resort, so nothing needs installing.
- **Anything else**: `python3 serve.py` or `node serve.mjs` in the folder.

Your browser opens at <http://localhost:8765/>. To install it as an app: Chrome/Edge → install icon in the address bar;
Safari on Mac → File → Add to Dock. Once loaded, it works offline.

**Phone**: a phone can't reach `localhost` on your computer. Either host the folder on any static host with HTTPS
(for example GitHub Pages, as with the worship app) and "Add to Home Screen", or open it from the computer's LAN address
(installing as an app on a phone needs HTTPS).

Opening `index.html` directly (file://) won't work: browsers block workers and wasm from file:// pages. Use a server script.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest unit + audio tests (Node)
npm run test:e2e     # build + Playwright smoke at 390x844 and desktop
npm run release      # build + release/KeyShift.zip
```

Layout: `src/theory` (pure TypeScript music logic, no UI dependencies), `src/audio` (key detection, Rubber Band,
encoders; shared by workers and tests), `src/workers` (Web Workers), `src/lib` (Svelte UI), `src/sw-template.js`
(service worker: network-first for pages so fixes always show, cache-first for hashed assets). The version label is in the footer.

## Notes and limits

- The browser decodes audio at the device's audio rate (often 48 kHz), so exports use that rate.
- Very long files (over ~10 minutes) need several hundred MB of memory while rendering.
- Detecting the relative major/minor instead of the exact key happens on ambiguous songs; the top 3 list shows both.
- Licenses: see LICENSES.md (Essentia is AGPL, Rubber Band GPL: fine for personal use).
