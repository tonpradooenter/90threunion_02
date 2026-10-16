$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskProject
$taskArchive = Join-Path $taskProject 'tmp\mariadb-11.8.6-winx64.zip'
$taskBinary = Join-Path $taskProject 'tmp\mariadb-portable\mariadb-11.8.6-winx64\bin\mariadb-install-db.exe'
$taskData = Join-Path $taskProject 'tmp\mariadb-data-v1'
New-Item -ItemType Directory -Force (Join-Path $taskProject 'tmp') | Out-Null
if (-not (Test-Path -LiteralPath $taskBinary)) {
  if (-not (Test-Path -LiteralPath $taskArchive)) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://archive.mariadb.org/mariadb-11.8.6/winx64-packages/mariadb-11.8.6-winx64.zip' -OutFile $taskArchive
  }
  $taskHash = (Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash
  if ($taskHash -ne '98cb8429841fc558fbc48e8c979c3b66c88ac506d7505a589e8ac74a039b0b21') { throw 'MariaDB archive SHA256 mismatch' }
  Expand-Archive -LiteralPath $taskArchive -DestinationPath (Join-Path $taskProject 'tmp\mariadb-portable') -Force
}
if (-not (Test-Path -LiteralPath (Join-Path $taskData 'mysql'))) {
  & $taskBinary "--datadir=$taskData" '--port=33079'
  if ($LASTEXITCODE -ne 0) { throw 'MariaDB initialization failed' }
}
& (Join-Path $PSScriptRoot 'start-local-mariadb.ps1')
node scripts/local-mariadb-bootstrap.mjs
if ($LASTEXITCODE -ne 0) { throw 'Local database account setup failed' }
npm.cmd run db:setup:mariadb
if ($LASTEXITCODE -ne 0) { throw 'Demo schema setup failed' }
Write-Output 'MariaDB v1 is ready. Start the website yourself with: npm.cmd run dev:mariadb'
