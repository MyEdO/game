// FINS DE LIGNE DE L'INDEX — `.gitattributes` déclare `* text=auto eol=lf` : un blob STAGÉ porteur de
// `\r` viole cette déclaration et ne se voit qu'après coup, très loin du geste (`docs:empreinte` et
// `agents:check` comparent des contenus normalisés et rendent des écarts illisibles).
//
// D'OÙ VIENNENT CES BLOBS : un worktree ouvert sous `core.autocrlf=true` (système) sort en CRLF, et
// un `git apply --index` y stage l'octet `\r` TEL QUEL — la normalisation `eol=lf` ne joue qu'au
// `git add` d'un fichier du disque, pas au patch appliqué à l'index.
//
// CE QUI EST JUGÉ : la colonne `i/` de `git ls-files --eol --cached`, qui dit les fins de ligne DU
// BLOB de l'index (`i/lf`, `i/crlf`, `i/mixed`, `i/none`, `i/-text` pour un binaire), et seulement
// pour les chemins dont la colonne `attr/` déclare `eol=lf`.
// ANGLES MORTS DÉCLARÉS : un chemin sans `eol=lf` (binaire, ou attribut levé) n'est pas jugé ; le
// WORKING TREE (`w/`) n'est pas jugé — c'est ce que le commit emporte qui compte, pas ce que le
// disque montre.
// Les colonnes se lisent par `eolsDe` (`gitPorte.mjs`), l'unique lecteur de cette forme.

/** Un blob d'index est mal normalisé s'il porte des `\r` : `crlf` (tous) ou `mixed` (certains). PURE. */
export const ESTAMPILLES_FAUTIVES = new Set(['crlf', 'mixed'])

/**
 * Les chemins STAGÉS dont le blob porte des `\r` alors que `.gitattributes` leur déclare `eol=lf`.
 * PURE : elle lit les entrées de `git ls-files --eol --cached -- <chemins>` (`eolsDe`), jamais git.
 * @param {readonly { index: string, attr: string, chemin: string }[]} entrees
 * @returns {{chemin: string, index: string}[]}
 */
export function cheminsMalNormalises(entrees) {
  return entrees
    .filter((e) => /\beol=lf\b/.test(e.attr) && ESTAMPILLES_FAUTIVES.has(e.index))
    .map(({ chemin, index }) => ({ chemin, index }))
}

/** Le refus, qui NOMME les chemins et le geste qui les répare. `null` si rien. PURE. */
export function raisonDeRefusEol(fautifs) {
  if (!fautifs.length) return null
  const noms = fautifs.map((f) => `${f.chemin} (i/${f.index})`).join(' · ')
  return (
    `⛔ blob(s) STAGÉ(s) en CRLF alors que .gitattributes déclare \`text=auto eol=lf\` : ${noms}. `
    + `Le geste : \`git add --renormalize ${fautifs.map((f) => f.chemin).join(' ')}\`. `
    + "(Un patch appliqué à l'index — `git apply --index` — n'est PAS normalisé : c'est le seul "
    + 'chemin qui produit ces blobs.)'
  )
}
