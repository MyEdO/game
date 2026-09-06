// Hook pre-push : la porte AU PUSH (#1679 L2). Elle LIT, elle ne joue rien — régime utilisateur
// 2026-09-01 « suite complète + tsc avant push, pas de push sur CI rouge ».
//
// Six refus, tous nommés. Les cinq premiers portent sur la TÊTE de chaque ref poussée (l'unité
// que la CI juge) :
//   1. `origin` ne pointe pas `github.com/cgauche/game` ;
//   2. une gate de `ci.yml` sans justificatif VERT et PROPRE pour le CONTENU poussé
//      (`scripts/guards/lib/justificatif.mjs` ; la commande qui le produit est nommée : `npm run gates`) ;
//   3. push non fast-forward (aucune autorisation d'écraser une histoire poussée) ;
//   4. le REJEU DES MIGRATIONS sur un EXPORT de la tête est rouge (#1613) — le job `migrations` de
//      la CI est le seul step qu'aucun justificatif ne couvre (`JOBS_HORS_JUSTIFICATIF` : rejoué EN
//      PLACE, il réécrit `src/data` et `src/scenes`). Il est donc JOUÉ ici, sur une copie jetable, et
//      seulement si la plage poussée touche ce qu'il mesure — sinon c'est dit et sauté ;
//   5. un STOCK NOMINATIF qui grandit quelque part dans la PLAGE poussée, sans que le message de SON
//      commit le dise (`scripts/guards/lib/plageStock.mjs`) : les portes de stock du commit et du
//      DERNIER commit ne voient qu'une tête, et un commit intermédiaire leur échappe (revue de
//      palier n°2, 2026-09-03 — `429b9a1a2` a traversé les deux, six heures après leur pose).
//
// Le sixième porte sur la CI de `main`, LUE UNE FOIS pour tout le push (jamais par ref : la CI de
// `main` ne dépend pas de la ref qu'on pousse). Quatre motifs, DEUX leviers de dérogation, chacun
// avec sa portée — une seule manette pour quatre refus rendrait indistinguable le franchissement du
// régime utilisateur et celui d'une panne de lecture :
//   · `rouge` — la dernière course TERMINÉE de `main` a échoué : `failure`, mais aussi `timed_out` et
//     `startup_failure` (`ROUGES`) ; `cancelled` n'est ni vert ni rouge et donne une NOTE nommée,
//     le refus venant alors de l'ancêtre vert. Levier `WFRP_PUSH_SUR_ROUGE=1`, et
//     lui SEUL : c'est ce refus-là qui porte le régime utilisateur du 2026-09-01. Il vaut pour TOUTE
//     ref, branche de travail comprise — un push de branche pendant que main est rouge détourne du
//     seul travail qui compte alors ;
//   · `non-consultable` — `git fetch`, `origin/main` ou `gh` n'ont rien rendu (hors ligne, jeton) ;
//   · `perimee` — `gh` sert une liste où AUCUNE course ne porte la tête d'`origin/main`, après une
//     relecture. La fraîcheur se juge par l'IDENTITÉ, jamais par une horloge : l'âge d'un COMMIT
//     n'est pas celui de sa course (9,1 min d'écart médian, 673 au maximum — mesure du juge de
//     design v2-T2, 2026-09-05) ;
//   · `sans-ancetre` — aucun commit de l'histoire de HEAD n'est porté par une course VERTE.
//   Les trois derniers se franchissent par `WFRP_PUSH_CI_NON_CONSULTABLE=1`, qui ne franchit JAMAIS
//   un rouge LU. Les deux leviers exigent `WFRP_DEROGATION` (20 caractères au moins) et écrivent une
//   ligne JSON dans `<git-common-dir>/wfrp-justificatifs/derogations.log`, relue par la revue de
//   palier. Ce journal enregistre une TENTATIVE de push : le hook s'exécute AVANT le transfert et ne
//   sait pas s'il aboutit — deux lignes identiques peuvent nommer un seul push abouti (mesuré le
//   2026-09-04 sur `c3692d0f9`, 07:49:58 puis 07:54:50 pour une unique course CI). Un comptage de
//   dérogations compte donc des tentatives, et chaque ligne le DIT.
//
// Le fast-forward ne se juge que contre une ref distante EXISTANTE (une ref neuve n'écrase rien).
//
// STDIN (githooks(5)) : une ligne `<ref locale> <sha local> <ref distante> <sha distant>` par ref.
// `git push --dry-run` joue AUSSI ce hook (mesuré : 2 invocations par push réel, 1 par dry-run) :
// une lecture ne se distingue pas d'un push, la porte juge les deux pareil.
//
// COÛT de la lecture des courses (mesuré le 2026-09-05 sur ce dépôt, médiane de trois passes) :
// `--limit 30` = 1 583 ms, `--limit 300` = 10 732 ms. D'où la lecture en DEUX TEMPS : les 30
// tranchent rouge, en vol et fraîcheur ; les 300 ne sont lues que si aucune course verte d'un
// ancêtre n'est dans les 30.
//
// MESURE : `WFRP_GH_STUB=<fichier json>` fournit les courses au lieu de `gh` (`coursesCi.mjs`), et
// dispense du `git fetch` — la consultation d'`origin` vient alors ENTIÈREMENT de la fixture.
import { appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { enteteArbre } from '../guards/lib/enteteArbre.mjs'
import { commitsDe, estAncetre, fetchOrigin, lireGit, sortieOuNull } from '../guards/lib/gitPorte.mjs'
import { coursesCiDeMain } from '../guards/lib/coursesCi.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { PERIMETRE } from '../migrations/replay.mjs'
import { rejeuSurExport } from '../migrations/replay-head.mjs'
import {
  cheminJustificatifs,
  clesDeContenu,
  gatesRequises,
  justificatifsSousDAutresCles,
  lireJustificatif,
  migrerAncienneGraphie,
  motifDeRefus,
} from '../guards/lib/justificatif.mjs'
import { croissancesDeLaPlage, raisonDeRefusDePlage } from '../guards/lib/plageStock.mjs'
import { MOTIF_MIN } from '../guards/lib/stock.mjs'

const ZERO = '0'.repeat(40)

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

/** Chemins dont la présence dans une plage poussée ARME le rejeu des migrations : ce que les
 *  migrations ÉCRIVENT (`PERIMETRE`, importé — jamais recopié) et les migrations elles-mêmes. */
export const CHEMINS_QUI_ARMENT_LE_REJEU = [...PERIMETRE, 'scripts/migrations']

/** La plage touche-t-elle de quoi armer le rejeu ? Comparaison par SEGMENT : `src/database` n'est
 *  pas `src/data`. */
export const armeLeRejeu = (chemins) =>
  chemins.some((chemin) => {
    const c = String(chemin).replace(/\\/g, '/')
    return CHEMINS_QUI_ARMENT_LE_REJEU.some((p) => c === p || c.startsWith(`${p}/`))
  })

/** Le dépôt de ce projet, en https comme en ssh. */
export const urlOrigineAcceptee = (url) => /github\.com[:/]cgauche\/game(?:\.git)?$/.test(String(url ?? '').trim())

/** Le levier de dérogation de chaque motif. `rouge` a le SIEN, et il ne franchit que lui. */
export const LEVIER_DU_MOTIF = {
  rouge: 'WFRP_PUSH_SUR_ROUGE',
  'non-consultable': 'WFRP_PUSH_CI_NON_CONSULTABLE',
  perimee: 'WFRP_PUSH_CI_NON_CONSULTABLE',
  'sans-ancetre': 'WFRP_PUSH_CI_NON_CONSULTABLE',
}

/** Longueur minimale d'une raison de dérogation : une manette se motive, ou elle ne vaut rien.
 *  MÊME seuil que le motif d'un `CLIQUET:` — il vit à UN endroit (`stock.mjs`). */
export const RAISON_MINIMALE = MOTIF_MIN

/** Une course TERMINÉE ? Un stub qui ne dit rien du statut décrit une course finie. */
const estTerminee = (course) => String(course?.status ?? 'completed') === 'completed'

/** Les conclusions qui disent une course ÉCHOUÉE. `failure` n'est pas la seule : GitHub rend aussi
 *  `timed_out` (le job a dépassé sa borne) et `startup_failure` (le runner n'a pas démarré). Les
 *  omettre laissait passer le push sur une CI qui n'est PAS verte — mesuré : refus=0 sur les deux. */
export const ROUGES = new Set(['failure', 'timed_out', 'startup_failure'])

/** `cancelled` n'est ni vert ni rouge : personne n'a jugé ce contenu. Le refus vient alors de la
 *  règle de l'ancêtre vert, pas d'un échec qu'on lui prêterait — et la NOTE le dit. */
export const ANNULEE = 'cancelled'

/**
 * VERDICT sur la CI de `main`. PUR — `relire(limite)` est la seule lecture, injectée.
 *
 * FRAÎCHEUR PAR IDENTITÉ : une liste est CONCLUANTE si et seulement si une course y porte la tête
 * d'`origin/main`. Sinon elle est relue UNE fois ; toujours pas, et le refus le dit. Aucune horloge
 * n'entre ici : ce qui est connaissable et monotone, c'est l'identité du commit jugé.
 *
 * @param {{ courses: object[], teteMain: string|null, raisonTete?: string|null,
 *           ancetres?: string[], relire?: (limite: number) => object[] }} p
 * @returns {{ refus: { motif: string, dit: string, sha: string|null }[], notes: string[] }}
 */
export function verdictCi({ courses, teteMain, raisonTete = null, ancetres = [], relire = () => [] }) {
  const refus = []
  const notes = []
  // `shaCause` = le commit qui CAUSE le refus (la tête de `main`, le commit de la course rouge) —
  // jamais le commit poussé : celui-là, seul le hook le connaît, et c'est à LUI que le journal
  // attribue la dérogation (sans quoi la revue du palier qui contient ce push ne la voit pas).
  const nier = (motif, dit, shaCause = null) => refus.push({ motif, dit, shaCause })
  if (!teteMain) {
    nier('non-consultable', `CI de \`main\` non consultable : ${raisonTete ?? 'la tête d’`origin/main` n’a pas pu être lue'}`)
    return { refus, notes }
  }
  const porteLaTete = (liste) => (liste ?? []).some((c) => String(c?.headSha ?? '') === teteMain)

  let liste = courses ?? []
  if (!porteLaTete(liste)) {
    notes.push(`aucune course ne porte la tête de main ${teteMain.slice(0, 9)} : la liste est relue une fois`)
    liste = relire(30) ?? []
  }
  if (!porteLaTete(liste)) {
    nier(
      'perimee',
      `CI de \`main\` non consultable : \`gh\` ne sert aucune course pour la tête de \`main\` ${teteMain.slice(0, 9)} `
      + '(liste périmée ou course pas encore créée)',
      teteMain,
    )
    return { refus, notes }
  }

  const enVol = liste.filter((c) => !estTerminee(c))
  if (enVol.length)
    notes.push(
      `${enVol.length} course(s) EN VOL sur main (${enVol.map((c) => String(c.headSha ?? '').slice(0, 7)).join(', ')}) — `
      + 'le push ne les attend pas',
    )
  const derniereTerminee = liste.find(estTerminee)
  if (derniereTerminee && ROUGES.has(String(derniereTerminee.conclusion))) {
    nier(
      'rouge',
      `CI de main en ÉCHEC (${derniereTerminee.conclusion}) — course ${derniereTerminee.databaseId} `
      + `sur ${String(derniereTerminee.headSha ?? '').slice(0, 7)}`,
      String(derniereTerminee.headSha ?? ''),
    )
    return { refus, notes }
  }
  if (derniereTerminee && String(derniereTerminee.conclusion) === ANNULEE)
    notes.push(
      `dernière course TERMINÉE de main ANNULÉE (course ${derniereTerminee.databaseId} sur `
      + `${String(derniereTerminee.headSha ?? '').slice(0, 7)}) : ce contenu n'a été jugé ni vert ni rouge`,
    )

  const connus = new Set(ancetres ?? [])
  const porteUnVert = (l) => (l ?? []).some((c) => c?.conclusion === 'success' && connus.has(String(c.headSha ?? '')))
  if (!porteUnVert(liste)) {
    const large = relire(300) ?? []
    if (porteUnVert(large)) notes.push('ancêtre vert trouvé dans les 300 dernières courses (aucun dans les 30)')
    else
      nier(
        'sans-ancetre',
        'CI de `main` : aucun commit de cette histoire n’est porté par une course VERTE '
        + '(règle d’ingénierie, revue de palier n°4)',
        teteMain,
      )
  }
  return { refus, notes }
}

/** Verdict COMPLET du hook : `{ refus: [], notes: [] }`. Aucune sortie, aucun code — testable. */
export function jugerPush({ cwd, stdin, env = process.env }) {
  // Les lectures git passent par l'hôte unique : `null` dit « l'objet n'existe pas », et une
  // INDISPONIBILITÉ (git absent, hors dépôt) devient un refus NOMMÉ au lieu d'un `fatal:` brut.
  const lire = (args) => sortieOuNull(lireGit(args, { cwd }))
  const refus = []
  const notes = []
  /** Rejeux déjà joués, par sha : un push de deux refs sur le MÊME commit (`main` + une étiquette de
   *  travail) ne paie pas deux fois les ~17 s de la porte P1.4.
   *  @type {Map<string, { rouges: string[], chronos: Record<string, number> }>} */
  const rejeuxJoues = new Map()

  const origine = (lire(['remote', 'get-url', 'origin']) ?? '').trim()
  if (!urlOrigineAcceptee(origine))
    refus.push(`origin = « ${origine || '(absent)'} » : ce hook ne connaît que github.com/cgauche/game`)

  // Le magasin passe à la graphie courante AVANT toute lecture : un magasin resté à l'ancienne
  // (un fichier par gate, sans clé ni propreté dans le nom) est invisible au lecteur, et le push
  // serait refusé sur des preuves présentes. Idempotente, elle ne lit que le magasin.
  const migration = migrerAncienneGraphie({ cwd, journal: (t) => notes.push(t.trim()) })
  if (migration.renommes)
    notes.push(`${migration.renommes} justificatif(s) passé(s) à la graphie courante (nom porteur de la clé et de la propreté)`)

  let gates = []
  try {
    gates = gatesRequises({ cwd })
  } catch (e) {
    refus.push(e.message)
  }

  for (const { refLocale, shaLocal, refDistante, shaDistant } of refsAPousser(stdin)) {
    const cles = clesDeContenu(shaLocal, { cwd })
    const vues = gates.map((g) => ({ gate: g, vue: lireJustificatif({ cwd, gate: g.nom, cles }) }))
    const manques = vues
      .map(({ gate, vue }) =>
        motifDeRefus(vue, gate, { autresCles: justificatifsSousDAutresCles({ cwd, gate: gate.nom, cles }) }),
      )
      .filter(Boolean)
    if (manques.length) {
      refus.push(`${refLocale} → ${refDistante} : ${manques.length}/${gates.length} gate(s) sans justificatif sur ce contenu`)
      for (const m of manques) refus.push(`  · ${m}`)
      refus.push('  → tout produire d’un coup : npm run gates')
    } else {
      const shas = [...new Set(vues.map(({ vue }) => vue.sha))]
      if (!shas.includes(shaLocal))
        notes.push(
          `justificatif de ${shas.map((s) => s.slice(0, 7)).join(', ')} réutilisé pour ${shaLocal.slice(0, 7)} ` +
            '(contenu identique — pour chaque gate, sur le périmètre qui la gouverne)',
        )
    }

    // Fast-forward : il ne se juge QUE contre une ref distante EXISTANTE. Une ref neuve
    // (`shaDistant` nul) ne peut écraser aucune histoire — la comparer à `origin/main` refusait
    // toute branche de travail partie d'un point ancien (mesuré).
    if (!shaDistant || shaDistant === ZERO) {
      notes.push(
        `${refDistante} n’existe pas encore côté distant : rien à écraser, fast-forward non jugé — et ` +
          'le rejeu des migrations se juge sur l’arbre ENTIER, donc il est joué',
      )
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

    // REJEU DES MIGRATIONS sur l'export de la tête (#1613). Ce qu'on juge, c'est le CONTENU que la
    // plage apporte : sur une ref distante NEUVE il n'y a pas de plage, et l'arbre ENTIER du sha en
    // tient lieu — tout y arrive côté distant. Conséquence assumée et DITE dans la note : une branche
    // neuve arme toujours le rejeu (l'arbre de ce dépôt porte `src/data`), soit ~17 s au premier push
    // d'une branche ; les suivants ne paient que si la plage touche le périmètre.
    const plage = shaDistant && shaDistant !== ZERO ? `${shaDistant}..${shaLocal}` : null
    const ditPlage = plage ?? `l’arbre entier de ${shaLocal.slice(0, 7)} (ref distante neuve)`
    const touches = (() => {
      const args = plage ? ['diff', '--name-only', plage] : ['ls-tree', '-r', '--name-only', shaLocal]
      const vu = lire(args)
      return vu === null ? null : vu.split(/\r?\n/).filter(Boolean)
    })()
    if (touches === null) {
      refus.push(`${refLocale} → ${refDistante} : contenu de ${ditPlage} illisible — rejeu des migrations non jugé`)
    } else if (!armeLeRejeu(touches)) {
      notes.push(`replay sauté : aucun fichier du périmètre des migrations dans ${ditPlage}`)
    } else {
      try {
        // `ecrire: () => {}` : le détail des 88 migrations n'a pas sa place dans un refus de hook —
        // seuls les rouges sont nommés, et le refus renvoie à `npm run migrations:replay:head`.
        const rejeu =
          rejeuxJoues.get(shaLocal) ?? rejeuSurExport({ cwd, sha: shaLocal, ecrire: () => {} })
        rejeuxJoues.set(shaLocal, rejeu)
        if (rejeu.rouges.length) {
          refus.push(`${refLocale} → ${refDistante} : rejeu des migrations ROUGE sur l’export de ${shaLocal.slice(0, 7)}`)
          for (const r of rejeu.rouges) refus.push(`  · ${r}`)
          refus.push('  → rejouer et lire le détail : npm run migrations:replay:head')
        } else {
          notes.push(
            `rejeu des migrations vert sur l’export de ${shaLocal.slice(0, 7)} (${rejeu.chronos.total.toFixed(1)}s)`,
          )
        }
      } catch (e) {
        refus.push(`${refLocale} → ${refDistante} : rejeu des migrations impossible — ${e.message}`)
      }
    }

    // Stocks nominatifs de la PLAGE poussée : par commit, filtrés par la croissance cumulée.
    const stocks = croissancesDeLaPlage({ cwd, avant: shaDistant, apres: shaLocal })
    for (const n of stocks.notes) notes.push(n)
    if (stocks.indisponible)
      refus.push(`${refLocale} → ${refDistante} : plage \`${stocks.plage}\` illisible : ${stocks.indisponible}`)
    if (stocks.refus.length) refus.push(raisonDeRefusDePlage(stocks.refus))
  }

  // ── CI de `main` : UNE lecture pour tout le push, hors de la boucle des refs ─────────────────
  const teteLue = teteDeMain({ cwd, env })
  for (const n of teteLue.notes) notes.push(n)
  const ancetres = (() => {
    const vu = commitsDe('HEAD', 1000, { cwd })
    return vu.disponible && !vu.absent ? vu.valeur : []
  })()
  const relire = (limite) => {
    // 5 s : la course d'un push tout juste fait n'est pas servie à l'instant du hook. Le stub sert
    // ses listes sans attendre — c'est lui qui compte les appels.
    if (!env.WFRP_GH_STUB && limite === 30) attendreSync(5000)
    const vu = coursesCiDeMain({ cwd, env, limit: limite })
    if (!vu.disponible) {
      notes.push(`relecture des courses (${limite}) indisponible : ${vu.raison}`)
      return []
    }
    return vu.valeur
  }
  const premiere = coursesCiDeMain({ cwd, env, limit: 30 })
  const ci = premiere.disponible
    ? verdictCi({ courses: premiere.valeur, teteMain: teteLue.sha, raisonTete: teteLue.raison, ancetres, relire })
    : verdictCi({ courses: [], teteMain: null, raisonTete: `\`gh\` — ${premiere.raison}` })
  for (const n of ci.notes) notes.push(n)
  for (const { motif, dit, shaCause } of ci.refus) {
    const levier = LEVIER_DU_MOTIF[motif]
    const raison = String(env.WFRP_DEROGATION ?? '').trim()
    if (env[levier] === '1' && raison.length >= RAISON_MINIMALE) {
      notes.push(`${dit} — DÉROGATION journalisée (${motif}) : ${raison}`)
      journaliserDerogation({
        cwd,
        motif,
        sha: lire(['rev-parse', 'HEAD'])?.trim() ?? '',
        shaCause: shaCause ?? '',
        raison,
        notes,
      })
    } else {
      refus.push(dit)
      refus.push(
        `  → corriger main, ou déroger EXPLICITEMENT : ${levier}=1 `
        + `WFRP_DEROGATION="<raison de ${RAISON_MINIMALE} caractères au moins>"`,
      )
    }
  }

  return { refus, notes }
}

/**
 * La tête d'`origin/main`, RÉFÉRENCE de la fraîcheur. Le `fetch` (mutation de refs) est NOMMÉ, et
 * n'est pas joué sous stub — la fixture porte alors elle-même l'état d'`origin`.
 * @returns {{ sha: string|null, raison: string|null, notes: string[] }}
 */
export function teteDeMain({ cwd, env = process.env }) {
  const notes = []
  if (!env.WFRP_GH_STUB) {
    const vu = fetchOrigin({ cwd })
    if (!vu.disponible) return { sha: null, raison: `\`git fetch origin main\` — ${vu.raison}`, notes }
    if (vu.absent) return { sha: null, raison: '`origin` ne sert pas de branche `main`', notes }
  }
  const vu = lireGit(['rev-parse', 'origin/main'], { cwd })
  if (!vu.disponible) return { sha: null, raison: vu.raison, notes }
  if (vu.absent || vu.valeur.status !== 0) return { sha: null, raison: '`origin/main` est inconnu de ce dépôt', notes }
  return { sha: vu.valeur.stdout.trim(), raison: null, notes }
}

/** Une ligne JSON par TENTATIVE dérogée : un seul objet par ligne, relu par la revue de palier. */
function journaliserDerogation({ cwd, motif, sha, shaCause, raison, notes }) {
  try {
    const ligne = JSON.stringify({ horodatage: new Date().toISOString(), etat: 'tentative', motif, sha, shaCause, raison })
    appendFileSync(join(cheminJustificatifs({ cwd }), 'derogations.log'), `${ligne}\n`)
  } catch (e) {
    notes.push(`journal de dérogation non écrit : ${e.message}`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
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
