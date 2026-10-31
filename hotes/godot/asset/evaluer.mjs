// L'ÉVALUATEUR EN LIGNE DE COMMANDE (#2972) : `evaluateur/evaluer.ts` sur un GLB, chargé comme les assets
// (`chargerEvaluateur`, `charger.mjs`). Une ligne par écart ; code de sortie 1 s'il y a un écart ou
// si la base ne porte pas un clip, une silhouette ou la carrure demandés, 0 sinon.
//   npm run godot:evaluer -- <glb> [--base <glb>] [--manifeste <json>]
//     [--facteurs sl=1,legs=1,arms=1,head=1,st=1] [--silhouettes feminin=1,corpulence=1]
//     [--pas 0.0416] [--clips a,b] [--json <sortie>]
// Avec `--base`, `<glb>` est un élément monté sur cette base ; sans lui, `<glb>` est la base. Sans `--manifeste`, seule
// la racine a une position animée (`osAPositionAnimee` du manifeste de base).
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { chargerEvaluateur } from './charger.mjs'

const FACTEURS = ['sl', 'legs', 'arms', 'head', 'st']

const lirePaires = (texte, option, cles) => Object.fromEntries(texte.split(',').map((paire) => {
  const [cle, valeur, ...reste] = paire.split('=')
  if (!cle || cle.trim() !== cle || valeur === undefined || !valeur.trim() || reste.length || !Number.isFinite(Number(valeur)) || (cles && !cles.includes(cle))) {
    throw new Error(`--${option} : « ${paire} » ; attendu ${cles ? cles.map((c) => `${c}=<nombre>`).join(',') : 'nom=<nombre>[,nom=<nombre>]'}`)
  }
  return [cle, Number(valeur)]
}))

let values, positionals, facteurs, silhouettes
try {
  const argumentsLus = parseArgs({
    allowPositionals: true,
    options: {
      base: { type: 'string' },
      manifeste: { type: 'string' },
      facteurs: { type: 'string' },
      silhouettes: { type: 'string' },
      pas: { type: 'string' },
      clips: { type: 'string' },
      json: { type: 'string' },
    },
  })
  values = argumentsLus.values
  positionals = argumentsLus.positionals
  facteurs = values.facteurs === undefined ? undefined : lirePaires(values.facteurs, 'facteurs', FACTEURS)
  silhouettes = values.silhouettes === undefined ? undefined : lirePaires(values.silhouettes, 'silhouettes')
} catch (erreur) {
  console.error(erreur.message)
  process.exit(2)
}
if (positionals.length !== 1) {
  console.error('usage : npm run godot:evaluer -- <glb> [--base <glb>] [--manifeste <json>] [--facteurs sl=1,legs=1,arms=1,head=1,st=1] [--silhouettes feminin=1,corpulence=1] [--pas 0.0416] [--clips a,b] [--json <sortie>]')
  console.error('  sans --manifeste : ni gabarit ni prise, et seule la racine a une position animée')
  process.exit(2)
}
const pas = values.pas === undefined ? undefined : Number(values.pas)
if (pas !== undefined && !(pas > 0)) {
  console.error(`--pas : « ${values.pas} » n’est pas un pas positif`)
  process.exit(2)
}

/** Un écart (`Ecart`, `evaluateur/ecart.ts`) en une ligne. */
const ligneDEcart = (e) =>
  `[${e.garde}/${e.code}]${e.mesh ? ` ${e.mesh}` : ''}${e.clip ? ` ${e.clip}` : ''}${e.t === undefined ? '' : ` t=${e.t.toFixed(3)}`} : ${e.detail} (valeur ${typeof e.valeur === 'number' ? +e.valeur.toPrecision(6) : e.valeur}, seuil ${e.seuil ?? '—'})`

const { evaluer } = await chargerEvaluateur()
const [glb] = positionals
const fiche = await evaluer({
  base: readFileSync(values.base ?? glb),
  elements: values.base ? [readFileSync(glb)] : [],
  ...(values.manifeste ? { manifeste: JSON.parse(readFileSync(values.manifeste, 'utf8')) } : {}),
  ...(facteurs === undefined ? {} : { facteurs }),
  ...(silhouettes === undefined ? {} : { silhouettes }),
  ...(pas === undefined ? {} : { pas }),
  ...(values.clips ? { clips: values.clips.split(',').filter(Boolean) } : {}),
}).catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
})

const { triangles, sommets, os, images, corps, clips } = fiche.mesures
console.log(`${triangles.total} triangles (${Object.entries(triangles.parMesh).map(([m, t]) => `${m} ${t}`).join(', ')}), ${sommets} sommets, ${os} os, ${images} image(s) ; corps : ${corps.join(', ') || 'aucun'}`)
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
for (const e of fiche.ecarts) console.log(ligneDEcart(e))
const parGarde = fiche.ecarts.reduce((n, e) => ({ ...n, [e.garde]: (n[e.garde] ?? 0) + 1 }), {})
console.log(`${fiche.ecarts.length} écart(s)${fiche.ecarts.length ? ` : ${Object.entries(parGarde).map(([g, n]) => `${g} ${n}`).join(', ')}` : ''}`)
if (values.json) writeFileSync(values.json, `${JSON.stringify(fiche, null, 2)}\n`)
process.exit(fiche.ecarts.length ? 1 : 0)
