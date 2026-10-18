// CLÔTURE des ÉTAPES du train (#1806), gardée contre une retouche de bonne foi : une étape n'atteint
// aucun LANCEMENT de processus hors de son contexte.
//   node --test scripts/corpus/ops/etapesDuTrain.test.mjs   (chaîné dans `npm run test:corpus`)
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { ETAPES, posix, lectureDe, lanceursDeLaCloture, clotureDesEtapes } from '../../test/lib/bancEtapesDuTrain.mjs'
const LANCEURS = lanceursDeLaCloture(clotureDesEtapes())

test('le module des ÉTAPES n’acquiert aucune liaison qui atteint un lancement, depuis aucun module', () => {
  const { lectures, locaux } = LANCEURS
  const lu = lectures.get(posix(ETAPES))
  assert.ok(lu.imports.length > 0, 'les imports des étapes se lisent')
  const fautes = [
    ...lu.imports.filter((i) => locaux.get(posix(ETAPES)).has(i.local))
      .map((i) => `importe ${i.nom === '*' ? `* as ${i.local}` : i.nom} de ${i.abs ? posix(i.abs) : i.integre ? `node:${i.integre}` : 'un paquet'}`),
    ...lu.reexports.map((r) => `ré-exporte ${r.exporte}`),
    ...lu.dynamiques.map((d) => `charge dynamiquement : ${d}`),
  ]
  assert.deepEqual(fautes, [], 'une étape ne tient que son contexte : un lanceur y exprimerait un geste non nommé')
})

test('le module des ÉTAPES ne mentionne aucun accès qui ouvre un module intégré, ni aucun accès ambiant', () => {
  const { mentions, ambiants } = lectureDe(ETAPES)
  assert.deepEqual({ mentions, ambiants }, { mentions: [], ambiants: [] })
})

const HOTE = fileURLToPath(new URL('../../guards/lib/gitPorte.mjs', import.meta.url))
test('le point fixe voit les lanceurs de la clôture : questions et écrivains de l’hôte, `coursesCi`, `execFileResilient`, `appelGhRunner`', () => {
  const { exportsLanceurs, locaux } = LANCEURS
  const hote = exportsLanceurs.get(posix(HOTE))
  assert.ok(hote, 'la clôture lit bien l’hôte git : sinon ce test ne mesure rien')
  for (const nom of ['lancer', 'interroger', 'lire', 'ecrire']) assert.ok(locaux.get(posix(HOTE)).has(nom), `${nom} atteint un lancement`)
  for (const nom of ['commitDe', 'pousser', 'fusionner', 'shaDe', 'ceQuiChange', 'listerImage', 'journalDe'])
    assert.ok(hote.has(nom), `${nom} manque aux lanceurs de l’hôte : ${[...hote].join(', ')}`)
  for (const nom of ['TRONC', 'reussi', 'raisonCourte', 'urlOrigineAcceptee']) assert.ok(!hote.has(nom), `${nom} est un pur`)
  const de = (rel) => exportsLanceurs.get(posix(resolve(rel))) ?? new Set()
  assert.ok(de('scripts/guards/lib/coursesCi.mjs').has('coursesCi'))
  assert.ok(de('scripts/guards/lib/spawnResilient.mjs').has('execFileResilient'))
  assert.ok(de('scripts/guards/lib/ticketsGh.mjs').has('appelGhRunner'))
  assert.ok(de('scripts/lancer-local.mjs').has('sortieOutilLocal'))
})
