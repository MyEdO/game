import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { GitIndisponible, OPTIONS_DE_L_HOTE, depotDe, fusionnesEnCours } from '/home/user/game/scripts/guards/lib/gitPorte.mjs'
const RACINE = process.argv[2]
const A = 'a'.repeat(40), B = 'b'.repeat(40)
const connus = new Set([A, B])
const feint = (cwd, mode, enPanne) => depotDe(cwd, { enPanne, spawn: (_g, all) => {
  const args = all.slice(OPTIONS_DE_L_HOTE.length)
  if (args[0] === 'rev-parse' && args[1] === '--git-path') return { status: 0, stdout: `${args[2]}\n`, stderr: '' }
  if (args[0] === 'rev-parse' && args.includes('--verify')) {
    if (mode === 'panne') return { status: 128, stdout: '', stderr: 'fatal: boum\n' }
    const nom = args.at(-1).replace(/\^\{commit\}$/, '')
    return connus.has(nom) ? { status: 0, stdout: `${nom}\n`, stderr: '' } : { status: 1, stdout: '', stderr: '' }
  }
  if (args[0] === 'cat-file') return { status: 0, stdout: '', stderr: '' }
  return { status: 0, stdout: '', stderr: '' }
} })
const cas = {
  absent: null, vide: '', sansLF: A, lf: `${A}\n`, octo: `${A}\n${B}\n`, crlf: `${A}\r\n`,
  ligneVideMilieu: `${A}\n\n${B}\n`, espaceTete: ` ${A}\n`, nonResolue: `${A}\n${'c'.repeat(40)}\n`, repertoire: 'DIR',
}
for (const [nom, contenu] of Object.entries(cas)) {
  const cwd = join(RACINE, nom); rmSync(cwd, { recursive: true, force: true }); mkdirSync(cwd, { recursive: true })
  if (contenu === 'DIR') mkdirSync(join(cwd, 'MERGE_HEAD')); else if (contenu !== null) writeFileSync(join(cwd, 'MERGE_HEAD'), contenu)
  for (const mode of ['ok', 'panne']) {
    let leve; try { leve = JSON.stringify(fusionnesEnCours(feint(cwd, mode))) } catch (e) { leve = `${e instanceof GitIndisponible ? 'GitIndisponible' : e.name}: ${e.raison ?? e.message}` }
    const pannes = []; const r = fusionnesEnCours(feint(cwd, mode, (x) => pannes.push(x)))
    console.log(`${nom.padEnd(16)} ${mode.padEnd(5)} | sans enPanne: ${leve.slice(0, 90)} | enPanne: ${JSON.stringify(r)} pannes=${JSON.stringify(pannes)}`)
  }
}
