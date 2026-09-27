// ORDRE DE LECTURE d'une page de PDF (#1739) : les BOÎTES de texte que pdfminer a LUES
// (`scripts/raw/lib/pdf-lignes.py`, qui porte l'analyse de mise en page) rangées en COLONNES, puis
// leurs lignes rendues colonne par colonne. PUR, joué en CI sur des pages réelles
// (`scripts/raw/lib/fixtures/pages-crb/`). Aucune coupe à mi-page ni largeur de gouttière fixée.

/** Médiane de `[valeur, poids]` : la valeur où le poids cumulé atteint la moitié. */
const mediane = (paires) => {
  const s = [...paires].sort((a, b) => a[0] - b[0])
  const moitie = s.reduce((t, [, p]) => t + p, 0) / 2
  let cumul = 0
  for (const [v, p] of s) if ((cumul += p) >= moitie) return v
  return -Infinity
}

/**
 * Bords gauches des COLONNES de la page, croissants. Un CANDIDAT est une grappe d'abscisses `x0` de
 * boîtes (à 1 pt de la première, abscisse = la plus petite) qui porte au moins deux lignes. Un candidat
 * ouvre une colonne s'il tombe au-delà de la MARGE DROITE de la colonne en cours — la médiane des `x1`
 * des boîtes qui partent de son bord, pondérée par leur nombre de lignes : un encadré en retrait ou une
 * boîte de tableau restent dans son emprise, la gouttière est l'écart entre cette marge et le bord
 * suivant.
 * @param {{ x0: number, x1: number, lignes: unknown[] }[]} boites
 */
export function colonnes(boites) {
  const grappes = []
  for (const b of [...boites].sort((a, c) => a.x0 - c.x0)) {
    const g = grappes.at(-1)
    if (g && b.x0 - g.x <= 1) g.boites.push(b)
    else grappes.push({ x: b.x0, boites: [b] })
  }
  const bords = []
  let marge = -Infinity
  for (const g of grappes.filter((x) => x.boites.reduce((n, b) => n + b.lignes.length, 0) >= 2)) {
    if (g.x < marge) continue
    bords.push(g.x)
    marge = mediane(g.boites.map((b) => [b.x1, b.lignes.length]))
  }
  return bords
}

/**
 * LIGNES de la page dans l'ORDRE DE LECTURE : chaque boîte va à la colonne du plus grand bord qui ne
 * dépasse pas son `x0` (0,5 pt d'arrondi) ; colonne par colonne, boîtes du haut vers le bas, et dans
 * une boîte ses lignes dans l'ordre de pdfminer. `marge` = le bord droit (`x1`) de la boîte de la ligne ;
 * celle d'une boîte d'UNE ligne, qui n'a que son propre bord, est la justification de son BLOC : le plus
 * grand `x1` des boîtes de sa colonne parties de son bord gauche (à 2 pt) — un encadré en retrait garde
 * la sienne.
 * @returns {{ colonne: number, x0: number, x1: number, y0: number, marge: number, texte: string, spans: { texte: string, police: string, taille: number }[] }[]}
 */
export function lignes(boites, bords = colonnes(boites)) {
  const colonneDe = (x) => Math.max(0, ...bords.map((b, k) => (x >= b - 0.5 ? k : 0)))
  const rangees = boites.map((b) => ({ b, k: colonneDe(b.x0) }))
  const margeDe = (k, x0) => Math.max(...rangees.filter((r) => r.k === k && Math.abs(r.b.x0 - x0) <= 2).map(({ b }) => b.x1))
  return rangees
    .sort((a, c) => a.k - c.k || c.b.y1 - a.b.y1)
    .flatMap(({ b, k }) =>
      b.lignes.map((l) => ({
        colonne: k,
        x0: l.x0,
        x1: l.x1,
        y0: l.y0,
        marge: b.lignes.length > 1 ? b.x1 : margeDe(k, b.x0),
        texte: l.texte,
        spans: l.spans.map(([texte, police, taille]) => ({ texte, police, taille })),
      })),
    )
}
