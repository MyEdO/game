// Contrat de `litteralJs` (node --test) : `eval` du littéral rend la valeur, pour chaque caractère
// échappé. Garde de la construction `ECHAPPEUR_DE_LITTERAL` sur le périmètre des gardes : l'échappeur
// du guillemet simple écrit à la main hors de `litteralJs.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { litteralJs } from './litteralJs.mjs'
import { constructionsReserveesDuCorpus, scanConstructionsReservees, ECHAPPEUR_DE_LITTERAL } from './canonUnique.mjs'
import { corpusDesGardes } from './commentPoison.mjs'

const ECHAPPEUR = { ...ECHAPPEUR_DE_LITTERAL, foyer: 'scripts/guards/lib/litteralJs.mjs' }
const L2028 = String.fromCharCode(0x2028)
const L2029 = String.fromCharCode(0x2029)

test('litteralJs : antislash, guillemet, sauts de ligne, U+2028 et U+2029 — `eval` rend la valeur', () => {
  for (const v of ['a\\b', "l'arme", 'a\nb', 'a\rb', `a${L2028}b`, `a${L2029}b`, '', 'sans rien']) {
    const lit = litteralJs(v)
    assert.equal(lit[0], "'")
    assert.equal(lit.at(-1), "'")
    assert.equal((0, eval)(lit), v, JSON.stringify(v))
  }
  assert.equal(litteralJs(L2028).includes(L2028), false, 'U+2028 brut ne reste pas dans le littéral')
})

test('ECHAPPEUR_DE_LITTERAL : aucun échappeur du guillemet simple écrit hors de `litteralJs.mjs`', () => {
  assert.deepEqual(constructionsReserveesDuCorpus(corpusDesGardes(), [ECHAPPEUR]), [])
})

test('ECHAPPEUR_DE_LITTERAL : une recopie neuve hors du foyer est un site, la même dans le foyer ne l’est pas', () => {
  const texte = "const lit = (v) => `'${v.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, \"\\\\'\")}'`\n"
  const vu = (rel) => scanConstructionsReservees({ rel, text: texte }, [ECHAPPEUR]).map((t) => t.construction)
  assert.deepEqual(vu('scripts/fixture.mjs'), ['ECHAPPEUR_DE_LITTERAL'])
  assert.deepEqual(vu('scripts/guards/lib/litteralJs.mjs'), [])
})
