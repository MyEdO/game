param([string]$Pids = '', [string]$PidsAInspecter = '', [switch]$Identites, [switch]$MemoireSeulement)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ProgressPreference = 'SilentlyContinue'
function Selectionner-Processus {
  $proprietes = @('ProcessId', 'ParentProcessId', 'CreationDate')
  if (-not $Identites -or $MemoireSeulement) { $proprietes += 'WorkingSetSize' }
  if ($Identites -or -not $MemoireSeulement) { $proprietes += 'Name' }
  if (-not $Identites -and -not $MemoireSeulement) { $proprietes += 'ExecutablePath' }
  $selection = New-Object 'System.Collections.Generic.HashSet[int]'
  if ($Pids) { foreach ($cible in $Pids.Split(',')) { [void]$selection.Add([int]$cible) } }
  Get-CimInstance Win32_Process -Property $proprietes | Where-Object { -not $Pids -or $selection.Contains([int]$_.ProcessId) }
}
$cibles = @(Selectionner-Processus)
if ($Identites -or ($MemoireSeulement -and -not $PidsAInspecter)) {
  $items = @($cibles | ForEach-Object {
    $creation = if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { '' }
    $item = @{pid=[int]$_.ProcessId;ppid=[int]$_.ParentProcessId;creation=$creation;erreurs=@($(if (-not $creation) { 'creation illisible' }))}
    if ($Identites) { $item.nom = [string]$_.Name }
    if ($MemoireSeulement) {
      if ($null -eq $_.WorkingSetSize) { $item.erreurs += 'resident illisible' }
      else { $item.residentOctets = [long]$_.WorkingSetSize; $item.metriqueMemoire = 'WorkingSet Windows' }
    }
    $item
  })
  @{utilisateur=$null;processus=$items;erreurs=@()} | ConvertTo-Json -Depth 8 -Compress
  exit 0
}
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public sealed class LectureInstable : Exception { public LectureInstable(string message) : base(message) {} }
public static class WorktreeProcess {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint rights, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int info, byte[] bytes, int size, out int length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr h,out long creation,out long exit,out long kernel,out long user);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, System.Text.StringBuilder name, ref int size);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr handle, IntPtr address, byte[] bytes, int size, out IntPtr read);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle, int info, byte[] bytes, int size, out int read);
  [DllImport("ntdll.dll")] static extern int RtlNtStatusToDosError(int status);
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h, uint milliseconds);
  static IntPtr Open(uint rights, int pid) {
    IntPtr h=OpenProcess(rights,false,pid);
    if(h==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    return h;
  }
  public static bool Exists(int pid) {
    try { using(var p=System.Diagnostics.Process.GetProcessById(pid)) { return true; } }
    catch(ArgumentException) { return false; }
  }
  public static string Owner(int pid) {
    IntPtr h=Open(0x1000,pid), token;
    try {
      if(!OpenProcessToken(h,8,out token)) throw new Win32Exception(Marshal.GetLastWin32Error());
      try {
        int length; GetTokenInformation(token,1,null,0,out length);
        byte[] bytes=new byte[length];
        if(!GetTokenInformation(token,1,bytes,length,out length)) throw new Win32Exception(Marshal.GetLastWin32Error());
        GCHandle pinned=GCHandle.Alloc(bytes,GCHandleType.Pinned);
        try { return new System.Security.Principal.SecurityIdentifier(Marshal.ReadIntPtr(pinned.AddrOfPinnedObject())).Value; }
        finally { pinned.Free(); }
      } finally { CloseHandle(token); }
    } finally { CloseHandle(h); }
  }
  public static string Image(int pid) {
    IntPtr h=Open(0x1000,pid);
    try {
      var name=new System.Text.StringBuilder(32768); int size=name.Capacity;
      if(!QueryFullProcessImageName(h,0,name,ref size)) throw new Win32Exception(Marshal.GetLastWin32Error());
      return name.ToString(0,size);
    } finally { CloseHandle(h); }
  }
  static byte[] Read(IntPtr h, long address, int size) {
    byte[] bytes = new byte[size]; IntPtr read;
    if (!ReadProcessMemory(h, new IntPtr(address), bytes, size, out read)) throw new Win32Exception(Marshal.GetLastWin32Error());
    if (read.ToInt64()!=size) throw new Win32Exception(299);
    return bytes;
  }
  static long Pointer(byte[] bytes, int offset, bool wide) { return wide ? BitConverter.ToInt64(bytes,offset) : BitConverter.ToUInt32(bytes,offset); }
  public sealed class Inspection {
    public DateTime Creation;
    public string CreationNative;
    public string Commande;
    public string Cwd;
  }
  static void Alive(IntPtr h) {
    uint status=WaitForSingleObject(h,0);
    if(status==0) throw new LectureInstable("Instance terminee pendant inspection");
    if(status!=258) throw new Win32Exception(Marshal.GetLastWin32Error());
  }
  static void Query(IntPtr h, int info, byte[] bytes, string objet) {
    int read, status=NtQueryInformationProcess(h,info,bytes,bytes.Length,out read);
    if(status!=0) throw new Win32Exception(RtlNtStatusToDosError(status), objet+" illisible");
  }
  static long Parameters(IntPtr h, out bool wide) {
    byte[] wow=new byte[8];
    Query(h,26,wow,"PEB WOW64");
    long peb=BitConverter.ToInt64(wow,0); wide=peb==0;
    if(wide) { byte[] basic=new byte[48]; Query(h,0,basic,"PEB"); peb=BitConverter.ToInt64(basic,8); }
    return Pointer(Read(h,peb+(wide?32:16),wide?8:4),0,wide);
  }
  static string UnicodeAt(IntPtr h, long parameters, int offset, bool wide) {
    byte[] unicode=Read(h,parameters+offset,wide?16:8);
    int length=BitConverter.ToUInt16(unicode,0), maximum=BitConverter.ToUInt16(unicode,2);
    long buffer=Pointer(unicode,wide?8:4,wide);
    if(length%2!=0 || length>maximum || (length>0 && buffer==0)) throw new LectureInstable("Parametre Unicode invalide");
    return length==0 ? "" : System.Text.Encoding.Unicode.GetString(Read(h,buffer,length));
  }
  public static Inspection Inspect(int pid) {
    if(IntPtr.Size!=8) throw new Exception("Lecteur PEB exige PowerShell 64 bits");
    IntPtr h=Open(0x100410,pid);
    try {
      Alive(h);
      long creation,exit,kernel,user;
      if(!GetProcessTimes(h,out creation,out exit,out kernel,out user)) throw new Win32Exception(Marshal.GetLastWin32Error());
      bool wide; long parameters=Parameters(h,out wide);
      string cwd=UnicodeAt(h,parameters,wide?56:36,wide);
      string command=UnicodeAt(h,parameters,wide?112:64,wide);
      bool afterWide; long afterParameters=Parameters(h,out afterWide);
      if(parameters!=afterParameters || wide!=afterWide || cwd!=UnicodeAt(h,parameters,wide?56:36,wide) || command!=UnicodeAt(h,parameters,wide?112:64,wide)) throw new LectureInstable("Parametres modifies pendant inspection");
      Alive(h);
      DateTime date=DateTime.FromFileTimeUtc(creation);
      return new Inspection { Creation=date, CreationNative=date.ToString("o"), Commande=command, Cwd=cwd };
    } finally { CloseHandle(h); }
  }
}
'@
function Cause([string]$champ, $erreur) {
  for ($e = $erreur.Exception; $e; $e = $e.InnerException) {
    if ($e -is [System.ComponentModel.Win32Exception]) { return "$champ illisible : [win32 $($e.NativeErrorCode)] $($e.Message)" }
    if ($e -is [LectureInstable]) { return "$champ illisible : [instable] $($e.Message)" }
  }
  "$champ illisible : $($erreur.Exception.Message)"
}
$sid = if ($MemoireSeulement) { $null } else { [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value }
$aInspecter = New-Object 'System.Collections.Generic.HashSet[int]'
if ($PidsAInspecter) { foreach ($cible in $PidsAInspecter.Split(',')) { [void]$aInspecter.Add([int]$cible) } }
$items = @()
foreach ($p in $cibles) {
  # PID 0 : learn.microsoft.com/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess (ERROR_INVALID_PARAMETER)
  if ($p.ProcessId -eq 0) { continue }
  $creation = if ($p.CreationDate) { $p.CreationDate.ToUniversalTime().ToString('o') } else { '' }
  $item = @{pid=[int]$p.ProcessId;ppid=[int]$p.ParentProcessId;nom=[string]$p.Name;image=[string]$p.ExecutablePath;creation=$creation;commande=$null;cwd=$null;proprietaire=$null;residentOctets=[long]$p.WorkingSetSize;metriqueMemoire='WorkingSet Windows';erreurs=@()}
  if ($null -eq $p.WorkingSetSize) { $item.erreurs += 'resident illisible' }
  if (-not $creation) { $item.erreurs += 'creation illisible' }
  if ($MemoireSeulement -and -not $aInspecter.Contains([int]$p.ProcessId)) {
    $items += $item
    continue
  }
  if (-not $MemoireSeulement) {
    try { $item.proprietaire = [WorktreeProcess]::Owner($p.ProcessId) }
    catch {
      if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
      $item.erreurs += Cause 'proprietaire' $_
    }
    if (-not $item.image) {
      try { $item.image = [WorktreeProcess]::Image($p.ProcessId) }
      catch {
        if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
        $item.image = $null
        $item.erreurs += Cause 'image' $_
      }
    }
  }
  try { $inspection = [WorktreeProcess]::Inspect($p.ProcessId) }
  catch {
    if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
    $inspection = $null
    $item.erreurs += (Cause 'cwd' $_), (Cause 'commande' $_)
  }
  if ($inspection -and -not $MemoireSeulement -and $p.CreationDate -and $inspection.Creation.ToString('yyyy-MM-ddTHH:mm:ss.ffffff') -ne $p.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffff')) {
    $item.erreurs += 'cwd illisible : [instable] identite modifiee pendant inspection', 'commande illisible : [instable] identite modifiee pendant inspection'
  } elseif ($inspection) {
    $item.cwd = $inspection.Cwd
    $item.commande = $inspection.Commande
    if ($MemoireSeulement) { $item.creationNative = $inspection.CreationNative }
  }
  $items += $item
}
ConvertTo-Json -InputObject @{utilisateur=$sid;processus=$items} -Depth 4 -Compress
