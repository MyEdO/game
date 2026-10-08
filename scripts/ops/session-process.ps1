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
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class SessionJob {
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO {
    public uint cb; public string lpReserved, lpDesktop, lpTitle;
    public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public ushort wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public uint dwProcessId, dwThreadId; }
  [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT {
    public long PerProcessUserTimeLimit, PerJobUserTimeLimit; public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize; public uint ActiveProcessLimit;
    public UIntPtr Affinity; public uint PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong a,b,c,d,e,f; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT {
    public BASIC_LIMIT BasicLimitInformation; public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
  }
  [StructLayout(LayoutKind.Sequential)] struct ACCOUNTING {
    public long TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
    public uint TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref EXTENDED_LIMIT value, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, ref ACCOUNTING value, uint size, IntPtr length);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  static Exception Error(string name) { return new Win32Exception(Marshal.GetLastWin32Error(), name); }
  public static void Run(string node, string command, string cwd, int timeout) {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) throw Error("CreateJobObject");
    PROCESS_INFORMATION pi = new PROCESS_INFORMATION(); bool assigned = false;
    try {
      EXTENDED_LIMIT limit = new EXTENDED_LIMIT(); limit.BasicLimitInformation.LimitFlags = 0x00002000;
      if (!SetInformationJobObject(job, 9, ref limit, (uint)Marshal.SizeOf(limit))) throw Error("SetInformationJobObject");
      STARTUPINFO si = new STARTUPINFO(); si.cb = (uint)Marshal.SizeOf(si);
      if (!CreateProcess(node, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero, false, 0x00000004, IntPtr.Zero, cwd, ref si, out pi)) throw Error("CreateProcess");
      if (!AssignProcessToJobObject(job, pi.hProcess)) throw Error("AssignProcessToJobObject");
      assigned = true;
      if (ResumeThread(pi.hThread) == 0xffffffff) throw Error("ResumeThread");
      uint waited = WaitForSingleObject(pi.hProcess, timeout > 0 ? (uint)timeout : 0xffffffff);
      if (waited == 0xffffffff) throw Error("WaitForSingleObject");
      if (waited == 258) throw new TimeoutException("Node controller timeout");
    } finally {
      try {
      if (pi.hProcess != IntPtr.Zero && !assigned) {
        TerminateProcess(pi.hProcess, 1);
        WaitForSingleObject(pi.hProcess, 0xffffffff);
      }
      if (assigned) {
        if (!TerminateJobObject(job, 0)) throw Error("TerminateJobObject");
        if (pi.hProcess != IntPtr.Zero) WaitForSingleObject(pi.hProcess, 0xffffffff);
        ACCOUNTING accounting = new ACCOUNTING();
        for (;;) {
          if (!QueryInformationJobObject(job, 1, ref accounting, (uint)Marshal.SizeOf(accounting), IntPtr.Zero)) throw Error("QueryInformationJobObject");
          if (accounting.ActiveProcesses == 0) break;
          Thread.Sleep(10);
        }
      }
      } finally {
      if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
      if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
      CloseHandle(job);
      }
    }
  }
}
'@
  [SessionJob]::Run($Node, $CommandLine, $Worktree, $TimeoutMs)
} catch {
  [Console]::Error.WriteLine('[session JobHost] ' + $_.Exception.Message)
}
exit 0
