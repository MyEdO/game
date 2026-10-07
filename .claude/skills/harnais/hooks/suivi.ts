// Fonction `suivi` du mod `harnais` (#2279) : le suivi de vague `.git/suivi/<N>.json` sous les yeux pendant
// toute la session ; au démarrage, elle synchronise d'abord le principal (`synchroniser.mjs --json`, #2187).
// Elle REND l'état de session que calcule le lecteur `scripts/ops/suivi.mjs --session
// <id> --json [--depuis <cle>]` (`etatDeSession`), enregistre l'outil que décrit `suivi.mjs --outil --json`
// (son schéma est dérivé de la donnée, #2460) et lui confie chaque lot par `suivi.mjs <N> --session <id>
// --json --lot <json>` (`editer`). Le lecteur ne mesure jamais : pour chaque épique de son `aMesurer`, la
// relecture lance `suivi.mjs <N> --mesurer --sans-fetch --json` ; le verrou de mesure de
// `scripts/ops/suiviMesure.mjs`, pris sans attente, dédoublonne — le mod n'en décide rien (#2460, design §5).
// Porteurs :
// https://github.com/MyEdO/game/issues/2278#issuecomment-5983942497
import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderElement } from 'claude-code'
import type { HarnaisEtatDeSession, HarnaisOutil, HarnaisSuivi, HarnaisSynchro, HarnaisSynchroEnAttente } from '../types'
import { appel, lire } from './ops'
import type { Lu } from './ops'

const DEPART: HarnaisSuivi = { etat: null, cle: null, enAttente: null, generation: '' }
const atome = atom({ plugin: 'harnais', key: 'suivi' } as const, DEPART)

/**
 * Période (ms) de relecture. Un lot par l'outil relit aussitôt ; un lot par le CLI (`ops:suivi -- N`) est vu
 * en une minute au plus, pour un `node` de moins d'une seconde par minute
 * (#2278, sonde P1). Valeur maison.
 */
const PERIODE_MS = 60 * 1000

/** `scripts/ops/suivi.mjs` lancé avec `args` ; un échec va au journal de débogage. */
async function suiviMjs<T>($: EngineInterface, args: readonly string[]): Promise<Lu<T>> {
  let lu: Lu<T>
  try {
    lu = lire(await $.process.run(...appel($.plugin.root, 'suivi', args)))
  } catch (erreur) {
    lu = { ok: false, motif: `non lancé (${String(erreur)})` }
  }
  if (!lu.ok) $.ui.log(`harnais, suivi.mjs ${args.join(' ')} : ${lu.motif}`, { to: 'debug' })
  return lu
}

/**
 * Relit l'état de session depuis la clé retenue. Ignorée si une transition qui retient une clé a eu lieu
 * depuis son lancement ; un échec garde le dernier état valide. Chaque épique de son `aMesurer` est mesurée
 * (`mesurer`), sans attendre.
 */
async function relire($: EngineInterface) {
  const lancee = await read($, atome)
  const lu = await suiviMjs<HarnaisEtatDeSession>($, ['--session', await $.session.id(), '--json', ...(lancee.cle ? ['--depuis', lancee.cle] : [])])
  if (!lu.ok) return
  await update($, atome, (s) => (s.generation !== lancee.generation ? s : {
    ...s,
    etat: lu.valeur,
    enAttente: lu.valeur.ajout ? { ajout: lu.valeur.ajout, cle: lu.valeur.cle } : s.enAttente,
  }))
  for (const epique of lu.valeur.aMesurer) void mesurer($, epique)
}

/** Borne (ms) d'une mesure : `gh` sur la portée, les branches et les worktrees. Valeur maison. */
const BORNE_MESURE_MS = 300 * 1000

/**
 * La mesure de l'épique `epique` (`suivi.mjs <N> --mesurer --sans-fetch --json`) ; la relecture suivante en lit
 * le résultat. Un échec va au journal de débogage.
 */
async function mesurer($: EngineInterface, epique: number) {
  const args = [String(epique), '--mesurer', '--sans-fetch', '--json']
  try {
    const lu = lire(await $.process.run(...appel($.plugin.root, 'suivi', args, { borneMs: BORNE_MESURE_MS })))
    if (!lu.ok) $.ui.log(`harnais, suivi.mjs ${args.join(' ')} : ${lu.motif}`, { to: 'debug' })
  } catch (erreur) {
    $.ui.log(`harnais, suivi.mjs ${args.join(' ')} : non lancé (${String(erreur)})`, { to: 'debug' })
  }
}

const atomeSynchro = atom({ plugin: 'harnais', key: 'synchro' } as const, { texte: null } as HarnaisSynchroEnAttente)

/**
 * Borne (ms) de `synchroniser.mjs` : l'attente de ses verrous, le `fetch`, puis `post-merge` (`npm ci`,
 * docs dérivés) ; même valeur que `TIMEOUT_SYNCHRONISEUR` (`scripts/agents/compat-core.mjs`), côté Codex.
 * Valeur maison.
 */
const BORNE_SYNCHRO_MS = 300 * 1000

/** Les états de synchronisation qui ne disent rien à la session, sans configuration client changée. */
const ETATS_MUETS = new Set(['a-jour', 'avance'])

/**
 * Le texte d'un état reçu, `null` s'il est muet : `ETATS_MUETS` et `configurationClientChangee` vide ou
 * absent (#2187 commentaire 6029118597, C4).
 */
function texteDeSynchro(vu: HarnaisSynchro): string | null {
  const changes = Array.isArray(vu.configurationClientChangee) ? vu.configurationClientChangee.map(String) : []
  const etatMuet = ETATS_MUETS.has(vu.etat)
  if (etatMuet && !changes.length) return null
  const configuration = changes.length ? ` — la session tourne sur la configuration d'avant : ${changes.join(', ')}` : ''
  return `[synchroniser] principal : ${JSON.stringify(vu)}${configuration}${etatMuet ? '' : ' — reprise : `npm run ops:synchroniser`'}`
}

/**
 * Le principal synchronisé (`scripts/ops/synchroniser.mjs --json`, #2187) : un état non muet
 * (`texteDeSynchro`), ou un échec, est retenu pour UN bloc de contexte, tel que reçu.
 */
async function synchroniser($: EngineInterface) {
  let lu: Lu<HarnaisSynchro>
  try {
    lu = lire(await $.process.run(...appel($.plugin.root, 'synchroniser', ['--json'], { borneMs: BORNE_SYNCHRO_MS })), { codes: [0, 1, 2] })
  } catch (erreur) {
    lu = { ok: false, motif: `non lancé (${String(erreur)})` }
  }
  const texte = lu.ok ? texteDeSynchro(lu.valeur) : `[synchroniser] principal non synchronisé : ${lu.motif} — reprise : \`npm run ops:synchroniser\``
  await update($, atomeSynchro, () => ({ texte }))
}

/** La transition qui retient la clé `cle` : l'attente est vidée, une génération neuve est tirée. */
const retenir = (s: HarnaisSuivi, cle: string, etat: HarnaisEtatDeSession | null = s.etat): HarnaisSuivi =>
  ({ etat, cle, enAttente: null, generation: crypto.randomUUID() })

export function suivi(on: On) {
  on('session.start', async ($, e, next) => {
    await synchroniser($)
    await relire($)
    $.clock.every(PERIODE_MS, () => {
      void relire($)
    })
    const outil = await suiviMjs<HarnaisOutil>($, ['--outil', '--json'])
    if (outil.ok) await $.tool.register(outil.valeur)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__harnais__suivi' }, async ($, e) => {
    const lot = JSON.stringify({ epique: e.epique, mutations: e.mutations })
    const lu = await suiviMjs<HarnaisEtatDeSession>($, [String(e.epique), '--session', await $.session.id(), '--json', '--lot', lot])
    if (!lu.ok) return { deny: lu.motif }
    await update($, atome, (s) => retenir(s, lu.valeur.cle, lu.valeur))
    return { result: lu.valeur.ajout }
  })

  on('prompt.context', async ($, e, next) => {
    const porte: { etat: HarnaisEtatDeSession | null } = { etat: null }
    await update($, atome, (s) => {
      porte.etat = s.etat?.contexte ? s.etat : null
      return porte.etat ? retenir(s, porte.etat.cle) : s
    })
    const synchro: { texte: string | null } = { texte: null }
    await update($, atomeSynchro, (s) => {
      synchro.texte = s.texte
      return s.texte ? { texte: null } : s
    })
    const { etat } = porte
    const blocs = [
      ...(synchro.texte ? [{ name: 'synchroniser', text: synchro.texte }] : []),
      ...(etat ? [{ name: 'suivi', text: etat.contexte }] : []),
    ]
    return blocs.length ? next({ ...e, blocks: [...e.blocks, ...blocs] }) : next(e)
  })

  on('turn.start', async ($, e, next) => {
    const lu = await read($, atome)
    const { enAttente } = lu
    if (!enAttente) return next(e)
    try {
      await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: enAttente.ajout }] } })
    } catch (erreur) {
      $.ui.log(`harnais, ajout du suivi non fait, reporté au tour suivant : ${String(erreur)}`, { to: 'debug' })
      return next(e)
    }
    await update($, atome, (s) => (s.generation !== lu.generation ? s : retenir(s, enAttente.cle)))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { etat } = await read($, atome)
    if (e.props.hasSurvey || !etat?.suivis.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return h(Box, { flexDirection: 'column' }, ...etat.suivis.flatMap((lie) =>
      lie.lignes.map((ligne, rang) => h(Text, { key: `${lie.epique}-${rang}`, dimColor: true }, ligne)))) as RenderElement
  })
}
