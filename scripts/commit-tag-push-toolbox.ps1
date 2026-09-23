$ErrorActionPreference = 'Stop'
$toolboxRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $toolboxRoot

function Invoke-Git {
  param([Parameter(Position = 0, ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & git @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($Arguments -join ' ')" }
}

function Write-Utf8File {
  param([string]$Path, [string]$Content)
  [System.IO.File]::WriteAllText((Join-Path $toolboxRoot $Path), $Content, [System.Text.UTF8Encoding]::new($false))
}

function Set-ProjectVersion {
  param([string]$Version)
  & npm version $Version --no-git-tag-version --allow-same-version
  if ($LASTEXITCODE -ne 0) { throw "npm could not set version $Version" }

  $tauriPath = 'src-tauri\tauri.conf.json'
  $tauri = Get-Content -Raw $tauriPath
  $tauri = [regex]::Replace($tauri, '"version"\s*:\s*"[^"]+"', ('"version": "' + $Version + '"'), 1)
  Write-Utf8File $tauriPath $tauri

  $cargoTomlPath = 'src-tauri\Cargo.toml'
  $cargoToml = Get-Content -Raw $cargoTomlPath
  $cargoToml = [regex]::Replace($cargoToml, '(?m)^version\s*=\s*"[^"]+"', ('version = "' + $Version + '"'), 1)
  Write-Utf8File $cargoTomlPath $cargoToml

  $cargoLockPath = 'src-tauri\Cargo.lock'
  $cargoLock = Get-Content -Raw $cargoLockPath
  $cargoLock = [regex]::Replace($cargoLock, '(?ms)(\[\[package\]\]\s*\r?\nname = "toolbox"\s*\r?\nversion = ")[^"]+(")', { param($match) $match.Groups[1].Value + $Version + $match.Groups[2].Value }, 1)
  Write-Utf8File $cargoLockPath $cargoLock
}

Invoke-Git -Arguments @('rev-parse', '--is-inside-work-tree') | Out-Null
$branch = (& git branch --show-current).Trim()
$config = Get-Content -Raw 'src-tauri\tauri.conf.json' | ConvertFrom-Json
$previousTag = @(& git tag --list 'v[0-9]*' --sort=-version:refname)[0]
$previousVersion = if ($previousTag -match '^v(\d+)\.(\d+)\.(\d+)$') { [version]($Matches[1..3] -join '.') } else { [version]$config.version }
$recommendedVersion = "{0}.{1}.{2}" -f $previousVersion.Major, $previousVersion.Minor, ($previousVersion.Build + 1)

Write-Host ""
Write-Host "=== Current branch: $branch ===" -ForegroundColor Cyan
Write-Host "Previous released version: $(if ($previousTag) { $previousTag } else { 'none' })"
Write-Host "Recommended next version: $recommendedVersion" -ForegroundColor Green
Write-Host ""
& git status --short
if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git status.' }

$version = Read-Host "New version [$recommendedVersion]"
if ([string]::IsNullOrWhiteSpace($version)) { $version = $recommendedVersion }
$version = $version.Trim().TrimStart('v')
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must use X.Y.Z format, for example 0.1.13.' }
$tag = "v$version"

& git rev-parse -q --verify "refs/tags/$tag" 2>$null
if ($LASTEXITCODE -eq 0) { throw "Local tag $tag already exists. Choose a newer version." }
& git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) { throw "Remote tag $tag already exists. Choose a newer version." }

$continue = Read-Host "Press Enter to set version $version, stage, commit, tag, and push (type CANCEL to stop)"
if ($continue -ceq 'CANCEL') { Write-Host 'Cancelled. Nothing was changed.'; exit 0 }

Write-Host "`n=== Setting local version to $version ===" -ForegroundColor Cyan
Set-ProjectVersion $version

$defaultCommitMessage = 'updated at ' + (Get-Date -Format 'yyyy.MM.dd HH:mm:ss')
$commitMessage = Read-Host "Commit message [$defaultCommitMessage]"
if ([string]::IsNullOrWhiteSpace($commitMessage)) { $commitMessage = $defaultCommitMessage }

Write-Host "`n=== Creating commit ===" -ForegroundColor Cyan
Invoke-Git -Arguments @('add', '-A')
Invoke-Git -Arguments @('commit', '-m', $commitMessage)

Write-Host "`n=== Creating tag $tag ===" -ForegroundColor Cyan
Invoke-Git -Arguments @('tag', '-a', $tag, '-m', $tag)

Write-Host "`n=== Pushing branch and tag to origin ===" -ForegroundColor Cyan
Invoke-Git -Arguments @('push', 'origin', 'HEAD')
Invoke-Git -Arguments @('push', 'origin', $tag)

Write-Host "`nSuccessfully pushed branch $branch and tag $tag." -ForegroundColor Green
