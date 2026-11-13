// La sortie de `git merge-file -p --diff3` (`fusionDiff3`, `gitPorte.mjs`), lue en segments. PUR.

/** Les lignes d'un texte, fin de ligne comprise. @param {string} texte */
export const lignesDe = (texte) => texte.match(/[^\n]*\n|[^\n]+$/g) ?? []

/**
 * La taille des marqueurs de conflit (`--marker-size`, `git help merge-file`) qu'aucune ligne de `textes`
 * n'imite : 1 + la plus longue suite de `<`, `=`, `>` ou `|` en tête de ligne, 7 au moins.
 * @param {...(string | Buffer)} textes
 */
export function tailleDeMarqueur(...textes) {
  let plusLongue = 0
  for (const texte of textes) {
    for (const [suite] of String(texte).matchAll(/^(?:<+|=+|>+|\|+)/gm)) plusLongue = Math.max(plusLongue, suite.length)
  }
  return Math.max(7, plusLongue + 1)
}

/** Le marqueur de conflit (`<`, `|`, `=` ou `>` répété `taille` fois) qui ouvre `ligne`, `null` sinon. */
const marqueurDe = (ligne, taille) => new RegExp(`^(<{${taille}}|\\|{${taille}}|={${taille}}|>{${taille}})(?: |\\r?\\n|$)`).exec(ligne)?.[1][0] ?? null

/**
 * Les segments de `texte`, dans l'ordre : `{ lignes }` pour une suite de lignes fusionnées, `{ ours, base, theirs }`
 * pour un bloc en conflit ; `null` si un bloc reste ouvert. `taille` = celle des marqueurs (`tailleDeMarqueur`).
 * @param {string} texte @param {number} taille
 * @returns {({ lignes: string[] } | { ours: string[], base: string[], theirs: string[] })[] | null}
 */
export function segmentsDeFusion(texte, taille) {
  const segments = []
  /** @type {{ ours: string[], base: string[], theirs: string[] } | null} */
  let bloc = null
  /** @type {'ours' | 'base' | 'theirs'} */
  let cote = 'ours'
  for (const ligne of lignesDe(texte)) {
    const marqueur = marqueurDe(ligne, taille)
    if (!bloc) {
      if (marqueur === '<') [bloc, cote] = [{ ours: [], base: [], theirs: [] }, 'ours']
      else if (segments.at(-1)?.lignes) segments.at(-1).lignes.push(ligne)
      else segments.push({ lignes: [ligne] })
      continue
    }
    if (marqueur === '|' && cote === 'ours') cote = 'base'
    else if (marqueur === '=' && cote !== 'theirs') cote = 'theirs'
    else if (marqueur === '>' && cote === 'theirs') {
      segments.push(bloc)
      bloc = null
    } else bloc[cote].push(ligne)
  }
  return bloc ? null : segments
}
