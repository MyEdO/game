// Hook pre-push : la porte AU PUSH (#1776). Elle LIT, elle ne joue aucune gate — la CI de
// `.github/workflows/ci.yml` est la porte, et elle joue sur toute branche `chantier/**`.
//
// QUATRE refus, tous nommés. Les trois premiers portent sur CHAQUE ref poussée :
//   1. `origin` ne pointe pas `github.com/<DEPOT>` (`scripts/guards/lib/ticketsGh.mjs`) ;
//   2. un STOCK NOMINATIF qui grandit quelque part dans la PLAGE poussée, sans que le message de SON
//      commit le dise (`scripts/guards/lib/plageStock.mjs`) : les portes de stock du commit et du
//      DERNIER commit ne voient qu'une tête, et un commit intermédiaire leur échappe (revue de
//      palier n°2, 2026-09-03 — `429b9a1a2` a traversé les deux, six heures après leur pose) — et,
//      par la même lecture, un RECLASSEMENT CSS non déclaré, chaque commit contre sa base
//      (`reclassementsDeLaPlage`, même fichier) ;
//   3. un push NON fast-forward vers une ref distante EXISTANTE. Une ref neuve ne peut écraser aucune
//      histoire, elle n'est pas jugée. `refs/heads/chantier/**` en est EXEMPTÉE : une branche de
//      chantier n'a qu'un écrivain (régime « une session par chantier », 2026-09-01), qui en réécrit
//      l'histoire à son gré ; le train la pousse sous un `--force-with-lease` dont le bail n'écrase
//      que ce qu'il vient de lire (`scripts/ops/publier.mjs`, étape `push-branche`).
//
// Le quatrième ne porte que sur la ref distante `main` :
//   4. tout push vers `main` est REFUSÉ : `main` n'avance que par la FILE DE FUSION du serveur
//      (`scripts/ops/ruleset-main.mjs`, règles `merge_queue` et `pull_request`), où entre la PR armée
//      par `npm run ops:publier`. Miroir lisible du ruleset, qui est LA porte : il dit ici, en une
//      phrase et avec la commande à jouer, ce que GitHub refuserait à la seconde d'après. AUCUNE
//      exonération, pas même sous `GITHUB_ACTIONS` : le ruleset n'en porte aucune (HTTP 422 du
//      2026-09-16).
//
// STDIN (githooks(5)) : une ligne `<ref locale> <sha local> <ref distante> <sha distant>` par ref.
// `git push --dry-run` joue AUSSI ce hook (mesuré : 2 invocations par push réel, 1 par dry-run) :
// une lecture ne se distingue pas d'un push, la porte juge les deux pareil.
// Porte de version de Node en PREMIER import (`scripts/node-requis.mjs`).
import '../node-requis.mjs'
import { readFileSync } from 'node:fs'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import { TRONC, depotDe, estAncetre, origineDe, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { croissancesDeLaPlage, raisonDeRefusDePlage } from '../guards/lib/plageStock.mjs'
import { raisonDeRefusDeReclassement } from '../guards/lib/reclassementCss.mjs'
import { journaliserLeHook } from './journal.mjs'

const ZERO = '0'.repeat(40)

/** La ref distante que le ruleset protège — aucun push n'y entre, la file de fusion seule l'avance. */
export const REF_PROTEGEE = TRONC.branche

/** Refus NOMMÉ d'un push vers `REF_PROTEGEE`. */
export const REFUS_PUSH_VERS_MAIN =
  `push vers ${REF_PROTEGEE} REFUSÉ : main n’avance que par la file de fusion — publier par \`npm run ops:publier\``

/** Les refs dont l'histoire se réécrit par construction : un seul écrivain par chantier. */
export const PREFIXE_CHANTIER = 'refs/heads/chantier/'

/** Le fast-forward se juge-t-il sur cette ref distante ? */
export const fastForwardJuge = (refDistante) => !String(refDistante ?? '').startsWith(PREFIXE_CHANTIER)

/** Refs à juger : les suppressions de branche (sha local nul) n'en sont pas. */
export function refsAPousser(stdin) {
  return String(stdin ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [refLocale, shaLocal, refDistante, shaDistant] = l.trim().split(/\s+/)
      return { refLocale, shaLocal, refDistante, shaDistant }
    })
    .filter((r) => r.shaLocal && r.shaLocal !== ZERO)
}

/** Verdict COMPLET du hook : `{ refus: [], notes: [] }`. Aucune sortie, aucun code — testable. */
export function jugerPush({ cwd, stdin }) {
  // Les lectures git passent par les questions de l'hôte unique : `null` dit « l'objet n'existe pas »,
  // et une INDISPONIBILITÉ (git absent, hors dépôt) devient un refus NOMMÉ au lieu d'un `fatal:` brut.
  const pannes = []
  const depot = depotDe(cwd, { enPanne: (raison) => pannes.push(raison) })
  const refus = []
  const notes = []

  const origine = origineDe(depot) ?? ''
  if (pannes.length) refus.push(`origin illisible, git indisponible : ${pannes[0]}`)
  else if (!urlOrigineAcceptee(origine))
    refus.push(`origin = « ${origine || '(absent)'} » : ce hook ne connaît que github.com/${DEPOT}`)

  for (const { refLocale, shaLocal, refDistante, shaDistant } of refsAPousser(stdin)) {
    // Stocks nominatifs de la PLAGE poussée : par commit, filtrés par la croissance cumulée.
    const stocks = croissancesDeLaPlage({ cwd, debut: shaDistant, fin: shaLocal, vers: refDistante })
    for (const n of stocks.notes) notes.push(n)
    if (stocks.indisponible)
      refus.push(`${refLocale} → ${refDistante} : plage \`${stocks.plage}\` illisible : ${stocks.indisponible}`)
    if (stocks.refus.length) refus.push(raisonDeRefusDePlage(stocks.refus))
    if (stocks.reclassements.length) refus.push(raisonDeRefusDeReclassement(stocks.reclassements))

    if (!fastForwardJuge(refDistante)) {
      notes.push(`${refDistante} : branche de chantier — fast-forward non jugé, un seul écrivain`)
    } else if (!shaDistant || shaDistant === ZERO) {
      notes.push(`${refDistante} n’existe pas encore côté distant : rien à écraser, fast-forward non jugé`)
    } else {
      const ancetre = estAncetre(depot, shaDistant, shaLocal)
      if (!ancetre.disponible)
        refus.push(`${refLocale} → ${refDistante} : ascendance illisible — ${ancetre.raison}`)
      else if (ancetre.absent)
        refus.push(
          `push vers ${refDistante} non jugé : ${shaDistant.slice(0, 7)} est inconnu de ce dépôt — `
            + 'le fast-forward ne se prouve pas (git fetch origin)',
        )
      else if (ancetre.valeur !== true)
        refus.push(
          `push non fast-forward vers ${refDistante} : ${shaDistant.slice(0, 7)} n’est pas un ancêtre de ${shaLocal.slice(0, 7)}`,
        )
    }

    if (refDistante === REF_PROTEGEE) refus.push(REFUS_PUSH_VERS_MAIN)
    else notes.push(`${refDistante} : push libre — c’est la CI de cette branche qui juge le contenu`)
  }

  return { refus, notes }
}

if (import.meta.main) {
  const journal = journaliserLeHook('pre-push')
  const cwd = process.cwd()
  const stdin = (() => {
    try {
      return readFileSync(0, 'utf8')
    } catch {
      return ''
    }
  })()
  const { refus, notes } = jugerPush({ cwd, stdin })
  for (const n of notes) process.stderr.write(`[pre-push] ${n}\n`)
  if (refus.length) {
    journal.refuser(...refus)
    process.stderr.write(`[pre-push] ${enteteArbre(cwd)}\n`)
    process.stderr.write(`pre-push REFUSÉ :\n${refus.map((r) => (r.startsWith('  ') ? r : `  ${r}`)).join('\n')}\n`)
    process.exit(1)
  }
  process.stderr.write(`[pre-push] ${refsAPousser(stdin).length} ref(s) jugée(s) — porte franchie\n`)
}
