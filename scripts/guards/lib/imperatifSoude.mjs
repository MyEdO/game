// TRAIT D'UNION VERBE-PRONOM des extractions de `Source/` (#1595) : l'extraction perd le trait
// d'union qui lie le pronom à son verbe, SOUDÉ (`rappelezvous`) ou DÉTACHÉ d'une espace
// (`rappelez- vous`). Consommateur : la famille `imperatif-soude` de `scripts/raw/check-source-format.mjs`,
// rouge nommé sans stock ; le geste est de rendre le trait d'union au `.md`, puis `npm run raw:reanchor`
// (fiche `feedback-md-porteurs-du-faux-se-corrigent`). Module ESM pur.
//
// PORTÉE : SOUDÉ, un verbe en `-ez` ou `-ons` ; DÉTACHÉ, un verbe en `-ez`, `-ons` ou `-e`. HORS
// PORTÉE : un verbe en `-e` SOUDÉ à son pronom, où tombent des mots du livre (`cela`, `celui`,
// `receleur`).
//
// EXEMPTIONS AU SITE, patron `mobilierExemptions.mjs` : `fichier` (chemin POSIX du `.md`), `motif` qui
// tient au TEXTE de la ligne (jamais son numéro), `jetons` (le NOMBRE de sites qu'elle couvre sur sa
// ligne, pas un de plus), `raison`. Posées par `exempter` de `scripts/raw/lib/mobilier.mjs`.

const LETTRE = 'A-Za-zÀ-ÖØ-öø-ÿ'
const PRONOMS = 'vous|nous|moi|toi|le|la|les|en|y|lui|leur'
const CLASSES = [
  ['soude', new RegExp(`(?<![${LETTRE}])[${LETTRE}]+(?:ez|ons)(?:${PRONOMS})(?![${LETTRE}-])`, 'g')],
  ['detache', new RegExp(`(?<![${LETTRE}])[${LETTRE}]+(?:ez|ons|e)- (?:${PRONOMS})(?![${LETTRE}-])`, 'g')],
]

/** @type {{ fichier: string, motif: RegExp, jetons: number, raison: string }[]} */
export const EXEMPTIONS_IMPERATIF_SOUDE = []

/**
 * Sites d'UN texte, dans l'ordre de la ligne : `{ ligne, classe, jeton, texte }`. PURE.
 * @param {string} texte
 */
export function sitesImperatifSoude(texte) {
  const sites = []
  texte.split('\n').forEach((ligne, i) => {
    const trouves = CLASSES.flatMap(([classe, re]) => [...ligne.matchAll(re)].map((m) => ({ classe, jeton: m[0], index: m.index })))
    for (const t of trouves.sort((a, b) => a.index - b.index)) sites.push({ ligne: i + 1, classe: t.classe, jeton: t.jeton, texte: ligne })
  })
  return sites
}
