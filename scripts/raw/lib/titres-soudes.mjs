// TITRES SOUDÉS d'un livre extrait (#1739) : les formes que le `.md` seul trahit d'un titre d'entrée
// mal posé ou d'un paragraphe scindé. Feuillet PUR ; ses consommateurs partagent UNE définition — la
// famille `titre-soude` de la garde de format (`scripts/raw/check-source-format.mjs`), la sonde des
// titres (`scripts/raw/sonde-titres.mjs`, candidats de la forme P, prouvés au PDF) et la réparation
// (`scripts/raw/reparer-titres.mjs`, `recoller`).
//
// Règle utilisateur, verbatim (2026-09-20) : « Il est interdit de réécrire le texte. On peut réparer
// le texte s'il est tronqué/mélangé car l'extraction n'est pas parfaite. »

/** Caractère qui, après un gras de tête, dit une prose et non un titre : minuscule, ou `:-–—(|=`. */
const suiteDeProse = (c) => (c !== c.toUpperCase() && c === c.toLowerCase()) || ':-–—(|='.includes(c)

/** P5 : ligne ouverte par un gras que suit un texte qui n'en est pas la prose — un titre soudé à une
 *  ligne (`**40–42: Levy** An…`), ou la suite d'un paragraphe scindé au milieu d'un gras. Hors P5 : le gras
 *  ÉTIQUETTE (fini par `:`), le REPÈRE `A)`/`12)`, le gras fini par `,` ou `;` (un morceau de phrase, jamais un
 *  titre). PURE. */
export function estP5(ligne) {
  const m = /^\*\*([^*]+)\*\*\s+(\S)/.exec(ligne)
  return !!m && !/[:,;]\s*$/.test(m[1]) && !/^[A-Z0-9]{1,2}\)$/.test(m[1]) && !suiteDeProse(m[2])
}

/** Ligne de titre à DEUX groupes gras — deux titres soudés sur une ligne ; un second groupe en gras
 *  ITALIQUE (`***x***`) est l'accompagnement du même titre (CRB 071 l.97, `**Purple Pall of** ***Shyish***`). PURE. */
export const estTitreADeuxGras = (ligne) => /^#{1,6}\s+\*\*[^*]+\*\*\s*\*\*(?!\*)/.test(ligne)

/** Sites d'un texte : `{ ligne, classe: 'p5' | 'deux-gras', texte }`. PURE. */
export function sitesDeTitresSoudes(texte) {
  const out = []
  texte.split('\n').forEach((l, i) => {
    if (estP5(l)) out.push({ ligne: i + 1, classe: 'p5', texte: l })
    if (estTitreADeuxGras(l)) out.push({ ligne: i + 1, classe: 'deux-gras', texte: l })
  })
  return out
}

/** L'indice de la ligne de PROSE qui précède la ligne `i` à travers UNE ligne vide au plus, si elle
 *  s'arrête au milieu d'une phrase (dernier caractère hors `*` et blancs ni `.!?:;`), sinon -1. PURE. */
export function prosePrecedenteCoupee(lignes, i) {
  const j = lignes[i - 1] === '' ? i - 2 : i - 1
  const l = lignes[j] ?? ''
  if (!l.trim() || /^(#{1,6}\s|\||- |>)/.test(l)) return -1
  return /[.!?:;]$/.test(l.replace(/[\s*]+$/, '')) ? -1 : j
}

/** Un texte qui OUVRE un gras sans le fermer (nombre impair de `**`) : le titre `**T` coupé du gras de
 *  l'étiquette qui le suit (`**T Skills:** …`), que la coupe referme des deux côtés. PURE. */
export const grasOuvert = (texte) => (texte.match(/\*\*/g) ?? []).length % 2 === 1

/** Deux morceaux d'un paragraphe recollés : une espace — aucune après un trait d'union ou une barre de
 *  fin de ligne, gardés (`Nimble-` + `fingered` → `Nimble-fingered`, `Read/` + `Write` → `Read/Write` ;
 *  la sonde n'émet pas le joint d'une césure) —, et l'emphase que le saut coupait
 *  refaite UNE seule, de même marque des deux côtés (`**A** ` + `**B** x` → `**A B** x`, `*A*` + `*B*` →
 *  `*A B*`). PURE. */
export function recoller(avant, apres) {
  const a = avant.trimEnd()
  const marque = /(?<!\*)(\*{1,3})$/.exec(a)?.[1] ?? ''
  const refondue = marque && apres.startsWith(marque) && apres[marque.length] !== '*'
  const [gauche, droite] = refondue ? [a.slice(0, -marque.length), apres.slice(marque.length)] : [a, apres]
  return `${gauche}${/\p{L}[-/]$/u.test(gauche) ? '' : ' '}${droite}`
}
