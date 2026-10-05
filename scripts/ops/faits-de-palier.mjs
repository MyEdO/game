// FAITS D'UN PALIER — tout ce qu'un script PUR mesure d'une fenêtre `<base>..<tête>`, pour que le
// JUGE qui écrit la revue n'ait plus rien à mesurer lui-même.
//
// Un juge mesure à la parole d'un modèle ; ce script mesure avec git et le système de fichiers. Les
// faits lui arrivent donc tout faits, produits ICI, et chacun porte sa PROVENANCE — un fait `gh`
// peut manquer (réseau, jeton) sans que le reste de la mesure tombe : l'indisponibilité se DIT,
// elle ne se devine pas.
//
// Aucune mesure n'est réécrite : ce script COMPOSE les hôtes existants (`revuePalier.mjs`,
// `plageStock.mjs`, `fermetures-non-citees.mjs`, `audit-stock.mjs`) — un hôte n'est jamais dupliqué.
//
// Usage : `npm run ops:faits-de-palier -- --base <sha> --tete <sha>`, plus :
//   `--hors-ligne`            saute ce qui appelle GitHub et l'audit de dépendances ;
//   `--revue-precedente <p>`  impose le texte de la revue précédente au lieu de celui de HEAD ;
//   `--cwd <dossier>`         l'arbre MESURÉ (défaut : la racine de ce script) — git et soldes suivis
//                             y sont tous deux lus, jamais mélangés ;
//   `--sortie <chemin>`       où le JSON complet est aussi ÉCRIT (défaut sous `os.tmpdir()`) : le
//                             brief du juge n'embarque alors que les champs dont il a besoin et
//                             donne ce chemin pour le reste ;
//   `--sans-chainage`         BANC uniquement : rejoue une fenêtre DÉJÀ jugée (le chaînage à la revue
//                             précédente n'est pas exigé). Le JSON le DIT (`chainage`), et le texte
//                             de revue porte alors sa marque de banc.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ascendanceDansHead, derniereRevueArchivee, memeSha, shasDeSubstance } from '../guards/lib/revuePalier.mjs'
import { croissancesDeLaPlage } from '../guards/lib/plageStock.mjs'
import { depotDe, fait, imageDeHead, indisponible, journalDe, lireEnLot, tenter } from '../guards/lib/gitPorte.mjs'
import { coursesCi } from '../guards/lib/coursesCi.mjs'
import { soldesSuivis } from './fermetures-non-citees.mjs'
import { numerosFermes } from '../guards/lib/fermetures.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Arguments de la ligne de commande. PUR.
 * @throws {Error} nommé si `--base` ou `--tete` manque : la fenêtre ne se devine pas.
 * @returns {{ base: string, tete: string, revuePrecedente: string|null, cwd: string,
 *   horsLigne: boolean, sortie: string|null, sansChainage: boolean }}
 */
export function analyserArguments(argv) {
  const args = [...(argv ?? [])]
  const valeur = (drapeau) => {
    const i = args.indexOf(drapeau)
    return i === -1 ? null : (args[i + 1] ?? null)
  }
  const base = valeur('--base')
  const tete = valeur('--tete')
  const manques = [base ? null : '--base <sha>', tete ? null : '--tete <sha>'].filter(Boolean)
  if (manques.length) {
    throw new Error(`faits-de-palier : argument(s) manquant(s) — ${manques.join(', ')}`)
  }
  return {
    base,
    tete,
    revuePrecedente: valeur('--revue-precedente'),
    cwd: valeur('--cwd') ?? RACINE,
    horsLigne: args.includes('--hors-ligne'),
    sortie: valeur('--sortie'),
    sansChainage: args.includes('--sans-chainage'),
  }
}

/** Où le JSON complet s'écrit quand `--sortie` n'est pas donné. PUR. Hors de l'arbre mesuré : un
 *  fait n'a rien à faire dans le dossier qu'il juge. */
export const sortieParDefaut = (base, tete) =>
  join(tmpdir(), 'wfrp-faits-de-palier', `faits-${String(base).slice(0, 9)}-${String(tete).slice(0, 9)}.json`)

/** Un commit du journal (`journalDe`) en `{ sha, sujet, corps }` : le sujet est la première ligne du
 *  message, le corps le message entier. PUR. */
export const commitDuJournal = ({ sha, message }) => ({ sha, sujet: message.split('\n')[0].trim(), corps: message })

/** Marque les commits de SUBSTANCE au sens du palier (`shasDeSubstance`, revuePalier.mjs). PUR. */
export function marquerSubstance(commits, shas) {
  const substantiels = new Set([...(shas ?? [])].map((s) => String(s).trim()).filter(Boolean))
  return (commits ?? []).map((c) => ({ ...c, substance: substantiels.has(c.sha) }))
}

/**
 * Fermetures citées par les messages de la fenêtre, croisées avec les soldes SUIVIS par git. PUR.
 * @returns {{ numero: string, sha: string, sujet: string, solde: boolean }[]}
 */
export function fermeturesDesCommits(commits, soldes) {
  const suivis = new Set([...(soldes ?? [])].map(String))
  const out = []
  for (const c of commits ?? []) {
    const message = `${c.sujet}\n${c.corps ?? ''}`
    for (const numero of numerosFermes(message)) {
      out.push({ numero, sha: c.sha, sujet: c.sujet, solde: suivis.has(numero) })
    }
  }
  return out
}

/**
 * Courses CI par commit, depuis la liste servie par `coursesCi` (un tableau). PUR.
 * Un sha sans course est rendu avec `conclusion: null` : « pas de course » est un fait, et pas un
 * défaut — un push de plusieurs commits est jugé par sa TÊTE (régime du 2026-09-11, CLAUDE.md
 * § Commandes) : la CI ne joue que le sha poussé.
 * @returns {{ sha: string, courses: { workflow: string, conclusion: string|null, statut: string|null }[] }[]}
 */
export function coursesParCommit(servies, shas) {
  return [...(shas ?? [])].map((sha) => ({
    sha,
    courses: servies
      .filter((c) => String(c.headSha ?? '') === sha)
      .map((c) => ({
        workflow: c.workflowName ?? null,
        conclusion: c.conclusion || null,
        statut: c.status || null,
      })),
  }))
}

/**
 * Les courses de la fenêtre, depuis l'union rendue par `coursesCi`. PUR. La liste servie est
 * PÉRIMÉE quand elle ne porte aucune course de la tête et que sa course la plus récente précède la
 * date de commit de la tête (#2178, revue de palier : 2 lectures sur 13 servaient un instantané figé
 * au 2026-09-27T19:48:17Z) : la fenêtre est alors INDISPONIBLE, jamais `courses: []`.
 * @param {{disponible:boolean, valeur?:any, raison?:string}} vu
 * @param {{ shas: string[], tete: string, dateTete: string }} fenetre
 * @returns {{disponible:true, valeur:ReturnType<typeof coursesParCommit>}|{disponible:false, raison:string}}
 */
export function coursesDeLaFenetre(vu, { shas, tete, dateTete }) {
  if (!vu?.disponible) return indisponible(vu?.raison ?? 'courses CI non lues')
  if (!Array.isArray(vu.valeur)) return indisponible('courses CI : la lecture n’a pas rendu un tableau')
  const instants = vu.valeur.map((c) => Date.parse(c?.createdAt ?? '')).filter(Number.isFinite)
  const plusRecente = instants.length ? Math.max(...instants) : null
  const fraiche = vu.valeur.some((c) => String(c?.headSha ?? '') === tete) || (plusRecente !== null && plusRecente >= Date.parse(dateTete))
  if (!fraiche)
    return indisponible(`liste de courses PÉRIMÉE : aucune course de la tête ${tete}, et la plus récente (${plusRecente === null ? 'aucune' : new Date(plusRecente).toISOString()}) précède sa date de commit (${dateTete})`)
  return fait(coursesParCommit(vu.valeur, shas))
}

// ── Lecture réelle ────────────────────────────────────────────────────────────────────────────

/** La réponse d'une question au dépôt, ou une levée qui nomme `quoi` : ce que git n'a pas rendu. */
const exiger = (valeur, quoi, cwd) => {
  if (valeur === null || valeur === undefined) throw new Error(`faits-de-palier : ${quoi} illisible dans ${cwd}`)
  return valeur
}

function main() {
  let options
  try {
    options = analyserArguments(process.argv.slice(2))
  } catch (e) {
    process.stderr.write(`${e.message}\n`)
    process.exit(1)
  }
  const { base, tete, revuePrecedente, cwd, horsLigne, sortie, sansChainage } = options

  const derniere = derniereRevueArchivee(cwd)
  if (derniere.etat !== 'trouvee') {
    process.stderr.write(`faits-de-palier : aucune revue archivée ne juge l'histoire de HEAD (${derniere.etat}) — la base d'une fenêtre est la TÊTE de la dernière revue.\n`)
    process.exit(1)
  }
  const chaine = memeSha(base, derniere.tete)
  if (!chaine && !sansChainage) {
    process.stderr.write(`faits-de-palier : \`--base ${base}\` n'est pas la tête de fenêtre de la dernière revue archivée (${derniere.chemin} → ${derniere.tete}) — une fenêtre s'enchaîne à la précédente.\n`)
    process.exit(1)
  }
  // Le BANC rejoue une fenêtre déjà jugée pour comparer deux méthodes : seul le chaînage cède, et le
  // JSON le dit à qui le lit — un texte produit sur ces faits porte sa marque de banc et ne s'archive pas.
  const chainage = chaine
    ? 'vérifié'
    : `ignoré (--sans-chainage, banc) — base attendue par l'histoire : ${derniere.tete}, base jouée : ${base}`
  const ascendance = ascendanceDansHead(tete, cwd)
  if (!ascendance.disponible) {
    process.stderr.write(`faits-de-palier : ascendance indisponible — ${ascendance.raison} : \`--tete ${tete}\` n'a pas pu être située dans l'histoire de HEAD.\n`)
    process.exit(1)
  }
  if (ascendance.absent || ascendance.valeur !== true) {
    process.stderr.write(`faits-de-palier : \`--tete ${tete}\` n'est pas dans l'histoire de HEAD — la fenêtre jugerait une histoire que ce dépôt ne porte pas.\n`)
    process.exit(1)
  }

  const depot = depotDe(cwd)
  const substance = tenter(() => shasDeSubstance(depot, [`${base}..${tete}`]))
  if (!substance.disponible) {
    process.stderr.write(`faits-de-palier : ce que font les commits de \`${base}..${tete}\` est illisible — ${substance.raison}.\n`)
    process.exit(1)
  }
  const commits = marquerSubstance(
    exiger(journalDe(depot, [`${base}..${tete}`]), `la plage ${base}..${tete}`, cwd).map(commitDuJournal),
    substance.valeur,
  )
  const shas = commits.map((c) => c.sha)
  const fermetures = fermeturesDesCommits(commits, soldesSuivis(cwd))
  const stocks = tenter(() => croissancesDeLaPlage({ cwd, debut: base, fin: tete }))

  const depuis = exiger(journalDe(depot, [`${base}^!`])?.[0]?.date.slice(0, 10), `la date de ${base}`, cwd)
  const fermeturesHorsCommit = horsLigne
    ? { disponible: false, raison: '`--hors-ligne` : GitHub non consulté' }
    : tenter(() => execFileSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'fermetures-non-citees.mjs'), '--depuis', depuis], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000,
    }))
  const auditStock = horsLigne
    ? { disponible: false, raison: '`--hors-ligne` : audit de dépendances non joué' }
    : tenter(() => execFileSync(process.execPath, [join(RACINE, 'scripts', 'ops', 'audit-stock.mjs')], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000,
    }))
  // `limit: 300` : la lecture des courses n'a pas de fenêtre de dates, la limite EST la fenêtre. Une
  // plage dont le plus ancien commit sort des 300 dernières courses rend `courses: []` pour ce
  // commit — indiscernable d'un commit jamais couru, et c'est ce que le lecteur doit savoir.
  // `workflow: null` : TOUS les workflows, pas seulement `ci.yml`. `branche: null` : toutes les refs —
  // un commit de `main` court sous `gh-readonly-queue/main/*` (`merge_group`, #2178).
  const commitTete = exiger(journalDe(depot, [`${tete}^!`])?.[0], `le commit ${tete}`, cwd)
  const coursesDeLaPlage = horsLigne
    ? { disponible: false, raison: '`--hors-ligne` : courses CI non consultées' }
    : coursesDeLaFenetre(coursesCi({ cwd, limit: 300, workflow: null, branche: null }), { shas, tete: commitTete.sha, dateTete: commitTete.date })

  const texteDeRevue = tenter(() => (revuePrecedente
    ? readFileSync(revuePrecedente, 'utf8')
    : exiger(lireEnLot(depot, imageDeHead(depot), [derniere.chemin]).get(derniere.chemin), `HEAD:${derniere.chemin}`, cwd)))

  const faitsChemin = sortie ?? sortieParDefaut(base, tete)
  const faits = {
    base,
    tete,
    depuis,
    chainage,
    faitsChemin,
    commits,
    fermetures,
    stocks,
    fermeturesHorsCommit,
    auditStock,
    coursesCi: coursesDeLaPlage,
    revuePrecedente: { chemin: revuePrecedente ?? derniere.chemin, ...texteDeRevue },
    provenance: {
      commits: 'script',
      fermetures: 'script',
      stocks: 'script',
      chainage: 'script',
      fermeturesHorsCommit: 'gh',
      auditStock: 'npm audit',
      coursesCi: 'gh',
      revuePrecedente: 'git',
    },
  }
  const rendu = `${JSON.stringify(faits, null, 1)}\n`
  // Le JSON s'écrit AUSSI dans un fichier : un consommateur qui n'a besoin que de trois champs les
  // prend et donne ce chemin pour le reste, au lieu de recopier 72 Ko dans chaque prompt.
  mkdirSync(dirname(faitsChemin), { recursive: true })
  writeFileSync(faitsChemin, rendu)
  process.stderr.write(`[faits] ${faitsChemin}\n`)
  process.stdout.write(rendu)
}

if (import.meta.main) main()
