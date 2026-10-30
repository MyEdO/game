param(
  [Parameter(Mandatory=$true)][string]$Node,
  [Parameter(Mandatory=$true)][string]$CommandLine,
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][guid]$SessionId,
  [Parameter(Mandatory=$true)][string]$Terminal,
  [Parameter(Mandatory=$true)][string]$JournalHote,
  [int]$TimeoutMs = 0
)
$ErrorActionPreference = 'Stop'
Remove-Item Env:WFRP_SESSION_JETON -ErrorAction SilentlyContinue
Remove-Item Env:WFRP_SESSION_REVENDICATION -ErrorAction SilentlyContinue
Remove-Item Env:CLAUDE_CODE_CHILD_SESSION -ErrorAction SilentlyContinue
$env:WFRP_SESSION_JOBHOST = [string]$PID
try {
  Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public static class SessionTerminal {
  delegate bool Handler(uint signal);
  static readonly Handler callback = OnSignal;
  static string path, contenu;
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool SetConsoleCtrlHandler(Handler handler, bool add);
  public static void Install(string destination, string json) {
    path = destination; contenu = json;
    if (!SetConsoleCtrlHandler(callback, true)) throw new System.ComponentModel.Win32Exception();
  }
  static bool OnSignal(uint signal) {
    if (signal != 2) return false;
    try {
      string temporaire = path + ".tmp";
      File.WriteAllText(temporaire, contenu);
      File.Move(temporaire, path);
    } catch { }
    return false;
  }
}
'@
  $creation = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").CreationDate.ToUniversalTime().ToString('o')
  if (-not $creation) { throw 'Identité JobHost indisponible' }
  $signal = @{sessionId=$SessionId.ToString();jobHost=@{pid=$PID;creation=$creation}} | ConvertTo-Json -Compress
  [SessionTerminal]::Install($Terminal, $signal)
  Add-Type -Path (Join-Path $PSScriptRoot '../guards/lib/processusJob.cs')
  [SessionJob]::Run($Node, $CommandLine, $Worktree, $TimeoutMs)
} catch {
  $diagnostic = '[session JobHost] ' + $_.Exception.Message
  [Console]::Error.WriteLine($diagnostic)
  try { [System.IO.File]::WriteAllText($JournalHote, $diagnostic) } catch { }
  exit 1
}
exit 0
