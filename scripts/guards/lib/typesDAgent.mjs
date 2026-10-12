// Les TYPES d'agent déclarés sous `.claude/agents/` : le FRONTMATTER de leur fiche fait foi, jamais la
// `description` (#2537). Lus par la porte de forme des workflows, la garde du type d'un `agent()` de
// workflow, la garde de lecture seule et le banc de l'Atlas.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFrontmatter } from '../../agents/compat-core.mjs'
import { OUTILS_ECRITURE } from './contratGarde.mjs'
import { listerDossier } from './lister.mjs'

/** Les outils qui DÉLÈGUENT à un autre agent, dont les outils ne sont pas ceux de la fiche. */
export const OUTILS_DE_DELEGATION = Object.freeze(['Agent', 'Workflow', 'Task'])

const liste = (valeur) => (valeur === undefined ? null : valeur.split(',').map((o) => o.trim()).filter(Boolean))

/** Une entrée de `disallowedTools` couvre-t-elle `outil` ? Un suffixe `*` couvre son préfixe. */
const couvre = (motif, outil) => (motif.endsWith('*') ? outil.startsWith(motif.slice(0, -1)) : motif === outil)

/**
 * La fiche d'un type, lue à son frontmatter (`readFrontmatter`). PURE.
 * `tools` vaut `null` quand le champ est absent : le type hérite alors de TOUS les outils.
 * @param {string} texte @param {string} [fichier]
 * @returns {{ name: string, tools: string[] | null, disallowedTools: string[] }}
 */
export function ficheDAgent(texte, fichier) {
  const { attributes } = readFrontmatter(texte, fichier)
  return { name: attributes.get('name') ?? '', tools: liste(attributes.get('tools')), disallowedTools: liste(attributes.get('disallowedTools')) ?? [] }
}

/** Les fiches de `<racine>/.claude/agents/*.md`, par `name:`. @param {string} racine @returns {Map<string, ReturnType<typeof ficheDAgent>>} */
export function fichesDAgent(racine) {
  const dossier = join(racine, '.claude', 'agents')
  const fiches = listerDossier(dossier, { absent: 'vide' }).filter((f) => f.endsWith('.md')).map((f) => ficheDAgent(readFileSync(join(dossier, f), 'utf8'), f))
  return new Map(fiches.filter((f) => f.name).map((f) => [f.name, f]))
}

/** Les noms des types déclarés sous `<racine>/.claude/agents/`. @returns {Set<string>} */
export const typesDeclares = (racine) => new Set(fichesDAgent(racine).keys())

/** Une liste d'outils ne contient ni canal d'écriture (`OUTILS_ECRITURE`) ni outil de délégation. PURE. */
export const outilsEnLectureSeule = (outils) => !outils.some((o) => OUTILS_ECRITURE.includes(o) || OUTILS_DE_DELEGATION.includes(o))

/** Un type est en LECTURE SEULE : `tools` présent, et ses outils privés de `disallowedTools` sont en lecture seule. PURE. */
export const enLectureSeule = (fiche) =>
  fiche.tools !== null && outilsEnLectureSeule(fiche.tools.filter((o) => !fiche.disallowedTools.some((motif) => couvre(motif, o))))

/** Les noms des types en lecture seule déclarés sous `<racine>/.claude/agents/`. @returns {string[]} */
export const typesEnLectureSeule = (racine) => [...fichesDAgent(racine).values()].filter(enLectureSeule).map((f) => f.name)
