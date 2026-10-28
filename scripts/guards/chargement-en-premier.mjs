// GATE `noyau:chargement` (#3058) : chaque module des zones du noyau, du moteur, de la donnée et des feuilles qu'il
// compose, de ses hôtes et des scénarios qu'ils chargent (`ZONES`) se charge EN PREMIER, dans un graphe de modules
// neuf, sans erreur d'ordre d'initialisation. Un hôte ou un outil entre dans le noyau par n'importe quel module ; un
// cycle d'import qui lit une liaison non évaluée y casse son chargement.
//
// Chargeur : le module runner de Vite (`runnerImport`), celui de chaque hôte réel — hôte texte
// (`scripts/hote-texte.mjs:14`), assets de Godot (`hotes/godot/asset/charger.mjs:2`), Vitest, app web.
// Limite : sous Vite, une CONSTANTE lue avant son évaluation se lit `undefined` (un calcul sur elle rend `NaN`), sans
// erreur ; cette classe ne lève que sous l'ESM de Node, et cette garde ne l'attrape pas.
//
// Pourquoi une garde, et non la structure : le noyau porte une composante d'import cyclique de 46 modules (et une de
// 4), mesurée le 2026-10-28, où vivent `rollFlowFactory` et `rollFlowSpecs`. La fabrique y entre par trois arêtes
// (`combatOrParty`, `rollSeam`, `corruptionFlow`) ; extraire `touchActors` et `surfaceOf` dans des feuilles laisse la
// composante à 46, et seule la sortie de `gainCorruption` (la Corruption entière : mutation, cascade, seuil) la ramène
// à 45, sans en sortir `rollFlowSpecs`. Aucun découpage local ne rend le cycle incompilable.
//
// Absolue : aucun module n'en est exempté ; les modules de test (`*.test.*`, `*.testkit.*`) sont hors de son champ par
// leur nature de fichier. Des travailleurs en parallèle chargent chacun un LOT de modules
// (`scripts/guards/lib/chargementDUnModule.mjs`), chaque lot BORNÉ (`spawnBorne`) : un module qui pend est nommé, le
// reste de son lot repart. Rend 1 dès qu'un module échoue.
import '../node-requis.mjs'
import { mkdtempSync, rmSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dossierDe } from './lib/couches.mjs'
import { TRAVAIL, depotDe, listerImage } from './lib/gitPorte.mjs'
import { spawnBorne } from './lib/processusBorne.mjs'
import { MARQUE_DE_VERDICT } from './lib/chargementDUnModule.mjs'

/** Les zones dont chaque module se charge en premier (`COUCHES`, couches.mjs) : le noyau, le moteur, la donnée et les
 *  feuilles qu'il compose, ses hôtes (`hote`, `hoteTexte`, `hotes` hors de `src/`) et les scénarios qu'ils chargent. */
export const ZONES = Object.freeze(['noyau', 'engine', 'data', 'lib', 'geometry', 'i18n', 'hote', 'hoteTexte', 'hotes', 'scenes'])

/** Modules par lot d'un travailleur. */
const TAILLE_DE_LOT = 12

/** Borne d'un lot : son démarrage (serveur Vite, premier graphe transformé), puis chaque module. */
const bornesDuLot = (n) => 90_000 + 20_000 * n

const TRAVAILLEUR = fileURLToPath(new URL('./lib/chargementDUnModule.mjs', import.meta.url))

/** Le chemin POSIX relatif `rel` est-il un module à charger : source TypeScript, ni test, ni testkit, ni déclaration. */
export const estModuleACharger = (rel) =>
  /\.(m?ts|tsx)$/.test(rel) && !/\.d\.m?ts$/.test(rel) && !/\.(test|testkit)\./.test(rel)

/** Les modules de la zone `zone` (`dossierDe`, couches.mjs) sous `racine`, suivis ou non encore indexés, triés. */
export const modulesDeZone = (racine, zone) =>
  listerImage(depotDe(racine), TRAVAIL, dossierDe(zone)).filter(estModuleACharger).sort()

/** Les verdicts `{ module, echec }` que rend la sortie d'un travailleur, dans leur ordre. */
export const verdictsDe = (sortie) => sortie.split(/\r?\n/)
  .filter((l) => l.startsWith(MARQUE_DE_VERDICT))
  .map((l) => JSON.parse(l.slice(MARQUE_DE_VERDICT.length)))

/** La ligne qui nomme la panne d'un travailleur, hors des verdicts qu'il a rendus : la première qui COMMENCE par une
 *  erreur nommée (`TypeError: …`), sinon la dernière ligne non vide. */
export function erreurDe(sortie) {
  const lignes = sortie.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith(MARQUE_DE_VERDICT.trim()))
  return lignes.find((l) => /^(Uncaught )?([A-Z]\w*)?(Error|Exception)( \[\w+\])?: /.test(l)) ?? lignes.at(-1) ?? '(aucune sortie)'
}

/**
 * Charge chaque module de `modules` (relatifs à `racine`) EN PREMIER, par lots bornés, `parallele` à la fois.
 * @returns {Promise<Array<{ module: string, erreur: string, pile: string[] }>>}
 *   les modules en échec, dans l'ordre de `modules`
 */
export async function chargerEnPremier(racine, modules, { parallele = availableParallelism(), tailleDeLot = TAILLE_DE_LOT, borne = bornesDuLot } = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'chargement-en-premier-'))
  const lots = []
  for (let i = 0; i < modules.length; i += tailleDeLot) lots.push(modules.slice(i, i + tailleDeLot))
  const echecs = new Map()
  let numero = 0
  const fil = async () => {
    for (let lot = lots.shift(); lot; lot = lots.shift()) {
      const limiteMs = borne(lot.length)
      const r = await spawnBorne({ argv: [TRAVAILLEUR, racine, ...lot], fichier: join(dossier, `lot-${numero++}.txt`), limiteMs, cwd: racine })
      const rendus = verdictsDe(r.sortie)
      for (const { module, echec } of rendus) if (echec) echecs.set(module, echec)
      if (rendus.length === lot.length) {
        // Une panne après le dernier verdict (rejet tardif, exception d'un minuteur) : portée par le dernier module du lot.
        const dernier = lot.at(-1)
        if (r.code !== 0 && !echecs.has(dernier))
          echecs.set(dernier, { erreur: `travailleur en panne après le dernier verdict de son lot de ${lot.length} (code ${r.code}) : ${erreurDe(r.sortie)}`, pile: [] })
        continue
      }
      const [pendu, ...reste] = lot.slice(rendus.length)
      const cause = r.expiree ? `ne rend pas son verdict en ${limiteMs} ms (lot de ${lot.length})` : `travailleur en panne (code ${r.code}) : ${erreurDe(r.sortie)}`
      echecs.set(pendu, { erreur: cause, pile: [] })
      if (reste.length) lots.push(reste)
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.max(1, Math.min(parallele, lots.length)) }, fil))
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
  return modules.filter((m) => echecs.has(m)).map((module) => ({ module, ...echecs.get(module) }))
}

/** Le rapport d'un module en échec : son erreur, puis ses lignes de pile. */
export const rapportDe = ({ module, erreur, pile }) => `  ${module} : ${erreur}\n${pile.map((l) => `      ${l}\n`).join('')}`

if (import.meta.main) {
  const racine = process.cwd()
  const modules = ZONES.flatMap((z) => modulesDeZone(racine, z))
  const t0 = Date.now()
  const echecs = await chargerEnPremier(racine, modules)
  const bilan = `${modules.length} modules (${ZONES.map(dossierDe).join(', ')}) chargés en premier, ${echecs.length} échec(s), ${((Date.now() - t0) / 1000).toFixed(1)} s`
  if (echecs.length === 0) {
    process.stdout.write(`[noyau:chargement] ${bilan}\n`)
  } else {
    process.stderr.write(`[noyau:chargement] ${bilan}\n${echecs.map(rapportDe).join('')}`)
    process.exit(1)
  }
}
