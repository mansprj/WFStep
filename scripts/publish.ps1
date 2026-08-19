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

# --- Build (may fail to publish, that's ok — we fix below) ---
try {
  npm run dist -- --publish always
} catch {
  Write-Host "electron-builder publish had errors, will fix via API..." -ForegroundColor Yellow
}

Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue

# --- Resolve version & release ---
$version = (Get-Content -LiteralPath 'package.json' | ConvertFrom-Json).version
$tag = "v$version"
Write-Host "`nChecking release $tag..." -ForegroundColor Cyan

$release = $null
try {
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/mansprj/WFStep/releases/tags/$tag" -Headers @{ Authorization = "token $token" }
} catch {
  # Release doesn't exist — create it
  Write-Host "Release $tag not found, creating..." -ForegroundColor Yellow
  $sha = (git ls-remote "https://github.com/mansprj/WFStep.git" "refs/tags/$tag").Split("`t")[0]
  if (-not $sha) {
    Write-Host "Tag $tag not found on remote. Push it first." -ForegroundColor Red
    exit 1
  }
  $body = @{ tag_name = $tag; name = $version; target_commitish = $sha } | ConvertTo-Json
  $release = Invoke-RestMethod -Uri "https://api.github.com/repos/mansprj/WFStep/releases" -Method Post -Headers @{ Authorization = "token $token"; "Content-Type" = "application/json" } -Body $body
  Write-Host "Created release id=$($release.id)" -ForegroundColor Green
}

$releaseId = $release.id
$existingNames = @($release.assets | ForEach-Object { $_.name })

# --- Map local filenames -> GitHub asset names (spaces -> hyphens) ---
$assetMap = @(
  @{ Local = "dist\wfstep Setup $version.exe";              Name = "wfstep-Setup-$version.exe" }
  @{ Local = "dist\wfstep Setup $version.exe.blockmap";     Name = "wfstep-Setup-$version.exe.blockmap" }
  @{ Local = "dist\latest.yml";                             Name = "latest.yml" }
)

$uploadBase = "https://uploads.github.com/repos/mansprj/WFStep/releases/$releaseId/assets"
$uploaded = 0

foreach ($a in $assetMap) {
  $name = $a.Name
  if ($existingNames -contains $name) {
    Write-Host "  $name already uploaded." -ForegroundColor DarkGray
    continue
  }
  if (-not (Test-Path -LiteralPath $a.Local)) {
    Write-Host "  $name not found locally at $($a.Local), skipping." -ForegroundColor Yellow
    continue
  }
  Write-Host "  Uploading $name..." -NoNewline
  $result = curl.exe -sS -X POST `
    -H "Authorization: token $token" `
    -H "Content-Type: application/octet-stream" `
    --data-binary "@$($a.Local)" `
    "$uploadBase?name=$name" | ConvertFrom-Json
  if ($result.state -eq 'uploaded') {
    Write-Host " OK ($($result.size) bytes)" -ForegroundColor Green
    $uploaded++
  } else {
    Write-Host " FAILED: $($result | ConvertTo-Json -Compress)" -ForegroundColor Red
  }
}

# --- Verify ---
$final = Invoke-RestMethod -Uri "https://api.github.com/repos/mansprj/WFStep/releases/$releaseId" -Headers @{ Authorization = "token $token" }
$finalNames = ($final.assets | ForEach-Object { $_.name }) -join ', '
Write-Host "`nRelease $tag: $finalNames" -ForegroundColor Green
Write-Host "Done. $uploaded asset(s) uploaded." -ForegroundColor Green
