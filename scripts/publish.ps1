# Publishes the app: builds the installer and uploads it to GitHub Releases.
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
  if ($LASTEXITCODE -ne 0) {
    throw "Publish failed with exit code $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
}
