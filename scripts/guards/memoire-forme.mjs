// FORME DU STOCK PERMANENT — ce qui est chargé à chaque session (fiches de mémoire, skills, agents,
// credo) porte une RÈGLE, pas un RÉCIT. Le récit (ce qui a été vécu, mesuré, daté) est de l'histoire :
// git la porte. Une fiche qui raconte grossit à chaque relecture et personne ne la relit.
//
// PÉRIMÈTRE JUGÉ (trois familles, deux volets) :
//   A. `.claude/memory/*.md` HORS `MEMORY.md` (l'index, jugé par `budget-contexte.mjs`) —
//      1. corps > TAILLE_MAX octets, frontmatter exclu ET TEXTE CITÉ (`« … »`) EXCLU : la PROSE se
//         plafonne, jamais les mots de l'utilisateur. « Tout arbitrage UTILISATEUR consigné (doc,
//         mémoire, ticket) porte sa CITATION verbatim + date » (CLAUDE.md § Pour TOUT agent) : un
//         verbatim ne se tronque pas pour tenir un plafond, et une fiche qui en porte trois n'est pas
//         plus bavarde qu'une autre. Ce qui se borne, c'est ce que la session ÉCRIT autour — sur la
//         même ligne comme ailleurs : un seul mot cité n'exempte pas la ligne qui le porte ;
//      2. toute date ISO (`AAAA-MM-JJ`) dans le corps HORS d'une ligne de citation verbatim
//         (celle qui porte les guillemets `«` : un arbitrage consigné DOIT porter sa date) ;
//      3. les motifs de RÉCIT.
//   B. `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`, `.claude/credo.md` — les motifs de RÉCIT
//      seulement : ces fichiers n'ont pas de plafond de taille ici (leur `description:` est plafonnée
//      par `budget-contexte.mjs`, leur corps est chargé à la demande).
//
// ANGLES MORTS DÉCLARÉS : le contenu VRAI mais long n'est pas jugé (seule sa TAILLE l'est — une
// fiche juste et dense passe tant qu'elle tient) ; une date dans un NOM DE FICHIER n'est pas jugée ;
// une date dans le FRONTMATTER (`description`, `metadata`) n'est pas jugée ; les motifs de récit sont
// une liste FERMÉE, pas une détection sémantique — un récit qui n'emploie aucun de ces mots passe ; un
// texte de la session placé tout entier entre `« »` passe pour une citation.
import { Buffer } from 'node:buffer'

/** Plafond du CORPS d'une fiche de mémoire, en octets. Une règle tient ; un récit non. */
export const TAILLE_MAX = 1200

/**
 * Les tournures qui disent « je raconte ce qui s'est passé » — liste FERMÉE. Chacune a été relevée
 * en tête des fiches qui avaient le plus grossi (#1728 : `vécu #254`, `mesuré le 2026-09-08`,
 * `précédent : la fausse piste…`, `audit 2026-07`, `session du 3 août`).
 */
export const MOTIFS_DE_RECIT = [
  { nom: 'vécu', re: /\bvécu\b/i },
  { nom: 'mesuré le', re: /\bmesuré le\b/i },
  { nom: 'précédent :', re: /\bprécédent\s*:/i },
  { nom: 'audit 20', re: /\baudit 20\d\d/i },
  { nom: 'session du', re: /\bsession du\b/i },
]

/** Une date ISO `AAAA-MM-JJ`, celle que porte une ligne de citation verbatim. */
export const DATE = /20\d\d-\d\d-\d\d/

/** Le CORPS d'un document : ce qui suit le frontmatter YAML, ou tout le texte s'il n'y en a pas. PURE. */
export function corpsDe(texte) {
  const lignes = String(texte ?? '').split(/\r?\n/)
  if (lignes[0]?.trim() !== '---') return { corps: String(texte ?? ''), premiereLigne: 1 }
  const fin = lignes.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (fin === -1) return { corps: String(texte ?? ''), premiereLigne: 1 }
  return { corps: lignes.slice(fin + 1).join('\n'), premiereLigne: fin + 2 }
}

/** La famille d'un chemin du périmètre : `'fiche'`, `'prose'` ou `null` (hors périmètre). PURE. */
export function familleDe(chemin) {
  const rel = String(chemin ?? '').replace(/\\/g, '/')
  if (rel === '.claude/memory/MEMORY.md') return null
  if (/^\.claude\/memory\/[^/]+\.md$/.test(rel)) return 'fiche'
  if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(rel)) return 'prose'
  if (/^\.claude\/agents\/[^/]+\.md$/.test(rel)) return 'prose'
  if (rel === '.claude/credo.md') return 'prose'
  return null
}

/**
 * Les défauts de forme d'un document du périmètre. PURE.
 * @param {string} chemin @param {string} texte
 * @returns {{ligne: number, quoi: string, detail: string}[]} vide si le chemin est hors périmètre.
 */
export function defautsDeForme(chemin, texte) {
  const famille = familleDe(chemin)
  if (!famille) return []
  const { corps, premiereLigne } = corpsDe(texte)
  const lignes = corps.split(/\r?\n/)
  const defauts = []
  if (famille === 'fiche') {
    // La PROSE mesurée : le corps MOINS son texte cité (`« … »` fermé, sur une ou plusieurs lignes).
    // Les mots de l'utilisateur sont portés tels quels, jamais tronqués pour tenir un plafond (en-tête
    // de ce fichier) ; un `«` jamais refermé ne retire rien.
    const prose = corps.replace(/«[^«»]*»/g, '')
    const octets = Buffer.byteLength(prose.replace(/\r\n/g, '\n'), 'utf8')
    if (octets > TAILLE_MAX) {
      defauts.push({
        ligne: premiereLigne,
        quoi: 'fiche trop longue',
        detail: `${octets} octets de PROSE (citations exclues) pour un plafond de ${TAILLE_MAX} — une fiche `
          + 'porte UNE règle ; ce qui la dépasse est du récit (git le porte) ou une seconde règle (une '
          + 'seconde fiche).',
      })
    }
    // Une date n'est légitime que SUR une ligne de CITATION (celle qui porte les guillemets `«`) :
    // c'est la règle du dépôt — « Tout arbitrage UTILISATEUR consigné (doc, mémoire, ticket) porte sa
    // CITATION verbatim + date » (CLAUDE.md § Pour TOUT agent). Elle ne vaut pas que pour les fiches
    // `user-*` (les `feedback-*`/`game-*` portent aussi des verbatims datés, 33 mesurés le
    // 2026-09-14), et une fiche peut porter PLUSIEURS verbatims. Toute date HORS citation est du
    // récit daté : la règle s'écrit au présent, git porte le jour où elle est née.
    lignes.forEach((l, i) => {
      if (!DATE.test(l) || l.includes('«')) return
      defauts.push({
        ligne: premiereLigne + i,
        quoi: 'date hors citation',
        detail: 'une fiche porte une RÈGLE, jamais quand elle a été apprise — seule une ligne de '
          + 'citation verbatim (« … ») porte une date ; retirer la date (git la porte).',
      })
    })
  }
  lignes.forEach((l, i) => {
    for (const m of MOTIFS_DE_RECIT) {
      if (!m.re.test(l)) continue
      defauts.push({
        ligne: premiereLigne + i,
        quoi: 'motif de récit',
        detail: `« ${m.nom} » — écrire la RÈGLE au présent, sans l'épisode qui l'a révélée.`,
      })
    }
  })
  return defauts
}

/** Le refus, prêt à être joint aux autres refus d'une porte. `null` si rien. PURE. */
export function raisonDeRefusDeForme(parFichier) {
  const lignes = parFichier
    .flatMap(({ chemin, defauts }) => defauts.map((d) => `${chemin}:${d.ligne} [${d.quoi}] ${d.detail}`))
  if (!lignes.length) return null
  return (
    'FORME DU STOCK PERMANENT — ces fichiers sont chargés à CHAQUE session : ils portent une règle, '
    + `jamais un récit (scripts/guards/memoire-forme.mjs) :\n${lignes.map((l) => `  ${l}`).join('\n')}`
  )
}
