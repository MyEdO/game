param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][string]$CommandLine,
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][int]$ParentPid,
  [Parameter(Mandatory=$true)][string]$StopFile
)
$ErrorActionPreference = 'Stop'
try {
  Add-Type -Path (Join-Path $PSScriptRoot 'processusJob.cs')
  [SessionJob]::Run($Node, $CommandLine, $Worktree, 0, $ParentPid, $StopFile)
  exit 0
} catch {
  try { [Console]::Error.WriteLine('[supervision hôte] ' + $_.Exception.Message) } catch {}
  exit 70
}
