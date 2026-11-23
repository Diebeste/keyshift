#!/bin/bash
# Build and package the static site + server scripts into release/KeyShift.zip
set -euo pipefail
cd "$(dirname "$0")/.."
npx vite build
rm -rf release/KeyShift release/KeyShift.zip
mkdir -p release/KeyShift
cp -r dist/. release/KeyShift/
cp serve/serve.py serve/serve.mjs serve/serve.command serve/serve.bat serve/serve.ps1 release/KeyShift/
cp README.md LICENSES.md release/KeyShift/
chmod +x release/KeyShift/serve.command release/KeyShift/serve.py
python3 - <<'PY'
import os, zipfile
with zipfile.ZipFile('release/KeyShift.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dp, dn, fn in os.walk('release/KeyShift'):
        dn.sort()
        for f in sorted(fn):
            full = os.path.join(dp, f)
            arc = os.path.relpath(full, 'release')
            info = zipfile.ZipInfo.from_file(full, arc)
            info.compress_type = zipfile.ZIP_DEFLATED
            mode = 0o755 if f in ('serve.command', 'serve.py') else 0o644
            info.external_attr = (0o100000 | mode) << 16
            with open(full, 'rb') as fh:
                z.writestr(info, fh.read())
PY
ls -la release/KeyShift.zip
