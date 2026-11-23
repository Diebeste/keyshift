# Key Shift local server using built-in PowerShell (no installs). Serves this folder on localhost only.
param([int]$Port = 8765)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'; '.wasm'='application/wasm';
  '.svg'='image/svg+xml'; '.png'='image/png'; '.json'='application/json'; '.webmanifest'='application/manifest+json' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Key Shift running at http://localhost:$Port/  (close this window to stop)"
Start-Process "http://localhost:$Port/"
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $p = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($p.EndsWith('/')) { $p += 'index.html' }
  $file = [IO.Path]::GetFullPath((Join-Path $root $p.TrimStart('/')))
  $res = $ctx.Response
  if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
}
