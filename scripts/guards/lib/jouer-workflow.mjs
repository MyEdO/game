// JOUER UN SCRIPT DE WORKFLOW AVEC DES DOUBLURES — sans un seul agent.
//
// Un script de workflow (`.claude/workflows/*.js`, `scripts/**/*.workflow.js`) est du JavaScript
// qu'aucun `import` ne peut charger : `export const meta` d'un côté, `return` de premier niveau de
// l'autre. Le harnais l'enveloppe dans une fonction async ; ce module l'enveloppe DE LA MÊME FAÇON,
// pour que ce qu'un banc observe soit ce que le script REND et ce qu'il ENVOIE — jamais une
// réécriture de l'un ou de l'autre dans un test.
//
// SOURCE UNIQUE de cette enveloppe : deux copies dériveraient dès que le harnais change une
// doublure, et un banc jouerait alors un autre script que celui qui part.
//
// La racine du schéma de chaque agent se juge à la FORME, à tous les sites, par la porte
// `scripts/ops/workflows.test.mjs`. La doublure `agent` en est le FILET : elle applique le même
// jugement (`defautsDeRacine`, formeDeWorkflow.mjs) à l'objet SÉRIALISÉ qui part, sur les chemins
// qu'un banc atteint — ce qui voit une mutation d'intrinsèque (`Object.prototype.toJSON`) que la
// forme ne voit pas. Un banc dont un agent reçoit une racine fautive REJETTE.

import { readFileSync } from 'node:fs'
import { basename, join, relative, resolve, sep } from 'node:path'
import { estSuiteVitest } from './fichierVitest.mjs'
import { TRAVAIL, depotDe, listerImage } from './gitPorte.mjs'
import { defautsDeRacine, lireWorkflow, PREFILTRE_DE_WORKFLOW } from './formeDeWorkflow.mjs'

/**
 * @typedef {object} RunDeWorkflow
 * @property {any} rendu ce que le script `return`
 * @property {Map<string, string>} promptsParLabel `phase:label` → prompt ENVOYÉ
 * @property {Map<string, any>} optionsParLabel `phase:label` → OPTIONS envoyées (type d'agent, modèle,
 *   schéma), COPIÉES à l'appel : ce qu'un banc doit pouvoir juger sans relire le source à la regex
 * @property {string[]} journal ce que le script a passé à `log`
 */

/** L'image `TRAVAIL` de l'hôte (`listerImage`), chemins ABSOLUS. LÈVE si elle est vide. */
function fichiersDuDepot(racine) {
  const fichiers = listerImage(depotDe(racine), TRAVAIL)
  if (!fichiers.length) throw new Error(`jouer-workflow : git ne rend aucun fichier de ${racine}`)
  return fichiers.map((f) => resolve(join(racine, f)))
}

/**
 * La reconnaissance A2 (`lireWorkflow`) sur tout fichier JavaScript du dépôt.
 * @param {string} racine
 * @returns {{ lus: number, parses: number, scripts: string[], defauts: string[] }} `lus` = fichiers
 *   JavaScript lus, `parses` = ceux que le préfiltre envoie à l'AST, `scripts` = chemins ABSOLUS triés,
 *   `defauts` = défauts de reconnaissance (chemins RELATIFS à la racine)
 */
export function reconnaissanceDuDepot(racine) {
  const base = resolve(racine)
  const js = fichiersDuDepot(racine).filter((f) => /\.(c|m)?js$/.test(f))
  const scripts = []
  const defauts = []
  let parses = 0
  for (const f of js) {
    const texte = readFileSync(f, 'utf8')
    if (PREFILTRE_DE_WORKFLOW.test(texte)) parses++
    const lu = lireWorkflow(texte, relative(base, f).split(sep).join('/'))
    if (lu.script) scripts.push(f)
    defauts.push(...lu.defauts)
  }
  return { lus: js.length, parses, scripts: scripts.sort(), defauts }
}

/**
 * Les scripts de workflow du dépôt, reconnus à leur CONTENU (A2), jamais à un nom ou un dossier.
 * @param {string} racine @returns {string[]} chemins ABSOLUS, triés
 */
export const scriptsDeWorkflowDuDepot = (racine) => reconnaissanceDuDepot(racine).scripts

/**
 * Les bancs du dépôt : tout fichier de test qui importe CETTE enveloppe.
 * @param {string} racine @returns {string[]} chemins ABSOLUS, triés
 */
export function bancsDeWorkflowDuDepot(racine) {
  return fichiersDuDepot(racine)
    .filter((f) => estSuiteVitest(f) && /from ['"][^'"]*\/jouer-workflow\.mjs['"]/.test(readFileSync(f, 'utf8')))
    .sort()
}

/**
 * Joue le script de workflow du chemin donné, dans l'enveloppe du harnais.
 * `repondre(prompt, opts)` rend ce que l'agent aurait rendu, phase par phase.
 * REJETTE si un agent a reçu un schéma dont la racine est fautive — après la fin du script, car
 * `parallel` et `pipeline` avalent ce qu'un agent lève.
 * @param {string} chemin chemin ABSOLU du script de workflow
 * @param {any} argsDuRun la valeur du global `args`
 * @param {(prompt: string, opts: any) => any} repondre
 * @returns {Promise<RunDeWorkflow>}
 */
export async function jouerWorkflow(chemin, argsDuRun, repondre) {
  const nom = basename(chemin).replace(/\.js$/, '')
  const brut = readFileSync(chemin, 'utf8')
  const position = lireWorkflow(brut, chemin).exportDeMeta
  // `export` devient six espaces : la colonne d'une erreur reste celle du source ; sa ligne, dans
  // la pile (`<anonymous>:L:C`), vaut celle du source + 3 — les trois lignes que `new Function`
  // pose devant lui (signature, `) {`, ouverture de l'enveloppe async).
  const source = position === null ? brut : `${brut.slice(0, position)}      ${brut.slice(position + 'export'.length)}`
  const promptsParLabel = new Map()
  const optionsParLabel = new Map()
  const journal = []
  const defautsDeSchema = new Set()
  // Le harnais sérialise un appel au moment où il PART : ce qui est rangé est une copie prise à
  // l'appel, qu'une mutation ultérieure d'un objet partagé par le script (un schéma constant) ne
  // réécrit pas.
  const agent = (prompt, opts) => {
    promptsParLabel.set(`${opts.phase}:${opts.label}`, prompt)
    optionsParLabel.set(`${opts.phase}:${opts.label}`, structuredClone(opts))
    if (opts.schema !== undefined) {
      const fil = JSON.stringify(opts.schema)
      for (const d of defautsDeRacine(fil === undefined ? undefined : JSON.parse(fil), `${nom}:${opts.label}`)) defautsDeSchema.add(d)
    }
    return Promise.resolve(repondre(prompt, opts))
  }
  // Les doublures font ce que fait le harnais, point par point :
  //  · `parallel` ne REJETTE jamais — un thunk qui lève rend `null`, comme un agent mort ;
  //  · `pipeline` dépose à `null` l'item dont une stage lève, et saute ses stages restantes ;
  //  · les items qui traversent `pipeline` sont des COPIES — une comparaison d'identité y est fausse.
  const parallel = (thunks) => Promise.all(thunks.map((t) => Promise.resolve().then(t).catch(() => null)))
  const copie = (v) => (v === undefined ? undefined : structuredClone(v))
  const pipeline = async (items, ...stages) => {
    const out = []
    for (const item of items) {
      let courant = copie(item)
      for (const stage of stages) {
        try {
          courant = copie(await stage(courant))
        } catch {
          courant = null
          break
        }
      }
      out.push(courant)
    }
    return out
  }
  const fabrique = new Function(
    'agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget',
    `return (async () => {\n${source}\n})()`,
  )
  const rendu = await fabrique(agent, parallel, pipeline, () => {}, (m) => journal.push(m), argsDuRun, undefined)
  if (defautsDeSchema.size) {
    throw new Error(`${defautsDeSchema.size} schéma(s) de sortie à racine fautive — un texte vit dans un objet ou un tableau :\n${[...defautsDeSchema].join('\n')}`)
  }
  return { rendu, promptsParLabel, optionsParLabel, journal }
}
