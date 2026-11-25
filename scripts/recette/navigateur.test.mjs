// `refusDuNavigateur` (navigateur.mjs) ne laisse passer que le `Chrome/<version>` d'`EPINGLE` sous Linux x86-64, et
// nomme sinon ce qu'il a lu, ce qu'il attend et la commande d'installation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EPINGLE, refusDuNavigateur } from './navigateur.mjs'

const LINUX = { plateforme: 'linux', architecture: 'x64' }

test('laisse passer le Chrome épinglé sous Linux x86-64', () => {
  assert.equal(refusDuNavigateur(`Chrome/${EPINGLE.chrome}`, LINUX), null)
})

test('refuse un autre binaire à la version épinglée', () => {
  assert.match(refusDuNavigateur(`HeadlessChrome/${EPINGLE.chrome}`, LINUX), new RegExp(`HeadlessChrome/${EPINGLE.chrome} sous linux-x64`))
})

test('refuse un autre build, en nommant ce qu’il a lu, ce qu’il attend et la commande d’installation', () => {
  const refus = refusDuNavigateur('HeadlessChrome/152.0.7000.1', LINUX)
  for (const attendu of ['HeadlessChrome/152.0.7000.1 sous linux-x64', `Chrome ${EPINGLE.chrome} sous linux-x64`,
    `PLAYWRIGHT_BROWSERS_PATH=<dossier> npx -y playwright@${EPINGLE.playwright} install chromium`]) assert.ok(refus.includes(attendu), attendu)
})

test('refuse le build épinglé sur une autre plateforme', () => {
  assert.ok(refusDuNavigateur(`Chrome/${EPINGLE.chrome}`, { plateforme: 'win32', architecture: 'x64' }).includes(`Chrome/${EPINGLE.chrome} sous win32-x64`))
  assert.ok(refusDuNavigateur(`Chrome/${EPINGLE.chrome}`, { plateforme: 'linux', architecture: 'arm64' }).includes('sous linux-arm64'))
})
