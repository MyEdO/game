import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'

const EXTS_LINT = ['.ts', '.tsx', '.mjs', '.mts', '.js', '.jsx', '.cts', '.cjs']
export const BUDGET_DE_LIGNE = 16000
export function lotsDeLigne(fichiers, budget = BUDGET_DE_LIGNE) {
  const lots = []
  let lot = [], taille = 0
  for (const f of fichiers) {
    if (lot.length && taille + f.length + 1 > budget) { lots.push(lot); lot = []; taille = 0 }
    lot.push(f); taille += f.length + 1
  }
  if (lot.length) lots.push(lot)
  return lots
}
export function fichiersALinter(chemins, racine) {
  return chemins.map(f => String(f).replace(/\\/g, '/')).filter(rel => EXTS_LINT.some(e => rel.endsWith(e)) && existsSync(join(racine, rel)))
}
const defautOutillage = message => ({ site: '(lint)', gravite: 'erreur', regle: '(outillage)', message })
export function nomDeRegle(code) {
  if (!code) return '(parse)'
  const m = /^([^()]+)\(([^()]+)\)$/.exec(code)
  return m ? (m[1] === 'eslint' ? m[2] : `${m[1]}/${m[2]}`) : code
}
export function positionDeRapport(diagnostic, cwd, lire = fichier => readFileSync(fichier, 'utf8')) {
  const span = diagnostic.labels?.[0]?.span
  if (!Number.isInteger(span?.line) || !Number.isInteger(span?.column) || span.line < 1 || span.column < 1) throw new Error('position Oxlint invalide')
  const ligne = lire(resolve(cwd, diagnostic.filename)).split('\n')[span.line - 1]
  if (ligne === undefined) throw new Error('ligne Oxlint hors fichier')
  const octets = Buffer.from(ligne)
  const prefixe = octets.subarray(0, span.column - 1).toString('utf8')
  if (span.column - 1 > octets.length || Buffer.byteLength(prefixe) !== span.column - 1) throw new Error('colonne Oxlint hors caractère')
  return { line: span.line, column: prefixe.length + 1 }
}
export function defautsDeRapport(sortieJson, cwd, lire) {
  if (!String(sortieJson).trim()) return []
  let rapport
  try { rapport = JSON.parse(sortieJson) }
  catch (e) { return [defautOutillage(`rapport illisible : ${e.message}`)] }
  if (!Array.isArray(rapport?.diagnostics)) return [defautOutillage('rapport illisible : diagnostics Oxlint absents')]
  const base = resolve(cwd).replaceAll('\\', '/') + '/'
  const defauts = []
  for (const m of rapport.diagnostics) {
    if (typeof m.filename !== 'string' || typeof m.message !== 'string' || !['error', 'warning'].includes(m.severity)) return [defautOutillage('rapport illisible : diagnostic Oxlint invalide')]
    const file = m.filename.replaceAll('\\', '/')
    const rel = file.startsWith(base) ? file.slice(base.length) : file
    let pos
    try { pos = positionDeRapport(m, cwd, lire) }
    catch (e) { return [defautOutillage(`rapport illisible : ${e.message}`)] }
    defauts.push({ site: `${rel}:${pos.line}:${pos.column}`, gravite: m.severity === 'error' ? 'erreur' : 'avertissement', regle: nomDeRegle(m.code), message: m.message })
  }
  return defauts
}
/** @param {string} racine @param {string[]} fichiers @param {{cwd?: string, budget?:number, configuration?:object}} options */
export function lancerLint(racine, fichiers, { cwd = racine, budget = BUDGET_DE_LIGNE, configuration } = {}) {
  if (!fichiers.length) return { defauts: [], brut: '', stdout: '', codeSortie: 0 }
  let config = join(racine, 'oxlint.config.mjs')
  const temporaire = resolve(cwd) !== resolve(racine) || configuration
  if (temporaire) {
    config = join(cwd, `.lint-${process.pid}-${Math.random().toString(36).slice(2)}.config.mjs`)
    writeFileSync(config, `import config from ${JSON.stringify(pathToFileURL(join(racine, 'oxlint.config.mjs')).href)};\nexport default {...config,...${JSON.stringify(configuration ?? {})}};\n`)
  }
  try {
    const lancements = lotsDeLigne(fichiers, budget).map(lot => lancerUnLot(racine, lot, cwd, config))
    const rapports = lancements.map(l => { try { return JSON.parse(l.stdout) } catch { return {} } })
    return { defauts: lancements.flatMap(l => l.defauts), brut: lancements.map(l => l.brut).join('\n'), codeSortie:Math.max(...lancements.map(l=>l.codeSortie)), stdout: JSON.stringify({diagnostics:rapports.flatMap(r=>r.diagnostics??[]),number_of_files:rapports.reduce((n,r)=>n+(r.number_of_files??0),0)}) }
  } finally { if (temporaire) unlinkSync(config) }
}
function lancerUnLot(racine, lot, cwd, config) {
  const args = [join(racine, 'scripts', 'lancer-local.mjs'), 'oxlint', '--cwd', cwd, '--', 'oxlint', '--max-warnings', '0', '--format', 'json', '--no-error-on-unmatched-pattern', '--disable-nested-config', '--config', config, ...lot]
  let stdout, stderr = '', lancement = '', echec = false, codeSortie = 0
  try { stdout = execFileSync(process.execPath, args, { cwd: racine, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }) }
  catch (e) { echec = true; codeSortie = Number.isInteger(e.status) ? e.status : 1; stdout = String(e.stdout ?? ''); stderr = String(e.stderr ?? ''); lancement = String(e.message ?? '') }
  const defauts = defautsDeRapport(stdout, cwd)
  if (echec && !defauts.length) defauts.push(defautOutillage(`oxlint a échoué sans rapport : ${(stderr || stdout || lancement).trim().split('\n')[0] || '(aucune sortie)'}`))
  if (!echec && !stdout.trim()) defauts.push(defautOutillage('oxlint a réussi sans rapport'))
  return { defauts, brut: stdout + stderr, stdout, codeSortie }
}
