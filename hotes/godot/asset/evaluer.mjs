// L'ÉVALUATEUR EN LIGNE DE COMMANDE (#2972) : `evaluateur/evaluer.ts` sur un GLB, chargé comme les assets
// (`chargerEvaluateur`, `charger.mjs`). Une ligne par écart ; code de sortie 1 s'il y a un écart ou
// si la base ne porte pas un clip, une silhouette ou la carrure demandés, 0 sinon.
//   npm run godot:evaluer -- <glb>... [--base <glb>] [--manifeste <json>]
//     [--facteurs sl=1,legs=1,arms=1,head=1,st=1] [--silhouettes feminin=1,corpulence=1]
//     [--pas 0.0416] [--clips a,b] [--plafonds <json>] [--json <sortie>] [--etats-gabarit] [--porte]
// Avec `--base`, chaque `<glb>` est un élément monté sur cette base, ensemble (une tenue), sa couche et ses zones lues
// dans le manifeste d'élément voisin (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json` d'un import) :
// la traversée des couches se mesure (#3743) ; seul un élément dont la forme `cle.apparence` est celle d'une arme (un
// trapping `melee` ou `distance` de cette `shape`, `src/data/trappings.json`) porte un tranchant (`tranchantDuRigide`) :
// un sac rangé n'en a pas. Sans `--base`, l'unique `<glb>` est la base. Sans `--manifeste`, seule
// la racine a une position animée (`osAPositionAnimee` du manifeste de base). `--porte` joue les passes de la porte d'un
// élément (#3743) : le corps neutre, puis chaque silhouette déclarée par le manifeste de base seule à 1, chacune dans son
// processus, en parallèle sur les cœurs de la machine ; code 1 si une passe a un écart. `--plafonds` nomme la table des
// écarts `membre-dans-un-vetement` que la tenue admet, `{ "<passe>": { "<clip>": <nombre> } }` (`gardeMembreDansUnVetement`).
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { estObjet } from '../../../src/lib/objet.mjs'
import { chargerEvaluateur } from './charger.mjs'

const FACTEURS = ['sl', 'legs', 'arms', 'head', 'st']

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

let values, positionals, facteurs, silhouettes, plafonds
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
    },
  })
  values = argumentsLus.values
  positionals = argumentsLus.positionals
  if (values['etats-gabarit'] && (!values.manifeste || values.facteurs !== undefined || values.silhouettes !== undefined)) {
    throw new Error('--etats-gabarit : --manifeste requis, --facteurs et --silhouettes incompatibles')
  }
  if (values.porte && (!values.manifeste || values['etats-gabarit'] || values.silhouettes !== undefined || values.json !== undefined)) {
    throw new Error('--porte : --manifeste requis, --etats-gabarit, --silhouettes et --json incompatibles')
  }
  facteurs = values.facteurs === undefined ? undefined : lirePaires(values.facteurs, 'facteurs', FACTEURS)
  silhouettes = values.silhouettes === undefined ? undefined : lirePaires(values.silhouettes, 'silhouettes')
  if (values.plafonds !== undefined && (values['etats-gabarit'] || facteurs !== undefined)) throw new Error('--plafonds : --etats-gabarit et --facteurs incompatibles')
  plafonds = values.plafonds === undefined ? undefined : lirePlafonds(values.plafonds, silhouettes)
} catch (erreur) {
  console.error(erreur.message)
  process.exit(2)
}
/** Le manifeste d'élément voisin du GLB `glb`, ou `undefined`. */
const manifesteVoisin = (glb) => [glb.replace(/\.glb$/, '.element.json'), glb.replace(/\.glb$/, '.manifeste.json')].find(existsSync)
const sansManifeste = values.base ? positionals.filter((g) => !manifesteVoisin(g)) : []
if (values.base ? positionals.length === 0 || sansManifeste.length : positionals.length !== 1) {
  if (sansManifeste.length) console.error(`sans manifeste d’élément voisin (<id>.element.json ou <id>.manifeste.json) : ${sansManifeste.join(', ')}`)
  console.error('usage : npm run godot:evaluer -- <glb>... [--base <glb>] [--manifeste <json>] [--facteurs sl=1,legs=1,arms=1,head=1,st=1] [--silhouettes feminin=1,corpulence=1] [--pas 0.0416] [--clips a,b] [--plafonds <json>] [--json <sortie>] [--etats-gabarit] [--porte]')
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
  const args = process.argv.slice(2).filter((a) => a !== '--porte')
  const jouer = ([nom, ajout]) => new Promise((resolve) => {
    const enfant = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args, ...ajout], { stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    enfant.stdout.on('data', (d) => { sortie += d })
    enfant.stderr.on('data', (d) => { sortie += d })
    enfant.on('close', (code) => resolve({ nom, code, sortie }))
  })
  const resultats = []
  const file = [...passes]
  await Promise.all(Array.from({ length: Math.min(availableParallelism(), passes.length) }, async () => {
    while (file.length) resultats.push(await jouer(file.shift()))
  }))
  for (const [nom] of passes) {
    const r = resultats.find((x) => x.nom === nom)
    console.log(`PASSE ${nom} : code ${r.code}`)
    process.stdout.write(r.sortie)
  }
  await sortir(resultats.some((r) => r.code !== 0) ? 1 : 0)
}

const { evaluer } = await chargerEvaluateur()
const couche = (glb) => {
  const { couche, couvre = [], categorie } = JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8'))
  return couche ? { couche, couvre, categorie } : null
}
const FORMES_D_ARMES = new Set(JSON.parse(readFileSync(new URL('../../../src/data/trappings.json', import.meta.url), 'utf8'))
  .filter((t) => t.shape && ['melee', 'distance'].includes(t.categorie)).map((t) => t.shape.id))
const arme = (glb) => FORMES_D_ARMES.has(JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8')).cle?.apparence)
const entree = {
  base: readFileSync(values.base ?? positionals[0]),
  elements: values.base ? positionals.map((g) => readFileSync(g)) : [],
  ...(values.base ? { couches: positionals.map(couche), armes: positionals.map(arme) } : {}),
  ...(values.manifeste ? { manifeste: JSON.parse(readFileSync(values.manifeste, 'utf8')) } : {}),
  ...(facteurs === undefined ? {} : { facteurs }),
  ...(silhouettes === undefined ? {} : { silhouettes }),
  ...(pas === undefined ? {} : { pas }),
  ...(values.clips ? { clips: values.clips.split(',').filter(Boolean) } : {}),
  ...(plafonds === undefined ? {} : { plafondsDesMembres: plafonds }),
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
      const fiche = await evaluer({ ...entree, facteurs: etat.facteurs, silhouettes: etat.poidsSilhouettes })
      afficherFiche(fiche)
      ecarts += fiche.ecarts.length
      if (values.json) etats.push({ etat, fiche })
    }
    if (values.json) writeFileSync(values.json, `${JSON.stringify({ etats }, null, 2)}\n`)
    await sortir(ecarts ? 1 : 0)
  }
  const fiche = await evaluer(entree)
  afficherFiche(fiche)
  if (values.json) writeFileSync(values.json, `${JSON.stringify(fiche, null, 2)}\n`)
  await sortir(fiche.ecarts.length ? 1 : 0)
} catch (erreur) {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  await sortir(1)
}
