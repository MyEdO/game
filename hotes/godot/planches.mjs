// LES PLANCHES ET LEURS ÉTALONS (#3935). Une planche est un état de partie figé par le pont (`Planche`,
// `figerLesPlanches`, `recettes/ecran.ts`), que le jeu montre à l'adresse `?planche=<nom>`
// (`projet/scripts/pont_de_planche.gd`) ; son étalon est la capture de son écran que le banc compare (`etalons.mjs`).
// Une planche est un dérivé de l'export, jamais commitée : `construire.mjs --export` la fige et la dépose sous
// `<export>/planches/<nom>.json`, le monde de son scénario sous `<export>/planches/mondes/<scenario>.json`
// (`deposerLesPlanches`). Sous `etalons/` sont commités `<nom>.png`, l'étalon de la planche, et `valides.json`, par nom
// de planche la date et l'empreinte SHA-256 de l'étalon que l'utilisateur a validé. Un étalon ne vaut que pour le
// Chromium épinglé (`EPINGLE`) sous Linux x86-64 (`refusDuNavigateur`) : la porte de file le compare
// (job `migrations` de `.github/workflows/ci.yml`), qui installe ce Chromium à la version de Playwright lue ici.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DOSSIER_DES_ETALONS = fileURLToPath(new URL('./etalons', import.meta.url))
export const VALIDES = join(DOSSIER_DES_ETALONS, 'valides.json')
/** Le build du navigateur des étalons : la version de Playwright qui l'installe, et celle de Chrome for Testing qu'il
 *  installe. Monter l'épingle, c'est reposer tous les étalons dans le même commit. */
export const EPINGLE = Object.freeze({ playwright: '1.63.0', chrome: '153.0.8010.12' })
/** La plateforme où l'épingle a été mesurée (`process.platform`, `process.arch`). */
const PLATEFORME = Object.freeze({ plateforme: 'linux', architecture: 'x64' })

/** Les planches `planches` (`figerLesPlanches`) écrites sous `planches/` de `sortie`, celles d'avant retirées, et le
 *  monde de chaque scénario sous `planches/mondes/` ; deux planches d'un scénario au monde différent : refusé. */
export function deposerLesPlanches(sortie, planches) {
  const dossier = join(sortie, 'planches')
  rmSync(dossier, { recursive: true, force: true })
  mkdirSync(join(dossier, 'mondes'), { recursive: true })
  const mondes = new Map()
  for (const { monde, ...planche } of planches) {
    const { scenario } = planche.parametres
    const json = JSON.stringify(monde)
    if (mondes.has(scenario) && mondes.get(scenario) !== json) throw new Error(`${planche.nom} : le monde de ${scenario} n’est pas celui de ses autres planches`)
    mondes.set(scenario, json)
    writeFileSync(join(dossier, `${planche.nom}.json`), `${JSON.stringify(planche)}\n`)
  }
  for (const [scenario, json] of mondes) writeFileSync(join(dossier, 'mondes', `${scenario}.json`), `${json}\n`)
}

/** Le refus du banc pour le navigateur `navigateur` (le `product` de `Browser.getVersion`, `<nom>/<version>`) lancé
 *  sur `plateforme` et `architecture` (`process.platform`, `process.arch`) : ce qu'il a lu, ce qu'il attend et la
 *  commande qui installe le build épinglé ; `null` pour le seul `Chrome/<EPINGLE.chrome>` sous Linux x86-64. PURE. */
export function refusDuNavigateur(navigateur, { plateforme, architecture }) {
  const surLaPlateforme = plateforme === PLATEFORME.plateforme && architecture === PLATEFORME.architecture
  if (surLaPlateforme && navigateur === `Chrome/${EPINGLE.chrome}`) return null
  return `navigateur ${navigateur} sous ${plateforme}-${architecture}, le banc attend Chrome ${EPINGLE.chrome} sous ` +
    `${PLATEFORME.plateforme}-${PLATEFORME.architecture} ; sur une telle machine : ` +
    `PLAYWRIGHT_BROWSERS_PATH=<dossier> npx -y playwright@${EPINGLE.playwright} install chromium, puis le banc avec ce même PLAYWRIGHT_BROWSERS_PATH`
}

/** Les étalons de `fichiers` (le contenu du dossier des étalons) qu'aucune planche de `noms` ne porte. PURE. */
export const etalonsSansPlanche = (fichiers, noms) => fichiers.filter((f) => f.endsWith('.png') && !noms.includes(f.slice(0, -'.png'.length)))
