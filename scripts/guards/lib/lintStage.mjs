// LINT DES FICHIERS STAGÉS — la porte que la CI joue déjà (`npm run lint`) ramenée AU COMMIT, sur le
// seul diff. Sur la fenêtre mesurée (30 commits), les deux rouges CI venaient de là : le hook ne
// jouait aucun lint (revue de palier 2026-09-02).
//
// Quatre règles de câblage, chacune mesurée :
//   · l'outil vient de CET arbre (`scripts/lancer-local.mjs`) — un worktree sans `eslint` doit REFUSER,
//     pas emprunter celui de l'arbre principal ;
//   · `--no-warn-ignored` : `eslint.config.js` ignore `*.config.*` et les dossiers dérivés
//     (`dist/`, `public/`, `_site/`…), et un fichier
//     ignoré CITÉ explicitement rend un avertissement — avec `--max-warnings 0` il ferait échouer le
//     commit sans qu'aucune règle ne soit violée (7 commits sur 30 concernés) ;
//   · seuls les chemins EXISTANTS partent : un chemin supprimé cité rend exit 2 après ~15 s ;
//   · le dossier jugé est dit (`--cwd`) et la config est passée (`--config`) : eslint prend `cwd` pour
//     base path — les chemins du lot et les `ignores` de la config s'y résolvent, et les `site` rendus
//     lui sont relatifs. Au commit, `cwd` EST la racine ; un appelant qui juge un dossier hors de
//     l'arbre (fixtures de test) garde la config du dépôt sans rien y déposer ;
//   · le lot part en LANCEMENTS dont la ligne de commande tient dans `BUDGET_DE_LIGNE` : Windows ne
//     crée pas un processus dont la ligne dépasse 32 767 caractères, et l'échec survient avant
//     eslint, sans stdout ni stderr (fusion de 903 fichiers, 33 907 caractères de chemins).
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

/** Extensions que `eslint.config.js` sait juger. */
const EXTS_LINT = ['.ts', '.tsx', '.mjs', '.mts']

/** Caractères de chemins par lancement d'eslint — la moitié de la limite Windows : le lanceur local
 *  (`scripts/lancer-local.mjs`) relance eslint avec les mêmes chemins, préfixés de ses arguments. */
export const BUDGET_DE_LIGNE = 16000

/**
 * `fichiers` en lots CONSÉCUTIFS, dans l'ordre, dont la somme des longueurs (plus un séparateur par
 * chemin) tient dans `budget` ; un chemin plus long que le budget part seul.
 * @param {string[]} fichiers @param {number} [budget] @returns {string[][]}
 */
export function lotsDeLigne(fichiers, budget = BUDGET_DE_LIGNE) {
  const lots = []
  let lot = []
  let taille = 0
  for (const f of fichiers) {
    if (lot.length && taille + f.length + 1 > budget) {
      lots.push(lot)
      lot = []
      taille = 0
    }
    lot.push(f)
    taille += f.length + 1
  }
  if (lot.length) lots.push(lot)
  return lots
}

/**
 * Chemins à passer à eslint : ceux du lot qui portent une extension jugée ET qui existent sur le
 * disque de `racine`. REND des chemins POSIX relatifs, dans l'ordre du lot.
 * @param {string[]} chemins @param {string} racine @returns {string[]}
 */
export function fichiersALinter(chemins, racine) {
  return chemins
    .map((f) => String(f).replace(/\\/g, '/'))
    .filter((rel) => EXTS_LINT.some((e) => rel.endsWith(e)))
    .filter((rel) => existsSync(join(racine, rel)))
}

/** Défaut NOMMÉ quand le rapport n'est pas exploitable : un lint qu'on ne sait pas lire REFUSE le
 *  commit, il ne le laisse jamais passer. @param {string} cause */
const defautOutillage = (cause) => ({ site: '(lint)', gravite: 'erreur', regle: '(outillage)', message: cause })

/**
 * Défauts d'un rapport eslint `--format json` : un par message, `fichier:ligne:colonne` relatif au
 * dossier depuis lequel eslint a jugé (`cwd`). Les fichiers sans message n'en produisent aucun.
 * FAIL-CLOSED : une sortie NON VIDE que `JSON.parse` refuse rend un défaut d'outillage, jamais `[]`
 * — un `[]` y ferait passer un lint ROUGE (avertissement node, message de lanceur collé au JSON).
 * @param {string} sortieJson @param {string} cwd
 * @returns {{ site: string, gravite: string, regle: string, message: string }[]}
 */
export function defautsDeRapport(sortieJson, cwd) {
  if (!String(sortieJson).trim()) return []
  /** @type {{ filePath: string, messages: { line: number, column: number, severity: number, ruleId: string|null, message: string }[] }[]} */
  let rapport
  try {
    rapport = JSON.parse(sortieJson)
  } catch (e) {
    return [defautOutillage("rapport illisible : " + String(e.message).split('\n')[0] + " — sortie : " + String(sortieJson).trim().slice(0, 200))]
  }
  if (!Array.isArray(rapport)) return [defautOutillage("rapport illisible : le JSON rendu n'est pas la liste de fichiers d'eslint")]
  const basePosix = String(cwd).replace(/\\/g, '/').replace(/\/$/, '') + '/'
  const defauts = []
  for (const fichier of rapport) {
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
 * Joue l'eslint de `racine` sur `fichiers`, depuis `cwd` — le dossier dont les `fichiers` sont
 * relatifs, et contre lequel la config décide de ce qu'elle ignore. REND `{ defauts, brut, stdout }` :
 * `stdout` porte le rapport JSON SEUL, `brut` y ajoute stderr pour le diagnostic (rapport qui n'est
 * pas du JSON : outil absent, config cassée).
 * La configuration est PASSÉE (`--config`) plutôt que découverte : jugé hors de l'arbre, eslint ne
 * la trouverait pas ; jugé dedans, les deux voies rendent le même couple (mesuré).
 * Un lancement par lot de `lotsDeLigne(fichiers, budget)` : les défauts s'additionnent, `stdout`
 * est la liste des rapports de fichiers de tous les lancements.
 * @param {string} racine @param {string[]} fichiers @param {{ cwd?: string, budget?: number }} [ou]
 * @returns {{ defauts: ReturnType<typeof defautsDeRapport>, brut: string, stdout: string }}
 */
export function lancerLint(racine, fichiers, { cwd = racine, budget = BUDGET_DE_LIGNE } = {}) {
  if (!fichiers.length) return { defauts: [], brut: '', stdout: '' }
  const lancements = lotsDeLigne(fichiers, budget).map((lot) => lancerUnLot(racine, lot, cwd))
  return {
    defauts: lancements.flatMap((l) => l.defauts),
    brut: lancements.map((l) => l.brut).join('\n'),
    stdout: JSON.stringify(lancements.flatMap((l) => rapportsDeFichiers(l.stdout))),
  }
}

/** Les rapports de fichiers d'une sortie eslint `--format json` ; une sortie illisible n'en porte
 *  aucun (son refus est déjà NOMMÉ par `defautsDeRapport`). @param {string} sortieJson @returns {unknown[]} */
function rapportsDeFichiers(sortieJson) {
  try {
    const rapport = JSON.parse(sortieJson)
    return Array.isArray(rapport) ? rapport : []
  } catch {
    return []
  }
}

/** Un lancement d'eslint sur `lot`, depuis `cwd`. @param {string} racine @param {string[]} lot @param {string} cwd */
function lancerUnLot(racine, lot, cwd) {
  const args = [
    join(racine, 'scripts', 'lancer-local.mjs'), 'eslint', '--cwd', cwd, '--',
    'eslint', '--max-warnings', '0', '--no-warn-ignored', '--format', 'json',
    '--config', join(racine, 'eslint.config.js'),
    ...lot,
  ]
  // Le rapport JSON vit sur STDOUT et lui seul : stderr porte les avertissements du moteur node et
  // les messages du lanceur local, qui ne sont pas du JSON. Les concaténer casserait le parse.
  // `maxBuffer` : le rapport recopie la source de chaque fichier fautif, au-delà du Mo par défaut.
  let stdout
  let stderr = ''
  let lancement = ''
  let echec = false
  try {
    stdout = execFileSync(process.execPath, args, { cwd: racine, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  } catch (e) {
    echec = true
    stdout = String(e.stdout ?? '')
    stderr = String(e.stderr ?? '')
    lancement = String(e.message ?? '')
  }
  const defauts = defautsDeRapport(stdout, cwd)
  // eslint a rendu un code non nul SANS rapport exploitable (outil absent, config cassée, chemin
  // refusé, processus non créé) : le refus est NOMMÉ. Sans cette branche, l'échec passerait pour un
  // arbre propre.
  if (echec && !defauts.length) {
    defauts.push(defautOutillage("eslint a échoué sans rapport : " + ((stderr || stdout || lancement).trim().split('\n')[0] || '(aucune sortie)')))
  }
  return { defauts, brut: stdout + stderr, stdout }
}
