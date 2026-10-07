// Fonction `suivi` du mod `harnais` (#2279) : le suivi de vague `.git/suivi/<N>.md` sous les yeux pendant
// toute la session ; au démarrage, elle synchronise d'abord le principal (`synchroniser.mjs --json`, #2187).
// Elle REND l'état de session que calcule le lecteur `scripts/ops/suivi.mjs --session
// <id> --json [--depuis <cle>]` (`etatDeSession`) et confie l'édition à `suivi.mjs <N> --session <id>
// --json [--ticket <M>] --<geste> <texte>` (`editer`). Porteurs :
// https://github.com/MyEdO/game/issues/2278#issuecomment-5983942497
import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderElement } from 'claude-code'
import type { HarnaisEtatDeSession, HarnaisSuivi, HarnaisSynchro, HarnaisSynchroEnAttente } from '../types'
import { appel, lire } from './ops'
import type { Lu } from './ops'

const DEPART: HarnaisSuivi = { etat: null, cle: null, enAttente: null, generation: '' }
const atome = atom({ plugin: 'harnais', key: 'suivi' } as const, DEPART)

/**
 * Période (ms) de relecture. Une édition par l'outil relit aussitôt ; une écriture hors outil (à la main,
 * `ops:suivi -- N`) est vue en une minute au plus, pour un `node` de moins d'une seconde par minute
 * (#2278, sonde P1). Valeur maison.
 */
const PERIODE_MS = 60 * 1000

/** L'outil d'édition, listé `mcp__harnais__suivi`. */
const OUTIL = {
  name: 'suivi',
  description: 'Édite la zone écrite du suivi de vague `.git/suivi/<epique>.md` et lie cette session à l’épique : '
    + '`ajouter-item` (texte `#M libellé`), `ajouter-etape` (à l’item `ticket`), `cocher` (l’étape ouverte de l’item '
    + '`ticket` dont le texte commence par `texte`). Rend la situation du suivi. La zone mesurée ne s’édite pas.',
  inputSchema: {
    type: 'object',
    properties: {
      epique: { type: 'integer', minimum: 1, description: 'Le numéro N du suivi `.git/suivi/<N>.md`.' },
      geste: { type: 'string', enum: ['ajouter-item', 'ajouter-etape', 'cocher'] },
      ticket: { type: 'integer', minimum: 1, description: 'Le ticket de l’item visé (`ajouter-etape`, `cocher`).' },
      texte: {
        type: 'string', minLength: 1, pattern: '^[^\\r\\n]+$',
        description: 'Le libellé, le texte de l’étape, ou le début de l’étape à cocher ; une seule ligne.',
      },
    },
    required: ['epique', 'geste', 'texte'],
    additionalProperties: false,
  },
}

/** `scripts/ops/suivi.mjs` lancé avec `args` ; un échec va au journal de débogage. */
async function suiviMjs($: EngineInterface, args: readonly string[]): Promise<Lu<HarnaisEtatDeSession>> {
  let lu: Lu<HarnaisEtatDeSession>
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
 * depuis son lancement ; un échec garde le dernier état valide.
 */
async function relire($: EngineInterface) {
  const lancee = await read($, atome)
  const lu = await suiviMjs($, ['--session', await $.session.id(), '--json', ...(lancee.cle ? ['--depuis', lancee.cle] : [])])
  if (!lu.ok) return
  await update($, atome, (s) => (s.generation !== lancee.generation ? s : {
    ...s,
    etat: lu.valeur,
    enAttente: lu.valeur.ajout ? { ajout: lu.valeur.ajout, cle: lu.valeur.cle } : s.enAttente,
  }))
}

const atomeSynchro = atom({ plugin: 'harnais', key: 'synchro' } as const, { texte: null } as HarnaisSynchroEnAttente)

/**
 * Borne (ms) de `synchroniser.mjs` : l'attente de ses verrous, le `fetch`, puis `post-merge` (`npm ci`,
 * docs dérivés) ; même valeur que `TIMEOUT_SYNCHRONISEUR` (`scripts/agents/compat-core.mjs`), côté Codex.
 * Valeur maison.
 */
const BORNE_SYNCHRO_MS = 300 * 1000

/** Les états de synchronisation qui ne disent rien à la session. */
const ETATS_MUETS = new Set(['a-jour', 'avance'])

/**
 * Le principal synchronisé (`scripts/ops/synchroniser.mjs --json`, #2187) : un état autre que `a-jour` ou
 * `avance`, ou un échec, est retenu pour UN bloc de contexte, tel que reçu.
 */
async function synchroniser($: EngineInterface) {
  let lu: Lu<HarnaisSynchro>
  try {
    lu = lire(await $.process.run(...appel($.plugin.root, 'synchroniser', ['--json'], { borneMs: BORNE_SYNCHRO_MS })), { codes: [0, 1, 2] })
  } catch (erreur) {
    lu = { ok: false, motif: `non lancé (${String(erreur)})` }
  }
  const reprise = ' — reprise : `npm run ops:synchroniser`'
  const texte = !lu.ok ? `[synchroniser] principal non synchronisé : ${lu.motif}${reprise}`
    : ETATS_MUETS.has(lu.valeur.etat) ? null : `[synchroniser] principal : ${JSON.stringify(lu.valeur)}${reprise}`
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
    await $.tool.register(OUTIL)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__harnais__suivi' }, async ($, e) => {
    const ticket = e.ticket ? ['--ticket', String(e.ticket)] : []
    const lu = await suiviMjs($, [String(e.epique), '--session', await $.session.id(), '--json', ...ticket, `--${String(e.geste)}`, String(e.texte)])
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
