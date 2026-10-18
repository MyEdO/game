// #2683 : Claude Code charge une règle `.claude/rules/<x>.md` à `paths:` sur un Read, un Write ou un Edit NATIF
// du fichier qui correspond, jamais sur un outil lean-ctx (c.6232344531, c.6233822389). La garde la PROJETTE :
// lecture lean-ctx à chemin en PostToolUse (`garde`), `ctx_patch` en PreToolUse (`gardeEdition`). Le corps de
// chaque règle correspondante est injecté une fois par contexte (`session_id`, `agent_id`) ; une règle sans
// `paths` est déjà chargée au démarrage. Un `path` relatif de lecture se résout contre la racine de lean-ctx
// (`racineDeLeanCtx`), qui projette les règles de son arbre. L'état d'une session s'efface à sa compaction par
// le point d'entrée SessionStart `scripts/hooks/regles-projection-oubli.mjs`.
import '../node-requis.mjs'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import picomatch from 'picomatch'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'
import { racineSurDisque } from '../guards/lib/gitPorte.mjs'
import { versCheminNatif } from '../guards/lib/commandeShell.mjs'
import {
  EDITION, FAMILLES_LEAN_CTX, PREFIXES_LEAN_CTX, PROJECTION, cheminDEcriture, ecrituresDe, entreeDOutil, familleLeanCtx,
  racineDeLeanCtx,
} from '../guards/lib/contratGarde.mjs'

/** Les lectures lean-ctx qui chargent le contenu de fichiers nommés par `path` ou `paths`. */
const LECTURES_A_CHEMIN = ['ctx_read', 'ctx_smart_read', 'ctx_multi_read'].filter((nu) => Object.hasOwn(FAMILLES_LEAN_CTX, nu))
const nomme = (nu) => PREFIXES_LEAN_CTX.claude + nu
const OUTILS_LECTURE = LECTURES_A_CHEMIN.map(nomme)
const OUTILS_EDITION = Object.keys(FAMILLES_LEAN_CTX).filter((nu) => familleLeanCtx(nu) === EDITION).map(nomme)

const DOSSIER_REGLES = join('.claude', 'rules')

/** Les cibles d'une lecture à chemin : chaque `path` en `tool_input` à UN fichier, avec sa base de résolution,
 *  `dir` pour un absolu, la racine de lean-ctx pour un relatif (`null` si elle n'est pas résolue). */
function lecturesDe(entree, { dir, platform }) {
  const input = entreeDOutil(entree)
  if (input === null || dir === null) return []
  const paths = Array.isArray(input.paths) ? input.paths : []
  let leanCtx
  const racineLeanCtx = () => {
    leanCtx ??= racineDeLeanCtx(dir)
    return leanCtx.disponible ? leanCtx.valeur : null
  }
  return [input.path, ...paths].filter((p) => typeof p === 'string' && p.trim() !== '')
    .map((path) => ({ ecrit: { path }, base: isAbsolute(versCheminNatif(path, platform)) ? dir : racineLeanCtx() }))
}

/** La valeur YAML scalaire `brut`, guillemets retirés. */
const scalaire = (brut) => brut.trim().replace(/^(["'])(.*)\1$/, '$2')

/**
 * Le frontmatter d'une règle : `paths` (liste YAML, liste en flux `[a, b]` ou chaîne, `null` sans clé) et le
 * corps, frontmatter retiré.
 */
export function lireRegle(texte) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texte)
  if (!m) return { paths: null, corps: texte.trim() }
  const lignes = m[1].split(/\r?\n/)
  const i = lignes.findIndex((l) => /^paths\s*:/.test(l))
  let paths = null
  if (i !== -1) {
    const valeur = lignes[i].replace(/^paths\s*:/, '').trim()
    if (valeur.startsWith('[')) paths = valeur.replace(/^\[|\]$/g, '').split(',').map(scalaire).filter(Boolean)
    else if (valeur !== '') paths = [scalaire(valeur)]
    else {
      paths = []
      for (const l of lignes.slice(i + 1)) {
        const item = /^\s+-\s+(.*)$/.exec(l)
        if (!item) break
        paths.push(scalaire(item[1]))
      }
    }
  }
  return { paths: paths?.length ? paths : null, corps: texte.slice(m[0].length).trim() }
}

/** Les règles à `paths` de l'arbre `racine`, récursivement : `{ nom, fichier, correspond, corps }`. */
function reglesDe(racine) {
  let fichiers
  try {
    fichiers = readdirSync(join(racine, DOSSIER_REGLES), { recursive: true }).filter((f) => f.endsWith('.md'))
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  return fichiers.sort().flatMap((f) => {
    const fichier = join(racine, DOSSIER_REGLES, f)
    const { paths, corps } = lireRegle(readFileSync(fichier, 'utf8'))
    if (paths === null) return []
    return [{ nom: `${DOSSIER_REGLES}/${f}`.replaceAll('\\', '/'), fichier, correspond: picomatch(paths), corps }]
  })
}

const empreinte = (valeur) => createHash('sha1').update(JSON.stringify(valeur ?? null)).digest('hex').slice(0, 12)

/** Le dossier d'état de la session `session`, hors de l'arbre : un fichier par `agent_id`. */
export const dossierDeSession = (session) => join(tmpdir(), 'regles-projection', empreinte(session))

/** Le fichier d'état d'un contexte (`session_id`, `agent_id`) : les règles déjà injectées, une par ligne. */
const etatDe = (entree) => join(dossierDeSession(entree?.session_id), `${empreinte(entree?.agent_id)}.txt`)

function dejaInjectees(fichier) {
  try {
    return new Set(readFileSync(fichier, 'utf8').split('\n').filter(Boolean))
  } catch (e) {
    if (e.code === 'ENOENT') return new Set()
    throw e
  }
}

/** Les verdicts pour les `cibles` (`{ ecrit, base }`, un `tool_input` à un fichier chacun) : un fichier compte
 *  sous l'arbre de sa `base`, et y prend ses règles ; hors de cet arbre, il ne compte pas. */
function projeter(entree, cibles) {
  const relatifs = new Map()
  for (const { ecrit, base } of cibles) {
    const racine = base === null ? null : racineSurDisque(canoniser(base))
    const chemin = racine === null ? null : cheminDEcriture(ecrit, { base })
    if (chemin === null || chemin.racine !== racine) continue
    relatifs.set(racine, [...(relatifs.get(racine) ?? []), chemin.relatif])
  }
  if (relatifs.size === 0) return null
  const etat = etatDe(entree)
  const vues = dejaInjectees(etat)
  const neuves = [...relatifs].flatMap(([racine, rels]) =>
    reglesDe(racine).filter((r) => !vues.has(r.fichier) && rels.some((rel) => r.correspond(rel))))
  if (neuves.length === 0) return null
  return [
    { contexte: neuves.map((r) => `Règle ${r.nom} (projetée sur lean-ctx) :\n${r.corps}`).join('\n\n') },
    { trace: { fichier: etat, ligne: neuves.map((r) => `${r.fichier}\n`).join('') } },
  ]
}

export const garde = { nom: 'regles-projection', role: PROJECTION, outils: OUTILS_LECTURE, evaluer: (entree, contexte) => projeter(entree, lecturesDe(entree, contexte)) }

export const gardeEdition = {
  nom: 'regles-projection-edition',
  role: PROJECTION,
  outils: OUTILS_EDITION,
  evaluer: (entree, { dir }) => (dir === null ? null : projeter(entree, ecrituresDe(entree).map((ecrit) => ({ ecrit, base: dir })))),
}
