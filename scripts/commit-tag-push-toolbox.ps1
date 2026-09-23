$ErrorActionPreference = 'Stop'
$toolboxRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $toolboxRoot

function Invoke-Git {
  param([Parameter(Position = 0, ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & git @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Git command failed: git $($Arguments -join ' ')" }
}

Invoke-Git -Arguments @('rev-parse', '--is-inside-work-tree') | Out-Null
$branch = (& git branch --show-current).Trim()
$config = Get-Content -Raw 'src-tauri\tauri.conf.json' | ConvertFrom-Json
$previousTag = @(& git tag --list 'v[0-9]*' --sort=-version:refname)[0]
$recommendedTag = "v$($config.version)"

Write-Host ""
Write-Host "=== Current branch: $branch ===" -ForegroundColor Cyan
Write-Host "Previous released version: $(if ($previousTag) { $previousTag } else { 'none' })"
Write-Host "Recommended tag: $recommendedTag" -ForegroundColor Green
Write-Host ""
& git status --short
if ($LASTEXITCODE -ne 0) { throw 'Unable to read Git status.' }

$continue = Read-Host "Press Enter to stage, commit, tag, and push (type CANCEL to stop)"
if ($continue -ceq 'CANCEL') { Write-Host 'Cancelled. Nothing was changed.'; exit 0 }

$defaultCommitMessage = 'updated at ' + (Get-Date -Format 'yyyy.MM.dd HH:mm:ss')
$commitMessage = Read-Host "Commit message [$defaultCommitMessage]"
if ([string]::IsNullOrWhiteSpace($commitMessage)) { $commitMessage = $defaultCommitMessage }

$tag = Read-Host "Tag name [$recommendedTag]"
if ([string]::IsNullOrWhiteSpace($tag)) { $tag = $recommendedTag }

& git rev-parse -q --verify "refs/tags/$tag" 2>$null
if ($LASTEXITCODE -eq 0) { throw "Local tag $tag already exists. Choose a new tag name." }
& git ls-remote --exit-code --tags origin "refs/tags/$tag" *> $null
if ($LASTEXITCODE -eq 0) { throw "Remote tag $tag already exists. Choose a new tag name." }

Write-Host "`n=== Creating commit ===" -ForegroundColor Cyan
Invoke-Git -Arguments @('add', '-A')
Invoke-Git -Arguments @('commit', '-m', $commitMessage)

Write-Host "`n=== Creating tag $tag ===" -ForegroundColor Cyan
Invoke-Git -Arguments @('tag', '-a', $tag, '-m', $tag)

Write-Host "`n=== Pushing branch and tag to origin ===" -ForegroundColor Cyan
Invoke-Git -Arguments @('push', 'origin', 'HEAD')
Invoke-Git -Arguments @('push', 'origin', $tag)

Write-Host "`nSuccessfully pushed branch $branch and tag $tag." -ForegroundColor Green
