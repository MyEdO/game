/**
 * Écrit `docs/doctrines.md` — les doctrines utilisateur DÉRIVÉES des fiches `.claude/memory/user-*.md`
 * suivies par git : une fiche = une ligne (nom, date, compte de verbatims, extrait, chemin de la fiche).
 *
 * POURQUOI UN GÉNÉRATEUR : une doctrine utilisateur recopiée À LA MAIN dérive de sa fiche
 * (paraphrase, date perdue, ligne oubliée) ; le doc ment alors avec l'autorité du canon. La fiche
 * reste la SOURCE, ce doc n'en est que le reflet — une doctrine neuve s'écrit en fiche.
 *
 * CE QUE LE DOC EST : UN EXTRAIT par fiche, jamais tous ses verbatims (18 des 29 fiches en portent
 * plusieurs ; les rendre tous ferait une page que personne ne lit). La ligne DIT combien la fiche en
 * porte, et le chapeau renvoie à la fiche, qui fait foi. L'extrait est un VERBATIM (texte entre « »
 * du corps), jamais un résumé : coupé à 240 caractères sur une FIN DE PHRASE quand la fiche en offre
 * une, sinon sur un mot — jamais sur un mot-outil, qui laisserait la phrase en suspens.
 *
 * La cible est un doc GÉNÉRÉ écrit EN ENTIER (`targets` dans `GENERATORS`, famille
 * `merge=docs-generes`) : `CLAUDE.md` ne porte que la LIGNE DE ROUTAGE qui y mène.
 *
 * Mode --check (chaîné dans `npm run docs:check` et au pre-commit dès qu'une fiche `user-*` ou
 * `docs/doctrines.md` est stagé) : régénère en mémoire, compare au fichier committé, exit 1 si divergence.
 *
 *   node scripts/docs/build-doctrines.mjs [--check]
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
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
  'Un EXTRAIT par fiche — la FICHE fait foi : avant tout brief, tout verdict ou tout code sur un ' +
  'socle, lire les fiches concernées (`.claude/memory/user-*.md`). Ces doctrines PRIMENT sur tout ' +
  "réflexe et sur toute prose de brief ; un brief qui les contredit ment. Une doctrine neuve s'écrit " +
  'en FICHE `user-*`, jamais ici. Règle appliquée : « Tout arbitrage UTILISATEUR consigné (doc, ' +
  'mémoire, ticket) porte sa CITATION verbatim + date. » (CLAUDE.md § Pour TOUT agent).'
const MIN_VERBATIM = 40
const MAX_VERBATIM = 240

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

/** Mots qui ne terminent pas une pensée : couper là rend un extrait suspendu (« face a … »). */
const MOT_OUTIL = /(?:^|\s)(?:un|une|le|la|les|des|du|de|d'|l'|à|a|au|aux|et|ou|que|qu'|qui|tu|je|il|on|ce|cet|cette|ca|ça|en|dans|pour|par|sur|avec|sans|face|comme|si|est|sont)$/i

/** Retire la ponctuation faible PUIS les mots-outils terminaux, tant qu'il en reste. */
function nettoyerFin(texte) {
  let out = texte.replace(/[\s,;:.…—–-]+$/, '')
  while (MOT_OUTIL.test(out)) out = out.replace(MOT_OUTIL, '').replace(/[\s,;:.…—–-]+$/, '')
  return out
}

/**
 * Coupe à `max` caractères : d'abord à la dernière FIN DE PHRASE (`.`/`!`/`?`/`;`) de la fenêtre —
 * l'extrait reste alors une phrase entière, et sa ponctuation dit qu'il s'arrête là ; à défaut, sur
 * une frontière de mot, mots-outils terminaux retirés, suivie de « … ».
 */
export function tronquer(texte, max = MAX_VERBATIM) {
  if (texte.length <= max) return texte
  const fenetre = texte.slice(0, max)
  const phrase = Math.max(
    fenetre.lastIndexOf('.'), fenetre.lastIndexOf('!'), fenetre.lastIndexOf('?'), fenetre.lastIndexOf(';'),
  )
  if (phrase > max / 3) return fenetre.slice(0, phrase + 1)
  const espace = fenetre.lastIndexOf(' ')
  return `${nettoyerFin(espace > max / 3 ? fenetre.slice(0, espace) : fenetre)} …`
}

/** Marqueurs d'une doctrine PRESCRIPTIVE : entre deux verbatims d'une même fiche, celui qui POSE une
 *  règle prime sur celui qui raconte le grief. */
const PRESCRIPTIF = /\b(jamais|toujours|un seul|une seule|aucun|aucune|tout|toute|interdit|on migre)\b/i

/**
 * Verbatims d'une fiche : les citations du corps d'au moins `MIN_VERBATIM` caractères. Les
 * guillemets français font foi ; les guillemets droits ne servent que si le corps n'offre AUCUNE
 * citation française assez longue — l'inverse ferait élire un fragment `"…"` niché DANS un verbatim
 * français. Un corps sans citation longue rend les courtes, pour que l'appelant décide.
 * @returns {string[]} dans l'ordre du corps.
 */
export function verbatimsDe(corps) {
  const francaises = [...String(corps).matchAll(/«([^»]+)»/g)].map((m) => compacter(m[1]))
  const droites = [...String(corps).matchAll(/"([^"\n]+)"/g)].map((m) => compacter(m[1]))
  const longues = (liste) => liste.filter((c) => c.length >= MIN_VERBATIM)
  if (longues(francaises).length) return longues(francaises)
  if (longues(droites).length) return longues(droites)
  return [...francaises, ...droites].filter(Boolean)
}

/**
 * L'EXTRAIT retenu : le plus long des verbatims PRESCRIPTIFS s'il y en a, sinon le plus long tout
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

/**
 * Date d'une doctrine : celle écrite dans le PARAGRAPHE du verbatim, sinon celle de l'en-tête
 * (description puis `metadata.modified`), sinon la date d'AJOUT git de la fiche — dite comme telle,
 * parce qu'elle date le fichier et non la parole.
 * @returns {{ date: string, source: 'phrase'|'en-tete'|'ajout' }}
 */
export function dateDe({ entete, corps, citation, dateAjout }) {
  const dansPhrase = citation ? DATE_ISO.exec(paragrapheDe(corps, citation)) : null
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
 * fiche en porte plusieurs (l'extrait n'est alors qu'un extrait, et la ligne le dit), l'extrait, la
 * fiche. `dateAjout(fichier)` n'est appelée QUE si ni le paragraphe ni l'en-tête ne datent la parole
 * (un `git log` par fiche coûte, et ment sur la date de la parole).
 */
export function ligneDe({ fichier, texte }, dateAjout = () => '') {
  const { entete, corps } = decouperFiche(texte)
  const citation = citationDe(corps)
  if (!citation) abandon(`${fichier} — aucune citation verbatim (« … ») : une fiche user-* PORTE la parole de l'utilisateur`)
  const { date, source } = dateDe({ entete, corps, citation, dateAjout: () => dateAjout(fichier) })
  if (!date) abandon(`${fichier} — aucune date lisible (paragraphe, en-tête, ni ajout git)`)
  const n = verbatimsDe(corps).length
  const quand = [source === 'ajout' ? `${date}, date d'ajout` : date, ...(n > 1 ? [`${n} verbatims`] : [])].join(', ')
  return `- **${nomDe(entete, fichier)}** (${quand}) : « ${tronquer(citation)} » — \`${fichier}\``
}

/** Le doc entier. `fiches` = `[{ fichier, texte }]`, rendues triées par chemin (ordre total). */
export function construireDoc(fiches, { dateAjout = () => '' } = {}) {
  const lignes = [...fiches]
    .sort((a, b) => parUnitesDeCode(a.fichier, b.fichier))
    .map((f) => ligneDe(f, dateAjout))
  return [TITRE, '', AVERTISSEMENT, '', CHAPEAU, '', ...lignes, ''].join('\n')
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

function main() {
  const check = process.argv.includes('--check')
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const chemins = fichesSuivies(cwd)
  if (chemins.length === 0) abandon('aucune fiche `.claude/memory/user-*.md` suivie par git — source vide, doc refusé')
  const fiches = chemins.map((fichier) => ({ fichier, texte: readFileSync(resolve(cwd, fichier), 'utf8') }))
  const out = construireDoc(fiches, { dateAjout: (f) => dateAjoutGit(f, cwd) })
  const poids = Buffer.byteLength(out, 'utf8')
  emitOrCheck({
    out,
    path: resolve(cwd, CIBLE),
    check,
    staleMsg: `${OUTIL} — ${CIBLE} PÉRIMÉ (fiche ajoutée/éditée, ou doc édité à la main).`,
    rerunMsg: `${OUTIL} — relancer \`npm run docs:doctrines\` et committer ${CIBLE}.`,
    okMsg: `${OUTIL} — OK (${chemins.length} doctrines, ${poids} octets)`,
    writeMsg: `${OUTIL} — ${CIBLE} écrit (${chemins.length} doctrines, ${poids} octets)`,
  })
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
