$ErrorActionPreference = 'Stop'
$taskProject = Split-Path -Parent $PSScriptRoot
$taskBinary = Join-Path $taskProject 'tmp\mariadb-portable\mariadb-11.8.6-winx64\bin\mariadbd.exe'
$taskData = Join-Path $taskProject 'tmp\mariadb-data-v1'
if (-not (Test-Path -LiteralPath $taskBinary) -or -not (Test-Path -LiteralPath (Join-Path $taskData 'mysql'))) { throw 'Run scripts\setup-local-mariadb.ps1 first.' }
$taskListening = Get-NetTCPConnection -State Listen -LocalPort 33079 -ErrorAction SilentlyContinue
if ($taskListening) {
  $taskProcess = Get-Process -Id ($taskListening | Select-Object -First 1).OwningProcess -ErrorAction Stop
  if ($taskProcess.Path -ne $taskBinary) { throw 'Port 33079 belongs to another application; nothing was changed.' }
  Write-Output 'Local MariaDB is already running on 127.0.0.1:33079.'
  return
}
$taskArgs = @("--defaults-file=`"$(Join-Path $taskData 'my.ini')`"", '--bind-address=127.0.0.1', '--port=33079', '--skip-log-bin', "--log-error=`"$(Join-Path $taskData 'server.log')`"")
$taskProcess = Start-Process -FilePath $taskBinary -ArgumentList $taskArgs -WorkingDirectory $taskData -WindowStyle Hidden -PassThru
for ($i=0; $i -lt 50; $i++) {
  $taskProcess.Refresh()
  if ($taskProcess.HasExited) { throw "MariaDB failed to start. Read $taskData\server.log" }
  $taskClient = New-Object Net.Sockets.TcpClient
  try { $taskClient.Connect('127.0.0.1',33079); Write-Output 'Local MariaDB is ready on 127.0.0.1:33079.'; return }
  catch { Start-Sleep -Milliseconds 200 }
  finally { $taskClient.Dispose() }
}
throw 'MariaDB startup timed out; check tmp\mariadb-data-v1\server.log'
