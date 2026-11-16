// LE LOT DES RECETTES DE L'HÔTE GODOT (#4007) : chaque jeu de `JEUX_DU_PARCOURS` par `recette.mjs`, l'un après
// l'autre sur un export déjà produit (`node hotes/godot/construire.mjs --export --sortie <web>`), menés de front sans
// export (`--natif`, #3945, `jeuxPilotesDeFront`, #3412). Le journal et les captures de chaque jeu vont sous
// `--captures/<nom du jeu>/` ; le verdict de chacun s'imprime à sa fin, la fin d'un journal rouge aussi, et le code est
// non nul dès qu'un jeu est rouge. Joué chaque semaine par `.github/workflows/canari.yml`.
// Avec `--rendu`, chaque jeu natif se joue en rendu réel : ses captures montrent l'écran (`npm run godot:regarder`).
// Le jeu `planche:<nom>`, que seul `--jeux` nomme, montre et capture la planche `<nom>` (parcours `planche`) : sa capture
// `<nom>.png` et son journal `<nom>.journal.txt` vont sous `--captures/planche/`.
//   node hotes/godot/lot-de-recettes.mjs (--web <export> | --natif [--rendu]) --captures <dossier> [--jeux combat,planche:<nom>]
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { enFileBornee } from '../../scripts/guards/lib/fileBornee.mjs'
import { jeuxPilotesDeFront } from './construire.mjs'

const DOSSIER = '<dossier>'
/** Le préfixe d'un jeu de planche, `planche:<nom>`. */
const PLANCHE = 'planche:'

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
  compendium: { compendium: [] },
  atelier: { atelier: [] },
  composition: {},
  planche: {},
  preset: { preset: ['--preset', 'sorcier'] },
}

/** Les jeux qu'une recette native ne joue pas (`--natif`), chacun avec ce qui lui manque : le lot natif les saute en le
 *  disant, et refuse celui que `--jeux` nomme. */
const HORS_NATIF = {
  'combat-statique': '`--statique` sert l’export tel que le site le publie, sans objet hors d’une page',
}

/** Les jeux qu'une recette native joue toujours en rendu réel, sous le rendu de la page, les autres sans écran hors `--rendu` :
 *  `vision` et `murs` lisent les pixels de leurs captures, `wfrpCadrer` (`cadrages`) attend l'image dessinée de la
 *  caméra posée, et l'atelier (`preset`) mesure ses meshes skinnés aux os que le serveur de rendu leur pourvoit. */
const RENDUS_EN_NATIF = new Set(['vision', 'murs', 'cadrages', 'preset'])
const RENDU_DE_LA_PAGE = 'gl_compatibility'

const RECETTE = fileURLToPath(new URL('./recette.mjs', import.meta.url))
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Ce qu'un jeu attend dans son dossier avant d'être joué, `{ nom du jeu: (dossier, sortie) => code }`. */
const PREPARER = {
  bord: (dossier, sortie) =>
    spawnSync(process.execPath, ['scripts/lancer-local.mjs', 'vitest', '--', 'vitest', 'run', '--config', 'vitest.noyau.config.ts', 'hotes/godot/recettes/route-a-bord.hors-store.test.ts'], { cwd: RACINE, env: { ...process.env, ROUTE: dossier }, stdio: ['ignore', sortie, sortie] }).status,
}
/** Le délai d'un jeu ; au-delà, `recette.mjs` reçoit SIGTERM et sort en éteignant son Chrome (`scripts/recette/lib.mjs`). */
const DELAI_MS = 90 * 60 * 1000

/** Le code de sortie de `node <args>` lancé depuis la racine, sa sortie et ses erreurs dans le descripteur `sortie`,
 *  SIGTERM à `DELAI_MS`. */
async function jouer(args, sortie) {
  const enfant = spawn(process.execPath, args, { cwd: RACINE, stdio: ['ignore', sortie, sortie], timeout: DELAI_MS })
  const [code] = await once(enfant, 'exit')
  return code
}
/** Les lignes d'un journal rouge recopiées au verdict. */
const QUEUE = 15

if (import.meta.main) {
  const { values: o } = parseArgs({ options: { web: { type: 'string' }, natif: { type: 'boolean' }, rendu: { type: 'boolean' }, captures: { type: 'string' }, jeux: { type: 'string' } } })
  if (!o.web === !o.natif || !o.captures || (o.rendu && !o.natif)) throw new Error('usage : node hotes/godot/lot-de-recettes.mjs (--web <dossier de l’export> | --natif [--rendu]) --captures <dossier> [--jeux <nom>,<nom>]')
  const lieu = (nom) => (!o.natif ? ['--web', resolve(o.web)] : o.rendu || RENDUS_EN_NATIF.has(nom) ? ['--natif', '--rendu', RENDU_DE_LA_PAGE] : ['--natif'])
  const jeux = Object.entries(JEUX_DU_PARCOURS).flatMap(([parcours, parNom]) => Object.entries(parNom).map(([nom, args]) => ({ nom, parcours, args, dossier: nom, journal: 'journal.txt' })))
  const voulus = o.jeux?.split(',') ?? jeux.map((j) => j.nom)
  for (const nom of voulus.filter((v) => v.startsWith(PLANCHE) && v.length > PLANCHE.length)) {
    const planche = nom.slice(PLANCHE.length)
    jeux.push({ nom, parcours: 'planche', args: ['--planche', planche], dossier: 'planche', journal: `${planche}.journal.txt` })
  }
  const inconnus = voulus.filter((nom) => !jeux.some((j) => j.nom === nom))
  if (inconnus.length) throw new Error(`--jeux ${inconnus.join(',')} : ${jeux.map((j) => j.nom).join(' ou ')} ou ${PLANCHE}<nom> attendu`)
  const horsNatif = (nom) => o.natif && Object.hasOwn(HORS_NATIF, nom)
  const refuses = (o.jeux ? voulus : []).filter(horsNatif)
  if (refuses.length) throw new Error(`--natif ne joue pas ${refuses.map((nom) => `${nom} (${HORS_NATIF[nom]})`).join(', ')}`)
  const joues = jeux.filter((j) => voulus.includes(j.nom)).filter(({ nom }) => {
    if (horsNatif(nom)) console.log(`${nom} : hors natif, ${HORS_NATIF[nom]}`)
    return !horsNatif(nom)
  })
  const verdicts = await enFileBornee(joues.map(({ nom, parcours, args, dossier: sous, journal: fichier }) => async () => {
    const dossier = resolve(o.captures, sous)
    mkdirSync(dossier, { recursive: true })
    const journal = resolve(dossier, fichier)
    const sortie = openSync(journal, 'w')
    const debut = Date.now()
    const pret = !PREPARER[nom] || PREPARER[nom](dossier, sortie) === 0
    const status = pret ? await jouer([RECETTE, ...lieu(nom), '--captures', dossier, '--parcours', parcours, ...args.map((a) => a.replace(DOSSIER, dossier))], sortie) : 1
    closeSync(sortie)
    console.log(`${nom} : ${status === 0 ? 'vert' : 'ROUGE'} (${Math.round((Date.now() - debut) / 1000)} s)`)
    if (status !== 0) console.log(readFileSync(journal, 'utf8').trimEnd().split('\n').slice(-QUEUE).map((ligne) => `  ${ligne}`).join('\n'))
    return { nom, vert: status === 0 }
  }), { deFront: o.natif ? jeuxPilotesDeFront() : 1 })
  const rouges = verdicts.filter((v) => !v.vert).map((v) => v.nom)
  console.log(rouges.length ? `lot ROUGE : ${rouges.join(', ')}` : 'lot vert')
  process.exitCode = rouges.length ? 1 : 0
}
