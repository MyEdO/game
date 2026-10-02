// CONFRONTATION DE LA TABLE ÉCRIT/LU À LA SOURCE (#1679 L2 T1d) — pour chaque gate de `ci.yml`, les
// scripts LOCAUX qu'elle atteint (imports transitifs depuis la commande dépliée) et qui portent un
// appel d'ÉCRITURE de fichier.
//
// `ECRIT_LU` (scripts/gates/toutes.mjs) autorise deux gates à tourner en même temps.
//
// CE QUE ÇA MESURE, ET CE QUE ÇA NE MESURE PAS : le grain est le SCRIPT, pas la ligne — une gate qui
// se met à atteindre un module écrivain de plus est vue ; une écriture NEUVE dans un module qui en
// portait déjà ne l'est pas. La lecture statique ne suit ni un chemin calculé, ni ce
// qu'un outil externe (eslint, knip, tsc, vitest) fait de son côté — d'où les entrées `lit`/`ecrit`
// de la table, qui restent une MESURE, pas une déduction.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clotureDImports } from '../guards/lib/importGraph.mjs'
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

/** Fermeture transitive des imports locaux, depuis des graines relatives à la racine. */
export function transitif(graines, racine) {
  return [...clotureDImports(graines, { racine, typesEffaces: true })]
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
