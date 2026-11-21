// L'AGRÉGAT DU RELEVÉ `contenu` de `rendre.mjs` (#4585), en mode rapport : il ne fait échouer aucun rendu. Il lit les
// fichiers que chaque état rendu sous `RELEVE_CONTENUS=<dossier>` y a écrits, et rend, par gabarit (le champ `gabarit`
// des états), la synthèse (états, places, pièces sans place, contenus dont ceux vus dans un seul état, contenus qui
// bougent) puis, pour chaque contenu qui bouge, ce qui en diffère (place `x`, `y`, taille `l`, `h`), ses rects distincts
// (x, y, largeur, hauteur depuis le coin de son porteur, à 1 px près) et les états qui portent chacun :
//   node contenus.mjs <dossier>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , dossier] = process.argv
if (!dossier) throw new Error('node contenus.mjs <dossier>')
/** Les gabarits : pour chacun, ses états et, par contenu (porteur | rôle), ses rects distincts et leurs états. */
const gabarits = new Map()
for (const f of readdirSync(dossier).filter((f) => f.endsWith('.json')).sort()) {
  const { ecran, etat, gabarit, contenus } = JSON.parse(readFileSync(join(dossier, f), 'utf8'))
  const g = gabarits.get(gabarit) ?? gabarits.set(gabarit, { etats: 0, contenus: new Map() }).get(gabarit)
  g.etats++
  for (const [cle, { rect }] of Object.entries(contenus)) {
    const rects = g.contenus.get(cle) ?? g.contenus.set(cle, []).get(cle)
    const meme = rects.find((r) => r.rect.every((v, k) => Math.abs(v - rect[k]) <= 1))
    if (meme) meme.etats.push(`${ecran}/${etat}`)
    else rects.push({ rect, etats: [`${ecran}/${etat}`] })
  }
}
/** Ce qui diffère d'un rect à l'autre d'un contenu : sa place (`x`, `y`), sa taille (`l`, `h`). */
const differe = (rects) => ['x', 'y', 'l', 'h'].filter((_, k) => rects.some((r) => Math.abs(r.rect[k] - rects[0].rect[k]) > 1)).join(',')
const lignes = []
for (const [gabarit, { etats, contenus }] of [...gabarits].sort()) {
  const bougent = [...contenus].filter(([, rects]) => rects.length > 1)
  const porteurs = [...new Set([...contenus.keys()].map((c) => c.split(' | ')[0]))]
  const places = porteurs.filter((p) => p.includes(' > ')).length
  const seuls = [...contenus.values()].filter((rects) => rects.length === 1 && rects[0].etats.length === 1).length
  const synthese = `${gabarit} : ${etats} états, ${places} places, ${porteurs.length - places} pièces sans place, ${contenus.size} contenus (${seuls} vus dans un seul état), ${bougent.length} qui bougent`
  console.log(synthese)
  lignes.push('', `== ${synthese}`)
  for (const [cle, rects] of bougent) {
    lignes.push(`${cle} : ${rects.length} rects, diffèrent par ${differe(rects)}`)
    for (const { rect, etats: e } of rects) lignes.push(`    ${rect.join(',')} (${e.length}) : ${e.join(', ')}`)
  }
}
console.log(lignes.join('\n'))
