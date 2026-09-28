// Assemble la sortie JSON d'un workflow « Atlas RAW » en docs/raw/<domaine>.md.
// Gere mono-domaine ({domain,topics,...}) ET multi-domaines ({domains:[...]}).
// Le champ Implemente des topics est DERIVE du code par build-implemente (#487) : l'assembleur ne
// pose qu'un PLACEHOLDER nu (`**Implémente :** (non implémenté)`) par topic, jamais une carte
// code->regle ni un bilan de fidelite manuscrits (sections d'etat supprimees #507 — code-map.md eradique).
// CŒUR — l'entrée PORTE le cœur de règles de son run (`coeur`, clé de `src/data/books.json`) :
// l'assembleur le NOMME dans l'en-tête au lieu d'une édition écrite en dur, et il ÉCRIT SOUS son
// cœur — `docs/raw/<coeur>/<domaine>.md`. Le CHEMIN déclare le cœur : deux cœurs peuvent porter le
// même domaine sans qu'aucun run n'écrase la fiche de l'autre.
// Usage : node scripts/raw/assemble-domain.mjs <output.json> [Titre si mono]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { ancresDePage } from './lib/ancres.mjs'

export const RAWDIR = 'docs/raw'

/** Le cœur d'un rendu de workflow, ou LEVE en nommant la cause : il ne se devine pas. PUR. */
export function coeurDuRendu(data, racine = {}, source = '<entrée>') {
  const coeur = data.coeur ?? racine.coeur
  if (typeof coeur !== 'string' || !coeur)
    throw new Error(
      `assemble-domain: le rendu de workflow ${source} ne porte pas son \`coeur\` — l'en-tête d'une `
      + 'fiche NOMME le corps de règles qu\'elle synthétise, et il ne se devine pas depuis le JSON',
    )
  return coeur
}

/** Le dossier de l'Atlas où vit la fiche d'un cœur, et le chemin de sa fiche de domaine — PUR. */
export const dossierDuCoeur = (coeur, rawDir = RAWDIR) => join(rawDir, coeur)
export const cheminDeFiche = (coeur, domain, rawDir = RAWDIR) => join(dossierDuCoeur(coeur, rawDir), `${domain}.md`)

/** L'EN-TÊTE d'une fiche de domaine : le `titre` du registre (`scripts/raw/domaines.json`) en est le
 *  suffixe, et le préfixe ne s'écrit qu'ICI — `domaines.test.mjs` juge les fiches par cette même
 *  fonction, la FICHE faisant foi sur le titre. PUR. */
export const enTeteDeFiche = (titre) => `# Atlas RAW — ${titre}`

/**
 * Les topics qu'un rendu de workflow ne PROUVE pas fideles — PUR. Deux valeurs, une seule
 * conclusion : `faithful:false` (la verification a tenu son refus jusqu'apres la passe de
 * correction) et `faithful:null` (aucun verdict : l'agent de verification n'a rien rendu, et le
 * workflow laisse alors le topic sans preuve). Publier l'un comme l'autre, c'est publier EN SILENCE
 * du texte que personne n'a confronte a la source.
 * @param {Array<{ topicId?: string, faithful?: boolean|null, issues?: string[] }>} topics
 */
export function topicsInfideles(topics = []) {
  return topics
    .filter((t) => t && t.faithful !== true)
    .map((t) => ({
      topicId: t.topicId ?? '(sans id)',
      verdict: t.faithful === false ? 'fidelite REFUSEE' : 'JAMAIS verifie',
      issues: Array.isArray(t.issues) ? t.issues : [],
    }))
}

/** LEVE en NOMMANT chaque topic et ses `issues` — la sortie est de corriger le RENDU (rejouer la
 *  verification ou la correction de fidelite sur ces topics), jamais un drapeau de contournement. */
function refuserLInfidele(topics, domain) {
  const fautifs = topicsInfideles(topics)
  if (!fautifs.length) return
  const detail = fautifs
    .map((f) => `- ${f.topicId} : ${f.verdict}${f.issues.length ? ` — ${f.issues.join(' ; ')}` : ''}`)
    .join('\n')
  throw new Error(
    `assemble-domain: le domaine « ${domain} » porte ${fautifs.length} topic(s) dont la fidelite n'est `
    + `pas prouvee — une fiche ne publie que du texte confronte a la source :\n${detail}\n`
    + 'Corriger le RENDU (relancer la verification/correction de fidelite sur ces topics), puis rejouer l assemblage.',
  )
}

/**
 * Les domaines qu'un run a SAUTÉS (`sautes`), avec la raison de chacun — PUR.
 * @param {{ sautes?: Array<{ domain?: string, raison?: string }> }} racine
 */
export const domainesSautes = (racine = {}) =>
  (Array.isArray(racine.sautes) ? racine.sautes : []).filter((s) => s && typeof s.domain === 'string' && s.domain)

/** LÈVE en NOMMANT le domaine sauté et sa raison : la sortie est de REJOUER ce domaine, jamais
 *  d'assembler une fiche que le run n'a pas produite. */
function refuserLeSaute(domain, racine, source) {
  const saute = domainesSautes(racine).find((s) => s.domain === domain)
  if (!saute) return
  throw new Error(
    `assemble-domain: le rendu ${source} déclare le domaine « ${domain} » SAUTÉ — ${saute.raison ?? '(raison non dite)'}. `
    + "Aucune fiche ne s'écrit d'un domaine que le run n'a pas traité : rejouer ce domaine, puis rejouer l'assemblage.",
  )
}

/** Le titre que le markdown d'un topic OUVRE — c'est lui que la page ancre, et le Sommaire vise
 *  cette ancre-là. LÈVE en nommant le topic : un topic sans titre n'est ancrable par rien (#1824). */
function titreDuTopic(topic, domain) {
  const premier = ancresDePage(topic.markdown ?? '')[0]
  if (!premier)
    throw new Error(
      `assemble-domain: le topic « ${topic.topicId ?? topic.title} » du domaine « ${domain} » n'ouvre sur AUCUN titre `
      + "— la page n'y poserait aucune ancre, et son Sommaire renverrait dans le vide.",
    )
  return premier.titre
}

/** Le Sommaire d'une fiche : une ligne par topic, visant l'ancre RÉELLE que la page assemblée pose
 *  sur le titre de ce topic (homonymes suffixés compris) — la grammaire d'ancre vit dans
 *  `lib/ancres.mjs`, l'assembleur ne la redit pas (#1824). */
function lignesDuSommaire(topics, ancresDeLaPage, domain) {
  let curseur = 0
  return topics.map((t) => {
    const titre = titreDuTopic(t, domain)
    const rang = ancresDeLaPage.findIndex((a, i) => i >= curseur && a.titre === titre)
    if (rang < 0)
      throw new Error(`assemble-domain: le titre « ${titre} » du domaine « ${domain} » n'a pas d'ancre dans la page assemblée`)
    curseur = rang + 1
    return `- [${t.title}](#${ancresDeLaPage[rang].ancre})`
  })
}

// Placeholder du champ Implemente : build-implemente le remplira a partir du code (jamais ecrit a la
// main). Toute forme authoree du champ dans le markdown d'un topic est NORMALISEE vers ce placeholder
// nu (frontiere = ligne debutant par `**Implement…**`, meme graphie que FIELD_START_RE du generateur).
const IMPLEMENTE_PLACEHOLDER = '**Implémente :** (non implémenté)'
const IMPLEMENTE_FIELD_LINE_RE = /^\*\*Impl[ée]ment[ée]?\s*[:.]?\*\*.*$/gim
function withPlaceholderField(md) {
  const stripped = md.replace(IMPLEMENTE_FIELD_LINE_RE, '').replace(/\n{3,}/g, '\n\n').trim()
  return `${stripped}\n\n${IMPLEMENTE_PLACEHOLDER}`
}

/** `rawDir` est la MEME couture que celle de `cheminDeFiche` : elle dit DANS QUEL Atlas la fiche
 *  s ecrit. Un banc qui joue l assemblage la pointe sur un arbre jetable — sans elle, il n aurait
 *  d autre filet que le refus qu il mesure, et une regression du refus salirait `docs/raw/`. */
export function assemble(data, { racine = {}, source = '<entrée>', titleArg, rawDir = RAWDIR } = {}) {
  const coeur = coeurDuRendu(data, racine, source)
  const domain = data.domain
  refuserLeSaute(domain, racine, source)
  const title = data.title || titleArg || (domain.charAt(0).toUpperCase() + domain.slice(1))
  const topics = data.topics || []
  refuserLInfidele(topics, domain)
  const body = topics.map((t) => withPlaceholderField(t.markdown.trim())).join('\n\n---\n\n')

  const page = (toc) => `${enTeteDeFiche(title)}

> Référentiel **autosuffisant** des règles du cœur **${coeur}** (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite \`LIVRE NN l.X-Y\`
> (last-recours = la source). Abréviations : [\`sources.md\`](../sources.md). Index : [\`00-index.md\`](00-index.md).
>
> ⚠️ Agent-généré + vérifié (passe adversariale). Le champ **Implémente** est DÉRIVÉ du code
> (\`npm run raw:implemente\`), jamais écrit à la main.

## Sommaire

${toc}

---

${body}
`
  // Le Sommaire se lit dans la PAGE : ses ancres se calculent sur la page elle-même, Sommaire vide
  // (une ligne de liste n'est pas un titre — la table d'ancres est la même des deux côtés).
  const out = page(lignesDuSommaire(topics, ancresDePage(page('')), domain).join('\n'))
  const path = cheminDeFiche(coeur, domain, rawDir)
  mkdirSync(dossierDuCoeur(coeur, rawDir), { recursive: true })
  writeFileSync(path, out, 'utf8')
  return { domain, topics: topics.length, coeur, path }
}

function main() {
  const [, , jsonPath, titleArg] = process.argv
  if (!jsonPath) { console.error('usage: node scripts/raw/assemble-domain.mjs <output.json> [Titre]'); process.exit(1) }
  const parsed = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const racine = parsed.result || parsed
  // Un domaine SAUTÉ n'est pas dans `domains` : sans ce refus, l'assemblage d'un lot qui en porte un
  // écrirait les autres fiches et se tairait sur celle qui manque.
  const sautes = domainesSautes(racine)
  if (sautes.length)
    throw new Error(
      `assemble-domain: le rendu ${jsonPath} déclare ${sautes.length} domaine(s) SAUTÉ(s) :\n`
      + `${sautes.map((s) => `- ${s.domain} : ${s.raison ?? '(raison non dite)'}`).join('\n')}\n`
      + "Rejouer ce(s) domaine(s) avant d'assembler — une fiche absente ne doit pas pouvoir se lire « pas encore faite ».",
    )
  const list = racine.domains && Array.isArray(racine.domains) ? racine.domains : [racine]
  for (const r of list.map((d) => assemble(d, { racine, source: jsonPath, titleArg })))
    console.log(`wrote ${r.path.replace(/\\/g, '/')} — ${r.topics} topics (cœur ${r.coeur})`)
}

if (import.meta.main) main()
