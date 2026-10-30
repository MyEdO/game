import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'

const hooks = new URL('../../.claude/skills/harnais/hooks/', import.meta.url)
const { outilsSession } = await import('./session.mjs')
const { refusSession } = await import('./session-runtime.mjs')
const definitions = outilsSession()
const refus = (raison) => ({ exitCode: 1, stdout: JSON.stringify({ refus: refusSession(new Error(raison)) }), stderr: '' })
const json = (value) => ({ exitCode: 0, stdout: JSON.stringify(value), stderr: '' })

function charger(nom, dependances) {
  const fichier = new URL(`${nom}.ts`, hooks)
  const source = readFileSync(fichier, 'utf8')
  const noms = []
  const code = stripTypeScriptTypes(source).replace(/^import \{([^}]+)\} from '([^']+)'$/gm, (_ligne, cles, module) => {
    assert.ok(module in dependances, `import inattendu ${module}`)
    return `const {${cles}} = dependances[${JSON.stringify(module)}]`
  }).replace(/export (function|const) (\w+)/g, (_texte, type, cle) => {
    noms.push(cle)
    return `${type} ${cle}`
  })
  const h = (type, props, ...children) => ({ type, props, children })
  return new Function('dependances', 'h', `${code}\nreturn {${noms.join(',')}}`)(dependances, h)
}

function banc({ demarrage = json(definitions), enregistrer = () => {} } = {}) {
  const inscriptions = []
  const appels = []
  const outils = []
  const status = []
  const toasts = []
  const logs = []
  let reponse = json({ etat: 'occupe', seq: 4 })
  const atomes = new Map()
  const sdk = {
    atom: (cle, depart) => { atomes.set(cle.key, depart); return cle.key },
    read: async (_$, cle) => atomes.get(cle),
    update: async (_$, cle, transformer) => { atomes.set(cle, transformer(atomes.get(cle))) },
  }
  const ops = charger('ops', {})
  const codex = charger('codex', { 'claude-code': sdk, './ops': ops })
  const register = charger('register', { './codex': codex, './suivi': { suivi() {} }, './vigie': { vigie() {} } }).register
  register((event, matcher, fn) => { inscriptions.push({ event, matcher, fn }) })
  const $ = {
    plugin: { root: '/depot/.claude/skills/harnais' },
    tool: { register: async (outil) => { enregistrer(outil); outils.push(outil) } },
    process: { run: async (argv, options) => {
      appels.push({ argv, options })
      if (argv.includes('outils')) {
        if (demarrage instanceof Error) throw demarrage
        return demarrage
      }
      if (reponse instanceof Error) throw reponse
      return reponse
    } },
    ui: {
      status: (texte) => status.push(texte), toast: (texte) => toasts.push(texte), log: (texte) => logs.push(texte),
      resolve: () => ({ Box: 'Box', Text: 'Text' }),
    },
  }
  const declencher = async (event, e = {}, suite = { suite: true }) => {
    const hook = inscriptions.find((h) => h.event === event && (!h.matcher.tool || h.matcher.tool === e.tool))
    assert.ok(hook, `hook ${event} ${e.tool ?? ''}`)
    return hook.fn($, e, async () => suite)
  }
  return { appels, outils, status, toasts, logs, inscriptions, atomes, declencher, repondre: (valeur) => { reponse = valeur } }
}

const sessionId = '356a6a6a-a75e-4d76-98da-09265624e77b'

test('le registre branche les trois outils décrits par le script sur toutes les surfaces sans horloge', async () => {
  const b = banc()
  assert.deepEqual(b.inscriptions.find((h) => h.event === 'session.start').matcher, { isInteractive: [true, false] })
  assert.equal(b.inscriptions.some((h) => h.event === 'clock.every'), false)
  assert.deepEqual(await b.declencher('session.start'), { suite: true })
  assert.deepEqual(b.appels[0].argv.slice(2), ['outils', '--json'])
  assert.deepEqual(b.outils, definitions.outils)
  const attendre = definitions.outils.find((o) => o.name === 'codex_attendre').inputSchema
  assert.deepEqual(attendre.required, ['sessionId'])
  assert.equal(attendre.properties.timeoutMs.maximum, 240000)
  assert.equal(attendre.properties.depuis.minimum, 0)
  assert.deepEqual(definitions.prefixesDeRefus, Object.keys((await import('../guards/lib/categorieDeRefus.mjs')).CATEGORIES_DE_REFUS).map((await import('../guards/lib/categorieDeRefus.mjs')).prefixeDeRefus))
})

test('envoyer délègue le message et requestId, avec capacité sur stdin uniquement', async () => {
  const b = banc()
  await b.declencher('session.start')
  const resultat = await b.declencher('tool.call', { tool: 'mcp__harnais__codex_envoyer', sessionId, message: 'applique ceci', jeton: 'secret-test', requestId: sessionId })
  const appel = b.appels.at(-1)
  assert.deepEqual(appel.argv.slice(2), ['envoyer', sessionId, '--message', 'applique ceci', '--request-id', sessionId, '--json'])
  assert.equal(appel.options.stdin, JSON.stringify({ jeton: 'secret-test' }))
  assert.equal(appel.argv.includes('secret-test'), false)
  assert.deepEqual(b.logs, [])
  assert.equal(resultat.result, JSON.stringify({ etat: 'occupe', seq: 4 }))
  assert.equal(b.toasts.length, 0)
  assert.equal(b.atomes.get('codex').texte, resultat.result)
  const rendu = await b.declencher('ui.render', { props: { hasSurvey: false } }, 'bandeau voisin')
  assert.equal(rendu.children[0], 'bandeau voisin')
  assert.equal(rendu.children[1].children[0], resultat.result)
  assert.deepEqual(b.status, [resultat.result])
})

test('attendre fait un seul appel natif borné, rend la transition et son toast ; etat ne notifie pas', async () => {
  const b = banc()
  await b.declencher('session.start')
  b.repondre(json({ type: 'tour-termine', rapport: { resume: 'fini' }, curseur: 7 }))
  const resultat = await b.declencher('tool.call', { tool: 'mcp__harnais__codex_attendre', sessionId, depuis: 6, timeoutMs: 240000 })
  assert.deepEqual(b.appels.at(-1).argv.slice(2), ['attendre', sessionId, '--depuis', '6', '--timeout-ms', '240000', '--json'])
  assert.ok(b.appels.at(-1).options.timeoutMs > 240000)
  assert.ok(b.appels.at(-1).options.timeoutMs <= 270000)
  assert.deepEqual(b.toasts, [resultat.result])
  assert.equal(b.appels.length, 2)
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_etat', sessionId })
  assert.deepEqual(b.appels.at(-1).argv.slice(2), ['etat', sessionId, '--json'])
  assert.equal(b.toasts.length, 1)
  assert.equal(b.appels.length, 3)
})

test('les refus natifs gardent leur catégorie ; pannes locales utilisent le refus canonique sans exposer la capacité', async () => {
  const b = banc()
  await b.declencher('session.start')
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_etat', sessionId })
  const avant = b.atomes.get('codex').texte
  for (const [reponse, attendu] of [
    [refus('[permission · non retentable] SESSION INTERDITE'), '[permission · non retentable] SESSION INTERDITE'],
    [{ exitCode: 1, stdout: '', stderr: 'Error: panne Node' }, definitions.refusTechnique],
    [{ ...json({ refus: { prefixe: 'préfixe-inconnu', raison: 'interdit' } }), exitCode: 1 }, definitions.refusTechnique],
    [{ ...json({ refus: { prefixe: definitions.prefixesDeRefus[0], raison: 42 } }), exitCode: 1 }, definitions.refusTechnique],
    [{ ...json({ refus: { prefixe: definitions.prefixesDeRefus[0] } }), exitCode: 1 }, definitions.refusTechnique],
    [{ ...json({}), exitCode: 1 }, definitions.refusTechnique],
    [{ exitCode: 1, stdout: '', stderr: '' }, definitions.refusTechnique],
    [{ exitCode: 0, stdout: 'illisible', stderr: '' }, definitions.refusTechnique],
    [json([]), definitions.refusTechnique],
    [new Error('secret-test'), definitions.refusTechnique],
  ]) {
    b.repondre(reponse)
    assert.deepEqual(await b.declencher('tool.call', { tool: 'mcp__harnais__codex_envoyer', sessionId, message: 'x', jeton: 'secret-test' }), { deny: attendu })
    assert.equal(b.atomes.get('codex').texte, avant)
  }
  assert.deepEqual(b.logs, [])
  assert.equal(b.status.length, 1)
  assert.equal(b.toasts.length, 0)
})

test('options facultatives omises, curseur zéro conservé, délai envoyer transmis', async () => {
  const b = banc()
  await b.declencher('session.start')
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_attendre', sessionId })
  assert.deepEqual(b.appels.at(-1).argv.slice(2), ['attendre', sessionId, '--json'])
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_attendre', sessionId, depuis: 0, timeoutMs: 0 })
  assert.deepEqual(b.appels.at(-1).argv.slice(2), ['attendre', sessionId, '--depuis', '0', '--timeout-ms', '0', '--json'])
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_envoyer', sessionId, jeton: 'secret-test', message: 'x', timeoutMs: 200 })
  assert.deepEqual(b.appels.at(-1).argv.slice(2), ['envoyer', sessionId, '--message', 'x', '--timeout-ms', '200', '--json'])
})

test('les arguments non textuels des outils enregistrés sont refusés avant tout effet', async () => {
  const b = banc()
  await b.declencher('session.start')
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_etat', sessionId })
  const avant = {
    etat: structuredClone(b.atomes.get('codex')),
    appels: structuredClone(b.appels),
    status: [...b.status],
    toasts: [...b.toasts],
    logs: [...b.logs],
  }
  for (const valeur of [undefined, null, 42, false, ['secret-test'], { secret: 'secret-test' }]) {
    for (const evenement of [
      { tool: 'mcp__harnais__codex_envoyer', sessionId: valeur, message: 'x', jeton: 'secret-test' },
      { tool: 'mcp__harnais__codex_envoyer', sessionId, message: valeur, jeton: 'secret-test' },
      { tool: 'mcp__harnais__codex_attendre', sessionId: valeur },
      { tool: 'mcp__harnais__codex_etat', sessionId: valeur },
      ...(valeur ? [{ tool: 'mcp__harnais__codex_envoyer', sessionId, message: 'x', requestId: valeur, jeton: 'secret-test' }] : []),
    ]) {
      assert.deepEqual(await b.declencher('tool.call', evenement), { deny: definitions.refusTechnique })
      assert.deepEqual(b.atomes.get('codex'), avant.etat)
      assert.deepEqual(b.appels, avant.appels)
      assert.deepEqual(b.status, avant.status)
      assert.deepEqual(b.toasts, avant.toasts)
      assert.deepEqual(b.logs, avant.logs)
    }
  }
})

test('startup malformé, absent ou enregistrement manqué ne rendent jamais les outils actifs', async () => {
  const variantes = [undefined, {}, { ...definitions, outils: [{}] }, { ...definitions, prefixesDeRefus: [] }, { ...definitions, refusTechnique: undefined }, { ...definitions, outils: definitions.outils.map((o) => ({ ...o, inputSchema: null })) }]
  for (const valeur of variantes) {
    const b = banc({ demarrage: valeur === undefined ? { exitCode: 1, stdout: '', stderr: 'absent' } : json(valeur) })
    await b.declencher('session.start')
    assert.equal(b.atomes.get('codex').outils, null)
    assert.deepEqual(b.outils, [])
    assert.deepEqual(await b.declencher('tool.call', { tool: 'mcp__harnais__codex_etat', sessionId }), { suite: true })
    assert.ok(b.logs[0].includes(valeur === undefined ? 'absent' : 'malformé'))
  }
  for (const b of [banc({ demarrage: new Error('non lancé') }), banc({ enregistrer: () => { throw new Error('register échoué') } })]) {
    await b.declencher('session.start')
    assert.equal(b.atomes.get('codex').outils, null)
    assert.ok(b.logs[0].includes('lancement impossible'))
  }
})

test('sans outils enregistrés le hook rend la main ; le bandeau de sondage reste celui du moteur', async () => {
  const b = banc()
  assert.deepEqual(await b.declencher('tool.call', { tool: 'mcp__harnais__codex_etat', sessionId }), { suite: true })
  await b.declencher('session.start')
  await b.declencher('tool.call', { tool: 'mcp__harnais__codex_etat', sessionId })
  assert.deepEqual(await b.declencher('ui.render', { props: { hasSurvey: true } }), { suite: true })
})
