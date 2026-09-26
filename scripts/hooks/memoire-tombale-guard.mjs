// Hook PreToolUse(Write|Edit|mcp__lean-ctx__ctx_patch) : la règle 6(c) du CLAUDE.md (pierre tombale,
// tolérance zéro) appliquée à `.claude/memory/**`. Une fiche devenue fausse se RÉÉCRIT au présent ou
// se SUPPRIME — git porte l'historique ; poser un EN-TÊTE DE SUPERSESSION (les trois mots que `MOTIF`
// reconnaît plus bas) au-dessus du faux le laisse en place, et la fiche se relit comme une vérité
// (utilisateur, 2026-09-02 : « ce que tu as mis dans la mémoire sera retiré … vu qu'elle sera juste
// une pierre tombale ou du poison ? »). Le geste n'est pas interdit : il est ARBITRÉ (`ask`, patron
// `enterine-guard`).
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
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
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
  const chemin = String(input?.file_path ?? input?.path ?? '')
  if (!estFicheMemoire(chemin)) return null
  const neuf = input?.new_string ?? input?.new_text ?? input?.content
  if (typeof neuf !== 'string') return null
  const ancien = input?.old_string ?? input?.old_text ?? (input?.content !== undefined ? lireDisque(chemin) : '')
  const lignes = neuf.split(/\r?\n/)
  for (const { texte, rang } of lignesAjoutees(neuf, ancien)) {
    const entete = enteteSupersession(texte, lignes[rang - 1])
    if (!entete) continue
    return {
      decision: 'ask',
      reason:
        '⚠ En-tête de SUPERSESSION ajouté à une fiche de mémoire (« ' + entete + ' ») : une fiche ' +
        'devenue fausse se RÉÉCRIT au présent, ou se SUPPRIME (git porte l\'historique) — un en-tête ' +
        'posé AU-DESSUS du faux laisse le faux se relire comme une vérité (règle 6c, tolérance zéro). ' +
        'Confirmer seulement si cette ligne NOMME le porteur actuel de l\'invariant ; sinon, réécrire ' +
        'le corps de la fiche à l\'état présent.',
    }
  }
  return null
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let input = null
  try { input = JSON.parse(raw)?.tool_input ?? null } catch { /* stdin illisible → silence */ }
  const lire = (chemin) => { try { return readFileSync(chemin, 'utf8') } catch { return '' } }
  // La fiche se juge sous son chemin RÉEL : la mémoire de session s'écrit par une jonction (#1973).
  const chemin = cheminDEcriture(input)
  const decision = chemin ? evaluate({ ...input, file_path: chemin.reel }, lire) : null
  if (decision && !chemin.horsContenu) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision.decision ?? 'ask',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
