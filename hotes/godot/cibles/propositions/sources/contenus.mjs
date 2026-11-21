// L'AGRÉGAT DU RELEVÉ `contenu` de `rendre.mjs` (#4585) et la classe d'un écart, que `rendre.mjs` importe pour son
// relevé bloquant. Deux relevés du même contenu (porteur | rôle) d'un état à l'autre du même gabarit diffèrent :
//   A  boîte déplacée : son coin (x, y) bouge, ou la taille d'un contenu qui n'est pas un texte (`texte` : rien en lui
//      n'est autre qu'en ligne), ou d'une liste qui défile le départ, les x ou les écarts de ses entrées ;
//   B  longueur de texte : seule la largeur ou la hauteur d'un texte change, son coin fixe (un voisin qu'il pousse est
//      un A pour ce voisin) ;
//   C  contenu de liste : seul le nombre des entrées d'une liste qui défile change (une liste d'une seule entrée n'a
//      pas d'écart : ses écarts ne se comparent pas).
// Un A fait échouer le rendu (`rendre.mjs`) et cet agrégat (code 1), quel que soit le gabarit. L'agrégat lit les fichiers que chaque état rendu sous `RELEVE_CONTENUS=<dossier>` y a écrits, et
// rend, par gabarit (le champ `gabarit` des états), la synthèse (états, places, pièces sans place, contenus dont ceux
// vus dans un seul état, contenus qui bougent par classe) puis, pour chaque contenu qui bouge, sa classe, ce qui en
// diffère, ses relevés distincts et les états qui portent chacun :
// Il rend aussi, par gabarit, le relevé `brut` de ses états (`rendre.mjs`), sans effet sur son code : ce que les
// emplacements de primitive et les illustrations portent hors d'une primitive, puis le compte de chaque état :
//   node contenus.mjs <dossier>
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const loin = (m, n) => Math.abs(m - n) > 1
const autres = (u, v) => u.length !== v.length || u.some((m, k) => loin(m, v[k]))
/** Ce qui diffère de deux relevés du même contenu : `x`, `y`, `l`, `h` d'un rect ; `depart`, `x`, `ecarts`, `n` d'une liste,
 * dont les écarts ne se comparent qu'entre deux listes qui en ont (une seule entrée n'a pas d'écart). */
const differe = (u, v) => (u.liste
  ? ['depart', 'x', 'ecarts', 'n'].filter((k) => (k !== 'ecarts' || (u.liste.n > 1 && v.liste.n > 1)) && autres([u.liste[k]].flat(), [v.liste[k]].flat()))
  : ['x', 'y', 'l', 'h'].filter((_, k) => loin(u.rect[k], v.rect[k])))
/** La classe de l'écart entre deux relevés du même contenu : `A`, `B`, `C`, ou null s'ils sont les mêmes. */
export const classe = (u, v) => {
  const d = differe(u, v)
  if (!d.length) return null
  if (u.liste) return d.join() === 'n' ? 'C' : 'A'
  return d.includes('x') || d.includes('y') || !(u.texte && v.texte) ? 'A' : 'B'
}

if (import.meta.main) {
  const [, , dossier] = process.argv
  if (!dossier) throw new Error('node contenus.mjs <dossier>')
  /** Les gabarits : pour chacun, ses états et, par contenu (porteur | rôle), ses relevés distincts et leurs états. */
  const gabarits = new Map()
  for (const f of readdirSync(dossier).filter((f) => f.endsWith('.json')).sort()) {
    const { ecran, etat, gabarit, contenus, brut } = JSON.parse(readFileSync(join(dossier, f), 'utf8'))
    const g = gabarits.get(gabarit) ?? gabarits.set(gabarit, { etats: 0, contenus: new Map(), bruts: [] }).get(gabarit)
    g.etats++
    g.bruts.push({ etat: `${ecran}/${etat}`, ...brut })
    for (const [cle, valeur] of Object.entries(contenus)) {
      const releves = g.contenus.get(cle) ?? g.contenus.set(cle, []).get(cle)
      const meme = releves.find((r) => !differe(r.valeur, valeur).length)
      if (meme) meme.etats.push(`${ecran}/${etat}`)
      else releves.push({ valeur, etats: [`${ecran}/${etat}`] })
    }
  }
  const ordre = ['A', 'B', 'C']
  const lignes = []
  let bloquants = 0
  for (const [gabarit, { etats, contenus }] of [...gabarits].sort()) {
    const bougent = [...contenus].filter(([, r]) => r.length > 1).map(([cle, r]) => {
      const classes = r.slice(1).map((x) => classe(r[0].valeur, x.valeur))
      return { cle, releves: r, classe: ordre.find((c) => classes.includes(c)), differe: [...new Set(r.slice(1).flatMap((x) => differe(r[0].valeur, x.valeur)))].join(',') }
    }).sort((u, v) => ordre.indexOf(u.classe) - ordre.indexOf(v.classe))
    const porteurs = [...new Set([...contenus.keys()].map((c) => c.split(' | ')[0]))]
    const places = porteurs.filter((p) => p.includes(' > ')).length
    const seuls = [...contenus.values()].filter((r) => r.length === 1 && r[0].etats.length === 1).length
    const parClasse = ordre.map((c) => `${c} ${bougent.filter((b) => b.classe === c).length}`).join(', ')
    const synthese = `${gabarit} : ${etats} états, ${places} places, ${porteurs.length - places} pièces sans place, ${contenus.size} contenus (${seuls} vus dans un seul état), ${bougent.length} qui bougent (${parClasse})`
    bloquants += bougent.filter((b) => b.classe === 'A').length
    console.log(synthese)
    lignes.push('', `== ${synthese}`)
    for (const { cle, releves, classe: c, differe: d } of bougent) {
      lignes.push(`${c} ${cle} : ${releves.length} relevés, diffèrent par ${d}`)
      for (const { valeur, etats: e } of releves) lignes.push(`    ${valeur.liste ? JSON.stringify(valeur.liste) : `${valeur.rect.join(',')}${valeur.texte ? ' texte' : ''}`} (${e.length}) : ${e.join(', ')}`)
    }
  }
  const bruts = [...gabarits].sort().map(([gabarit, { etats, bruts: b }]) => {
    const somme = (k) => b.reduce((n, x) => n + x[k].length, 0)
    return { gabarit, etats, b, emplacement: somme('emplacement'), illustration: somme('illustration') }
  })
  lignes.push('', `== brut : ${bruts.reduce((n, g) => n + g.emplacement, 0)} en emplacement, ${bruts.reduce((n, g) => n + g.illustration, 0)} en illustration`)
  for (const { gabarit, etats, b, emplacement, illustration } of bruts) {
    lignes.push(`brut ${gabarit} : ${etats} états, ${emplacement} en emplacement, ${illustration} en illustration`)
    for (const x of b) lignes.push(`    ${x.etat} : ${x.emplacement.length} + ${x.illustration.length}`)
  }
  console.log(lignes.join('\n'))
  process.exitCode = bloquants ? 1 : 0
}
