// FORME DU STOCK PERMANENT — ce qui est chargé à chaque session (fiches de mémoire, skills, agents,
// credo) porte une RÈGLE, pas un RÉCIT. Le récit (ce qui a été vécu, mesuré, daté) est de l'histoire :
// git la porte. Une fiche qui raconte grossit à chaque relecture et personne ne la relit.
//
// PÉRIMÈTRE JUGÉ (cinq familles) :
//   0. `.claude/memory/*.md` qui n'est ni `user-*.md` ni `MEMORY.md` — REFUSÉ, sans liste : une fiche
//      ne naît que `user-*`, pour un verbatim daté ; toute autre consigne va à son porteur (règle,
//      skill, agent, doc : `.claude/rules/contexte-agents.md`).
//   I. `.claude/memory/MEMORY.md` — l'en-tête de ROUTAGE, sous `PLAFONDS_DE_L_INDEX` (lignes, octets,
//      caractères) ; sa croissance entre au budget du contexte permanent (`budget-contexte.mjs`).
//   A. `.claude/memory/user-*.md` —
//      1. corps > TAILLE_MAX octets, frontmatter exclu ET TEXTE CITÉ (`« … »`) EXCLU : la PROSE se
//         plafonne, jamais les mots de l'utilisateur. « Tout arbitrage UTILISATEUR consigné (doc,
//         mémoire, ticket) porte sa CITATION verbatim + date » (AGENTS.md § Pour TOUT agent) : un
//         verbatim ne se tronque pas pour tenir un plafond, et une fiche qui en porte trois n'est pas
//         plus bavarde qu'une autre. Ce qui se borne, c'est ce que la session ÉCRIT autour — sur la
//         même ligne comme ailleurs : un seul mot cité n'exempte pas la ligne qui le porte ;
//      2. toute date ISO (`AAAA-MM-JJ`) dans le corps HORS d'une ligne de citation verbatim
//         (celle qui porte les guillemets `«` : un arbitrage consigné DOIT porter sa date) ;
//      3. toute ligne qui CITE L'UTILISATEUR (`CITATION_DE_L_UTILISATEUR`) sans sa date ISO, la même
//         règle d'AGENTS.md ;
//      4. les motifs de RÉCIT.
//   R. `.claude/rules/*.md` — 1. fichier entier > REGLE_TAILLE_MAX octets (« 4 Ko maximum par fichier »,
//      .claude/rules/contexte-agents.md) ; 2. et 3. ceux de A, frontmatter `paths:` exclu ;
//      4. les motifs de RÉCIT.
//   B. `.claude/skills/*/SKILL.md`, `.claude/agents/*.md`, `.claude/credo.md` — les motifs de RÉCIT
//      seulement : ces fichiers n'ont pas de plafond de taille ici (leur `description:` est plafonnée
//      par `budget-contexte.mjs`, leur corps est chargé à la demande).
//
// ANGLES MORTS DÉCLARÉS : le contenu VRAI mais long n'est pas jugé (seule sa TAILLE l'est — une
// fiche juste et dense passe tant qu'elle tient) ; une date dans un NOM DE FICHIER n'est pas jugée ;
// une date dans le FRONTMATTER (`description`, `metadata`) n'est pas jugée ; les motifs de récit sont
// une liste FERMÉE, pas une détection sémantique — un récit qui n'emploie aucun de ces mots passe ; un
// texte de la session placé tout entier entre `« »` passe pour une citation ; une parole de l'utilisateur
// citée sans marqueur d'attribution (`Verbatim`, `utilisateur`) suivi de `:` puis `«` n'est pas vue citée ;
// à l'inverse, un livre ou un tiers cité sous la même forme (`Verbatim : « … »`) est jugé comme une parole
// de l'utilisateur et doit porter une date.
import { Buffer } from 'node:buffer'

/** Plafond du CORPS d'une fiche de mémoire, en octets. Une règle tient ; un récit non. */
export const TAILLE_MAX = 1200

/** Plafond d'une règle `.claude/rules/*.md`, fichier entier, en octets : .claude/rules/contexte-agents.md. */
export const REGLE_TAILLE_MAX = 4096


/** Le NOM d'un fichier admis à plat sous `.claude/memory/` : l'en-tête `MEMORY.md` ou une fiche `user-*`. PURE. */
export const estNomDeMemoireAdmis = (nom) => nom === 'MEMORY.md' || /^user-[a-z0-9-]+\.md$/.test(String(nom ?? ''))

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

/**
 * Une ligne qui CITE l'utilisateur : un marqueur d'attribution (`Verbatim`, `Verbatims`, `utilisateur`),
 * au plus 40 caractères (date, contexte, gras), puis `:` et la citation `«`.
 */
export const CITATION_DE_L_UTILISATEUR = /\b(verbatims?|utilisateur)\b[^«:\n]{0,40}:\s*«/i

/**
 * Plafonds de CHARGEMENT de l'index. Doc memory : « The first 200 lines of `MEMORY.md`, or the first
 * 25KB, whichever comes first, are loaded at the start of every conversation. » Doc hooks : la sortie
 * d'un hook (`additionalContext`, stdout) est « capped at 10,000 characters » ; au-delà elle est remplacée
 * par un aperçu. En conteneur distant, c'est un hook qui porte l'index au contexte (#2710) : `caracteres`
 * lui laisse 500 caractères pour son en-tête et ses lignes de constat. `lignes` est plus strict que le
 * chargement (200) : `MEMORY.md` est un en-tête de ROUTAGE (.claude/rules/contexte-agents.md).
 */
export const PLAFONDS_DE_L_INDEX = Object.freeze({ lignes: 10, octets: 25_000, caracteres: 9_500 })

/** Le CORPS d'un document : ce qui suit le frontmatter YAML, ou tout le texte s'il n'y en a pas. PURE. */
export function corpsDe(texte) {
  const lignes = String(texte ?? '').split(/\r?\n/)
  if (lignes[0]?.trim() !== '---') return { corps: String(texte ?? ''), premiereLigne: 1 }
  const fin = lignes.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (fin === -1) return { corps: String(texte ?? ''), premiereLigne: 1 }
  return { corps: lignes.slice(fin + 1).join('\n'), premiereLigne: fin + 2 }
}

/** La famille d'un chemin du périmètre : `'intrus'`, `'index'`, `'fiche'`, `'regle'`, `'prose'` ou `null` (hors périmètre). PURE. */
export function familleDe(chemin) {
  const rel = String(chemin ?? '').replace(/\\/g, '/')
  const memoire = /^\.claude\/memory\/([^/]+\.md)$/.exec(rel)
  if (memoire) {
    if (!estNomDeMemoireAdmis(memoire[1])) return 'intrus'
    return memoire[1] === 'MEMORY.md' ? 'index' : 'fiche'
  }
  if (/^\.claude\/rules\/[^/]+\.md$/.test(rel)) return 'regle'
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
  if (famille === 'intrus') {
    return [{
      ligne: 1,
      quoi: 'fiche hors user-*',
      detail: 'une fiche de mémoire ne naît que `user-*`, pour un arbitrage utilisateur cité verbatim et daté ; '
        + 'une autre consigne va à son porteur (règle, skill, agent, doc : .claude/rules/contexte-agents.md).',
    }]
  }
  if (famille === 'index') return defautsDIndex(texte)
  const { corps, premiereLigne } = corpsDe(texte)
  const defauts = []
  if (famille === 'regle') {
    const octets = Buffer.byteLength(String(texte ?? ''), 'utf8')
    if (octets > REGLE_TAILLE_MAX) {
      defauts.push({
        ligne: 1,
        quoi: 'règle trop longue',
        detail: `${octets} octets pour un plafond de ${REGLE_TAILLE_MAX} (.claude/rules/contexte-agents.md) — `
          + 'scinder par `paths:` ou renvoyer le détail à son doc.',
      })
    }
  }
  const lignes = corps.split(/\r?\n/)
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
  }
  if (famille === 'fiche' || famille === 'regle') {
    // Une date n'est légitime que SUR une ligne de CITATION (celle qui porte les guillemets `«`) :
    // c'est la règle du dépôt — « Tout arbitrage UTILISATEUR consigné (doc, mémoire, ticket) porte sa
    // CITATION verbatim + date » (AGENTS.md § Pour TOUT agent), et une fiche peut porter PLUSIEURS
    // verbatims. Toute date HORS citation est du récit daté : la règle s'écrit au présent, git porte
    // le jour où elle est née.
    lignes.forEach((l, i) => {
      if (!DATE.test(l) || l.includes('«')) return
      defauts.push({
        ligne: premiereLigne + i,
        quoi: 'date hors citation',
        detail: 'le stock permanent porte une RÈGLE, jamais quand elle a été apprise — seule une ligne de '
          + 'citation verbatim (« … ») porte une date ; retirer la date (git la porte).',
      })
    })
  }
  if (famille === 'fiche' || famille === 'regle') {
    lignes.forEach((l, i) => {
      if (!CITATION_DE_L_UTILISATEUR.test(l) || DATE.test(l)) return
      defauts.push({
        ligne: premiereLigne + i,
        quoi: 'citation sans date',
        detail: 'une parole de l\'utilisateur se consigne avec sa date AAAA-MM-JJ sur la ligne qui la cite ; '
          + 'introuvable, la date du commit qui l\'a versée au dépôt (`git log -S`) la borne : « au plus tard le … ».',
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

/** Les dépassements de `PLAFONDS_DE_L_INDEX` par le texte de l'index, ligne 1. PURE. */
function defautsDIndex(texte) {
  const normalise = String(texte ?? '').replace(/\r\n/g, '\n')
  const mesure = {
    lignes: normalise.split('\n').length - (normalise.endsWith('\n') ? 1 : 0),
    octets: Buffer.byteLength(normalise, 'utf8'),
    caracteres: [...normalise].length,
  }
  return Object.entries(PLAFONDS_DE_L_INDEX)
    .filter(([unite, plafond]) => mesure[unite] > plafond)
    .map(([unite, plafond]) => ({
      ligne: 1,
      quoi: 'index hors plafond',
      detail: `${mesure[unite]} ${unite} pour un plafond de ${plafond} — MEMORY.md est un en-tête de ROUTAGE ; `
        + 'les doctrines vivent dans docs/doctrines.md, les consignes chez leur porteur.',
    }))
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
