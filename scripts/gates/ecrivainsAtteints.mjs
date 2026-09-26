// CONFRONTATION DE LA TABLE ÉCRIT/LU À LA SOURCE (#1679 L2 T1d) — pour chaque gate de `ci.yml`, les
// scripts LOCAUX qu'elle atteint (imports transitifs depuis la commande dépliée) et qui portent un
// appel d'ÉCRITURE de fichier.
//
// À quoi ça sert : `ECRIT_LU` (scripts/gates/toutes.mjs) est ce qui autorise deux gates à tourner en
// même temps. Une table qui se démode en silence est pire que pas de table — le cas est vécu :
// `test:hooks` mutait `scripts/hooks/ecrans-ui.json` (un fichier COMMITTÉ) sans que rien ne le dise,
// et le `finally` censé le remettre a échoué sous charge le 2026-09-04.
//
// CE QUE ÇA MESURE, ET CE QUE ÇA NE MESURE PAS : le grain est le SCRIPT, pas la ligne — une gate qui
// se met à atteindre un module écrivain de plus est vue ; une écriture NEUVE dans un module qui en
// portait déjà ne l'est pas. La lecture statique ne suit ni `require`, ni un chemin calculé, ni ce
// qu'un outil externe (eslint, knip, tsc, vitest) fait de son côté — d'où les entrées `lit`/`ecrit`
// de la table, qui restent une MESURE, pas une déduction.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { gatesDeCi } from './gatesDeCi.mjs'
import { GATES, listerTests, testsDe } from './testsParGate.mjs'

/** Appels qui ÉCRIVENT sur le disque. Le `\b` évite `outputFile` dans une liste de drapeaux. */
const ECRITURE =
  /\b(?:writeFileSync|writeFile|createWriteStream|appendFileSync|appendFile|mkdirSync|mkdir|rmSync|rmdirSync|unlinkSync|renameSync|rename|cpSync|copyFileSync|truncateSync)\s*\(/

/** Une ligne de commentaire ou d'import ne prouve rien du corps du module. */
export const inerte = (ligne) => /^\s*(?:\/\/|\*|\/\*)/.test(ligne) || /^\s*import\s/.test(ligne)

/** Le lanceur des tests `node --test` : sa liste de fichiers n'est PAS dans la commande. */
const LANCEUR_TESTS = 'scripts/test/node-tests.mjs'

/** Chemins de script d'une commande npm dépliée, tels que la racine les porte. Une gate qui passe
 *  par le lanceur des tests prend ses graines à `testsParGate` — la table qui décide, par
 *  répertoire, des tests de cette gate — puisque la commande ne nomme plus un seul fichier. */
function fichiersDe(commande, racine, gate) {
  const out = []
  for (const jeton of commande.split(/\s+/))
    if (/^[\w./-]+\.(?:mjs|mts|js|ts)$/.test(jeton) && existsSync(join(racine, jeton))) out.push(jeton)
  if (out.includes(LANCEUR_TESTS) && GATES.includes(gate)) out.push(...testsDe(gate, () => listerTests(racine)))
  return out
}

/** Extensions essayées, dans l'ordre de Vite 5 (`DEFAULT_EXTENSIONS`, node_modules/vite/dist/node/constants.js:24). */
const EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']

/** `true` si le chemin est un FICHIER existant (un dossier n'en est pas un). */
const estFichier = (p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Résout un spécificateur RELATIF vers un FICHIER du dépôt, ou `null` — dans l'ordre de Vite 5
 *  (`tryCleanFsResolve`) : le fichier nommé, puis `base.<ext>`, puis `base/index.<ext>`. */
function resoudre(depuis, specificateur, racine) {
  if (!specificateur.startsWith('.')) return null
  const base = resolve(dirname(depuis), specificateur)
  const candidats = [base, ...EXTENSIONS.map((e) => `${base}${e}`), ...EXTENSIONS.map((e) => join(base, `index${e}`))]
  const trouve = candidats.find(estFichier)
  return trouve ? relative(racine, trouve).split('\\').join('/') : null
}

/** Déclaration d'import/export dont la clause est entre accolades (`import { a, type B } from '…'`). */
const ACCOLADES = /\b(?:import|export)\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g
/** Déclaration de TYPE seul par mot-clé (`import type X from '…'`, `export type { X } from '…'`). */
const TYPE_SEUL = /\b(?:import|export)\s+type\b[^;'"]*?\bfrom\s*['"][^'"]+['"]/g

/** Le texte d'un module sans ses imports/exports de TYPE seul : ils s'effacent à la compilation,
 *  n'exécutent ni ne lisent rien. Un import dont TOUS les spécificateurs sont des types en est un ;
 *  un import mixte (`{ type X, y }`) reste. */
export function sansImportsDeType(texte) {
  return texte.replace(TYPE_SEUL, '').replace(ACCOLADES, (decl, clause) => {
    const specs = clause.split(',').map((s) => s.trim()).filter(Boolean)
    return specs.length && specs.every((s) => /^type\s/.test(s)) ? '' : decl
  })
}

/** Fermeture transitive des imports locaux, depuis des graines relatives à la racine. */
export function transitif(graines, racine) {
  const vus = new Set()
  const pile = [...graines]
  while (pile.length) {
    const fichier = pile.pop()
    if (!fichier || vus.has(fichier)) continue
    vus.add(fichier)
    let texte
    try {
      texte = sansImportsDeType(readFileSync(join(racine, fichier), 'utf8'))
    } catch {
      continue
    }
    for (const motif of [/from\s+['"]([^'"]+)['"]/g, /import\(\s*['"]([^'"]+)['"]/g])
      for (const m of texte.matchAll(motif)) {
        const cible = resoudre(join(racine, fichier), m[1], racine)
        if (cible && !vus.has(cible)) pile.push(cible)
      }
  }
  return [...vus]
}

/** `true` si ce script porte au moins un appel d'écriture hors commentaire et hors import. */
export function porteUneEcriture(chemin, racine) {
  let texte
  try {
    texte = readFileSync(join(racine, chemin), 'utf8')
  } catch {
    return false
  }
  return texte.split('\n').some((l) => !inerte(l) && ECRITURE.test(l))
}

/** `{ [gate]: [scripts LOCAUX atteints, triés] }` — le CORPUS de chaque gate de `ci.yml` : ses
 *  graines de commande (tests `node --test` compris) et leur fermeture transitive d'imports. */
export function corpusParGate(racine = process.cwd()) {
  const scripts = JSON.parse(readFileSync(join(racine, 'package.json'), 'utf8')).scripts ?? {}
  const par = {}
  for (const gate of gatesDeCi({ cwd: racine })) {
    let commande = scripts[gate.nom] || gate.commande
    for (let i = 0; i < 4; i += 1)
      commande = commande.replace(/npm run ([A-Za-z0-9:_.-]+)/g, (tel, nom) => (scripts[nom] ? `(${scripts[nom]})` : tel))
    par[gate.nom] = transitif(fichiersDe(commande, racine, gate.nom), racine).sort()
  }
  return par
}

/** `{ [gate]: [scripts écrivains atteints, triés] }` pour toutes les gates de `ci.yml`. */
export function ecrivainsParGate(racine = process.cwd()) {
  const par = {}
  for (const [gate, corpus] of Object.entries(corpusParGate(racine)))
    par[gate] = corpus.filter((f) => porteUneEcriture(f, racine))
  return par
}
