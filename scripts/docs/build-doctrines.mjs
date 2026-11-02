/**
 * Écrit `docs/doctrines.md` — les doctrines utilisateur DÉRIVÉES des fiches `.claude/memory/user-*.md`
 * suivies par git : une fiche = une ligne (nom, date, description, compte de verbatims, chemin).
 *
 * POURQUOI UN GÉNÉRATEUR : une doctrine utilisateur recopiée À LA MAIN dérive de sa fiche
 * (paraphrase, date perdue, ligne oubliée) ; le doc ment alors avec l'autorité du canon. La fiche
 * reste la SOURCE, ce doc n'en est que le reflet — une doctrine neuve s'écrit en fiche.
 *
 * CE QUE LE DOC EST : un index de fiches ; les verbatims restent dans leur fiche (#3175).
 *
 * La cible est un doc GÉNÉRÉ écrit EN ENTIER (`targets` dans `GENERATORS`, jamais commité, #2203) :
 * `AGENTS.md` ne porte que la LIGNE DE ROUTAGE qui y mène.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-doctrines.mjs [--check]
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'

const OUTIL = 'build-doctrines'
const CIBLE = 'docs/doctrines.md'
const TITRE = '# Doctrines utilisateur — généré'
const AVERTISSEMENT = [
  '> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-doctrines.mjs` (`npm run docs:doctrines`) — NE PAS ÉDITER À LA MAIN.',
  '> Source UNIQUE : les fiches `.claude/memory/user-*.md` suivies par git.',
].join('\n')
/** Le chapeau porte SA source : la règle qu'il applique est déjà écrite dans le canon manuscrit. */
const CHAPEAU =
  'Une ligne par fiche — la FICHE fait foi : avant tout brief, tout verdict ou tout code sur un ' +
  'socle, lire les fiches concernées (`.claude/memory/user-*.md`). Ces doctrines PRIMENT sur tout ' +
  "réflexe et sur toute prose de brief ; un brief qui les contredit ment. Une doctrine neuve s'écrit " +
  'en FICHE `user-*`, jamais ici. Les verbatims datés vivent au ticket ou dans leur fiche ; ' +
  'cet index ne les recopie pas (AGENTS.md § Pour TOUT agent, #3175).'
const MIN_VERBATIM = 40
/** Le doc dit ce qu'il ne couvre PAS : sans ça, un généré se lit comme exhaustif (#908). Les bornes
 *  citées sont les CONSTANTES ci-dessus — jamais un nombre recopié à la main. */
const PERIMETRE = () =>
  '**Périmètre mesuré / angles morts** — mesuré : les fiches `.claude/memory/user-*.md` SUIVIES par ' +
  'git (`git ls-files`), une ligne par fiche. Une fiche neuve NON stagée n’y est donc pas, et elle y ' +
  'entre au commit qui la suit ; une doctrine qui vit ailleurs qu’en fiche `user-*` (ticket, fil de ' +
  'session) est invisible ici. Chaque ligne porte le nom, la date, la description de l’en-tête, le ' +
  'compte de verbatims quand la fiche en porte plusieurs et son chemin. Les citations restent dans les fiches. Le comptage écarte ' +
  `les citations de moins de ${MIN_VERBATIM} caractères tant qu’une plus longue existe, ainsi que le texte ` +
  'de l’assistant (`non-verbatim utilisateur`, paragraphes `**Why**` et `**How to apply**`). La DATE est ' +
  'celle du paragraphe du verbatim prescriptif le plus long, à défaut du plus long verbatim, puis de ' +
  'l’en-tête, puis de l’AJOUT git de la fiche — dit comme tel, parce qu’il date le fichier et non la ' +
  'parole. Rien ici ne vérifie que la fiche dit vrai, ni qu’elle est à jour du code.'

export function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}

/** Corps d'une fiche = tout ce qui suit le frontmatter `---…---` ; en-tête = le frontmatter seul. */
export function decouperFiche(texte) {
  const t = String(texte).replace(/\r\n?/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t)
  return m ? { entete: m[1], corps: t.slice(m[0].length) } : { entete: '', corps: t }
}

const compacter = (s) => s.replace(/\s+/g, ' ').trim()

/** Le MARQUEUR unique du texte de l'ASSISTANT dans une fiche (question AskUserQuestion, option non
 *  retenue, évaluation d'ingénierie) : jamais la parole de l'utilisateur. Une ligne qui le porte
 *  ne fournit pas le verbatim qui date la ligne, et elle ne porte aucun « » (convention des fiches, #1993). */
const MARQUEUR_ASSISTANT = /non-verbatim utilisateur/

/** Une ligne telle que `ANNONCES_ASSISTANT` la lit : apostrophe typographique rendue droite, gras et
 *  italique (`*`, `_`) retirés, casse basse. */
const formeDAnnonce = (ligne) => ligne.replace(/[’‘]/g, "'").replace(/[*_]/g, '').toLowerCase()

/** Introducteur d'une question citée : `question(s)` ou la préposition `à`, `au`, `aux`. */
const INTRODUIT_QUESTION = /(?:\bquestions?|(?:^|[\s(,])(?:à|aux?))\s*:?\s*$/
/** Réponse citée qui suit une question citée : `:` ou `→`, puis `«`. */
const SUIVIE_DE_REPONSE = /^\s*[:→]\s*«/

/** Une question CITÉE (`« … ? »`) à profondeur de guillemets 0 — dedans, c'est la parole citée de
 *  l'utilisateur —, introduite par `INTRODUIT_QUESTION` ou suivie de `SUIVIE_DE_REPONSE`. */
const QUESTION_CITEE = {
  test(ligne) {
    for (let i = ligne.indexOf('«'); i >= 0; i = ligne.indexOf('«', i)) {
      let fin = i + 1
      for (let p = 1; fin < ligne.length && p > 0; fin++) p += ligne[fin] === '«' ? 1 : ligne[fin] === '»' ? -1 : 0
      const contenu = ligne.slice(i + 1, ligne[fin - 1] === '»' ? fin - 1 : fin)
      if (/\?\s*$/.test(contenu)
        && (INTRODUIT_QUESTION.test(ligne.slice(0, i)) || SUIVIE_DE_REPONSE.test(ligne.slice(fin)))) return true
      i = fin
    }
    return false
  },
}

/** Les FORMES du texte de l'assistant, donc tenues de porter `MARQUEUR_ASSISTANT` (lues sur
 *  `formeDAnnonce`) : une ou des questions posées — en tête de ligne, ou suivies de `(` ou `:` — ;
 *  une `QUESTION_CITEE` ; une option ou proposition en tête de ligne qui n'est ni retenue ni
 *  choisie ; une option ou proposition, ses titres entre « » ou non, puis un qualificatif non
 *  retenu ou écarté, où qu'elle soit ; une évaluation d'ingénierie en tête de ligne. La simple
 *  mention de l'outil `AskUserQuestion` n'en est pas une : l'option retenue ou choisie est la
 *  parole de l'utilisateur, où qu'elle ait été posée. */
const ANNONCES_ASSISTANT = [
  /^[\s>-]*questions? posées?/,
  /questions? posées?\s*[(:]/,
  QUESTION_CITEE,
  /^[\s>-]*(?:options?|propositions?)\b(?!\s+(?:retenue|choisie)s?\b)/,
  /\b(?:options?|propositions?)(?:\s*«[^»]*»(?:\s*(?:,|et)\s*«[^»]*»)*)?\s+(?:(?:est|sont|a été|ont été)\s+)?(?:non retenues?|écartées?)/,
  /^[\s>-]*[ée]valuation d'ingénierie/,
]

const texteAssistant = (ligne) => MARQUEUR_ASSISTANT.test(ligne)

/** Ouvre un paragraphe de PROSE de l'assistant par construction : `**Why**` ou `**How to apply**` en
 *  tête de ligne. Il court jusqu'à la ligne vide ou au libellé gras (`**…`) suivant. */
const TETE_PROSE_ASSISTANT = /^\s*\*\*(?:why|how to apply)\b/i
const TETE_LIBELLE = /^\s*\*\*/

/** Le corps sans son texte de l'assistant — lignes marquées (`MARQUEUR_ASSISTANT`) et paragraphes
 *  **Why** / **How to apply** : ce qui reste fournit les verbatims qui datent les lignes. */
function horsAssistant(corps) {
  let prose = false
  return String(corps).split('\n').map((l) => {
    if (!l.trim()) prose = false
    else if (TETE_LIBELLE.test(l)) prose = TETE_PROSE_ASSISTANT.test(l)
    return prose || texteAssistant(l) ? '' : l
  }).join('\n')
}

/**
 * Défauts de la convention du texte de l'assistant dans une fiche : une ligne marquée qui porte des
 * « » range le texte de l'assistant là où un lecteur cherche la parole de l'utilisateur ; une ligne
 * qui l'annonce (`ANNONCES_ASSISTANT`) sans le marqueur n'est pas écartée, et ses « » passeraient
 * pour la parole de l'utilisateur. PUR.
 * @returns {string[]} `fichier:ligne — …`, ligne du FICHIER (frontmatter compris).
 */
export function defautsDuTexteAssistant(fichier, texte) {
  return String(texte).replace(/\r\n?/g, '\n').split('\n').flatMap((l, i) => {
    if (texteAssistant(l)) {
      return /[«»]/.test(l)
        ? [`${fichier}:${i + 1} — texte de l'assistant (\`non-verbatim utilisateur\`) porteur de « » : il s'écrit sans guillemets français, réservés à la parole de l'utilisateur`]
        : []
    }
    return ANNONCES_ASSISTANT.some((forme) => forme.test(formeDAnnonce(l)))
      ? [`${fichier}:${i + 1} — texte de l'assistant (question, option non retenue, évaluation d'ingénierie) sans le marqueur \`non-verbatim utilisateur\` : la ligne n'est pas écartée, et ses « » passeraient pour la parole de l'utilisateur`]
      : []
  })
}

/** Marqueurs d'une doctrine PRESCRIPTIVE : entre deux verbatims d'une même fiche, celui qui POSE une
 *  règle prime sur celui qui raconte le grief. */
const PRESCRIPTIF = /\b(jamais|toujours|un seul|une seule|aucun|aucune|tout|toute|interdit|on migre)\b/i

/**
 * Verbatims d'une fiche : les citations du corps d'au moins `MIN_VERBATIM` caractères. Les
 * guillemets français font foi ; les guillemets droits ne servent que si le corps n'offre AUCUNE
 * citation française assez longue — l'inverse ferait élire un fragment `"…"` niché DANS un verbatim
 * français. Un corps sans citation longue rend les courtes, pour que l'appelant décide. Une ligne de
 * texte de l'assistant (`MARQUEUR_ASSISTANT`) n'en fournit jamais.
 * @returns {string[]} dans l'ordre du corps.
 */
export function verbatimsDe(corps) {
  const matiere = horsAssistant(corps)
  const francaises = [...matiere.matchAll(/«([^»]+)»/g)].map((m) => compacter(m[1]))
  const droites = [...matiere.matchAll(/"([^"\n]+)"/g)].map((m) => compacter(m[1]))
  const longues = (liste) => liste.filter((c) => c.length >= MIN_VERBATIM)
  if (longues(francaises).length) return longues(francaises)
  if (longues(droites).length) return longues(droites)
  return [...francaises, ...droites].filter(Boolean)
}

/**
 * Le verbatim qui date la ligne : le plus long des verbatims PRESCRIPTIFS s'il y en a, sinon le plus long tout
 * court. Une fiche dont le grief est plus bavard que sa règle rendrait sinon le grief.
 * @returns {string|null} `null` si la fiche ne porte aucune citation.
 */
export function citationDe(corps) {
  const tous = verbatimsDe(corps)
  if (tous.length === 0) return null
  const prescriptifs = tous.filter((c) => PRESCRIPTIF.test(c))
  return (prescriptifs.length ? prescriptifs : tous).reduce((a, b) => (b.length > a.length ? b : a))
}

/** Date ISO isolée, horodatage compris : dans `2026-07-29T10:56:20Z` (forme du champ `modified` des
 *  en-têtes de fiche), `T` est un caractère de mot — d'où la frontière par classe, pas par `\b`. */
const DATE_ISO = /(?<![\d-])(\d{4}-\d{2}-\d{2})(?![\d-])/

/** Paragraphe (bloc entre lignes vides) qui porte `citation`. */
function paragrapheDe(corps, citation) {
  const noyau = citation.slice(0, 30)
  return String(corps)
    .split(/\n\s*\n/)
    .find((p) => compacter(p).includes(noyau)) ?? ''
}

/** LIGNE du paragraphe qui porte `citation` : une fiche empile ses verbatims datés ligne à ligne. */
function ligneDuVerbatim(paragraphe, citation) {
  const noyau = citation.slice(0, 30)
  return paragraphe.split('\n').find((l) => compacter(l).includes(noyau)) ?? ''
}

/**
 * Date d'une doctrine : celle écrite sur la LIGNE du verbatim, sinon dans son PARAGRAPHE, sinon
 * celle de l'en-tête (description puis `metadata.modified`), sinon la date d'AJOUT git de la fiche —
 * dite comme telle, parce qu'elle date le fichier et non la parole.
 * @returns {{ date: string, source: 'phrase'|'en-tete'|'ajout' }}
 */
export function dateDe({ entete, corps, citation, dateAjout }) {
  const paragraphe = citation ? paragrapheDe(corps, citation) : ''
  const dansPhrase = citation
    ? (DATE_ISO.exec(ligneDuVerbatim(paragraphe, citation)) ?? DATE_ISO.exec(paragraphe))
    : null
  if (dansPhrase) return { date: dansPhrase[1], source: 'phrase' }
  const dansEntete = DATE_ISO.exec(entete)
  if (dansEntete) return { date: dansEntete[1], source: 'en-tete' }
  const ajout = DATE_ISO.exec(String(typeof dateAjout === 'function' ? dateAjout() : (dateAjout ?? '')))
  if (ajout) return { date: ajout[1], source: 'ajout' }
  return { date: '', source: 'ajout' }
}

/** Nom déclaré par l'en-tête, à défaut le nom de fichier. */
export function nomDe(entete, fichier) {
  const m = /^name:\s*(.+)$/m.exec(entete)
  return (m ? m[1].trim() : '') || fichier.replace(/^.*\//, '').replace(/\.md$/, '')
}

/**
 * Ligne de doctrine d'une fiche `{ fichier, texte }` : la date, le COMPTE de verbatims quand la
 * fiche en porte plusieurs, la description de l'en-tête et le chemin. `dateAjout(fichier)` n'est appelée QUE si ni
 * le paragraphe ni l'en-tête ne datent la parole
 * (un `git log` par fiche coûte, et ment sur la date de la parole).
 */
export function ligneDe({ fichier, texte }, dateAjout = () => '') {
  const defauts = defautsDuTexteAssistant(fichier, texte)
  if (defauts.length) abandon(defauts.join('\n'))
  const { entete, corps } = decouperFiche(texte)
  const citation = citationDe(corps)
  if (!citation) abandon(`${fichier} — aucune citation verbatim (« … ») : une fiche user-* PORTE la parole de l'utilisateur`)
  const { date, source } = dateDe({ entete, corps, citation, dateAjout: () => dateAjout(fichier) })
  if (!date) abandon(`${fichier} — aucune date lisible (paragraphe, en-tête, ni ajout git)`)
  const n = verbatimsDe(corps).length
  const quand = [source === 'ajout' ? `${date}, date d'ajout` : date, ...(n > 1 ? [`${n} verbatims`] : [])].join(', ')
  const description = (/^description:\s*(.+)$/m.exec(entete)?.[1] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2')
  return `- **${nomDe(entete, fichier)}** (${quand}) — ${description} — \`${fichier}\``
}

/** Le doc entier. `fiches` = `[{ fichier, texte }]`, rendues triées par chemin (ordre total). */
export function construireDoc(fiches, { dateAjout = () => '' } = {}) {
  const lignes = [...fiches]
    .sort((a, b) => parUnitesDeCode(a.fichier, b.fichier))
    .map((f) => ligneDe(f, dateAjout))
  return [TITRE, '', AVERTISSEMENT, '', PERIMETRE(), '', CHAPEAU, '', ...lignes, ''].join('\n')
}

/** Fiches `user-*.md` SUIVIES par git (aucun listing de disque ici : `ls-files` trie). */
export function fichesSuivies(cwd) {
  const sortie = execFileSync('git', ['ls-files', '.claude/memory/user-*.md'], { cwd, encoding: 'utf8' })
  return sortie.split('\n').map((l) => l.trim()).filter(Boolean).sort((a, b) => parUnitesDeCode(a, b))
}

/** Date du commit qui a AJOUTÉ la fiche (`%as` = date d'auteur, forme courte). */
export function dateAjoutGit(fichier, cwd) {
  try {
    return execFileSync('git', ['log', '--diff-filter=A', '--format=%as', '-1', '--', fichier], { cwd, encoding: 'utf8' }).trim()
  } catch { return '' }
}

/** Le doc rendu depuis la racine git `cwd`, et le nombre de doctrines qu'il porte. */
function rendu(cwd) {
  const chemins = fichesSuivies(cwd)
  if (chemins.length === 0) abandon('aucune fiche `.claude/memory/user-*.md` suivie par git — source vide, doc refusé')
  const fiches = chemins.map((fichier) => ({ fichier, texte: readFileSync(resolve(cwd, fichier), 'utf8') }))
  return { out: construireDoc(fiches, { dateAjout: (f) => dateAjoutGit(f, cwd) }), n: chemins.length }
}

const racineGit = () => execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre(cwd = racineGit()) {
  return new Map([[CIBLE, rendu(cwd).out]])
}

function main() {
  const check = process.argv.includes('--check')
  const cwd = racineGit()
  const { out, n } = rendu(cwd)
  const poids = Buffer.byteLength(out, 'utf8')
  ecrireOuVerifier({
    out,
    path: resolve(cwd, CIBLE),
    check,
    staleMsg: `${OUTIL} — ${CIBLE} PÉRIMÉ (fiche ajoutée/éditée, ou doc édité à la main).`,
    rerunMsg: `${OUTIL} — relancer \`npm run docs:doctrines\` (${CIBLE} jamais commité, #2203).`,
    okMsg: `${OUTIL} — OK (${n} doctrines, ${poids} octets)`,
    writeMsg: `${OUTIL} — ${CIBLE} écrit (${n} doctrines, ${poids} octets)`,
  })
}

if (import.meta.main) main()
