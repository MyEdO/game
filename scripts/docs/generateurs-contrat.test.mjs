// Contrat de `GENERATORS` (scripts/docs/build-all.mjs, #2203) : chaque générateur exporte `rendre`, et
// IMPORTER son script n'écrit rien dans l'arbre — il n'écrit que sous sa porte `import.meta.main`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre } from '../guards/lib/lister.mjs'
import { chargerGenerateur, GENERATORS } from './build-all.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const HORS_ARBRE = new Set(['node_modules', '.git'])

/** Chemin relatif → `taille:mtime` de chaque fichier de l'arbre de travail. */
const instantane = () => new Map(
  listerArbre(RACINE, { descendre: (rel) => !HORS_ARBRE.has(rel.slice(rel.lastIndexOf('/') + 1)) }).map((rel) => {
    const s = statSync(join(RACINE, rel))
    return [rel, `${s.size}:${s.mtimeMs}`]
  }),
)

const ecartsDe = (avant, apres) => [
  ...[...apres].filter(([k, v]) => avant.get(k) !== v).map(([k]) => (avant.has(k) ? `modifié ${k}` : `créé ${k}`)),
  ...[...avant.keys()].filter((k) => !apres.has(k)).map((k) => `supprimé ${k}`),
]

test('GENERATORS : chaque générateur exporte `rendre`, et son import n’écrit rien dans l’arbre', async () => {
  const avant = instantane()
  const sansRendre = []
  for (const g of GENERATORS) if (typeof (await chargerGenerateur(g)).rendre !== 'function') sansRendre.push(g.script)
  assert.deepEqual(sansRendre, [], 'générateur(s) sans `rendre` exporté')
  assert.deepEqual(ecartsDe(avant, instantane()), [], 'l’import des générateurs a écrit dans l’arbre')
})
