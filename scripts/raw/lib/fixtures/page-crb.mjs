// Page RÉELLE du CRB figée (`pages-crb/p<N>.json`) : les boîtes et lignes de `pdf-lignes.py`, polices
// indexées dans `polices`. Rend les boîtes que lit `lib/colonnes.mjs#lignes`.
import { readFileSync } from 'node:fs'

export function pageCrb(n) {
  const f = JSON.parse(readFileSync(new URL(`./pages-crb/p${n}.json`, import.meta.url), 'utf8'))
  return f.boites.map(([x0, y0, x1, y1, ls]) => ({
    x0,
    y0,
    x1,
    y1,
    lignes: ls.map(([lx0, ly0, lx1, texte, spans]) => ({ x0: lx0, y0: ly0, x1: lx1, texte, spans: spans.map(([t, i, taille]) => [t, f.polices[i], taille]) })),
  }))
}
