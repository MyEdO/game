import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, RenderElement } from 'claude-code'
import type { HarnaisCodex } from '../types'
import { appel, lire, outilsCodex, refusNatif } from './ops'

const atome = atom({ plugin: 'harnais', key: 'codex' } as const, { outils: null, texte: null } as HarnaisCodex)
const BORNE_MS = 265 * 1000

async function executer($: EngineInterface, args: readonly unknown[], stdin?: string) {
  const { outils } = await read($, atome)
  if (!outils) return null
  if (!args.every((arg): arg is string => typeof arg === 'string')) return { deny: outils.refusTechnique }
  try {
    const lu = lire<Record<string, unknown>>(await $.process.run(...appel($.plugin.root, 'session', args, { borneMs: BORNE_MS, stdin })), { codes: [0, 1, 3] })
    if (!lu.ok) return { deny: outils.refusTechnique }
    if (lu.echec || 'refus' in lu.valeur) return { deny: refusNatif(lu.valeur, outils.prefixesDeRefus) ?? outils.refusTechnique }
    const texte = JSON.stringify(lu.valeur)
    await update($, atome, (etat) => ({ ...etat, texte }))
    $.ui.status(texte)
    return { result: texte }
  } catch {
    return { deny: outils.refusTechnique }
  }
}

export function codex(on: On) {
  on('session.start', { isInteractive: [true, false] }, async ($, e, next) => {
    await update($, atome, (etat) => ({ ...etat, outils: null }))
    try {
      const lu = outilsCodex(lire(await $.process.run(...appel($.plugin.root, 'session', ['outils', '--json']))))
      if (lu.ok) {
        for (const outil of lu.valeur.outils) await $.tool.register(outil)
        await update($, atome, (etat) => ({ ...etat, outils: lu.valeur }))
      } else $.ui.log(`harnais, outils Codex : ${lu.motif}`, { to: 'debug' })
    } catch {
      $.ui.log('harnais, outils Codex : lancement impossible', { to: 'debug' })
    }
    return next(e)
  })

  on('tool.call', { tool: 'mcp__harnais__codex_envoyer' }, async ($, e, next) => (await executer($,
    ['envoyer', e.sessionId, '--message', e.message, ...(e.requestId ? ['--request-id', e.requestId] : []), ...(e.timeoutMs === undefined ? [] : ['--timeout-ms', String(e.timeoutMs)]), '--json'], JSON.stringify({ jeton: e.jeton }))) ?? next(e))

  on('tool.call', { tool: 'mcp__harnais__codex_attendre' }, async ($, e, next) => {
    const resultat = await executer($, ['attendre', e.sessionId, ...(e.depuis === undefined ? [] : ['--depuis', String(e.depuis)]), ...(e.timeoutMs === undefined ? [] : ['--timeout-ms', String(e.timeoutMs)]), '--json'])
    if (resultat && 'result' in resultat && typeof resultat.result === 'string') $.ui.toast(resultat.result)
    return resultat ?? next(e)
  })

  on('tool.call', { tool: 'mcp__harnais__codex_etat' }, async ($, e, next) => (await executer($, ['etat', e.sessionId, '--json'])) ?? next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { texte } = await read($, atome)
    if (e.props.hasSurvey || !texte) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const suite = await next(e)
    return h(Box, { flexDirection: 'column' }, suite, h(Text, { dimColor: true }, texte)) as RenderElement
  })
}
