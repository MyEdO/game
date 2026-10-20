import test from 'node:test'
import assert from 'node:assert/strict'
import { rendre } from './build-icones.mjs'
import { REGISTRIES } from './lib/cibles-registres.mjs'

test('rendu des icônes depuis les métadonnées canoniques, avec attribution de leur source', () => {
  const entree = REGISTRIES.find(r => r.arrayName === 'ICON_FAMILIES')
  const lire = (e) => rendre(e).get('docs/ajouter-une-icone.md')
  const texte = lire()
  assert.ok(texte.includes('`ICON_FAMILIES` de `scripts/docs/lib/cibles-registres.mjs`'))
  assert.ok(texte.includes(`Réécrit \`${entree.out}\``))
  assert.ok(texte.includes(`dans \`${entree.idUnion.out}\`, son\nunion de littéraux \`${entree.idUnion.typeName}\``))
  const fixture = { ...entree, out: 'preuve/registre-icones.ts', idUnion: { ...entree.idUnion, typeName: 'UnionIconesPreuve' } }
  const modifie = lire(fixture)
  assert.ok(modifie.includes('Réécrit `preuve/registre-icones.ts`'))
  assert.ok(modifie.includes('union de littéraux `UnionIconesPreuve`'))
  assert.ok(modifie.includes('`scripts/gen-registry.mjs`, entrée `ICON_FAMILIES` de `scripts/docs/lib/cibles-registres.mjs`'))
})
