#!/usr/bin/env node
// SE NOMMER EN ROUGISSANT (#1779) — le signaleur UNIQUE des workflows qui n'ont pas de porte :
//
//   node scripts/ops/signaler-rouge.mjs --titre "<titre complet>" [--prefixe "<préfixe de titre>"] \
//     --label <label> --corps <fichier> --verdict vert|rouge
//
// Un fil UNIQUE par préfixe de titre : la SURVIVANTE est la plus ANCIENNE issue OUVERTE dont le
// titre commence par `--prefixe` (défaut : `--titre`). Le rapport y est COMMENTÉ tant qu'elle est
// ouverte ; une issue n'est CRÉÉE que s'il n'y en a aucune, et un verdict VERT la FERME.
// `--prefixe` est distinct de `--titre` parce que la recherche porte sur un DÉBUT de titre : le
// canari cherche `Canari rouge in:title` et crée « Canari rouge — environnement ou suite cassés »
// (scripts/ops/canari.test.mjs, cas « le résumé délègue le signalement »).
//
// Le code de sortie est 0 dès que `gh` réussit : c'est le WORKFLOW qui porte le verdict rouge
// (canari.yml, `exit 1` du résumé), jamais le signaleur.
//
// `stdio: ['ignore', …]` sur CHAQUE appel : c'est le `< /dev/null` des runs de canari — un runner ne
// ferme pas stdin pour `gh`, qui attend alors une saisie (scripts/ops/signaler-rouge.test.mjs).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/** Les deux verdicts qu'un workflow peut rendre. */
export const VERDICTS = ['vert', 'rouge']

/** Description du label, FIXE : `--force` la réécrit à chaque run, et deux workflows partagent le
 *  même label `canari` — une description tirée du préfixe ferait battre le label d'un run à l'autre. */
export const DESCRIPTION_LABEL = 'Signalement automatique d’un workflow sans porte'

/**
 * Les GESTES que commande un verdict, face à l'issue survivante. PUR.
 * @param {{ survivante: number|null, verdict: 'vert'|'rouge' }} p
 * @returns {Array<{ geste: 'commenter'|'fermer'|'creer', numero?: number }>}
 */
export function decider({ survivante, verdict }) {
  if (survivante) return verdict === 'vert'
    ? [{ geste: 'commenter', numero: survivante }, { geste: 'fermer', numero: survivante }]
    : [{ geste: 'commenter', numero: survivante }]
  return verdict === 'rouge' ? [{ geste: 'creer' }] : []
}

/**
 * La plus ANCIENNE issue ouverte dont le titre commence par `prefixe`, ou `null`. PUR.
 * @param {Array<{ number: number, createdAt: string, title: string }>} issues
 * @param {string} prefixe
 * @returns {number|null}
 */
export function survivanteDe(issues, prefixe) {
  const candidates = (issues ?? []).filter((i) => typeof i?.title === 'string' && i.title.startsWith(prefixe))
  if (!candidates.length) return null
  return [...candidates].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0].number ?? null
}

/** La ligne que le signaleur imprime pour chaque jeu de gestes. PUR. */
export function recit(gestes) {
  if (!gestes.length) return 'verdict vert et aucune issue ouverte : rien à ouvrir'
  const numero = gestes.find((g) => g.numero)?.numero
  if (gestes.some((g) => g.geste === 'creer')) return 'issue ouverte'
  if (gestes.some((g) => g.geste === 'fermer')) return `rapport posté puis #${numero} fermée`
  return `rapport posté sur #${numero}`
}

/** Options de la ligne de commande. PUR. Lève sur une option manquante ou un verdict inconnu. */
export function options(argv) {
  const lu = {}
  for (let i = 0; i < argv.length; i += 2) {
    const cle = /^--([a-z]+)$/.exec(argv[i])?.[1]
    if (!cle) throw new Error(`option non reconnue : « ${argv[i]} »`)
    lu[cle] = argv[i + 1]
  }
  for (const requise of ['titre', 'label', 'corps', 'verdict'])
    if (!lu[requise]) throw new Error(`option --${requise} manquante`)
  if (!VERDICTS.includes(lu.verdict)) throw new Error(`--verdict doit valoir ${VERDICTS.join(' ou ')}`)
  return { ...lu, prefixe: lu.prefixe || lu.titre }
}

/** Un appel `gh`, stdin FERMÉ. Lève si `gh` échoue — un signalement muet ne sert à rien. */
function gh(args, spawn) {
  const vu = spawn('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 })
  if (vu.error) throw new Error(`gh ${args[0]} : ${vu.error.message}`)
  if (vu.status !== 0) throw new Error(`gh ${args.join(' ')} a rendu ${vu.status} : ${vu.stderr ?? ''}`)
  return vu.stdout ?? ''
}

/**
 * Pose le label, lit la survivante, joue les gestes du verdict.
 * @param {{ titre: string, prefixe: string, label: string, corps: string, verdict: 'vert'|'rouge',
 *   spawn?: Function }} p
 * @returns {string} le récit du geste
 */
export function signaler({ titre, prefixe, label, corps, verdict, spawn = spawnSync }) {
  readFileSync(corps, 'utf8')
  gh(['label', 'create', label, '--description', DESCRIPTION_LABEL, '--color', 'B60205', '--force'], spawn)
  const brut = gh(
    ['issue', 'list', '--state', 'open', '--search', `${prefixe} in:title`, '--json', 'number,createdAt,title'],
    spawn,
  )
  let issues
  try {
    issues = JSON.parse(brut || '[]')
  } catch (e) {
    throw new Error(`gh issue list n’a pas rendu du JSON : ${e.message}`, { cause: e })
  }
  const gestes = decider({ survivante: survivanteDe(issues, prefixe), verdict })
  for (const g of gestes) {
    if (g.geste === 'commenter') gh(['issue', 'comment', String(g.numero), '--body-file', corps], spawn)
    if (g.geste === 'fermer') gh(['issue', 'close', String(g.numero), '--reason', 'completed'], spawn)
    if (g.geste === 'creer') gh(['issue', 'create', '--title', titre, '--body-file', corps, '--label', label], spawn)
  }
  return recit(gestes)
}

if (import.meta.main) {
  try {
    console.log(signaler(options(process.argv.slice(2))))
  } catch (e) {
    console.error(`signaler-rouge — ${e.message}`)
    process.exit(1)
  }
}
