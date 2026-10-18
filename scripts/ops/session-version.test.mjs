import test from 'node:test'
import assert from 'node:assert/strict'
import { comparerVersions, verifierVersionCodex } from './session-version.mjs'

test('version Codex : comparaison semver et préversions', () => {
  assert.equal(comparerVersions('0.163.0+build.1', '0.163.0+build.2'), 0)
  for (const invalide of ['0.163.0-01', '0.163.0-alpha..1', '01.163.0', '0.163.0+']) assert.throws(() => comparerVersions(invalide, '0.163.0'), /VERSION CODEX INVALIDE/)
  for (const [a, b] of [['0.9.0', '0.10.0'], ['0.163.0-rc.2', '0.163.0-rc.10'], ['0.163.0-rc.1', '0.163.0'], ['0.163.0-1', '0.163.0-alpha']]) {
    assert.equal(comparerVersions(a, b), -1)
    assert.equal(comparerVersions(b, a), 1)
    assert.equal(comparerVersions(a, a), 0)
  }
})

test('version Codex : retard refuse la même executable avant tout lancement', async () => {
  const executable = 'C:/propre/codex.exe'
  const executer = (exe, args, options) => {
    assert.equal(exe, executable); assert.deepEqual(args, ['--version']); assert.equal(options.shell, false); assert.ok(options.timeout <= 10_000)
    return { status: 0, stdout: 'codex-cli 0.162.1\n' }
  }
  const fetcher = async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/@openai%2fcodex/latest'); assert.ok(options.signal)
    return { ok: true, json: async () => ({ version: '0.163.0' }) }
  }
  await assert.rejects(verifierVersionCodex(executable, { executer, fetcher }), /\[validation · non retentable\].*npm install -g @openai\/codex@latest/)
})

test('version Codex : récente acceptée, panne et timeout registre avertissent et poursuivent sous borne', async () => {
  const executer = () => ({ status: 0, stdout: 'codex-cli 0.163.0' })
  assert.deepEqual(await verifierVersionCodex('codex.exe', { executer, fetcher: async () => ({ ok: true, json: async () => ({ version: '0.163.0' }) }) }), { locale: '0.163.0', derniere: '0.163.0' })
  for (const fetcher of [async () => { throw new Error('hors ligne') }, () => new Promise(() => {})]) {
    const avertissements = [], debut = Date.now()
    const resultat = await verifierVersionCodex('codex.exe', { executer, fetcher, timeoutMs: 10, avertir: (m) => avertissements.push(m) })
    assert.equal(resultat.derniere, null); assert.ok(Date.now() - debut < 1000)
    assert.match(avertissements[0], /^\[transitoire · retentable\] REGISTRE CODEX INJOIGNABLE/)
  }
  for (const vu of [{ status: 1, stderr: 'native' }, { status: 0, stdout: 'autre 0.163.0' }]) await assert.rejects(verifierVersionCodex('codex.exe', { executer: () => vu, fetcher: () => assert.fail('réseau atteint') }), /\[validation · non retentable\]/)
})
