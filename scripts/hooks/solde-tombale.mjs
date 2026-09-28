// Volet ANTI-TOMBALE du garde de solde : fermer un ticket dont le code porte encore, EN COMMENTAIRE,
// une trace de dette qui le cite laisse une pierre tombale (CLAUDE.md règle 6c, tolérance ZÉRO).
//
// La détection réutilise `extractComments` (scripts/guards/lib/commentPoison.mjs), la mécanique
// EXISTANTE du garde-fou commentaires — jamais un `git grep` sur le texte brut : un motif écrit dans
// une CHAÎNE n'est pas un commentaire (faux positif mesuré sur une fixture de test qui cite une
// ligne de dette dans un littéral). Périmètre de fichiers = celui des trois portes anti-poison
// (`estFichierScanne`, qui lit `PERIMETRE_DES_GARDES`).
//
// HORS de ce volet, dit : le canal DONNÉE (un stock JSON/MJS qui déclare un blocage dans une VALEUR,
// et non dans un commentaire) — la sémantique des stocks se traite avec eux.
//
// Chargé par IMPORT DYNAMIQUE depuis le driver de `solde-ticket-guard` : `commentPoison` tire le
// vocabulaire RAW derrière lui, et les autres gardes Bash qui importent `solde-ticket-guard` n'ont
// aucune raison de le payer. Ce module ne dépend d'AUCUN autre garde — les tickets fermés lui sont
// PASSÉS (une importation en retour vers `solde-ticket-guard` boucle sur son propre driver).
import { extractComments, estFichierScanne } from '../guards/lib/commentPoison.mjs'

/** Motifs de DETTE : les tournures par lesquelles un commentaire annonce un travail NON FAIT.
 *  La borne de mot est en TÊTE seulement (« vedette » n'est pas une dette) : `\b` est ASCII et ne se
 *  pose pas après un « é », la borne de queue rejetait donc « non implémenté » lui-même.
 *  HORS de la liste, et c'est mesuré : « en attente » et « bloqué par » sont des mots d'ÉTAT DU
 *  DOMAINE avant d'être des mots de dette — `store.ts:487` « Ouverture cérémonielle EN ATTENTE »
 *  nomme un champ du jeu, `travelFlow.ts:277` « BLOQUÉ par la porte d'heure » énonce une règle. */
export const MOTIF_DETTE_RE = /\b(?:dette|todo|non\s+impl[ée]ment[ée])/i
/** Une dette DÉCLARÉE ÉTEINTE sur la même ligne n'en est plus une (`registry.ts` `CodexSource` « #563 dette
 *  soldée », `labelLogic.mjs` `DISPLAY_FIELD` « dette #598, résorbée par le renommage »). */
const DETTE_ETEINTE_RE = /(?:soldé|résorbé|résolu|levé)/i
/** Citation d'un ticket dans un commentaire. */
const TICKET_RE = /#(\d+)/g

/**
 * Sites où le mot « dette » ne dit PAS une dette d'ingénierie portée par le ticket cité — stock
 * NOMINATIF AU SITE (`fichier:ligne`), chacun avec sa raison, et DÉCROISSANT : jamais une exemption
 * par FICHIER, jamais une liste ouverte. Une ligne qui bouge sort du stock et se rejuge.
 */
export const EXEMPTIONS_TOMBALE = [
  { site: 'src/ui/shipStatus.tsx:22', raison: 'la « dette cumulée » y est une RESSOURCE DU JEU (solde dû à l\'équipage), pas un travail non fait' },
  { site: 'src/data/stake-rule-ratchet.test.ts:120', raison: 'énonce l\'ABSENCE de dette (« le dataset naît sans dette »)' },
  { site: 'src/engine/effect-rule-anchor.test.ts:158', raison: 'constate qu\'un stock VOISIN ne bouge pas, n\'annonce aucun travail dû sur le ticket cité' },
  { site: 'scripts/ui/audit-i18n.mjs:3', raison: '« 2e chasse aux dettes » est le NOM du lot du ticket, pas une dette qu\'il laisserait ouverte' },
  { site: 'src/ui/ui-ratchets.test.ts:497', raison: 'récit d\'un lot EXÉCUTÉ (« -2, PURGE du doublon ») : la dette y est celle que le lot a réduite' },
]
const SITES_EXEMPTES = new Set(EXEMPTIONS_TOMBALE.map((e) => e.site))

/**
 * Lignes de commentaire qui portent À LA FOIS un motif de dette et la citation d'un des `numeros`.
 * `fichiers` = chemins à scanner, `lire(chemin)` = leur contenu (l'INDEX git côté driver, pour juger
 * ce qui PART dans le commit).
 *
 * La lecture est à la LIGNE, pas au bloc : un en-tête de fichier de plusieurs dizaines de lignes
 * énonce couramment une dette D'UN sujet et cite AILLEURS le ticket d'un AUTRE — les juger ensemble
 * rapprochait 206 paires dont l'écrasante majorité ne dit rien d'une dette du ticket cité ; à la
 * ligne, 57 (mesuré 2026-09-02 sur `git ls-files src scripts`). Une citation de provenance sans
 * motif de dette est tolérée : citer l'origine d'un choix n'est pas annoncer une dette.
 * @returns {{ n: number, fichier: string, ligne: number, extrait: string }[]}
 */
export function tombalesDansSource(numeros, { fichiers = [], lire = () => null } = {}) {
  const cibles = new Set(numeros.map(Number))
  if (cibles.size === 0) return []
  const trouvailles = []
  for (const fichier of fichiers) {
    if (!estFichierScanne(fichier)) continue
    const chemin = fichier.replace(/\\/g, '/')
    const src = lire(fichier)
    if (!src) continue
    for (const commentaire of extractComments(src)) {
      commentaire.text.split('\n').forEach((texte, rang) => {
        if (!MOTIF_DETTE_RE.test(texte) || DETTE_ETEINTE_RE.test(texte)) return
        const vus = new Set()
        for (const m of texte.matchAll(TICKET_RE)) {
          const n = Number(m[1])
          if (!cibles.has(n) || vus.has(n)) continue
          const site = `${chemin}:${commentaire.line + rang}`
          if (SITES_EXEMPTES.has(site)) continue
          vus.add(n)
          trouvailles.push({
            n,
            fichier: chemin,
            ligne: commentaire.line + rang,
            extrait: texte.replace(/\s+/g, ' ').trim().slice(0, 160),
          })
        }
      })
    }
  }
  return trouvailles
}

/**
 * Décision « fermeture d'un ticket encore cité comme dette dans un commentaire du code ».
 * `issuesFermees` = les tickets que le commit ferme (`extractClosedIssues`, côté appelant).
 * @returns {{ decision: 'deny', reason: string } | null}
 */
export function evaluateTombale({ issuesFermees = [], fichiers = [], lire = () => null }) {
  if (issuesFermees.length === 0) return null
  const trouvailles = tombalesDansSource(issuesFermees, { fichiers, lire })
  if (trouvailles.length === 0) return null
  const detail = trouvailles
    .map(({ n, fichier, ligne, extrait }) => `#${n} — ${fichier}:${ligne} : "${extrait}"`)
    .join(' | ')
  return {
    decision: 'deny',
    reason:
      `⛔ Fermeture d'un ticket encore cité comme DETTE dans un commentaire du code (CLAUDE.md règle 6c, ` +
      `tolérance zéro) : ${detail}. Retirer le commentaire dans le MÊME commit (git porte l'historique) ` +
      `— ou ne pas fermer, si la dette est réelle.`,
  }
}
