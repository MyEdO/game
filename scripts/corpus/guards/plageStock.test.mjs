import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { PORTE_DE_PLAGE, croissancesDeLaPlage, lectureDeLaPlage, refusDeLaPlage } from '../../guards/lib/plageStock.mjs'
import { TRONC } from '../../guards/lib/gitPorte.mjs'
import { gitDe } from '../../test/gitDeBanc.mjs'
const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const MODULE_PORTE = PORTE_DE_PLAGE.module
test('#2503 ÈRE SANS la porte, données réelles : `a9b7edf17` poussé sur le tronc `da3acf95c^` rend les refus de la porte actuelle', async () => {
  const sha = (ref) => gitDe(RACINE)('rev-parse', ref).trim()
  const plage = { cwd: RACINE, debut: sha('da3acf95c^'), fin: sha('a9b7edf17'), vers: TRONC.branche }
  const actuelle = refusDeLaPlage(lectureDeLaPlage(plage)).map((r) => [r.sha, r.fichier, r.net, r.declare])
  assert.ok(actuelle.length, 'témoin : la porte actuelle refuse cette plage')
  const vu = await croissancesDeLaPlage(plage)
  assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.declare]), actuelle)
  assert.ok(vu.notes.some((n) => n.includes(`sans la porte \`${MODULE_PORTE}\``)), vu.notes.join('\n'))
})
