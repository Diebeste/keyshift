# Key Shift — status

**Version:** 1.1.1 (the footer also shows a build stamp, e.g. `v1.1.1+YYYYMMDDHHMM`)

- Live: https://diebeste.github.io/keyshift/
- Repo: https://github.com/Diebeste/keyshift
- Local zip: `release/KeyShift.zip` (rebuild with `npm run release`)

Wrap-up note for the final bug-fix and cleanup round (24 Nov 2026, America/Toronto).

## What this round fixed

- **Production build / live preview:** the SoundTouch worklet was imported from a path that is not exported by `@soundtouchjs/audio-worklet` (`dist/worklet/processor.js`). Vite 8 now rejects that, so `vite build` failed. It now uses the package's `processor` export.
- **Stale results / overlapping work:** choosing a new file (or clicking Render again) no longer lets an earlier decode, key detect, chord detect, or render overwrite the current one. The player also ignores a late SoundTouch setup so a double-tap on Play cannot start two sources.
- **Original-format export button:** only appears for formats the app can actually encode (FLAC, OGG, Opus, M4A, AIFF, WebM, MKA). Unknown extensions and MP3/WAV no longer offer a doomed "Export …" button. `.m4v` is included with the other video types.
- **Empty and undecodable files:** empty files are rejected immediately. If both the browser decoder and ffmpeg.wasm fail, the error asks you to try MP3 or WAV instead of a raw ffmpeg message. The Key tab shows failures as errors, not as a status line, and surfaces large-file warnings.
- **Same file again:** the file input is cleared after each choice, so you can re-pick the same file after a failure.
- **Waveform performance:** peak data is cached so it is not recomputed on every animation frame while the song plays.
- **Chord timing drift:** if the beat tracker accumulates phase error later in a song, that linear drift is subtracted. Local timing (rubato, fills) is left alone; a steady undrifted grid is left alone.
- **Meter select:** the chart's beats-per-bar is coerced to a number so a 3/4 or 6/8 choice cannot be passed as the string `"3"`.
- **Workers:** copies of audio buffers are transferred to the worker (less memory), and a worker crash rejects the promise instead of hanging the UI.
- **Mobile layout:** safe-area insets on the top (notch) and sticky tabs, slightly tighter header text on narrow screens, 44px tab targets, and standard web-app meta tags for installed-on-home-screen use.
- **Cleanup:** shared export-format table, removed a dead file handle, ignored and untracked `serve/__pycache__`, version bump to 1.1.1.

## Tests

- `npm run check` (svelte-check + tsc): 0 errors, 0 warnings
- `npm test` (Vitest): **111 passed** / 5 files. Was 102; added 9 (export-format list, decode preflight, beat-drift correction).
- Playwright smoke (`npm run test:e2e`): **9 passed** across mobile 390×844, desktop 1366×900, and WebKit desktop (tabs + audio round-trip, offline service worker, empty-file error).
- Playwright chords: **3 passed** on the same three projects (timeline, shifted chords, edit, send to Chords, export).
- Format-matrix and real-MP3 e2e suites were not re-run here (they are long ffmpeg/real-file tests; the export-format table was centralized and only gained `.m4v`).

## Known limits (not fixed in this round)

- **Real Safari / iOS** has not been tested on a device. Playwright WebKit on the desktop is the closest coverage.
- **Listening** to the pitch-shifted output on a real phone, and **very large files** (many minutes / hundreds of MB), were not re-verified here.
- **Chord detection** is still a starting point, not a transcription. Piano/guitar songs with clear harmony work best; melody notes, passing tones and missing bass can invent sus/7th chords. Later chords on long, loose-tempo real songs can still be approximate even after beat-drift correction. Tap a chord to fix it.
- **Key detection** can prefer the relative major/minor on ambiguous songs; the top-3 list shows both.
- **Live SoundTouch preview** may sit a little ahead of the playhead because of worklet buffering; the Rubber Band render is the accurate output.
- The browser decodes at the device's sample rate (often 48 kHz), so exports use that rate.
- Opening `index.html` as a `file://` page will not work; use the zip's server scripts or the GitHub Pages URL.
- Licenses: Essentia is AGPL, Rubber Band is GPL — fine for personal use (see LICENSES.md).
