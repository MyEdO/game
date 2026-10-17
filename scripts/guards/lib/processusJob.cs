using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// https://learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
public static class SessionJob {
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO {
    public uint cb; public string lpReserved, lpDesktop, lpTitle;
    public uint dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public ushort wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX { public STARTUPINFO StartupInfo; public IntPtr lpAttributeList; }
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
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFOEX si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool DuplicateHandle(IntPtr sourceProcess, IntPtr source, IntPtr targetProcess, out IntPtr target, uint access, bool inherit, uint options);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int number);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  static Exception Error(string name) { return new Win32Exception(Marshal.GetLastWin32Error(), name); }

  public static void Run(string node, string command, string cwd, int timeout) {
    Run(node, command, cwd, timeout, 0, null);
  }

  public static void Run(string node, string command, string cwd, int timeout, int parentPid, string stopFile) {
    IntPtr job = IntPtr.Zero, parent = IntPtr.Zero, list = IntPtr.Zero, jobs = IntPtr.Zero, handles = IntPtr.Zero;
    IntPtr[] standards = new IntPtr[3];
    PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
    bool initialized = false;
    try {
      if (parentPid > 0) {
        parent = OpenProcess(0x00100000, false, parentPid);
        if (parent == IntPtr.Zero) throw Error("EPARENT OpenProcess");
        if (Process.GetProcessById(parentPid).StartTime.ToUniversalTime() > Process.GetCurrentProcess().StartTime.ToUniversalTime() || WaitForSingleObject(parent, 0) != 258)
          throw new InvalidOperationException("EPARENT parent disparu");
      }
      job = CreateJobObject(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw Error("CreateJobObject");
      EXTENDED_LIMIT limit = new EXTENDED_LIMIT(); limit.BasicLimitInformation.LimitFlags = 0x00002000;
      if (!SetInformationJobObject(job, 9, ref limit, (uint)Marshal.SizeOf(limit))) throw Error("SetInformationJobObject");
      IntPtr size = IntPtr.Zero;
      InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
      list = Marshal.AllocHGlobal(size);
      if (!InitializeProcThreadAttributeList(list, 2, 0, ref size)) throw Error("InitializeProcThreadAttributeList");
      initialized = true;
      jobs = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobs, job);
      if (!UpdateProcThreadAttribute(list, 0, new IntPtr(0x0002000D), jobs, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero)) throw Error("PROC_THREAD_ATTRIBUTE_JOB_LIST");
      handles = Marshal.AllocHGlobal(IntPtr.Size * 3);
      for (int i = 0; i < 3; i++) {
        if (!DuplicateHandle(GetCurrentProcess(), GetStdHandle(-10 - i), GetCurrentProcess(), out standards[i], 0, true, 2)) throw Error("DuplicateHandle standard");
        Marshal.WriteIntPtr(handles, IntPtr.Size * i, standards[i]);
      }
      if (!UpdateProcThreadAttribute(list, 0, new IntPtr(0x00020002), handles, new IntPtr(IntPtr.Size * 3), IntPtr.Zero, IntPtr.Zero)) throw Error("PROC_THREAD_ATTRIBUTE_HANDLE_LIST");
      STARTUPINFOEX si = new STARTUPINFOEX(); si.StartupInfo.cb = (uint)Marshal.SizeOf(si);
      si.lpAttributeList = list; si.StartupInfo.dwFlags = 0x00000100;
      si.StartupInfo.hStdInput = standards[0]; si.StartupInfo.hStdOutput = standards[1]; si.StartupInfo.hStdError = standards[2];
      if (!CreateProcess(node, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero, true, 0x00080000, IntPtr.Zero, cwd, ref si, out pi)) throw Error("CreateProcess");
      Stopwatch elapsed = Stopwatch.StartNew();
      for (;;) {
        if (parent != IntPtr.Zero && WaitForSingleObject(parent, 0) != 258) throw new InvalidOperationException("EPARENT parent disparu");
        if (stopFile != null && File.Exists(stopFile)) throw new OperationCanceledException("EINTR arrêt demandé");
        if (timeout > 0 && elapsed.ElapsedMilliseconds >= timeout) throw new TimeoutException("Node controller timeout");
        uint waited = WaitForSingleObject(pi.hProcess, 20);
        if (waited == 0xffffffff) throw Error("WaitForSingleObject");
        if (waited == 0) break;
      }
    } finally {
      try {
        if (job != IntPtr.Zero) {
          if (!TerminateJobObject(job, 0)) throw Error("TerminateJobObject");
          Stopwatch cleanup = Stopwatch.StartNew();
          for (;;) {
            ACCOUNTING accounting = new ACCOUNTING();
            if (!QueryInformationJobObject(job, 1, ref accounting, (uint)Marshal.SizeOf(accounting), IntPtr.Zero)) throw Error("QueryInformationJobObject");
            if (accounting.ActiveProcesses == 0) break;
            if (cleanup.ElapsedMilliseconds >= 5000) throw new TimeoutException("ECLEANUP ActiveProcesses non nul");
            Thread.Sleep(10);
          }
        }
      } finally {
        if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
        if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
        foreach (IntPtr handle in standards) if (handle != IntPtr.Zero) CloseHandle(handle);
        if (initialized) DeleteProcThreadAttributeList(list);
        if (list != IntPtr.Zero) Marshal.FreeHGlobal(list);
        if (jobs != IntPtr.Zero) Marshal.FreeHGlobal(jobs);
        if (handles != IntPtr.Zero) Marshal.FreeHGlobal(handles);
        if (parent != IntPtr.Zero) CloseHandle(parent);
        if (job != IntPtr.Zero) CloseHandle(job);
      }
    }
  }
}
