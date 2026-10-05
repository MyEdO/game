// LINT DES FICHIERS STAGÉS, lus dans l'INDEX (#2327 A5) : la gate `lint` de la CI (`npm run lint`)
// jouée au commit sur le seul diff. Le pre-commit en fait un AVERTISSEMENT (A8) ; la gate le rejuge.
//
// Câblage :
//   · le texte jugé est le blob de l'INDEX (`lireEnLot`), jamais le disque : sur l'arbre partagé, le
//     disque porte le WIP d'une autre session que le commit n'embarque pas ;
//   · eslint vient de CET arbre (`moduleLocal`, `scripts/lancer-local.mjs`) et se joue dans le
//     processus (`ESLint#lintText`) ; `warnIgnored: false` : un fichier que la config ignore ne rend rien ;
//   · la config est celle du DISQUE (`overrideConfigFile`), confrontée à TOUT lancement à celle de
//     l'INDEX : si elles diffèrent (config stagée ou disque modifié), SAUT déclaré, jamais un verdict
//     rendu sous une autre config que celle du commit ;
//   · une panne (eslint absent de l'arbre, index illisible, config qui lève) est un défaut d'outillage
//     NOMMÉ ; le pre-commit l'AVERTIT comme tout défaut de lint (#2327 A8), la gate `lint` rejuge.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { INDEX, lireEnLot } from './gitPorte.mjs'
import { moduleLocal } from '../../lancer-local.mjs'

/** Extensions que `eslint.config.js` sait juger. */
const EXTS_LINT = ['.ts', '.tsx', '.mjs', '.mts']
/** La config du dépôt, relative à sa racine. */
export const CONFIG_ESLINT = 'eslint.config.js'

/** Défaut NOMMÉ quand eslint n'a pas jugé (outil absent, config cassée, lecture de l'index en panne).
 *  @param {string} cause */
const defautOutillage = (cause) => ({ site: '(lint)', gravite: 'erreur', regle: '(outillage)', message: cause })

/** Première ligne d'une erreur. @param {unknown} e */
const premiereLigne = (e) => String(/** @type {any} */ (e)?.message ?? e).trim().split('\n')[0]

/**
 * Défauts des rapports d'eslint (`ESLint.LintResult[]`) : un par message, `fichier:ligne:colonne`
 * relatif à `cwd`. Les fichiers sans message n'en produisent aucun.
 * @param {{ filePath: string, messages: { line?: number, column?: number, severity: number, ruleId: string|null, message: string }[] }[]} rapports
 * @param {string} cwd
 * @returns {{ site: string, gravite: string, regle: string, message: string }[]}
 */
export function defautsDeRapport(rapports, cwd) {
  const basePosix = String(cwd).replace(/\\/g, '/').replace(/\/$/, '') + '/'
  const defauts = []
  for (const fichier of rapports) {
    const abs = String(fichier.filePath).replace(/\\/g, '/')
    const rel = abs.startsWith(basePosix) ? abs.slice(basePosix.length) : abs
    for (const m of fichier.messages ?? []) {
      defauts.push({
        site: `${rel}:${m.line ?? 0}:${m.column ?? 0}`,
        gravite: m.severity === 2 ? 'erreur' : 'avertissement',
        regle: m.ruleId ?? '(parse)',
        message: m.message,
      })
    }
  }
  return defauts
}

/**
 * Lint des `chemins` stagés de `racine`, lus dans l'index de `depot`. REND `{ defauts, saut }` :
 * `saut` NOMME pourquoi rien n'a été jugé (`eslint.config.js` de l'index qui diffère du disque), sinon
 * `null`. Une panne (outil absent, lecture refusée, config qui lève) est un défaut d'outillage NOMMÉ.
 * @param {string} racine @param {import('./gitPorte.mjs').Depot} depot @param {readonly string[]} chemins
 * @returns {Promise<{ defauts: ReturnType<typeof defautsDeRapport>, saut: string | null }>}
 */
export async function lintDeLIndex(racine, depot, chemins) {
  const posix = chemins.map((c) => String(c).replace(/\\/g, '/'))
  const aJuger = posix.filter((rel) => EXTS_LINT.some((e) => rel.endsWith(e)))
  if (!aJuger.length) return { defauts: [], saut: null }
  let textes
  try {
    textes = lireEnLot(depot, INDEX, [...aJuger, CONFIG_ESLINT])
  } catch (e) {
    return { defauts: [defautOutillage(`index illisible — ${premiereLigne(e)}`)], saut: null }
  }
  if (textes.get(CONFIG_ESLINT) !== texteDuDisque(join(racine, CONFIG_ESLINT)))
    return { defauts: [], saut: `${CONFIG_ESLINT} de l'index diffère du disque : aucun verdict sous une autre config que celle du commit` }
  const { chemin, refus } = moduleLocal(racine, 'eslint')
  if (refus) return { defauts: [defautOutillage(refus)], saut: null }
  try {
    const { ESLint } = await import(pathToFileURL(chemin).href)
    const eslint = new ESLint({ cwd: racine, overrideConfigFile: join(racine, CONFIG_ESLINT) })
    const rapports = []
    for (const rel of aJuger) {
      const texte = textes.get(rel)
      if (texte == null) continue
      rapports.push(...(await eslint.lintText(texte, { filePath: join(racine, rel), warnIgnored: false })))
    }
    return { defauts: defautsDeRapport(rapports, racine), saut: null }
  } catch (e) {
    return { defauts: [defautOutillage(`eslint a échoué : ${premiereLigne(e)}`)], saut: null }
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
