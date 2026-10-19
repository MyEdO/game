// SUSPENDEUR DE MESURE (#2586) : un banc win32 qui rend RÉELLEMENT expirée la mesure Windows de processus
// (`mesurerProcessusWorktrees`, un `powershell.exe` enfant borné par son échéance), en suspendant ce mesureur.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Options `node:test` d'un test de la mesure Windows : un `powershell.exe` enfant du mesurant, borné par son échéance, qui
 *  lit `SystemRoot` à chaque appel (processusWorktrees.mjs, mesurerProcessusWorktrees) ; la mesure Linux lit /proc dans le
 *  processus lui-même. */
export const MESURE_WINDOWS = Object.freeze({ skip: process.platform !== 'win32' && 'mesure Linux sans mesureur distinct à suspendre ni SystemRoot à retirer', timeout: 60000 })

/** Suspend (NtSuspendProcess) chaque `powershell.exe` enfant du PID `-Cible`, `-Max` au plus (0 : tous), jusqu'à la sortie
 *  de ce PID ; un processus s'identifie par son PID ET sa date de création (GetProcessTimes), qu'un PID réutilisé ne
 *  partage pas. Imprime le PID de chaque suspendu, et crée `-Pret` une fois armé. */
const SUSPENDEUR_PS1 = `param([uint32]$Cible, [string]$Pret, [int]$Max = 0)
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;
public static class Suspendeur {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct Entree { public uint dwSize, cntUsage, th32ProcessID; public IntPtr th32DefaultHeapID; public uint th32ModuleID, cntThreads, th32ParentProcessID; public int pcPriClassBase; public uint dwFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile; }
  [DllImport("kernel32.dll")] static extern IntPtr CreateToolhelp32Snapshot(uint drapeaux, uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr cliche, ref Entree e);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr cliche, ref Entree e);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint acces, bool herite, uint pid);
  [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr h, out long creation, out long sortie, out long noyau, out long utilisateur);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("ntdll.dll")] static extern int NtSuspendProcess(IntPtr h);
  public static void Boucle(uint cible, int max) {
    IntPtr surveille = OpenProcess(0x00100000, false, cible);
    if (surveille == IntPtr.Zero) throw new Exception("cible introuvable : " + cible);
    var vus = new HashSet<string>();
    while (WaitForSingleObject(surveille, 0) != 0) {
      IntPtr cliche = CreateToolhelp32Snapshot(2, 0);
      var e = new Entree(); e.dwSize = (uint)Marshal.SizeOf(typeof(Entree));
      for (bool ok = Process32FirstW(cliche, ref e); ok && (max == 0 || vus.Count < max); ok = Process32NextW(cliche, ref e)) {
        if (e.th32ParentProcessID != cible || !string.Equals(e.szExeFile, "powershell.exe", StringComparison.OrdinalIgnoreCase)) continue;
        IntPtr h = OpenProcess(0x1800, false, e.th32ProcessID);
        if (h == IntPtr.Zero) continue;
        long creation, sortie, noyau, utilisateur;
        if (GetProcessTimes(h, out creation, out sortie, out noyau, out utilisateur) && vus.Add(e.th32ProcessID + ":" + creation) && NtSuspendProcess(h) == 0) Console.WriteLine(e.th32ProcessID);
        CloseHandle(h);
      }
      CloseHandle(cliche);
      Thread.Sleep(2);
    }
    CloseHandle(surveille);
  }
}
'@
[IO.File]::WriteAllText($Pret, '')
[Suspendeur]::Boucle($Cible, $Max)
`

/** Joue le module `pilote` (texte) dans un Node à part, une fois le suspendeur armé sur lui avec `max` ; rend `{ status,
 *  sortie, suspendus, suspendeur }` : le code et les flux du pilote, les PID suspendus, la fin `{ status, erreurs }` du
 *  suspendeur. `TMP`/`TEMP`/`TMPDIR` du pilote : le dossier du banc, retiré à la fin du test `t`. */
export async function jouerSousSuspendeur(t, pilote, { max = 0 } = {}) {
  const dossier = mkdtempSync(join(tmpdir(), '2586-suspendeur-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const pret = join(dossier, 'pret')
  const suspendeur = join(dossier, 'suspendeur.ps1')
  const chemin = join(dossier, 'pilote.mjs')
  writeFileSync(suspendeur, SUSPENDEUR_PS1)
  writeFileSync(chemin, `{ const { existsSync } = await import('node:fs'); const debut = Date.now()
  while (!existsSync(${JSON.stringify(pret)})) { if (Date.now() - debut > 30000) throw new Error('suspendeur jamais armé'); await new Promise((ok) => setTimeout(ok, 25)) } }
${pilote}`)
  const enfant = spawn(process.execPath, [chemin], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TMP: dossier, TEMP: dossier, TMPDIR: dossier } })
  const hote = spawn(join(process.env.SystemRoot ?? '', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', suspendeur, '-Cible', String(enfant.pid), '-Pret', pret, '-Max', String(max)], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  t.after(() => { hote.kill(); enfant.kill() })
  const suspendus = []
  let erreurs = ''
  hote.stdout.setEncoding('utf8').on('data', (d) => suspendus.push(...d.split(/\s+/).filter(Boolean)))
  hote.stderr.setEncoding('utf8').on('data', (d) => { erreurs += d })
  const finSuspendeur = new Promise((ok, non) => { hote.once('error', non); hote.once('close', (status) => ok({ status, erreurs })) })
  let sortie = ''
  enfant.stdout.on('data', (d) => { sortie += d }); enfant.stderr.on('data', (d) => { sortie += d })
  const status = await new Promise((ok, non) => { enfant.once('error', non); enfant.once('close', ok) })
  return { status, sortie, suspendus, suspendeur: await finSuspendeur }
}
