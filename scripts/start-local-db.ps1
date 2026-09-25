$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$ctl = Join-Path $project 'tmp\postgres-17\pgsql\bin\pg_ctl.exe'
$data = Join-Path $project 'tmp\pgdata'
if (-not (Test-Path -LiteralPath $ctl) -or -not (Test-Path -LiteralPath $data)) { throw 'Local PostgreSQL files are missing. Run setup first.' }
& $ctl -D $data -l (Join-Path $data 'server.log') -o '-h 127.0.0.1 -p 54329' -w start
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output 'PostgreSQL is ready on 127.0.0.1:54329.'
