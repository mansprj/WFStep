# Publishes the app: builds the installer and uploads it to GitHub Releases.
# Handles electron-builder's duplicate-artifact bug by falling back to API uploads.
# The token is taken from (priority):
#   1. the GH_TOKEN env var, or
#   2. the file ~/.gh-token (just the token, nothing else)
#   3. an interactive masked prompt
# It is validated BEFORE building and never stored in the repo.

$ErrorActionPreference = 'Stop'

$token = $null
if (-not $env:GH_TOKEN) {
  $tokenFile = Get-ChildItem -LiteralPath $HOME -Filter '.gh-token*' -File -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($tokenFile) {
    $token = (Get-Content -LiteralPath $tokenFile.FullName -Raw).Trim()
  }
}
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = $env:GH_TOKEN
}
if ([string]::IsNullOrWhiteSpace($token)) {
  $secure = Read-Host 'GitHub token (starts with ghp_ or github_pat_)' -AsSecureString
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $token = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$token = $token.Trim()
$env:GH_TOKEN = $token

if ($token -notmatch '^(ghp_|github_pat_)[A-Za-z0-9_]+$') {
  Write-Host ''
  Write-Host "BAD TOKEN: got $($token.Length) characters, starts with: $($token.Substring(0, [Math]::Min(8, $token.Length)))" -ForegroundColor Red
  Write-Host 'The token must start with ghp_ or github_pat_ and contain only letters, digits and underscores.' -ForegroundColor Red
  Write-Host 'Tip: create C:\Users\Asus\.gh-token in Notepad containing ONLY the token, then run this script again.' -ForegroundColor Red
  exit 1
}

try {
  npm run dist -- --publish always
} finally {
  Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
}

# --- Fallback: check if latest.yml was uploaded, fix if not ---
$version = (Get-Content -LiteralPath 'package.json' | ConvertFrom-Json).version
$tag = "v$version"
Write-Host "`nChecking release $tag for missing assets..." -ForegroundColor Cyan

$release = $null
try {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/mansprj/WFStep/releases/tags/$tag" -Headers @{ Authorization = "token $token" }
} catch {
  Write-Host "Release $tag not found on GitHub, skipping fallback." -ForegroundColor Yellow
  exit 0
}

$assets = @($release.assets | ForEach-Object { $_.name })
$releaseId = $release.id

$missing = @()
if ($assets -notcontains 'latest.yml')       { $missing += 'latest.yml' }
if ($assets -notcontains 'latest.yml.blockmap') { $missing += 'latest.yml.blockmap' }

if ($missing.Count -eq 0) {
  Write-Host "All assets present for $tag." -ForegroundColor Green
  exit 0
}

Write-Host "Missing: $($missing -join ', '). Uploading via API..." -ForegroundColor Yellow

$uploadBase = "https://uploads.github.com/repos/mansprj/WFStep/releases/$releaseId/assets"

foreach ($name in $missing) {
  $filePath = "dist\$name"
  if (-not (Test-Path -LiteralPath $filePath)) {
    Write-Host "  $name not found locally at $filePath, skipping." -ForegroundColor Yellow
    continue
  }
  Write-Host "  Uploading $name..." -NoNewline
  $result = & curl.exe -sS -X POST `
    -H "Authorization: token $token" `
    -H "Content-Type: application/octet-stream" `
    --data-binary "@$filePath" `
    "$uploadBase?name=$name" | ConvertFrom-Json
  if ($result.state -eq 'uploaded') {
    Write-Host " OK ($($result.size) bytes)" -ForegroundColor Green
  } else {
    Write-Host " FAILED: $($result | ConvertTo-Json -Compress)" -ForegroundColor Red
  }
}

Write-Host "`nRelease $tag published successfully." -ForegroundColor Green
