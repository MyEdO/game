// LE LOT DES RECETTES DE L'HÔTE GODOT (#4007) : chaque jeu de `JEUX_DU_PARCOURS`, l'un après l'autre, par
// `recette.mjs` sur un export déjà produit (`node hotes/godot/construire.mjs --export --sortie <web>`). Le journal et
// les captures de chaque jeu vont sous `--captures/<nom du jeu>/` ; le verdict de chacun s'imprime, la fin d'un journal
// rouge aussi, et le code est non nul dès qu'un jeu est rouge. Joué chaque semaine par `.github/workflows/canari.yml`.
//   node hotes/godot/lot-de-recettes.mjs --web <export> --captures <dossier> [--jeux combat,relief]
import { spawnSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const DOSSIER = '<dossier>'

/**
 * Les jeux de chaque parcours de `recette.mjs`, `{ nom du jeu: arguments après --parcours <parcours> }` ; `DOSSIER` y
 * vaut le dossier du jeu, que `PREPARER` remplit avant lui. `composition`, sans jeu, attend deux productions de la
 * chaîne 3D (`--base`, `--piece`) que le dépôt ne porte pas ; `recette.mjs` refuse un parcours absent d'ici.
 */
export const JEUX_DU_PARCOURS = {
  combat: { combat: [], 'combat-statique': ['--statique'], 'combat-teinte': ['--scenario', 'teinte-au-combat'] },
  critique: { critique: [] },
  fin: { fin: [] },
  dialogue: { dialogue: ['--scenario', 'dialogue-multi'] },
  document: { document: ['--scenario', 'documents-edo'] },
  incantation: { incantation: ['--scenario', 'magie'] },
  soin: { soin: ['--scenario', 'magie'] },
  voyage: { voyage: ['--scenario', 'voyage'] },
  marche: { marche: ['--scenario', 'commerce-fluvial'] },
  repos: { repos: ['--scenario', 'voyage'] },
  repit: { repit: ['--scenario', 'bataille-de-masse'] },
  ouvrage: { ouvrage: ['--scenario', 'entre-deux-aventures'] },
  bataille: { bataille: ['--scenario', 'bataille-de-masse'] },
  exploration: { exploration: ['--scenario', 'porte-close'] },
  relief: { relief: ['--scenario', 'grimpant'] },
  murs: { murs: ['--scenario', 'zones-pieces'] },
  etage: { etage: ['--scenario', 'fenetre-ecuries'] },
  regards: { regards: ['--scenario', 'fenetre-ecuries'] },
  meteo: { meteo: ['--scenario', 'voyage'] },
  vehicule: { vehicule: ['--scenario', 'caraque'] },
  cadrages: { cadrages: ['--scenario', 'a-bord-de-la-caraque', '--vues', 'hotes/godot/cadrages/a-bord-de-la-caraque.json'] },
  bord: { bord: ['--scenario', 'a-bord-de-la-caraque', '--route', `${DOSSIER}/a-bord-de-la-caraque.json`] },
  brume: { brume: ['--scenario', 'brouillard'] },
  vision: { vision: ['--scenario', 'grimpant'] },
  fiche: { fiche: [] },
  inventaire: { inventaire: ['--scenario', 'porte-close'] },
  creation: { creation: ['--scenario', 'marche-equipement'] },
  campagne: { campagne: [] },
  roster: { roster: [] },
  reglages: { reglages: [] },
  editeur: { editeur: [] },
  atelier: { atelier: [] },
  composition: {},
  preset: { preset: ['--preset', 'sorcier'] },
}

const RECETTE = fileURLToPath(new URL('./recette.mjs', import.meta.url))
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Ce qu'un jeu attend dans son dossier avant d'être joué, `{ nom du jeu: (dossier, sortie) => code }`. */
const PREPARER = {
  bord: (dossier, sortie) =>
    spawnSync(process.execPath, ['scripts/lancer-local.mjs', 'vitest', '--', 'vitest', 'run', '--config', 'vitest.noyau.config.ts', 'hotes/godot/recettes/route-a-bord.hors-store.test.ts'], { cwd: RACINE, env: { ...process.env, ROUTE: dossier }, stdio: ['ignore', sortie, sortie] }).status,
}
/** Le délai d'un jeu ; au-delà, `recette.mjs` reçoit SIGTERM et sort en éteignant son Chrome (`scripts/recette/lib.mjs`). */
const DELAI_MS = 90 * 60 * 1000
/** Les lignes d'un journal rouge recopiées au verdict. */
const QUEUE = 15

if (import.meta.main) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, captures: { type: 'string' }, jeux: { type: 'string' } } })
  if (!o.web || !o.captures) throw new Error('usage : node hotes/godot/lot-de-recettes.mjs --web <dossier de l’export> --captures <dossier> [--jeux <nom>,<nom>]')
  const jeux = Object.entries(JEUX_DU_PARCOURS).flatMap(([parcours, parNom]) => Object.entries(parNom).map(([nom, args]) => ({ nom, parcours, args })))
  const voulus = o.jeux?.split(',') ?? jeux.map((j) => j.nom)
  const inconnus = voulus.filter((nom) => !jeux.some((j) => j.nom === nom))
  if (inconnus.length) throw new Error(`--jeux ${inconnus.join(',')} : ${jeux.map((j) => j.nom).join(' ou ')} attendu`)
  const rouges = []
  for (const { nom, parcours, args } of jeux.filter((j) => voulus.includes(j.nom))) {
    const dossier = resolve(o.captures, nom)
    mkdirSync(dossier, { recursive: true })
    const journal = resolve(dossier, 'journal.txt')
    const sortie = openSync(journal, 'w')
    const debut = Date.now()
    const pret = !PREPARER[nom] || PREPARER[nom](dossier, sortie) === 0
    const status = pret ? spawnSync(process.execPath, [RECETTE, '--web', resolve(o.web), '--captures', dossier, '--parcours', parcours, ...args.map((a) => a.replace(DOSSIER, dossier))], { cwd: RACINE, stdio: ['ignore', sortie, sortie], timeout: DELAI_MS }).status : 1
    closeSync(sortie)
    console.log(`${nom} : ${status === 0 ? 'vert' : 'ROUGE'} (${Math.round((Date.now() - debut) / 1000)} s)`)
    if (status === 0) continue
    rouges.push(nom)
    console.log(readFileSync(journal, 'utf8').trimEnd().split('\n').slice(-QUEUE).map((ligne) => `  ${ligne}`).join('\n'))
  }
  console.log(rouges.length ? `lot ROUGE : ${rouges.join(', ')}` : 'lot vert')
  process.exitCode = rouges.length ? 1 : 0
}
