$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (!(Test-Path -LiteralPath 'backend/.venv/Scripts/python.exe')) { python -m venv backend/.venv; if ($LASTEXITCODE -ne 0) { throw 'Python virtual environment creation failed.' } }
& backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
if (!(Test-Path -LiteralPath 'backend/.env')) {
    $demoName = Read-Host 'Choose a demo administrator username'
    if ([string]::IsNullOrWhiteSpace($demoName) -or $demoName -notmatch '^[a-zA-Z0-9_.-]+$') { throw 'Use letters, numbers, underscore, dot, or dash for the username.' }
    $securePassword = Read-Host 'Choose a demo password (at least 12 characters)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try { $demoPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($demoPassword.Length -lt 12 -or $demoPassword.Contains("`n") -or $demoPassword.Contains("`r")) { throw 'Password must have at least 12 characters and no newlines.' }
    # dotenv single-quoted strings preserve symbols; quote and slash escapes explicitly.
    $escapedPassword = $demoPassword.Replace('\', '\\').Replace("'", "\'")
    @("OMCM_DEMO_AUTH=true", "OMCM_ADMIN_USERNAME=$demoName", "OMCM_ADMIN_PASSWORD='$escapedPassword'", 'OMCM_DATABASE_PATH=omcm.db', 'OMCM_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173') | Set-Content -LiteralPath backend/.env -Encoding UTF8
    $demoPassword = $null
    $escapedPassword = $null
}
Push-Location frontend
try {
    # Node 24 can use trusted Windows certificates without disabling TLS verification.
    $env:NODE_USE_SYSTEM_CA = '1'
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
Write-Host 'Setup complete. Run start.ps1 to launch OMCM.'
