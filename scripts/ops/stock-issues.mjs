// COMPTEUR DU TRAVAIL RESTANT du backlog (#2561), joué à la main par `npm run ops:stock-issues`.
// Credo, puce « Le poison se corrige DANS LE GESTE » : un ticket émis par une vague naît SOUS-ISSUE
// native de son épique (`parent_issue_url`, `scripts/guards/lib/epique.mjs`). Le stock sans parent
// d'avant ne se rattache pas : seule l'ÉMISSION se mesure.
//
// Mesures, sur un instantané des issues ouvertes et fermées (pull requests écartées, `estPullRequest`) :
//   - travail restant = issues ouvertes                                                    -> mesure ;
//   - croissance nette sur la fenêtre glissante (créées − fermées) > 0                     -> ROUGE ;
//   - émises sans épique : créées dans la fenêtre, sans parent, hors épiques, bots compris
//     (`claude[bot]` émet les tickets des sessions cloud), dont celles des bots           -> mesure ;
//   - balance par vague : enfants d'une épique fermés < enfants créés dans la fenêtre     -> ROUGE ;
//     un enfant est toute issue dont la CHAÎNE de parents remonte à l'épique.
//
// Les comparateurs sont PURS ; la lecture REST vit dans `main` : la LISTE paginée seule (`pagesRest`,
// jamais `--paginate`), qui porte `parent_issue_url` — aucun appel par issue.
// Aucune écriture GitHub, aucune gate CI.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEPOT, appelGhRunner, estPullRequest, pagesRest } from '../guards/lib/ticketsGh.mjs'
import { estEpique, parentDe } from '../guards/lib/epique.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Fenêtre glissante par défaut, en jours. */
export const FENETRE_JOURS = 7

const JOUR_MS = 24 * 60 * 60 * 1000

/**
 * Les tickets d'une liste REST `repos/<o>/<r>/issues?state=all`, sous la forme que lisent les
 * comparateurs. Les pull requests sont écartées. PUR.
 * @param {object[]} entrees
 * @returns {{numero:number, ouvert:boolean, creee:number, fermee:number|null, epique:boolean, parent:number|null, bot:boolean}[]}
 */
export function ticketsDeLaListe(entrees) {
  return entrees
    .filter((e) => !estPullRequest(e))
    .map((e) => ({
      numero: Number(e.number),
      ouvert: e.state === 'open',
      creee: Date.parse(e.created_at),
      fermee: e.closed_at ? Date.parse(e.closed_at) : null,
      epique: estEpique(e),
      parent: parentDe(e),
      bot: e.user?.type === 'Bot',
    }))
}

/** Créées et fermées dans la fenêtre `[maintenant − jours, maintenant]`, et leur solde. PUR. */
export function croissanceNette(tickets, maintenant, jours = FENETRE_JOURS) {
  const borne = maintenant - jours * JOUR_MS
  const creees = tickets.filter((t) => t.creee >= borne).length
  const fermees = tickets.filter((t) => t.fermee !== null && t.fermee >= borne).length
  return { creees, fermees, net: creees - fermees }
}

/** Issues créées dans la fenêtre sans parent, hors épiques, bots compris : leur compte et celui des
 *  bots. PUR. */
export function emisesSansEpique(tickets, maintenant, jours = FENETRE_JOURS) {
  const borne = maintenant - jours * JOUR_MS
  const emises = tickets.filter((t) => t.creee >= borne && !t.epique && t.parent === null)
  return { total: emises.length, bots: emises.filter((t) => t.bot).length }
}

/** Épiques de la chaîne de parents d'un ticket, de la plus proche à la plus lointaine. Un cycle
 *  s'arrête au premier numéro revu. PUR. @param {Map<number, {parent:number|null, epique:boolean}>} parNumero */
function epiquesAncetres(ticket, parNumero) {
  const vus = new Set([ticket.numero])
  const epiques = []
  for (let n = ticket.parent; n !== null && !vus.has(n); n = parNumero.get(n)?.parent ?? null) {
    vus.add(n)
    if (parNumero.get(n)?.epique) epiques.push(n)
  }
  return epiques
}

/** Par épique, enfants (chaîne de parents comprise) créés et fermés dans la fenêtre ; `rouge` si
 *  fermés < créés. PUR. */
export function balanceParVague(tickets, maintenant, jours = FENETRE_JOURS) {
  const borne = maintenant - jours * JOUR_MS
  const parNumero = new Map(tickets.map((t) => [t.numero, t]))
  const parEpique = new Map()
  for (const t of tickets) {
    for (const e of epiquesAncetres(t, parNumero)) {
      const b = parEpique.get(e) ?? { epique: e, creees: 0, fermees: 0 }
      if (t.creee >= borne) b.creees += 1
      if (t.fermee !== null && t.fermee >= borne) b.fermees += 1
      parEpique.set(e, b)
    }
  }
  return [...parEpique.values()]
    .filter((b) => b.creees || b.fermees)
    .map((b) => ({ ...b, rouge: b.fermees < b.creees }))
    .sort((a, b) => a.epique - b.epique)
}

/**
 * Verdict de l'instantané : lignes de mesure, ROUGES. PUR.
 * @param {ReturnType<typeof ticketsDeLaListe>} tickets @param {number} maintenant @param {number} [jours]
 * @returns {{ mesures: string[], rouges: string[] }}
 */
export function jugerStock(tickets, maintenant, jours = FENETRE_JOURS) {
  const ouvertes = tickets.filter((t) => t.ouvert).length
  const croissance = croissanceNette(tickets, maintenant, jours)
  const sansEpique = emisesSansEpique(tickets, maintenant, jours)
  const balance = balanceParVague(tickets, maintenant, jours)
  const mesures = [
    `travail restant : ${ouvertes} issue(s) ouverte(s)`,
    `croissance nette ${jours} j : ${croissance.creees} créée(s) − ${croissance.fermees} fermée(s) = ${croissance.net}`,
    `émises sans épique ${jours} j : ${sansEpique.total} (dont ${sansEpique.bots} de bots)`,
    ...balance.filter((b) => !b.rouge).map((b) => `vague de l'épique #${b.epique} : ${b.fermees} fermé(s) ≥ ${b.creees} créé(s)`),
  ]
  const rouges = [
    ...(croissance.net > 0 ? [`croissance nette ${jours} j positive (+${croissance.net}) : le backlog grossit`] : []),
    ...balance.filter((b) => b.rouge).map((b) =>
      `vague de l'épique #${b.epique} : ${b.fermees} enfant(s) fermé(s) < ${b.creees} créé(s) en ${jours} j`),
  ]
  return { mesures, rouges }
}

function main() {
  const jours = Number(process.argv.includes('--jours') ? process.argv[process.argv.indexOf('--jours') + 1] : FENETRE_JOURS)
  if (!Number.isInteger(jours) || jours < 1) {
    process.stderr.write('[stock-issues] --jours attend un entier ≥ 1\n')
    process.exit(2)
  }
  const vue = pagesRest(`repos/${DEPOT}/issues?state=all`, appelGhRunner({ cwd: RACINE }))
  if (!vue.ok) {
    process.stderr.write(`[stock-issues] lecture des issues impossible — ${vue.raison}\n`)
    process.exit(1)
  }
  const tickets = ticketsDeLaListe(vue.entrees)
  const { mesures, rouges } = jugerStock(tickets, Date.now(), jours)
  process.stdout.write(`[stock-issues] ${tickets.length} ticket(s) lus sur ${DEPOT}, fenêtre ${jours} j\n`)
  for (const m of mesures) process.stdout.write(`  ${m}\n`)
  for (const r of rouges) process.stderr.write(`  ROUGE ${r}\n`)
  if (rouges.length) {
    process.stderr.write(`[stock-issues] ${rouges.length} rouge(s)\n`)
    process.exit(1)
  }
  process.stdout.write('[stock-issues] aucun rouge\n')
}

if (import.meta.main) main()
