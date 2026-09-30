// Garde PreToolUse des canaux d'écriture (`OUTILS_ECRITURE`) : la règle 6(c) du CLAUDE.md (pierre tombale,
// tolérance zéro) appliquée à `.claude/memory/**`. Une fiche devenue fausse se RÉÉCRIT au présent ou
// se SUPPRIME — git porte l'historique ; poser un EN-TÊTE DE SUPERSESSION (les trois mots que `MOTIF`
// reconnaît plus bas) au-dessus du faux le laisse en place, et la fiche se relit comme une vérité
// (utilisateur, 2026-09-02 : « ce que tu as mis dans la mémoire sera retiré … vu qu'elle sera juste
// une pierre tombale ou du poison ? »). Le geste est REFUSÉ, avec la consigne de réécriture
// (doctrine `user-doctrine-gardes-jamais-de-ask`, 2026-09-28).
//
// PÉRIMÈTRE ÉTROIT, mesuré (2026-09-02, 362 fiches) : les seuls motifs retenus sont ceux d'un EN-TÊTE
// de supersession. Un en-tête se reconnaît à son ORNEMENT de tête (`>`, `#`, `**`, `⚠`) ou au fait
// qu'il OUVRE un paragraphe (ligne précédente vide) ; une ligne de MILIEU de paragraphe porte la
// suite d'une phrase repliée, jamais un chapeau. Les mêmes mots DANS une phrase relèvent du vécu
// daté légitime (49 lignes pour le premier mot, 28 pour « désormais », 43 pour le troisième) : les
// scanner ferait 84 fiches touchées sur 362, soit un garde qui crie sur du récit — l'en-tête, lui,
// touche 2 lignes du stock entier (les deux autres lignes du motif large sont des REPLIS de
// phrase). `PORTÉ PAR <garde>` est admis : nommer la garde qui porte l'invariant est une
// réécriture au présent, pas une tombale.
//
// LIGNES AJOUTÉES seulement : un Edit se juge sur `new_string` privé de ce que portait déjà
// `old_string` ; un Write se compare au fichier SUR DISQUE — sans quoi la RÉÉCRITURE que la règle
// prescrit (re-sauver la fiche entière) se ferait refuser par les lignes qu'elle conserve.
// CONSÉQUENCE DITE : replacer le MÊME en-tête dans `old_string` le rend silencieux — la ligne n'est
// plus ajoutée. Le garde arbitre l'ÉCRITURE d'un en-tête, il n'inspecte pas la fiche existante.
import { readFileSync } from 'node:fs'
import { OUTILS_ECRITURE, cheminVise, ecritLeFichierEntier, ecrituresDe, texteNeuf, texteRemplace, verdictDe } from '../guards/lib/contratGarde.mjs'
import { cheminDEcriture } from './solde-ticket-guard.mjs'

/** Ligne débarrassée de ses ornements de tête (citation, puce, titre, gras, avertissement). */
const nu = (ligne) => ligne.replace(/⚠|️/gu, ' ').replace(/^[\s>#*_~–—•!-]+/u, '').trim()

/** Le mot d'en-tête de supersession, en MOT ENTIER (« Périmètre » n'en est pas un), insensible à la
 *  casse et aux accents. */
const MOTIF = /^(supers[ée]d[ée](?:es?|s)?|obsol[èe]tes?|p[ée]rim[ée]e?s?)(?![A-Za-zÀ-ÿ])/i

/** Réécriture au présent qui NOMME le porteur actuel de l'invariant : admise. */
const PORTE_PAR = /PORT[ÉE]\s+PAR/i

/** Bornes du frontmatter YAML (`---` en tête de fichier) : `[début, fin]` exclusive, ou `null`. */
function frontmatter(lignes) {
  if (lignes[0]?.trim() !== '---') return null
  const fin = lignes.findIndex((l, i) => i > 0 && l.trim() === '---')
  return fin === -1 ? null : [0, fin + 1]
}

/** Les lignes du texte NEUF qui ne figuraient pas dans l'ANCIEN (comparaison par contenu : une ligne
 *  déplacée n'est pas une ligne ajoutée). */
export function lignesAjoutees(neuf, ancien) {
  const avant = new Set(String(ancien ?? '').split(/\r?\n/).map((l) => l.trim()))
  const lignes = String(neuf ?? '').split(/\r?\n/)
  const bornes = frontmatter(lignes)
  return lignes
    .map((texte, rang) => ({ texte, rang }))
    .filter(({ texte, rang }) => !(bornes && rang < bornes[1]) && !avant.has(texte.trim()))
}

/** Ornements de tête d'un EN-TÊTE markdown : citation, titre, gras, avertissement. Une puce `-` n'en
 *  est pas un — un item de liste décrit, il ne chapeaute rien. */
const ORNEMENT_ENTETE = /^\s*(?:>|#{1,6}\s|\*\*|__|⚠)/u

/** Une ligne qui OUVRE un paragraphe : la précédente est vide, absente (première ligne du texte),
 *  ferme un frontmatter/sépare par un filet `---`, ou termine une ligne de TABLEAU `|…|`. Aucune de
 *  ces trois ne porte de phrase que la suivante puisse continuer — ce qui suit chapeaute. */
function ouvreParagraphe(precedente) {
  const p = String(precedente ?? '').trim()
  return p === '' || /^-{3,}$/.test(p) || p.startsWith('|')
}

/** La ligne CHAPEAUTE-t-elle ? Ornement de tête, ou ouverture de paragraphe : une ligne de MILIEU de
 *  paragraphe est la continuation d'une phrase.
 *  DÉCISION ÉCRITE : une puce `- SUPERSÉDÉ par …` posée SOUS du texte courant reste hors périmètre —
 *  un item de liste qui suit un paragraphe le DÉTAILLE, il ne le chapeaute pas. La même puce en tête
 *  de paragraphe, elle, est vue. */
export function estLigneEntete(ligne, precedente) {
  return ORNEMENT_ENTETE.test(ligne) || ouvreParagraphe(precedente)
}

/** L'en-tête de supersession porté par une ligne AJOUTÉE, ou `null`. `precedente` = la ligne
 *  PHYSIQUE qui la précède dans le texte neuf. */
export function enteteSupersession(ligne, precedente) {
  if (!estLigneEntete(ligne, precedente)) return null
  const corps = nu(ligne)
  if (!MOTIF.test(corps) || PORTE_PAR.test(corps)) return null
  return corps.slice(0, 80)
}

/** Le chemin visé est-il une fiche de la mémoire persistante ? */
export const estFicheMemoire = (chemin) =>
  /(^|[\\/])\.claude[\\/]memory[\\/]/.test(String(chemin ?? '')) &&
  String(chemin ?? '').endsWith('.md')

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision, reason }` sinon.
 * `lireDisque` rend le contenu actuel du fichier (`''` s'il n'existe pas) — un Write se juge contre
 * lui, un Edit contre son `old_string`.
 */
export function evaluate(input, lireDisque = () => '') {
  const chemin = String(cheminVise(input) ?? '')
  if (!estFicheMemoire(chemin)) return null
  const neuf = texteNeuf(input)
  if (typeof neuf !== 'string') return null
  const ancien = texteRemplace(input) ?? (ecritLeFichierEntier(input) ? lireDisque(chemin) : '')
  const lignes = neuf.split(/\r?\n/)
  for (const { texte, rang } of lignesAjoutees(neuf, ancien)) {
    const entete = enteteSupersession(texte, lignes[rang - 1])
    if (!entete) continue
    return {
      decision: 'deny',
      reason:
        '⛔ En-tête de SUPERSESSION ajouté à une fiche de mémoire (« ' + entete + ' ») : un en-tête ' +
        'posé AU-DESSUS du faux laisse le faux se relire comme une vérité (règle 6c, tolérance zéro). ' +
        'Geste : RÉÉCRIS le corps de la fiche au présent, ou SUPPRIME la fiche (git porte l\'historique) ; ' +
        'si la ligne nomme le porteur actuel de l\'invariant, écris-la `PORTÉ PAR <porteur>`.',
    }
  }
  return null
}

const lire = (chemin) => { try { return readFileSync(chemin, 'utf8') } catch { return '' } }

/** Le refus pour UNE écriture (`ecrituresDe`), `null` sans en-tête de supersession. */
function refus(input) {
  // La fiche se juge sous son chemin RÉEL : la mémoire de session s'écrit par une jonction (#1973).
  const chemin = cheminDEcriture(input)
  const decision = chemin ? evaluate({ ...input, file_path: chemin.reel }, lire) : null
  return decision && !chemin.horsContenu ? verdictDe(decision) : null
}

const evaluer = (entree) => ecrituresDe(entree).map(refus)

export const garde = { nom: 'memoire-tombale', outils: OUTILS_ECRITURE, evaluer }
