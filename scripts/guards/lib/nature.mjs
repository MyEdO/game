// NATURE d'une fermeture — la ligne `NATURE: <nature> [#M]` du solde `.claude/soldes/<N>.md`, source
// UNIQUE de ce que le fermeur pose en `state_reason` (`scripts/ops/fermer-depuis-main.mjs`) et de ce
// que la porte du commit exige comme preuve (`validateSolde`, `scripts/git-hooks/porte-du-commit.mjs`).
// Credo (épique #2561) : « Une issue se ferme CORRIGÉE ou PROUVÉE SANS OBJET (doublon de #M, constat
// non reproduit à `<sha>` avec sonde collée, ou décision utilisateur datée). La fermeture suit la
// PUBLICATION : le commit cite #N et porte son solde, dont la NATURE fait le `state_reason`. »
// `state_reason` : enum `completed | not_planned | duplicate | reopened` de
// `PATCH /repos/{owner}/{repo}/issues/{issue_number}` (spec OpenAPI `github/rest-api-description`).
// Personne d'autre ne lit la ligne `NATURE:`.

/** Les natures, et elles seules : `raison` = le `state_reason` posé, `cible` = la nature exige `#M`. */
export const NATURES = Object.freeze({
  corrigé: Object.freeze({ raison: 'completed', cible: false }),
  doublon: Object.freeze({ raison: 'duplicate', cible: true }),
  caduc: Object.freeze({ raison: 'not_planned', cible: false }),
  décidé: Object.freeze({ raison: 'not_planned', cible: false }),
})

/** La nature d'un solde SANS ligne `NATURE:`. */
export const NATURE_PAR_DEFAUT = 'corrigé'

const LIGNE_RE = /^NATURE[ \t]*:(.*)$/gm
const VALEUR_RE = /^\s*(\p{L}+)(?:\s+#(\d+))?\s*$/u

/** Les natures, telles qu'un refus les énonce. PUR. */
export const grammaireDesNatures = () =>
  Object.entries(NATURES).map(([nom, { cible }]) => (cible ? `${nom} #M` : nom)).join(' | ')

/**
 * La nature que porte le solde `contenu` : la ligne `NATURE:` en TÊTE de ligne, au plus une ; absente,
 * `corrigé`. `numero` = le ticket que le solde ferme, que `#M` ne peut pas nommer. PUR.
 * @param {string | null} contenu @param {number | string} [numero]
 * @returns {{ nature: string, cible?: number } | { erreur: string }}
 */
export function natureDuSolde(contenu, numero) {
  const lignes = [...String(contenu ?? '').matchAll(LIGNE_RE)]
  if (lignes.length === 0) return { nature: NATURE_PAR_DEFAUT }
  if (lignes.length > 1) return { erreur: `${lignes.length} lignes "NATURE:" — une seule, en tête de ligne` }
  const brut = lignes[0][1].normalize('NFC').trim()
  const lu = VALEUR_RE.exec(brut)
  const def = lu && Object.hasOwn(NATURES, lu[1]) ? NATURES[lu[1]] : null
  if (!def) return { erreur: `"NATURE: ${brut}" inconnue — attendu ${grammaireDesNatures()}` }
  const [, nature, cible] = lu
  if (def.cible && !cible) return { erreur: `"NATURE: ${nature}" sans "#M" — le ticket qui le reprend se nomme` }
  if (!def.cible && cible) return { erreur: `"NATURE: ${nature}" ne porte pas de "#M"` }
  if (cible && numero !== undefined && Number(cible) === Number(numero)) {
    return { erreur: `"NATURE: ${nature} #${cible}" nomme le ticket fermé lui-même` }
  }
  return cible ? { nature, cible: Number(cible) } : { nature }
}

/**
 * Le `state_reason` d'une nature (`NATURES`). PUR.
 * @param {string} nature @returns {string}
 * @throws {Error} une nature hors de `NATURES`.
 */
export function raisonDeFermeture(nature) {
  if (!Object.hasOwn(NATURES, nature)) throw new Error(`raisonDeFermeture : nature « ${nature} » inconnue`)
  return NATURES[nature].raison
}
