$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$ctl = Join-Path $project 'tmp\postgres-17\pgsql\bin\pg_ctl.exe'
$data = Join-Path $project 'tmp\pgdata'
if (-not (Test-Path -LiteralPath $ctl) -or -not (Test-Path -LiteralPath $data)) { throw 'Local PostgreSQL files are missing.' }
& $ctl -D $data -m fast -w stop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output 'PostgreSQL stopped.'
