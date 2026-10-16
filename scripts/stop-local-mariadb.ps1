$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskProject
$taskListening = Get-NetTCPConnection -State Listen -LocalPort 33079 -ErrorAction SilentlyContinue
if (-not $taskListening) { Write-Output 'Local MariaDB is already stopped.'; return }
$taskExpected = Join-Path $taskProject 'tmp\mariadb-portable\mariadb-11.8.6-winx64\bin\mariadbd.exe'
$taskProcess = Get-Process -Id ($taskListening | Select-Object -First 1).OwningProcess -ErrorAction Stop
if ($taskProcess.Path -ne $taskExpected) { throw 'Port 33079 belongs to another application; stop aborted.' }
node scripts/local-mariadb-stop.mjs
if ($LASTEXITCODE -ne 0) { throw 'Could not stop local MariaDB' }
Write-Output 'Local MariaDB stopped.'
