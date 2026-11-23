// L'ÉVALUATEUR EN LIGNE DE COMMANDE (#2972) : `evaluateur/evaluer.ts` sur un GLB, chargé comme les assets
// (`chargerEvaluateur`, `charger.mjs`). Une ligne par écart ; code de sortie 1 s'il y a un écart ou
// si la base ne porte pas un clip, une silhouette ou la carrure demandés, 0 sinon.
//   npm run godot:evaluer -- <glb>... [--base <glb>] [--manifeste <json>]
//     [--facteurs sl=1,legs=1,arms=1,head=1,st=1] [--silhouettes feminin=1,corpulence=1]
//     [--pas 0.0416] [--clips a,b] [--plafonds <json>] [--json <sortie>] [--temoin <rapport.json>] [--etats-gabarit] [--porte]
//     [--preset <id> | --tenue <id> [--local <id>=<glb>]... [--portee <id>[,<id>…]]] [--poses-rangees]
// Avec `--base`, chaque `<glb>` est un élément monté sur cette base, ensemble (une tenue), sa couche et ses zones lues
// dans le manifeste d'élément voisin (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json` d'un import) :
// la traversée des couches se mesure (#3743) ; seul un élément dont la forme `cle.apparence` est celle d'une arme (un
// trapping `melee` ou `distance` de cette `shape`, `src/data/trappings.json`) porte un tranchant (`tranchantDuRigide`) :
// un sac rangé n'en a pas. Sans `--base`, l'unique `<glb>` est la base. Sans `--manifeste`, seule
// la racine a une position animée (`osAPositionAnimee` du manifeste de base). `--porte` joue les passes de la porte d'un
// élément (#3743) : le corps neutre, puis chaque silhouette déclarée par le manifeste de base seule à 1, chacune dans son
// processus, en parallèle sur les cœurs et la mémoire libre de la machine, le tas de chacune borné ; code 1 si une
// passe a un écart. Sous `--porte`, `--json` et
// `--temoin` nomment un rapport par passe, le nom de la passe inséré avant `.json` (`mesure.json` → `mesure.neutre.json`,
// `parPasse`) : le `--json` d'une porte sert de témoin à la suivante. `--plafonds` nomme la table des
// écarts `membre-dans-un-vetement` que la tenue admet, `{ "<passe>": { "<clip>": <nombre> } }` (`gardeMembreDansUnVetement`).
// `--temoin` nomme le rapport `--json` d'un run antérieur : la sortie ne liste que les écarts absents du témoin
// (`identiteDEcart`, `evaluateur/temoin.ts`) après une ligne de compte, et le code est 1 seulement s'il y en a ; `--json`
// écrit toujours le rapport complet (#4338). Le libellé `élément k` d'un mesh est positionnel : le témoin se compare
// aux mêmes `<glb>` dans le même ordre, les éléments neufs à la fin. `--preset` nomme un preset de personnage
// (`src/data/presets-de-personnage.json`) : chaque rigide qu'il range se mesure là où le jeu le range, au repos et à
// chaque instant échantillonné, sur l'emplacement de la base ou la case de la pièce qui l'offre, posé par l'éditeur
// Godot épinglé en un lancement (`posesDesRanges.mjs`, #4351), et la garde `rigideRange` le mesure contre ce qui est
// porté ; un élément que le preset porte plusieurs fois se donne autant de fois, chaque `<glb>` montant à son tour la
// ligne suivante du preset. Sous `--preset`, chaque passe pose aussi les formes de la tête que le jeu pose au preset, une
// forme que `--silhouettes` nomme gardant le poids qu'il lui donne (`silhouettesSousLePreset`).
// `--tenue <id>` vaut `--preset <id>` et met en tête des `<glb>` la tenue que le jeu monte pour ce preset, dans l'ordre de
// ses lignes (`tenueDesGlb`, `posesDesRanges.mjs`, #4338), au dossier du manifeste de base ; chaque `--local <id>=<glb>`
// y remplace l'élément publié `<id>` par ce GLB local, à côté de son manifeste, ou s'ajoute après la tenue si le preset ne
// le monte pas. `--poses-rangees` n'évalue rien : sous le corps neutre puis chaque silhouette déclarée seule à 1, à
// l'instant 0 de l'unique clip de `--clips`, il imprime la pose de chaque mesh rangé des `<glb>` (`posesALInstant`) et,
// avec `--local`, celle du même mesh dans la tenue publiée, leur écart, et `BASCULE` au-delà de `BASCULE` (#4806) ; code 1
// s'il y en a une. `--portee <id>[,<id>…]` (#4814), sous `--tenue` et sans `--plafonds`, nomme des éléments des `<glb>`
// par leur id (le nom du GLB) : les gardes ne mesurent que ce qui nomme un mesh de ces éléments ou des couches que la
// pile leur fait retenir, de proche en proche (`EntreeDEvaluation.portee`), le rapport ne garde que ces écarts et liste
// ces meshes (`portee`), et le témoin se filtre de même (`deLaPortee`, `evaluateur/temoin.ts`) : la passe d'une retouche
// d'élément, contre le témoin pris sous la même portée.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { coeurs, memoireDisponibleMo } from '../../../scripts/test/partition.mjs'
import { estObjet } from '../../../src/lib/objet.mjs'
import { chargerEvaluateur } from './charger.mjs'
import { lireLocales, manifesteVoisin, porteeDuPreset, posesALInstant, posesDesRanges, silhouettesSousLePreset, tenueDesGlb } from './posesDesRanges.mjs'

const FACTEURS = ['sl', 'legs', 'arms', 'head', 'st']
/** Ce qu'une passe de `--porte` tient hors de son tas, en Mo : ses tableaux de sommets et l'éditeur Godot de ses poses
 *  (0,75 et 0,8 Go mesurés sur la tenue du Gladiateur, #4743). */
const HORS_DU_TAS_MO = 2048
/** Le tas d'une passe en Mo, sous lequel `--porte` mène moins de passes de front : la tenue du Gladiateur tient en 1,5 Go.
 *  Sans borne, chaque passe laisse grossir son tas jusqu'à 6 Go et la porte meurt faute de mémoire (#4743). */
const TAS_MINIMAL_MO = 1536

const lirePaires = (texte, option, cles) => Object.fromEntries(texte.split(',').map((paire) => {
  const [cle, valeur, ...reste] = paire.split('=')
  if (!cle || cle.trim() !== cle || valeur === undefined || !valeur.trim() || reste.length || !Number.isFinite(Number(valeur)) || (cles && !cles.includes(cle))) {
    throw new Error(`--${option} : « ${paire} » ; attendu ${cles ? cles.map((c) => `${c}=<nombre>`).join(',') : 'nom=<nombre>[,nom=<nombre>]'}`)
  }
  return [cle, Number(valeur)]
}))

/** Les plafonds de la passe jouée, le corps neutre (`neutre`) ou la silhouette seule à 1, lus de la table `chemin`. */
function lirePlafonds(chemin, silhouettes = {}) {
  const noms = Object.keys(silhouettes)
  if (noms.length > 1 || noms.some((nom) => silhouettes[nom] !== 1)) throw new Error('--plafonds : une passe de la porte, le corps neutre ou une silhouette seule à 1')
  const table = JSON.parse(readFileSync(chemin, 'utf8'))
  if (!estObjet(table) || !Object.values(table).every((passe) => estObjet(passe) && Object.values(passe).every((n) => Number.isInteger(n) && n >= 1))) {
    throw new Error(`--plafonds : ${chemin} n’est pas une table { "<passe>": { "<clip>": <entier ≥ 1> } }`)
  }
  return table[noms[0] ?? 'neutre'] ?? {}
}

/** Le déplacement, en mètres, et le tour, en degrés, au-delà desquels la pose rangée d'un rigide local bascule loin de
 *  celle du rigide publié sous `--poses-rangees` (#4806). */
const BASCULE = { metres: 0.05, degres: 15 }

/** L'origine `(x, y, z)` d'une pose de 16 nombres colonne par colonne (`posesALInstant`). */
const origine = (pose) => `(${pose.slice(12, 15).map((v) => v.toFixed(3)).join(', ')})`

/** L'écart des poses `a` et `b` (16 nombres colonne par colonne) : la distance de leurs origines, en mètres, et l'angle
 *  de la rotation de l'une à l'autre, en degrés, leurs axes ramenés à l'unité. */
function ecartDePoses(a, b) {
  const axe = (m, k) => { const v = m.slice(4 * k, 4 * k + 3); const n = Math.hypot(...v); return v.map((x) => x / n) }
  const trace = [0, 1, 2].reduce((somme, k) => somme + axe(a, k).reduce((d, x, i) => d + x * axe(b, k)[i], 0), 0)
  return { metres: Math.hypot(...[12, 13, 14].map((i) => a[i] - b[i])), degres: (Math.acos(Math.min(1, Math.max(-1, (trace - 1) / 2))) * 180) / Math.PI }
}

/** Les rangs, dans les `<glb>` `glbs`, des éléments dont `--portee` nomme l'id (le nom du GLB) ; refuse un id absent. */
function lirePortee(texte, glbs) {
  const ids = glbs.map((g) => basename(g, '.glb'))
  const absents = texte.split(',').filter((id) => !ids.includes(id))
  if (absents.length) throw new Error(`--portee : ${absents.join(', ')} absent(s) de la tenue ; ids : ${[...new Set(ids)].join(', ')}`)
  return ids.flatMap((id, k) => (texte.split(',').includes(id) ? [k] : []))
}

/** Les écarts du rapport `--json` `chemin` d'une évaluation, refusé s'il n'en porte pas. */
function lireTemoin(chemin) {
  const rapport = JSON.parse(readFileSync(chemin, 'utf8'))
  if (!estObjet(rapport) || !Array.isArray(rapport.ecarts)) throw new Error(`--temoin : ${chemin} n’est pas le rapport --json d’une évaluation (sans « ecarts »)`)
  return rapport.ecarts
}

let values, positionals, facteurs, silhouettes, plafonds, temoin, ajoutes, portee
try {
  const argumentsLus = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: 'string' },
      manifeste: { type: 'string' },
      'etats-gabarit': { type: 'boolean' },
      porte: { type: 'boolean' },
      facteurs: { type: 'string' },
      silhouettes: { type: 'string' },
      pas: { type: 'string' },
      clips: { type: 'string' },
      json: { type: 'string' },
      plafonds: { type: 'string' },
      temoin: { type: 'string' },
      preset: { type: 'string' },
      tenue: { type: 'string' },
      local: { type: 'string', multiple: true },
      'poses-rangees': { type: 'boolean' },
      portee: { type: 'string' },
    },
  })
  values = argumentsLus.values
  positionals = argumentsLus.positionals
  if (values['etats-gabarit'] && (!values.manifeste || values.facteurs !== undefined || values.silhouettes !== undefined)) {
    throw new Error('--etats-gabarit : --manifeste requis, --facteurs et --silhouettes incompatibles')
  }
  if (values.porte && (!values.manifeste || values['etats-gabarit'] || values.silhouettes !== undefined)) {
    throw new Error('--porte : --manifeste requis, --etats-gabarit et --silhouettes incompatibles')
  }
  facteurs = values.facteurs === undefined ? undefined : lirePaires(values.facteurs, 'facteurs', FACTEURS)
  silhouettes = values.silhouettes === undefined ? undefined : lirePaires(values.silhouettes, 'silhouettes')
  if (values.plafonds !== undefined && (values['etats-gabarit'] || facteurs !== undefined)) throw new Error('--plafonds : --etats-gabarit et --facteurs incompatibles')
  plafonds = values.plafonds === undefined ? undefined : lirePlafonds(values.plafonds, silhouettes)
  if (values.temoin !== undefined && values['etats-gabarit']) throw new Error('--temoin : --etats-gabarit incompatible')
  temoin = values.temoin === undefined || values.porte ? undefined : lireTemoin(values.temoin)
  if (values.tenue !== undefined && values.preset !== undefined) throw new Error('--tenue : implique --preset, à ne pas donner')
  if (values.local !== undefined && values.tenue === undefined) throw new Error('--local : --tenue requis')
  if (values.portee !== undefined && (values.tenue === undefined || values.plafonds !== undefined)) throw new Error('--portee : --tenue requis, --plafonds incompatible')
  values.preset ??= values.tenue
  if (values.preset !== undefined && !(values.base && values.manifeste)) throw new Error(`${values.tenue === undefined ? '--preset' : '--tenue'} : --base et --manifeste requis`)
  if (values['poses-rangees'] && (values.preset === undefined || values.porte || values['etats-gabarit'] || silhouettes !== undefined || values.clips?.split(',').length !== 1)) {
    throw new Error('--poses-rangees : --tenue ou --preset requis, un seul clip par --clips, --porte, --etats-gabarit et --silhouettes incompatibles')
  }
  ajoutes = positionals
  if (values.tenue !== undefined) positionals = [...await tenueDesGlb({ manifeste: values.manifeste, portee: await porteeDuPreset(values.tenue), locales: lireLocales(values.local) }), ...ajoutes]
  portee = values.portee === undefined ? undefined : lirePortee(values.portee, positionals)
} catch (erreur) {
  console.error(erreur.message)
  process.exit(2)
}
const sansManifeste = values.base ? positionals.filter((g) => !manifesteVoisin(g)) : []
if (values.base ? positionals.length === 0 || sansManifeste.length : positionals.length !== 1) {
  if (sansManifeste.length) console.error(`sans manifeste d’élément voisin (<id>.element.json ou <id>.manifeste.json) : ${sansManifeste.join(', ')}`)
  console.error('usage : npm run godot:evaluer -- <glb>... [--base <glb>] [--manifeste <json>] [--facteurs sl=1,legs=1,arms=1,head=1,st=1] [--silhouettes feminin=1,corpulence=1] [--pas 0.0416] [--clips a,b] [--plafonds <json>] [--json <sortie>] [--temoin <rapport.json>] [--etats-gabarit] [--porte] [--preset <id> | --tenue <id> [--local <id>=<glb>]... [--portee <id>[,<id>…]]] [--poses-rangees]')
  console.error('  sans --manifeste : ni gabarit ni prise, et seule la racine a une position animée')
  process.exit(2)
}
const pas = values.pas === undefined ? undefined : Number(values.pas)
if (pas !== undefined && !(pas > 0)) {
  console.error(`--pas : « ${values.pas} » n’est pas un pas positif`)
  process.exit(2)
}

/** Sort avec le code `code` une fois les sorties standard et d'erreur écrites : `process.exit` seul tronque une sortie
 *  en tuyau. */
async function sortir(code) {
  await Promise.all([process.stdout, process.stderr].map((flux) => new Promise((resolve) => flux.write('', resolve))))
  process.exit(code)
}

/** Un écart (`Ecart`, `evaluateur/ecart.ts`) en une ligne. */
const ligneDEcart = (e) =>
  `[${e.garde}/${e.code}]${e.mesh ? ` ${e.mesh}` : ''}${e.clip ? ` ${e.clip}` : ''}${e.t === undefined ? '' : ` t=${e.t.toFixed(3)}`} : ${e.detail} (valeur ${typeof e.valeur === 'number' ? +e.valeur.toPrecision(6) : e.valeur}, seuil ${e.seuil ?? '—'})`

if (values.porte) {
  const { silhouettes: declarees = [] } = JSON.parse(readFileSync(values.manifeste, 'utf8'))
  const passes = [['neutre', []], ...declarees.map((nom) => [nom, ['--silhouettes', `${nom}=1`]])]
  const parPasse = (option, nom) => (values[option] === undefined ? [] : [`--${option}`, values[option].replace(/(\.json)?$/, `.${nom}$1`)])
  const propres = ['json', 'temoin']
  const args = process.argv.slice(2).filter((a, i, tous) => a !== '--porte' && !propres.some((o) => a === `--${o}` || a.startsWith(`--${o}=`) || tous[i - 1] === `--${o}`))
  const jouer = ([nom, ajout]) => new Promise((resolve) => {
    const enfant = spawn(process.execPath, [tas, fileURLToPath(import.meta.url), ...args, ...ajout, ...propres.flatMap((o) => parPasse(o, nom))], { stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    enfant.stdout.on('data', (d) => { sortie += d })
    enfant.stderr.on('data', (d) => { sortie += d })
    enfant.on('close', (code) => resolve({ nom, code, sortie }))
  })
  const memoire = memoireDisponibleMo(process.env)
  const deFront = Math.max(1, Math.min(coeurs(process.env, availableParallelism), passes.length, Math.floor(memoire / (TAS_MINIMAL_MO + HORS_DU_TAS_MO))))
  const tas = `--max-old-space-size=${Math.max(TAS_MINIMAL_MO, Math.floor(memoire / deFront - HORS_DU_TAS_MO))}`
  const resultats = []
  const file = [...passes]
  await Promise.all(Array.from({ length: deFront }, async () => {
    while (file.length) resultats.push(await jouer(file.shift()))
  }))
  for (const [nom] of passes) {
    const r = resultats.find((x) => x.nom === nom)
    console.log(`PASSE ${nom} : code ${r.code}`)
    process.stdout.write(r.sortie)
  }
  await sortir(resultats.some((r) => r.code !== 0) ? 1 : 0)
}

if (values['poses-rangees']) {
  const { silhouettes: declarees = [] } = JSON.parse(readFileSync(values.manifeste, 'utf8'))
  const locales = values.tenue === undefined ? {} : lireLocales(values.local)
  const publiees = Object.keys(locales).length ? [...await tenueDesGlb({ manifeste: values.manifeste, portee: await porteeDuPreset(values.tenue) }), ...ajoutes] : null
  const instant = { base: values.base, manifeste: values.manifeste, preset: values.preset, clip: values.clips.split(',')[0], t: 0, ...(facteurs ? { facteurs } : {}) }
  let bascules = 0
  for (const [passe, poids] of [['neutre', {}], ...declarees.map((nom) => [nom, { [nom]: 1 }])]) {
    const poser = async (elements) => {
      const { elements: poses, sans } = await posesALInstant({ ...instant, elements, silhouettes: poids })
      if (sans.length) console.error(`${passe} : ligne(s) montée(s) par le jeu sans <glb> répété : ${sans.join(', ')}`)
      return new Map(poses.flatMap((e) => (e ? Object.entries(e.meshes).map(([mesh, pose]) => [`${mesh} (${e.ligne})`, pose]) : [])))
    }
    const ici = await poser(positionals)
    const publie = publiees && await poser(publiees)
    for (const mesh of new Set([...ici.keys(), ...(publie?.keys() ?? [])])) {
      const pose = ici.get(mesh) ?? null
      const reference = publie?.get(mesh) ?? null
      const ecart = pose && reference ? ecartDePoses(pose, reference) : null
      const bascule = publie !== null && (ecart === null ? (pose === null) !== (reference === null) : ecart.metres > BASCULE.metres || ecart.degres > BASCULE.degres)
      if (bascule) bascules++
      console.log(`${passe} ${mesh} : ${pose ? `origine ${origine(pose)} m` : 'non rangé'}${publie ? ` ; publiée ${reference ? `${origine(reference)} m` : 'non rangée'}${ecart ? `, écart ${ecart.metres.toFixed(3)} m, ${ecart.degres.toFixed(1)}°` : ''}${bascule ? ' BASCULE' : ''}` : ''}`)
    }
  }
  if (publiees) console.log(`${bascules} pose(s) rangée(s) qui basculent (au-delà de ${BASCULE.metres} m ou ${BASCULE.degres}° de la publiée)`)
  await sortir(bascules ? 1 : 0)
}

const { evaluer } = await chargerEvaluateur()
const couche = (glb) => {
  const { couche, couvre = [], categorie } = JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8'))
  return couche ? { couche, couvre, categorie } : null
}
const FORMES_D_ARMES = new Set(JSON.parse(readFileSync(new URL('../../../src/data/trappings.json', import.meta.url), 'utf8'))
  .filter((t) => t.shape && ['melee', 'distance'].includes(t.categorie)).map((t) => t.shape.id))
const arme = (glb) => FORMES_D_ARMES.has(JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8')).cle?.apparence)
/** Le rangeur de `evaluer` (`Rangeur`, `evaluateur/rangement.ts`) sous le preset de personnage `preset` : les poses
 *  que le jeu donne aux rigides rangés des `<glb>` (`posesDesRanges`) ; une ligne du preset sans `<glb>` se dit. */
const ranger = (preset) => async (instants) => {
  const { elements, sans } = await posesDesRanges({ base: values.base, manifeste: values.manifeste, elements: positionals, preset, instants })
  if (sans.length) console.error(`--preset ${preset} : ligne(s) montée(s) par le jeu sans <glb> répété : ${sans.join(', ')}`)
  return elements
}
/** Les poids `silhouettes` d'une évaluation, sous le preset `--preset` s'il est nommé (`silhouettesSousLePreset`). */
const sousLePreset = async (silhouettes) => (values.preset === undefined ? silhouettes : silhouettesSousLePreset(values.preset, silhouettes))
const poidsPoses = await sousLePreset(silhouettes).catch(async (erreur) => {
  console.error(`--preset : ${erreur.message}`)
  await sortir(2)
})
if (values.preset !== undefined) console.log(`--preset ${values.preset} : poids posés ${Object.entries(poidsPoses).map(([nom, poids]) => `${nom}=${poids}`).join(', ') || 'aucun'}`)
const entree = {
  base: readFileSync(values.base ?? positionals[0]),
  elements: values.base ? positionals.map((g) => readFileSync(g)) : [],
  ...(values.base ? { couches: positionals.map(couche), armes: positionals.map(arme) } : {}),
  ...(values.manifeste ? { manifeste: JSON.parse(readFileSync(values.manifeste, 'utf8')) } : {}),
  ...(facteurs === undefined ? {} : { facteurs }),
  ...(poidsPoses === undefined ? {} : { silhouettes: poidsPoses }),
  ...(pas === undefined ? {} : { pas }),
  ...(values.clips ? { clips: values.clips.split(',').filter(Boolean) } : {}),
  ...(plafonds === undefined ? {} : { plafondsDesMembres: plafonds }),
  ...(values.preset === undefined ? {} : { ranger: ranger(values.preset) }),
  ...(portee === undefined ? {} : { portee }),
}

function afficherFiche(fiche) {
  const { triangles, sommets, os, images, corps, clips } = fiche.mesures
  console.log(`${triangles.total} triangles (${triangles.parMesh.map(({ mesh, triangles: t }) => `${mesh} ${t}`).join(', ')}), ${sommets} sommets, ${os} os, ${images} image(s) ; corps : ${corps.join(', ') || 'aucun'}`)
  for (const c of clips) {
    console.log(`clip ${c.nom} : ${c.duree.toFixed(3)} s, ${c.echantillons} échantillon(s), sommet le plus bas ${c.plusBas.min.toFixed(4)} à ${c.plusBas.max.toFixed(4)} m`)
    if (c.appuis) {
      console.log(`  vitesse au sol : ${c.appuis.vitesseAuSol ?? 'indétectable'} m/s ; déclarée ${c.appuis.vitesseDeclaree} m/s ; direction XZ ${c.appuis.direction.join(', ')}`)
      for (const p of c.appuis.pieds) console.log(`  ${p.pied} : ${p.vitesseAuSol ?? 'indétectable'} m/s ; appui ${p.duree} s (${p.intervalles} intervalles) ; contact max ${p.contactMax ?? '—'} m ; glissement max ${p.glissementMax ?? '—'} m`)
    }
  }
  const { anneaux, silhouettes: mesuresDesSilhouettes, carrure } = fiche.mesures.silhouettes
  console.log(`silhouettes : ${anneaux} anneau(x) articulaire(s)`)
  for (const s of mesuresDesSilhouettes) console.log(`  ${s.nom} : déplacement max ${s.deplacementMax.toFixed(4)} m ; centre ${s.centrePire ? `${s.centrePire.os} à ${s.centrePire.rapport.toFixed(4)} du rayon` : '—'}`)
  if (carrure) console.log(`  carrure (${carrure.os}, rayon ${carrure.rayonDeRepos.toFixed(4)} m) : ${carrure.points.map((p) => `st=${p.st} → ${p.rapport.toFixed(4)}`).join(', ')} ; écart relatif à st ${carrure.ecartASt.toFixed(4)}, au segment ${carrure.ecartAuSegment.toFixed(4)}`)
  const { segments } = fiche.mesures
  const triplet = (t) => `(${t.map((v) => (v === null ? '—' : v.toFixed(4))).join(', ')})`
  if (segments) console.log(`segments du gabarit (S_b → rapport par axe local) : ${segments.segments.map((s) => `${s.os} (${s.attendu.join(', ')}) → ${triplet(s.rapport)}`).join(', ')} ; écart relatif à S_b ${segments.ecartALEchelle.toFixed(4)}`)
  for (const c of fiche.mesures.chaines) {
    const r = c.rotationMax
    console.log(`chaîne ${c.chaine} : ${c.os} os, pistes dans ${c.clipsPistes}/${fiche.mesures.clips.length} clips, rotation jouée max ${r ? `${r.degres.toFixed(1)}° (${r.os}, ${r.clip} t=${r.t.toFixed(3)})` : '—'}`)
  }
  for (const e of fiche.ecarts) console.log(ligneDEcart(e))
  const parGarde = fiche.ecarts.reduce((n, e) => ({ ...n, [e.garde]: (n[e.garde] ?? 0) + 1 }), {})
  console.log(`${fiche.ecarts.length} écart(s)${fiche.ecarts.length ? ` : ${Object.entries(parGarde).map(([g, n]) => `${g} ${n}`).join(', ')}` : ''}`)
}

try {
  if (values['etats-gabarit']) {
    const { validerManifesteDeBase } = await chargerEvaluateur('../manifesteDeBase.ts')
    const verdict = validerManifesteDeBase(entree.manifeste, entree.base)
    if (!verdict.ok) throw new Error(`--etats-gabarit : manifeste invalide : ${verdict.ecarts.map((e) => `[${e.code}] ${e.ou} : ${e.detail}`).join('; ')}`)
    if (!verdict.manifeste.gabarit) throw new Error(`--etats-gabarit : la base ${verdict.manifeste.base} ne porte pas de table de gabarit`)
    const { etatsDuGabarit } = await chargerEvaluateur('../etatsDuGabarit.ts')
    const liste = etatsDuGabarit(verdict.manifeste.gabarit, verdict.manifeste.silhouettes)
    const etats = []
    let ecarts = 0
    for (const [indice, etat] of liste.entries()) {
      console.log(`GABARIT_ETAT ${indice + 1}/${liste.length} ${etat.nom}`)
      const fiche = await evaluer({ ...entree, facteurs: etat.facteurs, silhouettes: await sousLePreset(etat.poidsSilhouettes) })
      afficherFiche(fiche)
      ecarts += fiche.ecarts.length
      if (values.json) etats.push({ etat, fiche })
    }
    if (values.json) writeFileSync(values.json, `${JSON.stringify({ etats }, null, 2)}\n`)
    await sortir(ecarts ? 1 : 0)
  }
  const fiche = await evaluer(entree)
  if (values.json) writeFileSync(values.json, `${JSON.stringify(fiche, null, 2)}\n`)
  if (!temoin) {
    afficherFiche(fiche)
    await sortir(fiche.ecarts.length ? 1 : 0)
  }
  const { deLaPortee, identiteDEcart } = await chargerEvaluateur('temoin.ts')
  const libelles = fiche.portee && new Set(fiche.portee)
  const temoinDeLaPortee = libelles ? temoin.filter((e) => deLaPortee(e, libelles)) : temoin
  const connus = new Set(temoinDeLaPortee.map(identiteDEcart))
  const neufs = fiche.ecarts.filter((e) => !connus.has(identiteDEcart(e)))
  console.log(`témoin ${temoinDeLaPortee.length} écart(s), mesure ${fiche.ecarts.length}, neufs ${neufs.length}`)
  for (const e of neufs) console.log(ligneDEcart(e))
  await sortir(neufs.length ? 1 : 0)
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  await sortir(1)
}
