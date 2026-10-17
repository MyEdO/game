import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEUILLES, manquementsDeFeuilles } from '../../guards/lib/modulesFeuilles.mjs'

test('CLIQUET : le module qui FERME est une FEUILLE — aucune source suivie ne l’acquiert par un spécificateur LITTÉRAL', () => {
  // Un import suffit à mettre le geste à portée d'appel, et aucune lecture d'argv ne voit un appel
  // indirect. La mesure est GÉNÉRALE et vit dans `scripts/guards/lib/modulesFeuilles.mjs` — un
  // prédicat écrit ici rate les graphies qu'il n'a pas imaginées (multi-ligne, dynamique, ré-export,
  // chemin sans extension, `require`/`createRequire`). CE QU'ELLE PROUVE, et le titre s'y borne :
  // les acquisitions dont le spécificateur est un LITTÉRAL. Un chemin passé par variable n'est
  // lisible par aucune analyse statique.
  const vu = manquementsDeFeuilles()
  assert.deepEqual(vu.manquements, [])
  assert.ok(FEUILLES.some((f) => f.module === 'scripts/ops/fermer-depuis-main.mjs'), 'ce module est DÉCLARÉ feuille')
  assert.ok(vu.sourcesLues > 1000, `la garde ne lit plus les sources du dépôt (${vu.sourcesLues})`)
})
