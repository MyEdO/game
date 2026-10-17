param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][string]$CommandLine,
  [Parameter(Mandatory=$true)][string]$Worktree,
  [int]$TimeoutMs = 0
)
$ErrorActionPreference = 'Stop'
Remove-Item Env:WFRP_SESSION_JETON -ErrorAction SilentlyContinue
Remove-Item Env:WFRP_SESSION_REVENDICATION -ErrorAction SilentlyContinue
Remove-Item Env:CLAUDE_CODE_CHILD_SESSION -ErrorAction SilentlyContinue
$env:WFRP_SESSION_JOBHOST = [string]$PID
try {
  Add-Type -Path (Join-Path $PSScriptRoot '../guards/lib/processusJob.cs')
  [SessionJob]::Run($Node, $CommandLine, $Worktree, $TimeoutMs)
} catch {
  [Console]::Error.WriteLine('[session JobHost] ' + $_.Exception.Message)
}
exit 0
