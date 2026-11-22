// LES ÉCARTS D'UN RENDU DES MAQUETTES À SA RÉFÉRENCE (#4585, règle 7 de `docs/plans/2026-11-21-maquettes-en-donnees.md`),
// que `pixels.mjs --comparer` rapporte : les relevés de `rendre.mjs` lus sur sa sortie (`relevesDeLaSortie`), les
// entrées de relevé neuves (`relevesNeufs`), les états changés confrontés aux états attendus (`confronter`) et l'écart
// du style calculé de chaque texte (`ecartDeStyle`, champs `PROPRIETES_DE_STYLE`).
import { tableTotale } from '../../src/lib/tableTotale.ts'

/** Le PNG de l'état `etat` de l'écran `ecran`, tel que `rendre.mjs <écran> <écran>.png` le nomme. */
export const pngDe = (ecran, etat) => `${ecran}-${etat}.png`

/** Les relevés d'un `rendre.mjs <ecran>` sous la clé `<écran>/<état>`, depuis sa sortie standard : par état, une ligne
 *  `<état> erreurs <n> …`, puis la ligne JSON de son relevé. */
export function relevesDeLaSortie(ecran, sortie) {
  const releves = {}
  let etat
  for (const ligne of sortie.split('\n')) {
    if (ligne.startsWith('{')) {
      if (etat === undefined) throw new Error(`${ecran} : relevé sans ligne d'état`)
      releves[`${ecran}/${etat}`] = JSON.parse(ligne)
      etat = undefined
    } else if (/ erreurs \d+/.test(ligne)) etat = ligne.split(' erreurs')[0]
  }
  return releves
}

/** Les entrées de chaque liste d'un relevé de `rendu` absentes de la même liste du relevé du même état dans `reference`
 *  (`{ "<écran>/<état>": relevé }`) : `[{ etat, releve, entrees }]`. */
export function relevesNeufs(reference, rendu) {
  return Object.entries(rendu).flatMap(([etat, vu]) => Object.entries(vu).flatMap(([releve, liste]) => {
    if (!Array.isArray(liste)) return []
    const avant = new Set((reference[etat]?.[releve] ?? []).map((e) => JSON.stringify(e)))
    const entrees = liste.filter((e) => !avant.has(JSON.stringify(e)))
    return entrees.length ? [{ etat, releve, entrees }] : []
  }))
}

/** Les états `changes` confrontés aux `attendus` (l'union des clés des objets `{ "<écran>/<état>": [...] }`) : les
 *  attendus restés inchangés et les changés hors attendu, triés. */
export function confronter(changes, attendus) {
  const a = new Set(attendus.flatMap((o) => Object.keys(o)))
  const c = new Set(changes)
  return { inchanges: [...a].filter((e) => !c.has(e)).sort(), hors: [...c].filter((e) => !a.has(e)).sort() }
}

/** Les propriétés de style qu'`ecartDeStyle` compare : le rect et le fond n'y entrent pas, le PNG les juge. */
export const PROPRIETES_DE_STYLE = Object.freeze(['police', 'taille', 'graisse', 'style', 'couleur', 'interlettre', 'interligne', 'ombre', 'casse', 'marge', 'bordure', 'remplissage'])

/** Les textes d'un relevé de style sous leur clé écran, état, chemin, texte et rang parmi ceux de même clé. */
const parCle = (textes) => {
  const rangs = new Map(), out = new Map()
  for (const t of textes) {
    const cle = JSON.stringify([t.ecran, t.etat, t.chemin, t.texte])
    rangs.set(cle, (rangs.get(cle) ?? 0) + 1)
    out.set(`${cle}#${rangs.get(cle)}`, t)
  }
  return out
}

/** Les deux derniers maillons du chemin DOM d'un texte. */
const maillons = (chemin) => chemin.split(' > ').slice(-2).join(' > ')

/** L'écart de style entre les textes de `reference` et ceux de `rendu` (champs de `rendre.mjs`, `RELEVE_STYLES`), par
 *  signature (les deux derniers maillons du chemin et les propriétés changées, ou `disparu`, `apparu`) : son nombre
 *  d'éléments et un exemple avant/après, du plus nombreux au moins nombreux. */
export function ecartDeStyle(reference, rendu) {
  const avant = parCle(reference), apres = parCle(rendu)
  const groupes = new Map()
  const compter = (signature, exemple) => {
    const g = groupes.get(signature) ?? { signature, n: 0, exemple }
    g.n++
    groupes.set(signature, g)
  }
  for (const [cle, t] of avant) {
    const u = apres.get(cle)
    if (!u) { compter(`${maillons(t.chemin)} : disparu`, { ecran: t.ecran, etat: t.etat, texte: t.texte }); continue }
    const changees = PROPRIETES_DE_STYLE.filter((p) => t[p] !== u[p])
    if (changees.length) compter(`${maillons(t.chemin)} : ${changees.join(', ')}`, { ecran: t.ecran, etat: t.etat, texte: t.texte, avant: tableTotale(changees, (p) => t[p]), apres: tableTotale(changees, (p) => u[p]) })
  }
  for (const [cle, u] of apres) if (!avant.has(cle)) compter(`${maillons(u.chemin)} : apparu`, { ecran: u.ecran, etat: u.etat, texte: u.texte })
  return [...groupes.values()].sort((x, y) => y.n - x.n || x.signature.localeCompare(y.signature))
}
