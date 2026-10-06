$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'local-server.mjs') stop
if ($LASTEXITCODE -ne 0) { throw 'Could not authenticate this QASentinel launcher. No other application was stopped.' }
