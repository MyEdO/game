// Hook pre-push : la porte AU PUSH (#1776). Elle LIT, elle ne joue aucune gate — la CI de
// `.github/workflows/ci.yml` est la porte, et elle joue sur toute branche `chantier/**`.
//
// QUATRE refus, tous nommés. Les trois premiers portent sur CHAQUE ref poussée :
//   1. `origin` ne pointe pas `github.com/cgauche/game` ;
//   2. un STOCK NOMINATIF qui grandit quelque part dans la PLAGE poussée, sans que le message de SON
//      commit le dise (`scripts/guards/lib/plageStock.mjs`) : les portes de stock du commit et du
//      DERNIER commit ne voient qu'une tête, et un commit intermédiaire leur échappe (revue de
//      palier n°2, 2026-09-03 — `429b9a1a2` a traversé les deux, six heures après leur pose) ;
//   3. un push NON fast-forward vers une ref distante EXISTANTE. Une ref neuve ne peut écraser aucune
//      histoire, elle n'est pas jugée. `refs/heads/chantier/**` en est EXEMPTÉE : une branche de
//      chantier n'a qu'un écrivain (régime « une session par chantier », 2026-09-01), et le train la
//      REBASE avant chaque push (`scripts/ops/publier.mjs`, étape `push-branche`, avec un
//      `--force-with-lease` dont le bail n'écrase que ce qu'on vient de lire) — son histoire se
//      réécrit par construction. Vers `main`, ce refus est le MIROIR de la règle `non_fast_forward`
//      du ruleset ; c'est le SERVEUR qui tranche sur l'état réel de la ref, le hook le dit plus tôt.
//
// Le quatrième ne porte que sur la ref distante `main` :
//   4. le sha poussé doit porter un run CI TERMINÉ et VERT. Miroir lisible du ruleset `main`
//      (`scripts/ops/ruleset-main.mjs`), qui est LA porte : il dit ici, en une phrase et avec la
//      commande pour voir le run, ce que GitHub refuserait à la seconde d'après. Un push sur une
//      branche de travail ne le rencontre jamais. AUCUNE exonération, pas même sous
//      `GITHUB_ACTIONS` : le ruleset n'en porte aucune (HTTP 422 du 2026-09-16) — un saut local ne
//      ferait que mentir sur le sort du push.
//
// STDIN (githooks(5)) : une ligne `<ref locale> <sha local> <ref distante> <sha distant>` par ref.
// `git push --dry-run` joue AUSSI ce hook (mesuré : 2 invocations par push réel, 1 par dry-run) :
// une lecture ne se distingue pas d'un push, la porte juge les deux pareil.
//
// MESURE : `WFRP_GH_STUB=<fichier json>` fournit les courses au lieu de `gh` (`coursesCi.mjs`).
import { readFileSync } from 'node:fs'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import { estAncetre, lireGit, sortieOuNull, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { ROUGES, coursesCi } from '../guards/lib/coursesCi.mjs'
import { croissancesDeLaPlage, raisonDeRefusDePlage } from '../guards/lib/plageStock.mjs'

const ZERO = '0'.repeat(40)

/** La ref distante que le ruleset protège — la seule dont le contenu doit être VERT avant d'entrer. */
export const REF_PROTEGEE = 'refs/heads/main'

/** Les refs dont l'histoire se réécrit par construction : un écrivain, rebasées par le train. */
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

/** Une course TERMINÉE ? Un stub qui ne dit rien du statut décrit une course finie. */
const estTerminee = (course) => String(course?.status ?? 'completed') === 'completed'

/**
 * VERDICT sur le run CI du sha qui entre dans `main`. PUR — les courses sont injectées.
 * REND `{ refus: string[], notes: string[] }`.
 *
 * Quatre issues, chacune nommée, et chacune renvoyant à la commande qui montre le run :
 *   · aucune course pour ce sha — la CI n'a pas (encore) jugé ce contenu ;
 *   · course EN VOL — la CI juge ce contenu à cette seconde, aucun verdict n'en est sorti ;
 *   · course ROUGE — le contenu est jugé, et il est mauvais ;
 *   · course VERTE — rien à dire.
 * Une conclusion qui n'est ni `success` ni un `ROUGES` connu n'est pas verte non plus : elle refuse
 * en se nommant, plutôt que de laisser entrer une valeur que ce dépôt n'a jamais vue.
 */
export function verdictDuSha({ courses, sha, disponible = true, raison = null }) {
  const voir = `  → voir le run : gh run list --commit ${sha.slice(0, 12)}`
  if (!disponible) return { refus: [`CI du sha poussé non consultable : ${raison}`, voir], notes: [] }
  const notres = (courses ?? []).filter((c) => String(c?.headSha ?? '') === sha)
  if (!notres.length)
    return {
      refus: [
        `aucun run CI sur ${sha.slice(0, 9)} : ce contenu n’a pas été jugé — pousse-le d’abord sur ta `
          + 'branche `chantier/**`, où la CI joue les mêmes gates',
        voir,
      ],
      notes: [],
    }
  const course = notres[0]
  if (!estTerminee(course))
    return {
      refus: [
        `run CI EN VOL sur ${sha.slice(0, 9)} (course ${course.databaseId}) : aucun verdict encore — attendre`,
        voir,
      ],
      notes: [],
    }
  const conclusion = String(course.conclusion ?? '')
  if (conclusion === 'success')
    return { refus: [], notes: [`run CI VERT sur ${sha.slice(0, 9)} (course ${course.databaseId})`] }
  const dit = ROUGES.has(conclusion)
    ? `en ÉCHEC (${conclusion})`
    : `de conclusion « ${conclusion || '(vide)'} », qui n’est pas un vert`
  return { refus: [`run CI ${dit} sur ${sha.slice(0, 9)} — course ${course.databaseId}`, voir], notes: [] }
}

/** Verdict COMPLET du hook : `{ refus: [], notes: [] }`. Aucune sortie, aucun code — testable. */
export function jugerPush({ cwd, stdin, env = process.env }) {
  // Les lectures git passent par l'hôte unique : `null` dit « l'objet n'existe pas », et une
  // INDISPONIBILITÉ (git absent, hors dépôt) devient un refus NOMMÉ au lieu d'un `fatal:` brut.
  const lire = (args) => sortieOuNull(lireGit(args, { cwd }))
  const refus = []
  const notes = []

  const origine = (lire(['remote', 'get-url', 'origin']) ?? '').trim()
  if (!urlOrigineAcceptee(origine))
    refus.push(`origin = « ${origine || '(absent)'} » : ce hook ne connaît que github.com/cgauche/game`)

  for (const { refLocale, shaLocal, refDistante, shaDistant } of refsAPousser(stdin)) {
    // Stocks nominatifs de la PLAGE poussée : par commit, filtrés par la croissance cumulée.
    const stocks = croissancesDeLaPlage({ cwd, avant: shaDistant, apres: shaLocal })
    for (const n of stocks.notes) notes.push(n)
    if (stocks.indisponible)
      refus.push(`${refLocale} → ${refDistante} : plage \`${stocks.plage}\` illisible : ${stocks.indisponible}`)
    if (stocks.refus.length) refus.push(raisonDeRefusDePlage(stocks.refus))

    if (!fastForwardJuge(refDistante)) {
      notes.push(`${refDistante} : branche de chantier — fast-forward non jugé, le train la rebase avant chaque push`)
    } else if (!shaDistant || shaDistant === ZERO) {
      notes.push(`${refDistante} n’existe pas encore côté distant : rien à écraser, fast-forward non jugé`)
    } else {
      const ancetre = estAncetre(shaDistant, shaLocal, { cwd })
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

    if (refDistante !== REF_PROTEGEE) {
      notes.push(`${refDistante} : push libre — c’est la CI de cette branche qui juge le contenu`)
      continue
    }
    const vu = coursesCi({ cwd, env, commit: shaLocal, limit: 30 })
    const ci = verdictDuSha({
      courses: vu.disponible ? vu.valeur : [],
      sha: shaLocal,
      disponible: vu.disponible,
      raison: vu.disponible ? null : vu.raison,
    })
    for (const n of ci.notes) notes.push(n)
    for (const r of ci.refus) refus.push(r)
  }

  return { refus, notes }
}

if (import.meta.main) {
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
    process.stderr.write(`[pre-push] ${enteteArbre(cwd)}\n`)
    process.stderr.write(`pre-push REFUSÉ :\n${refus.map((r) => (r.startsWith('  ') ? r : `  ${r}`)).join('\n')}\n`)
    process.exit(1)
  }
  process.stderr.write(`[pre-push] ${refsAPousser(stdin).length} ref(s) jugée(s) — porte franchie\n`)
}
