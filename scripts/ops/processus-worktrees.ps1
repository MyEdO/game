param([string]$Pids = '', [string]$PidsAInspecter = '', [switch]$Identites, [switch]$MemoireSeulement)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ProgressPreference = 'SilentlyContinue'
function Selectionner-Processus {
  $proprietes = @('ProcessId', 'ParentProcessId', 'CreationDate')
  if (-not $Identites -or $MemoireSeulement) { $proprietes += 'WorkingSetSize' }
  if ($Identites -or -not $MemoireSeulement) { $proprietes += 'Name' }
  if ((-not $Identites -and -not $MemoireSeulement) -or ($MemoireSeulement -and $PidsAInspecter)) { $proprietes += 'CommandLine' }
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
using System.Runtime.InteropServices;
public static class WorktreeProcess {
  [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint rights, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
  [DllImport("advapi32.dll", SetLastError=true)] static extern bool GetTokenInformation(IntPtr token, int info, byte[] bytes, int size, out int length);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr h,out long creation,out long exit,out long kernel,out long user);
  public static bool Exists(int pid) {
    try { using(var p=System.Diagnostics.Process.GetProcessById(pid)) { return true; } }
    catch(ArgumentException) { return false; }
  }
  public static long Creation(int pid) {
    IntPtr h=OpenProcess(0x1000,false,pid);
    if(h==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      long creation,exit,kernel,user;
      if(!GetProcessTimes(h,out creation,out exit,out kernel,out user)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      return creation;
    } finally { CloseHandle(h); }
  }
  public static string Owner(int pid) {
    IntPtr h=OpenProcess(0x1000,false,pid), token;
    if(h==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      if(!OpenProcessToken(h,8,out token)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        int length; GetTokenInformation(token,1,null,0,out length);
        byte[] bytes=new byte[length];
        if(!GetTokenInformation(token,1,bytes,length,out length)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        GCHandle pinned=GCHandle.Alloc(bytes,GCHandleType.Pinned);
        try { return new System.Security.Principal.SecurityIdentifier(Marshal.ReadIntPtr(pinned.AddrOfPinnedObject())).Value; }
        finally { pinned.Free(); }
      } finally { CloseHandle(token); }
    } finally { CloseHandle(h); }
  }
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool ReadProcessMemory(IntPtr handle, IntPtr address, byte[] bytes, int size, out IntPtr read);
  [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle, int info, byte[] bytes, int size, out int read);
  static byte[] Read(IntPtr h, long address, int size) {
    byte[] bytes = new byte[size]; IntPtr read;
    if (!ReadProcessMemory(h, new IntPtr(address), bytes, size, out read) || read.ToInt64()!=size)
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    return bytes;
  }
  static long Pointer(byte[] bytes, int offset, bool wide) { return wide ? BitConverter.ToInt64(bytes,offset) : BitConverter.ToUInt32(bytes,offset); }
  [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr h, uint milliseconds);
  public sealed class Inspection {
    public string CreationNative;
    public string Commande;
    public string Cwd;
  }
  static void Alive(IntPtr h) {
    uint status=WaitForSingleObject(h,0);
    if(status==0) throw new Exception("Instance terminee pendant inspection");
    if(status!=258) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
  static long Parameters(IntPtr h, out bool wide) {
    int read; byte[] wow=new byte[8];
    if(NtQueryInformationProcess(h,26,wow,8,out read)!=0) throw new Exception("PEB WOW64 illisible");
    long peb=BitConverter.ToInt64(wow,0); wide=peb==0;
    if(wide) { byte[] basic=new byte[48]; if(NtQueryInformationProcess(h,0,basic,48,out read)!=0) throw new Exception("PEB illisible"); peb=BitConverter.ToInt64(basic,8); }
    return Pointer(Read(h,peb+(wide?32:16),wide?8:4),0,wide);
  }
  static string UnicodeAt(IntPtr h, long parameters, int offset, bool wide) {
    byte[] unicode=Read(h,parameters+offset,wide?16:8);
    int length=BitConverter.ToUInt16(unicode,0), maximum=BitConverter.ToUInt16(unicode,2);
    long buffer=Pointer(unicode,wide?8:4,wide);
    if(length%2!=0 || length>maximum || (length>0 && buffer==0)) throw new Exception("Parametre Unicode invalide");
    return length==0 ? "" : System.Text.Encoding.Unicode.GetString(Read(h,buffer,length));
  }
  public static Inspection Inspect(int pid) {
    if(IntPtr.Size!=8) throw new Exception("Lecteur PEB exige PowerShell 64 bits");
    IntPtr h=OpenProcess(0x100410,false,pid);
    if(h==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      Alive(h);
      long creation,exit,kernel,user;
      if(!GetProcessTimes(h,out creation,out exit,out kernel,out user)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      bool wide; long parameters=Parameters(h,out wide);
      string cwd=UnicodeAt(h,parameters,wide?56:36,wide);
      string command=UnicodeAt(h,parameters,wide?112:64,wide);
      bool afterWide; long afterParameters=Parameters(h,out afterWide);
      if(parameters!=afterParameters || wide!=afterWide || cwd!=UnicodeAt(h,parameters,wide?56:36,wide) || command!=UnicodeAt(h,parameters,wide?112:64,wide)) throw new Exception("Parametres modifies pendant inspection");
      Alive(h);
      return new Inspection { CreationNative=DateTime.FromFileTimeUtc(creation).ToString("o"), Commande=command, Cwd=cwd };
    } finally { CloseHandle(h); }
  }
  public static string Cwd(int pid) {
    if (IntPtr.Size != 8) throw new Exception("Lecteur PEB exige PowerShell 64 bits");
    IntPtr h=OpenProcess(0x410,false,pid);
    if(h==IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      int read; byte[] wow=new byte[8];
      if(NtQueryInformationProcess(h,26,wow,8,out read)!=0) throw new Exception("PEB WOW64 illisible");
      long peb=BitConverter.ToInt64(wow,0); bool wide=peb==0;
      if(wide) { byte[] basic=new byte[48]; if(NtQueryInformationProcess(h,0,basic,48,out read)!=0) throw new Exception("PEB illisible"); peb=BitConverter.ToInt64(basic,8); }
      long parameters=Pointer(Read(h,peb+(wide?32:16),wide?8:4),0,wide);
      byte[] unicode=Read(h,parameters+(wide?56:36),wide?16:8);
      int length=BitConverter.ToUInt16(unicode,0); long buffer=Pointer(unicode,wide?8:4,wide);
      return length==0 ? "" : System.Text.Encoding.Unicode.GetString(Read(h,buffer,length));
    } finally { CloseHandle(h); }
  }
}
'@
$sid = if ($MemoireSeulement) { $null } else { [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value }
$aInspecter = New-Object 'System.Collections.Generic.HashSet[int]'
if ($PidsAInspecter) { foreach ($cible in $PidsAInspecter.Split(',')) { [void]$aInspecter.Add([int]$cible) } }
$items = @()
foreach ($p in $cibles) {
  $creation = if ($p.CreationDate) { $p.CreationDate.ToUniversalTime().ToString('o') } else { '' }
  $item = @{pid=[int]$p.ProcessId;ppid=[int]$p.ParentProcessId;nom=[string]$p.Name;image=[string]$p.ExecutablePath;creation=$creation;commande=[string]$p.CommandLine;cwd=$null;proprietaire=$null;residentOctets=[long]$p.WorkingSetSize;metriqueMemoire='WorkingSet Windows';erreurs=@()}
  if ($null -eq $p.WorkingSetSize) { $item.erreurs += 'resident illisible' }
  if (-not $creation) { $item.erreurs += 'creation illisible' }
  if ($MemoireSeulement -and -not $aInspecter.Contains([int]$p.ProcessId)) {
    $item.commande = $null
    $items += $item
    continue
  }
  if (-not $MemoireSeulement) {
    try { $owner = [WorktreeProcess]::Owner($p.ProcessId) }
    catch {
      if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
      $owner = $null
      $item.erreurs += "proprietaire illisible : $($_.Exception.Message)"
    }
    $item.proprietaire = $owner
  }
  if ($MemoireSeulement -and $aInspecter.Contains([int]$p.ProcessId)) {
    $item.commande = $null
    try {
      $inspection = [WorktreeProcess]::Inspect($p.ProcessId)
      $item.creationNative = $inspection.CreationNative
      $item.commande = $inspection.Commande
      $item.cwd = $inspection.Cwd
    } catch {
      $item.erreurs += "inspection native illisible : $($_.Exception.Message)"
    }
  } else {
    try {
      $item.cwd = [WorktreeProcess]::Cwd($p.ProcessId)
    } catch {
      if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
      $item.erreurs += "cwd illisible : $($_.Exception.Message)"
    }
    try {
      if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
      $creationNative = [DateTime]::FromFileTimeUtc([WorktreeProcess]::Creation($p.ProcessId)).ToString('yyyy-MM-ddTHH:mm:ss.ffffff')
      if ($p.CreationDate -and $creationNative -ne $p.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.ffffff')) { throw 'identite modifiee pendant inspection' }
    } catch {
      if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
      $item.erreurs += "identite illisible : $($_.Exception.Message)"
    }
  }
  if (-not $item.commande) { $item.erreurs += 'commande illisible' }
  $items += $item
}
ConvertTo-Json -InputObject @{utilisateur=$sid;processus=$items} -Depth 4 -Compress
