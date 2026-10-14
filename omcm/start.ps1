$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$pythonExe = Join-Path $backendRoot '.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonExe) -or !(Test-Path -LiteralPath (Join-Path $frontendRoot 'node_modules'))) { throw 'Run setup.ps1 first.' }
if (!(Test-Path -LiteralPath (Join-Path $backendRoot '.env'))) { Write-Host 'Demo administrator access is disabled until backend/.env has credentials. Overview and public data still work.' }
$backendProcess = $null
$frontendProcess = $null
try {
    $backendProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $backendRoot 'server.log') -RedirectStandardError (Join-Path $backendRoot 'server-error.log')
    $nodeExe = (Get-Command node).Source
    $viteEntry = Join-Path $frontendRoot 'node_modules/vite/bin/vite.js'
    $frontendProcess = Start-Process -FilePath $nodeExe -ArgumentList @("`"$viteEntry`"", '--host', '127.0.0.1', '--port', '5173', '--strictPort') -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $frontendRoot 'server.log') -RedirectStandardError (Join-Path $frontendRoot 'server-error.log')
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        if ($backendProcess.HasExited -or $frontendProcess.HasExited) { throw 'A server failed to start. Check backend/server-error.log and frontend/server-error.log; ensure ports 8000 and 5173 are free.' }
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health'
            $page = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing
            if ($health.status -eq 'ok' -and $page.StatusCode -eq 200) { break }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    if ($attempt -ge 30) { throw 'Server readiness timed out. Check server logs.' }
    Write-Host 'OMCM: http://127.0.0.1:5173'
    Write-Host 'Public dashboard: http://127.0.0.1:5173/public'
    Write-Host 'API documentation: http://127.0.0.1:8000/docs'
    Write-Host 'Keep this terminal open. Press Ctrl+C to stop both servers.'
    while (!$backendProcess.HasExited -and !$frontendProcess.HasExited) { Start-Sleep -Seconds 1 }
} finally {
    if ($frontendProcess -and !$frontendProcess.HasExited) { Stop-Process -Id $frontendProcess.Id }
    if ($backendProcess -and !$backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id }
}
