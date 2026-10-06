// LINT Oxlint (`oxlint.config.mjs`) : `lancerLint` joue l'oxlint de CET arbre (`scripts/lancer-local.mjs`)
// sur les fichiers d'un dossier `cwd`, sous une config posée dans ce dossier qui importe celle de la
// racine ; `lintDeLIndex` est la porte du pre-commit (#2327 A5).
//
// `lintDeLIndex` :
//   · le texte jugé est le blob de l'INDEX (`lireEnLot`), matérialisé sous un dossier temporaire aux
//     mêmes chemins relatifs et jugé par `lancerLint` (`cwd`) : sur l'arbre partagé, le disque porte le
//     WIP d'une autre session que le commit n'embarque pas ;
//   · la config est celle du DISQUE, confrontée à TOUT lancement à celle de l'INDEX fichier par fichier
//     sur sa FERMETURE (`fermetureDeConfig`) : si l'un d'eux diffère (stagé ou disque modifié), SAUT
//     déclaré qui le nomme, jamais un verdict rendu sous une autre config que celle du commit ;
//   · une panne (oxlint absent de l'arbre, config ou index illisible, rapport illisible) est un défaut
//     d'outillage NOMMÉ ; le pre-commit l'AVERTIT comme tout défaut de lint (#2327 A8), la gate `lint` rejuge.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { INDEX, lireEnLot } from './gitPorte.mjs'
import { clotureDImports } from './importGraph.mjs'

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
/** @param {string} racine @param {string[]} fichiers @param {{cwd: string, budget?:number, configuration?:object}} options */
export function lancerLint(racine, fichiers, { cwd, budget = BUDGET_DE_LIGNE, configuration }) {
  if (!fichiers.length) return { defauts: [], brut: '', stdout: '', codeSortie: 0 }
  const config = join(cwd, `.lint-${process.pid}-${Math.random().toString(36).slice(2)}.config.mjs`)
  writeFileSync(config, `import config from ${JSON.stringify(pathToFileURL(join(racine, CONFIG_LINT)).href)};\nexport default {...config,...${JSON.stringify(configuration ?? {})}};\n`)
  try {
    const lancements = lotsDeLigne(fichiers, budget).map(lot => lancerUnLot(racine, lot, cwd, config))
    const rapports = lancements.map(l => { try { return JSON.parse(l.stdout) } catch { return {} } })
    return { defauts: lancements.flatMap(l => l.defauts), brut: lancements.map(l => l.brut).join('\n'), codeSortie:Math.max(...lancements.map(l=>l.codeSortie)), stdout: JSON.stringify({diagnostics:rapports.flatMap(r=>r.diagnostics??[]),number_of_files:rapports.reduce((n,r)=>n+(r.number_of_files??0),0)}) }
  } finally { unlinkSync(config) }
}
/** La config du dépôt, relative à sa racine. */
export const CONFIG_LINT = 'oxlint.config.mjs'

/**
 * La FERMETURE de `oxlint.config.mjs` sous `racine`, en chemins POSIX relatifs : la config, ses
 * `jsPlugins` locaux lus sur l'objet CHARGÉ, et leurs imports relatifs transitifs (`clotureDImports`).
 * Config absente du disque : elle seule.
 * @param {string} racine @returns {string[]}
 */
export function fermetureDeConfig(racine) {
  const abs = join(racine, CONFIG_LINT)
  if (texteDuDisque(abs) === null) return [CONFIG_LINT]
  const { default: config } = createRequire(abs)(abs)
  const plugins = (config.jsPlugins ?? [])
    .map((p) => (typeof p === 'string' ? p : p.specifier))
    .filter((spec) => spec.startsWith('.') || isAbsolute(spec))
    .map((spec) => resolve(racine, spec))
  return [...new Set([CONFIG_LINT, ...clotureDImports([CONFIG_LINT, ...plugins], { racine })])]
}

/**
 * Lint des `chemins` stagés de `racine`, lus dans l'index de `depot`. REND `{ defauts, saut }` :
 * `saut` NOMME pourquoi rien n'a été jugé (un fichier de `fermetureDeConfig` dont l'index diffère du disque), sinon
 * `null`. Une panne est un défaut d'outillage NOMMÉ.
 * @param {string} racine @param {import('./gitPorte.mjs').Depot} depot @param {readonly string[]} chemins
 * @returns {{ defauts: ReturnType<typeof defautsDeRapport>, saut: string | null }}
 */
export function lintDeLIndex(racine, depot, chemins) {
  const aJuger = chemins.map((c) => String(c).replace(/\\/g, '/')).filter((rel) => EXTS_LINT.some((e) => rel.endsWith(e)))
  if (!aJuger.length) return { defauts: [], saut: null }
  let fermeture
  try {
    fermeture = fermetureDeConfig(racine)
  } catch (e) {
    return { defauts: [defautOutillage(`config illisible — ${String(e?.message ?? e).trim().split('\n')[0]}`)], saut: null }
  }
  let textes
  try {
    textes = lireEnLot(depot, INDEX, [...aJuger, ...fermeture])
  } catch (e) {
    return { defauts: [defautOutillage(`index illisible — ${String(e?.message ?? e).trim().split('\n')[0]}`)], saut: null }
  }
  const ecart = fermeture.find((rel) => textes.get(rel) !== texteDuDisque(join(racine, rel)))
  if (ecart !== undefined)
    return { defauts: [], saut: `${ecart} de l'index diffère du disque : aucun verdict sous une autre config que celle du commit` }
  const presents = aJuger.filter((rel) => textes.get(rel) != null)
  if (!presents.length) return { defauts: [], saut: null }
  const dossier = mkdtempSync(join(tmpdir(), 'lint-index-'))
  try {
    for (const rel of presents) {
      mkdirSync(dirname(join(dossier, rel)), { recursive: true })
      writeFileSync(join(dossier, rel), textes.get(rel))
    }
    return { defauts: lancerLint(racine, presents, { cwd: dossier }).defauts, saut: null }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

/** Le texte d'un fichier du disque, `null` s'il est absent. @param {string} chemin */
function texteDuDisque(chemin) {
  try {
    return readFileSync(chemin, 'utf8')
  } catch {
    return null
  }
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
