// Fonction `suivi` du mod `harnais` (#2279) : le suivi de vague `.git/suivi/<N>.md` sous les yeux pendant
// toute la session. Elle REND l'état que calcule le lecteur `scripts/ops/suivi.mjs --session <id> --json
// [--depuis <cle>]` (`etatDeSession`) et confie l'édition à `suivi.mjs <N> --session <id> --json --<geste>`
// (`editer`). Porteurs : https://github.com/MyEdO/game/issues/2278#issuecomment-5983942497
import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderElement } from 'claude-code'
import type { HarnaisSuivi } from '../types'
import { appel, lire } from './ops'
import type { Lu } from './ops'

const etat = atom({ plugin: 'harnais', key: 'suivi' } as const, null)
const cle = atom({ plugin: 'harnais', key: 'cle' } as const, null)
const enAttente = atom({ plugin: 'harnais', key: 'enAttente' } as const, null)

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
    + '`ticket` dont le texte commence par `texte`). Rend l’état du suivi. La zone mesurée ne s’édite pas.',
  inputSchema: {
    type: 'object',
    properties: {
      epique: { type: 'integer', minimum: 1, description: 'Le numéro N du suivi `.git/suivi/<N>.md`.' },
      geste: { type: 'string', enum: ['ajouter-item', 'ajouter-etape', 'cocher'] },
      ticket: { type: 'integer', minimum: 1, description: 'Le ticket de l’item visé (`ajouter-etape`, `cocher`).' },
      texte: { type: 'string', minLength: 1, description: 'Le libellé, le texte de l’étape, ou le début de l’étape à cocher.' },
    },
    required: ['epique', 'geste', 'texte'],
    additionalProperties: false,
  },
}

/** `scripts/ops/suivi.mjs` lancé avec `args` ; un échec va au journal de débogage. */
async function suiviMjs($: EngineInterface, args: readonly string[]): Promise<Lu<HarnaisSuivi>> {
  let lu: Lu<HarnaisSuivi>
  try {
    lu = lire(await $.process.run(...appel($.plugin.root, 'suivi', args)))
  } catch (erreur) {
    lu = { ok: false, motif: `non lancé (${String(erreur)})` }
  }
  if (!lu.ok) $.ui.log(`harnais, suivi.mjs ${args.join(' ')} : ${lu.motif}`, { to: 'debug' })
  return lu
}

/**
 * Relit l'état depuis la dernière clé connue ; un ajout rendu attend le prochain tour, sauf si sa clé est
 * celle retenue À SON RETOUR (un geste l'a retenue pendant la lecture).
 */
async function relire($: EngineInterface) {
  const depuis = await read($, cle)
  const lu = await suiviMjs($, ['--session', await $.session.id(), '--json', ...(depuis ? ['--depuis', depuis] : [])])
  await update($, etat, () => (lu.ok ? lu.valeur : null))
  if (lu.ok && lu.valeur.ajout && lu.valeur.cle !== (await read($, cle))) {
    await update($, enAttente, () => ({ ajout: lu.valeur.ajout, cle: lu.valeur.cle }))
  }
}

export function suivi(on: On) {
  on('session.start', async ($, e, next) => {
    await relire($)
    $.clock.every(PERIODE_MS, () => {
      void relire($)
    })
    await $.tool.register(OUTIL)
    return next(e)
  })

  on('tool.call', { tool: 'mcp__harnais__suivi' }, async ($, e) => {
    const visee = e.geste === 'ajouter-item' ? [] : [String(e.ticket)]
    const lu = await suiviMjs($, [String(e.epique), '--session', await $.session.id(), '--json', `--${String(e.geste)}`, ...visee, String(e.texte)])
    if (!lu.ok) return { deny: lu.motif }
    await update($, etat, () => lu.valeur)
    await update($, cle, () => lu.valeur.cle)
    await update($, enAttente, () => null)
    return { result: lu.valeur.ajout }
  })

  on('prompt.context', async ($, e, next) => {
    const courant = await read($, etat)
    if (!courant?.contexte) return next(e)
    await update($, cle, () => courant.cle)
    await update($, enAttente, () => null)
    return next({ ...e, blocks: [...e.blocks, { name: 'suivi', text: courant.contexte }] })
  })

  on('turn.start', async ($, e, next) => {
    const attente = await read($, enAttente)
    if (attente) {
      try {
        await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: attente.ajout }] } })
        await update($, cle, () => attente.cle)
        await update($, enAttente, () => null)
      } catch (erreur) {
        $.ui.log(`harnais, ajout du suivi non fait, reporté au tour suivant : ${String(erreur)}`, { to: 'debug' })
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const courant = await read($, etat)
    if (e.props.hasSurvey || !courant?.suivis.length) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return h(Box, { flexDirection: 'column' }, ...courant.suivis.flatMap((lie) =>
      lie.lignes.map((ligne, rang) => h(Text, { key: `${lie.epique}-${rang}`, dimColor: true }, ligne)))) as RenderElement
  })
}
