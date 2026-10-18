using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// https://learn.microsoft.com/windows/win32/procthread/job-objects
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
  [StructLayout(LayoutKind.Sequential)] struct MEMORY {
    public uint cb, PageFaultCount; public UIntPtr PeakWorkingSetSize, WorkingSetSize, QuotaPeakPagedPoolUsage,
      QuotaPagedPoolUsage, QuotaPeakNonPagedPoolUsage, QuotaNonPagedPoolUsage, PagefileUsage, PeakPagefileUsage;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_BASIC {
    public IntPtr Reserved1, PebBaseAddress, Reserved2a, Reserved2b, UniqueProcessId, InheritedFromUniqueProcessId;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attrs, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int info, ref EXTENDED_LIMIT value, uint size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, ref ACCOUNTING value, uint size, IntPtr length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int info, IntPtr value, uint size, out uint length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool member);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFOEX si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr list, int count, uint flags, ref IntPtr size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr list, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previous, IntPtr returned);
  [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool DuplicateHandle(IntPtr sourceProcess, IntPtr source, IntPtr targetProcess, out IntPtr target, uint access, bool inherit, uint options);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr GetStdHandle(int number);
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process, out long creation, out long exit, out long kernel, out long user);
  [DllImport("psapi.dll", SetLastError=true)] static extern bool GetProcessMemoryInfo(IntPtr process, ref MEMORY memory, uint size);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr process, int info, ref PROCESS_BASIC value, uint size, out uint returned);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateHardLink(string link, string existing, IntPtr security);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle, out uint code);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  const uint STILL = 258;
  static Exception Error(string name) { return new Win32Exception(Marshal.GetLastWin32Error(), name); }
  static long Now() { return (DateTime.UtcNow.Ticks - 621355968000000000L) / 10000; }
  static Dictionary<string, object> Obj(params object[] pairs) {
    Dictionary<string, object> value = new Dictionary<string, object>();
    for (int i = 0; i < pairs.Length; i += 2) value.Add((string)pairs[i], pairs[i+1]);
    return value;
  }
  static readonly Type JsonType = Assembly.Load("System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35").GetType("System.Web.Script.Serialization.JavaScriptSerializer");
  static readonly object Json = MakeJson();
  static object MakeJson() {
    object serializer = Activator.CreateInstance(JsonType);
    JsonType.GetProperty("MaxJsonLength").SetValue(serializer, Int32.MaxValue, null); return serializer;
  }
  static string Encode(object value) { return (string)JsonType.GetMethod("Serialize", new Type[] { typeof(object) }).Invoke(Json, new object[] { value }); }
  static Dictionary<string, object> Read(string path) {
    object value = JsonType.GetMethod("DeserializeObject").Invoke(Json, new object[] { File.ReadAllText(path, Encoding.UTF8) });
    Dictionary<string, object> result = value as Dictionary<string, object>;
    if (result == null) throw new InvalidOperationException("EPROTO objet requis");
    return result;
  }
  static Dictionary<string, object> ReadShared(string path) {
    try { return Read(path); }
    catch (IOException error) { if (error.HResult == unchecked((int)0x80070020)) return null; throw; } // #2586
  }
  static object Field(Dictionary<string, object> value, string key) {
    object result; if (!value.TryGetValue(key, out result)) throw new InvalidOperationException("EPROTO champ " + key); return result;
  }
  static string Text(Dictionary<string, object> value, string key) {
    string result = Field(value, key) as string;
    if (String.IsNullOrEmpty(result)) throw new InvalidOperationException("EPROTO texte " + key); return result;
  }
  static long Number(Dictionary<string, object> value, string key) {
    object result = Field(value, key);
    if (!(result is int) && !(result is long)) throw new InvalidOperationException("EPROTO entier " + key);
    return Convert.ToInt64(result, CultureInfo.InvariantCulture);
  }
  static void Atomic(string path, object value) {
    string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
    try { File.WriteAllText(temporary, Encode(value), new UTF8Encoding(false)); File.Move(temporary, path); }
    finally { if (File.Exists(temporary)) File.Delete(temporary); }
  }
  sealed class Instance {
    public IntPtr Handle; public int Pid, Ppid; public long Birth;
    public string Id = Guid.NewGuid().ToString("N"), Role, Entry;
    public string Creation { get { return DateTime.FromFileTimeUtc(Birth).ToString("o", CultureInfo.InvariantCulture); } }
  }
  sealed class Domain : IDisposable {
    public IntPtr Job; public Instance Host, Worker, Target;
    public string DirectoryPath, Generation; public int Delay; public bool Supervision;
    public readonly List<string> Errors = new List<string>();
    readonly Dictionary<string, Instance> instances = new Dictionary<string, Instance>();
    readonly Dictionary<int, Instance> byPid = new Dictionary<int, Instance>();
    readonly Dictionary<string, IntPtr> entries = new Dictionary<string, IntPtr>();
    readonly HashSet<string> requests = new HashSet<string>();
    bool workerRecorded;
    public Domain(string directory, int delay) {
      DirectoryPath = directory;
      Dictionary<string, object> config = Read(Path.Combine(directory, "configuration.json"));
      if (Number(config, "version") != 1 || Number(config, "delaiArretMs") != delay || delay < 1) throw new InvalidOperationException("EPROTO configuration");
      Generation = Text(config, "generation"); Delay = delay;
      Directory.CreateDirectory(Path.Combine(directory, "requetes")); Directory.CreateDirectory(Path.Combine(directory, "reponses"));
      string probe = Path.Combine(directory, "hardlink-" + Guid.NewGuid().ToString("N"));
      File.WriteAllText(probe, "1");
      try { if (!CreateHardLink(probe + ".lien", probe, IntPtr.Zero)) throw Error("EHARDLINK"); }
      finally { if (File.Exists(probe + ".lien")) File.Delete(probe + ".lien"); File.Delete(probe); }
      Host = Capture(GetCurrentProcess(), Process.GetCurrentProcess().Id, "hote", false);
    }
    Instance Capture(IntPtr handle, int pid, string role, bool owned) {
      long birth, exit, kernel, user;
      if (!GetProcessTimes(handle, out birth, out exit, out kernel, out user)) {
        Exception failure = Error("GetProcessTimes"); if (owned) CloseHandle(handle); throw failure;
      }
      Instance known;
      if (byPid.TryGetValue(pid, out known) && known.Birth == birth) {
        if (owned) CloseHandle(handle); if (role != null) known.Role = role; return known;
      }
      PROCESS_BASIC basic = new PROCESS_BASIC(); uint returned;
      if (NtQueryInformationProcess(handle, 0, ref basic, (uint)Marshal.SizeOf(basic), out returned) != 0) {
        if (owned) CloseHandle(handle); throw new InvalidOperationException("EIDENTITE NtQueryInformationProcess");
      }
      Instance instance = new Instance(); instance.Handle = handle; instance.Pid = pid;
      instance.Ppid = basic.InheritedFromUniqueProcessId.ToInt32(); instance.Birth = birth; instance.Role = role;
      instances.Add(instance.Id, instance); byPid[pid] = instance; return instance;
    }
    public void SetWorker(IntPtr handle, int pid) {
      IntPtr copy; if (!DuplicateHandle(GetCurrentProcess(), handle, GetCurrentProcess(), out copy, 0, false, 2)) throw Error("DuplicateHandle worker");
      Worker = Capture(copy, pid, "worker", true);
    }
    bool Alive(Instance instance) {
      uint waited = WaitForSingleObject(instance.Handle, 0);
      if (waited == 0xffffffff) throw Error("WaitForSingleObject instance"); return waited == STILL;
    }
    void Check(long deadline) {
      if (Closing || WorkerExited()) throw new OperationCanceledException("ECLOTURE demandée");
      if (Now() >= deadline) throw new TimeoutException("EEXPIRATION requête expirée");
    }
    public bool WorkerExited() {
      if (Worker == null || Alive(Worker)) return false;
      if (!workerRecorded) {
        workerRecorded = true; uint status;
        if (Supervision && (!GetExitCodeProcess(Worker.Handle, out status) || status != 0)) Errors.Add("EWORKER statut non nul"); // #2586
        Closure();
      }
      return true;
    }
    List<Instance> Members(long deadline) {
      int capacity = 64;
      for (;;) {
        Check(deadline);
        if (capacity > 1048576) throw new InvalidOperationException("EDOMAINE trop de processus");
        int size = checked(8 + IntPtr.Size * capacity); IntPtr memory = Marshal.AllocHGlobal(size);
        List<int> pids = new List<int>();
        try {
          uint returned;
          bool ok = QueryInformationJobObject(Job, 3, memory, (uint)size, out returned);
          int assigned = Marshal.ReadInt32(memory, 0), count = Marshal.ReadInt32(memory, 4);
          if (!ok) {
            if (Marshal.GetLastWin32Error() != 234) throw Error("JobObjectBasicProcessIdList");
            capacity = Math.Max(capacity * 2, assigned + 16); continue;
          }
          if (assigned > count || count > capacity) { capacity = Math.Max(capacity * 2, assigned + 16); continue; }
          for (int i = 0; i < count; i++) pids.Add(checked((int)Marshal.ReadIntPtr(memory, 8 + IntPtr.Size * i).ToInt64()));
        } finally { Marshal.FreeHGlobal(memory); }
        List<Instance> members = new List<Instance>();
        foreach (int pid in pids) {
          Check(deadline);
          Instance found;
          if (!byPid.TryGetValue(pid, out found) || !Alive(found)) found = null;
          if (found == null) {
            IntPtr handle = OpenProcess(0x00100000 | 0x0400 | 0x0010 | 0x0100 | 0x0001, false, pid);
            if (handle == IntPtr.Zero) { if (Marshal.GetLastWin32Error() == 87) continue; throw Error("ECAPTURE OpenProcess"); }
            bool member;
            if (!IsProcessInJob(handle, Job, out member)) { Exception failure = Error("IsProcessInJob"); CloseHandle(handle); throw failure; }
            if (!member) { CloseHandle(handle); continue; }
            found = Capture(handle, pid, null, true);
          }
          if (!Alive(found)) continue;
          foreach (KeyValuePair<string, IntPtr> entry in entries) {
            bool member; if (!IsProcessInJob(found.Handle, entry.Value, out member)) throw Error("IsProcessInJob entree");
            if (member) {
              if (found.Entry != null && found.Entry != entry.Key) throw new InvalidOperationException("EAFFECTATION conflit hérité");
              found.Entry = entry.Key;
            }
          }
          members.Add(found);
        }
        return members;
      }
    }
    object Row(Instance instance, long deadline) {
      Check(deadline);
      MEMORY memory = new MEMORY(); memory.cb = (uint)Marshal.SizeOf(memory);
      Exception failure = GetProcessMemoryInfo(instance.Handle, ref memory, memory.cb) ? null : Error("ECAPTURE GetProcessMemoryInfo");
      if (!Alive(instance)) return null;
      if (failure != null) { Check(deadline); throw failure; }
      return Obj("identifiant", instance.Id, "pid", instance.Pid, "ppid", instance.Ppid,
        "creation", instance.Creation, "residentOctets", memory.WorkingSetSize.ToUInt64(), "metriqueMemoire", "working-set",
        "etat", "vivant", "erreurs", new object[0], "role", instance.Role, "entreeId", instance.Entry);
    }
    object View(long deadline) {
      List<Instance> members = Members(deadline); List<object> rows = new List<object>(); rows.Add(Row(Host, deadline));
      foreach (Instance instance in members) { object row = Row(instance, deadline); if (row != null) rows.Add(row); }
      return Obj("processus", rows, "metriqueMemoire", "working-set");
    }
    void Assign(Dictionary<string, object> request, long deadline) {
      Check(deadline);
      string id = Text(request, "identifiant"); Instance instance;
      if (!instances.TryGetValue(id, out instance) || instance.Pid != Number(request, "pid") || instance.Creation != Text(request, "creation") || !Alive(instance))
        throw new InvalidOperationException("EIDENTITE instance non détenue ou sortie");
      Dictionary<string, object> destination = Field(request, "destination") as Dictionary<string, object>;
      if (destination == null) throw new InvalidOperationException("EPROTO destination");
      string type = Text(destination, "type");
      if (type == "parent") {
        if (instance.Entry != null || (Target != null && Target != instance) || instance == Host || instance == Worker ||
            Worker == null || !Alive(Worker) || instance.Ppid != Worker.Pid || instance.Birth < Worker.Birth)
          throw new InvalidOperationException("EAFFECTATION parent non prouvé");
        Target = instance; instance.Role = "cible"; return;
      }
      if (type != "entree" || instance.Role != null) throw new InvalidOperationException("EAFFECTATION destination");
      string entry = Text(destination, "id");
      Members(deadline);
      if (instance.Entry != null) {
        if (instance.Entry != entry) throw new InvalidOperationException("EAFFECTATION conflit"); return;
      }
      IntPtr subjob;
      if (!entries.TryGetValue(entry, out subjob)) {
        subjob = CreateJobObject(IntPtr.Zero, null); if (subjob == IntPtr.Zero) throw Error("CreateJobObject entree"); entries.Add(entry, subjob);
      }
      if (!AssignProcessToJobObject(subjob, instance.Handle)) throw Error("AssignProcessToJobObject entree");
      instance.Entry = entry;
    }
    public void Requests() {
      foreach (string path in Directory.GetFiles(Path.Combine(DirectoryPath, "requetes"), "*.json")) {
        string name = Path.GetFileNameWithoutExtension(path); if (!requests.Add(name)) continue;
        Dictionary<string, object> response = Obj("version", 1, "generation", Generation, "id", name);
        try {
          Dictionary<string, object> request = ReadShared(path);
          if (request == null) { requests.Remove(name); continue; }
          if (Number(request, "version") != 1 || Text(request, "generation") != Generation || Text(request, "id") != name) throw new InvalidOperationException("EPROTO requête");
          long deadline = Number(request, "echeance");
          if (Now() >= deadline) throw new TimeoutException("EEXPIRATION requête expirée");
          string operation = Text(request, "operation");
          if (operation == "vue") response.Add("vue", View(deadline));
          else if (operation == "attribuer") Assign(request, deadline);
          else throw new InvalidOperationException("EPROTO opération");
          Check(deadline);
          response.Add("ok", true);
        } catch (Exception error) {
          response.Remove("vue"); response["ok"] = false;
          string code = error is TimeoutException ? "EXPIRATION" : error is OperationCanceledException ? "FERMETURE" : "ECONTROLE";
          response["error"] = Obj("code", code, "message", error.Message);
          if (!(error is TimeoutException) && !(error is OperationCanceledException)) Errors.Add(error.Message);
        }
        Atomic(Path.Combine(DirectoryPath, "reponses", name + ".json"), response);
        if (Errors.Count != 0 || Closing) return;
      }
    }
    public long Closure() {
      string path = Path.Combine(DirectoryPath, "cloture.json");
      if (!File.Exists(path)) {
        string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try {
          File.WriteAllText(temporary, Encode(Obj("version", 1, "generation", Generation, "echeance", Now() + Delay)), new UTF8Encoding(false));
          if (!CreateHardLink(path, temporary, IntPtr.Zero) && Marshal.GetLastWin32Error() != 183) throw Error("ECLOTURE CreateHardLink");
        } finally { if (File.Exists(temporary)) File.Delete(temporary); }
      }
      Dictionary<string, object> closure = Read(path);
      if (Number(closure, "version") != 1 || Text(closure, "generation") != Generation) throw new InvalidOperationException("ECLOTURE incohérente");
      long deadline = Number(closure, "echeance");
      if (deadline < 1 || deadline > Now() + Delay + 1000) throw new InvalidOperationException("ECLOTURE échéance");
      return deadline;
    }
    public bool Closing { get { return File.Exists(Path.Combine(DirectoryPath, "cloture.json")); } }
    public void Finish() {
      bool zero = false; long deadline = 0;
      try { deadline = Closure(); } catch (Exception error) { Errors.Add(error.Message); }
      if (Job != IntPtr.Zero) {
        if (!TerminateJobObject(Job, 0)) Errors.Add(Error("TerminateJobObject").Message);
        for (;;) {
          ACCOUNTING accounting = new ACCOUNTING();
          if (!QueryInformationJobObject(Job, 1, ref accounting, (uint)Marshal.SizeOf(accounting), IntPtr.Zero)) { Errors.Add(Error("QueryInformationJobObject").Message); break; }
          if (accounting.ActiveProcesses == 0) { zero = deadline > 0 && Now() <= deadline; break; }
          if (Now() >= deadline) break; Thread.Sleep(2);
        }
      } else zero = deadline > 0 && Now() <= deadline;
      if (!zero) Errors.Add("ECLOTURE zéro absent dans échéance");
      Atomic(Path.Combine(DirectoryPath, "certificat.json"), Obj("version", 1, "generation", Generation, "methode", "job-windows", "zero", zero, "echeance", deadline, "erreurs", Errors));
      if (!zero || Errors.Count != 0) throw new InvalidOperationException("ECLOTURE " + String.Join("; ", Errors.ToArray()));
    }
    public void Dispose() {
      foreach (Instance instance in instances.Values) if (instance != Host) CloseHandle(instance.Handle);
      foreach (IntPtr subjob in entries.Values) CloseHandle(subjob);
    }
  }
  public static void Run(string node, string command, string cwd, int timeout) {
    string directory = Path.Combine(Path.GetTempPath(), "session-job-" + Guid.NewGuid().ToString("N"));
    Directory.CreateDirectory(directory);
    try {
      Atomic(Path.Combine(directory, "configuration.json"), Obj("version", 1, "generation", Guid.NewGuid().ToString("N"), "delaiArretMs", 2000));
      Run(node, command, cwd, timeout, 0, directory, 2000);
    } finally { Directory.Delete(directory, true); }
  }
  public static void Run(string node, string command, string cwd, int timeout, int parentPid, string controlDirectory, int delaiArretMs) {
    IntPtr job = IntPtr.Zero, parent = IntPtr.Zero, list = IntPtr.Zero, jobs = IntPtr.Zero, handles = IntPtr.Zero;
    IntPtr[] standards = new IntPtr[3]; PROCESS_INFORMATION pi = new PROCESS_INFORMATION(); bool initialized = false;
    Domain domain = null;
    try {
      domain = new Domain(controlDirectory, delaiArretMs);
      domain.Supervision = parentPid > 0;
      if (parentPid > 0) {
        parent = OpenProcess(0x00100000 | 0x0400, false, parentPid); if (parent == IntPtr.Zero) throw Error("EPARENT OpenProcess");
        long birth, exit, kernel, user;
        if (!GetProcessTimes(parent, out birth, out exit, out kernel, out user) || birth > domain.Host.Birth || WaitForSingleObject(parent, 0) != STILL)
          throw new InvalidOperationException("EPARENT parent disparu");
      }
      job = CreateJobObject(IntPtr.Zero, null); if (job == IntPtr.Zero) throw Error("CreateJobObject"); domain.Job = job;
      EXTENDED_LIMIT limit = new EXTENDED_LIMIT(); limit.BasicLimitInformation.LimitFlags = 0x00002000;
      if (!SetInformationJobObject(job, 9, ref limit, (uint)Marshal.SizeOf(limit))) throw Error("SetInformationJobObject");
      IntPtr size = IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size); list = Marshal.AllocHGlobal(size);
      if (!InitializeProcThreadAttributeList(list, 2, 0, ref size)) throw Error("InitializeProcThreadAttributeList"); initialized = true;
      jobs = Marshal.AllocHGlobal(IntPtr.Size); Marshal.WriteIntPtr(jobs, job);
      if (!UpdateProcThreadAttribute(list, 0, new IntPtr(0x0002000D), jobs, new IntPtr(IntPtr.Size), IntPtr.Zero, IntPtr.Zero)) throw Error("PROC_THREAD_ATTRIBUTE_JOB_LIST");
      handles = Marshal.AllocHGlobal(IntPtr.Size * 3);
      for (int i = 0; i < 3; i++) {
        if (!DuplicateHandle(GetCurrentProcess(), GetStdHandle(-10 - i), GetCurrentProcess(), out standards[i], 0, true, 2)) throw Error("DuplicateHandle standard");
        Marshal.WriteIntPtr(handles, IntPtr.Size * i, standards[i]);
      }
      if (!UpdateProcThreadAttribute(list, 0, new IntPtr(0x00020002), handles, new IntPtr(IntPtr.Size * 3), IntPtr.Zero, IntPtr.Zero)) throw Error("PROC_THREAD_ATTRIBUTE_HANDLE_LIST");
      STARTUPINFOEX si = new STARTUPINFOEX(); si.StartupInfo.cb = (uint)Marshal.SizeOf(si); si.lpAttributeList = list; si.StartupInfo.dwFlags = 0x00000100;
      si.StartupInfo.hStdInput = standards[0]; si.StartupInfo.hStdOutput = standards[1]; si.StartupInfo.hStdError = standards[2];
      if (!CreateProcess(node, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero, true, 0x00080000, IntPtr.Zero, cwd, ref si, out pi)) throw Error("CreateProcess");
      domain.SetWorker(pi.hProcess, checked((int)pi.dwProcessId)); Stopwatch elapsed = Stopwatch.StartNew();
      for (;;) {
        if (domain.Closing) break;
        if (parent != IntPtr.Zero && WaitForSingleObject(parent, 0) != STILL) { domain.Errors.Add("EPARENT parent disparu"); break; }
        if (timeout > 0 && elapsed.ElapsedMilliseconds >= timeout) { domain.Errors.Add("ETIMEDOUT Node controller timeout"); break; }
        if (domain.WorkerExited()) break;
        domain.Requests(); if (domain.Errors.Count > 0) break;
        uint waited = WaitForSingleObject(pi.hProcess, 5); if (waited == 0xffffffff) throw Error("WaitForSingleObject");
        if (waited == 0) { domain.WorkerExited(); break; }
      }
    } catch (Exception error) { if (domain != null) domain.Errors.Add(error.Message); throw; }
    finally {
      try { if (domain != null) domain.Finish(); }
      finally {
        if (domain != null) domain.Dispose();
        if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread); if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
        foreach (IntPtr handle in standards) if (handle != IntPtr.Zero) CloseHandle(handle);
        if (initialized) DeleteProcThreadAttributeList(list); if (list != IntPtr.Zero) Marshal.FreeHGlobal(list);
        if (jobs != IntPtr.Zero) Marshal.FreeHGlobal(jobs); if (handles != IntPtr.Zero) Marshal.FreeHGlobal(handles);
        if (parent != IntPtr.Zero) CloseHandle(parent); if (job != IntPtr.Zero) CloseHandle(job);
      }
    }
  }
}
