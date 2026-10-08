param([string]$Pids = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ProgressPreference = 'SilentlyContinue'
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
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$items = @()
foreach ($p in Get-CimInstance Win32_Process) {
  if ($Pids -and $p.ProcessId -notin ($Pids.Split(',') | ForEach-Object { [int]$_ })) { continue }
  $creation = if ($p.CreationDate) { $p.CreationDate.ToUniversalTime().ToString('o') } else { '' }
  $item = @{pid=[int]$p.ProcessId;nom=[string]$p.Name;creation=$creation;commande=[string]$p.CommandLine;cwd=$null;proprietaire=$null;erreurs=@()}
  try { $owner = [WorktreeProcess]::Owner($p.ProcessId) }
  catch {
    if (-not [WorktreeProcess]::Exists($p.ProcessId)) { continue }
    $owner = $null
    $item.erreurs += "proprietaire illisible : $($_.Exception.Message)"
  }
  $item.proprietaire = $owner
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
  if (-not $item.commande) { $item.erreurs += 'commande illisible' }
  if (-not $creation) { $item.erreurs += 'creation illisible' }
  $items += $item
}
ConvertTo-Json -InputObject @{utilisateur=$sid;processus=$items} -Depth 4 -Compress
