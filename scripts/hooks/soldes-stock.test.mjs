// CLIQUET (node --test) — stock des soldes déjà écrits qui ROUTENT plus d'un reste.
//
// Le plafond « un seul reste routé » (skill orchestrer § Fermeture) entre en vigueur pour les
// fermetures À VENIR ; les soldes déjà committés le violent 25 fois. Ce stock est figé NOMINATIVEMENT
// et ne peut que DÉCROÎTRE : aucun nom neuf, aucun compte qui remonte. Il se mesure avec la fonction
// du garde lui-même (`restesRoutants`), jamais avec un grep parallèle qui dériverait d'elle.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { restesRoutants } from '../git-hooks/porte-du-commit.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SOLDES = join(RACINE, '.claude', 'soldes')

/** Stock MESURÉ le 2026-09-02 sur `.claude/soldes/*.md` : `<fiche>: <restes routés>`. */
const STOCK = {
  1548: 17, 1457: 11, 1553: 7, 541: 6, 732: 6, 733: 6, 1552: 5, 729: 5, 1640: 4, 734: 4,
  '1225-tranche1': 3, 510: 3, 513: 3, 543: 3, 684: 3, 717: 3,
  1592: 2, 1633: 2, 419: 2, 508: 2, 514: 2, 516: 2, 606: 2, 677: 2, 900: 2,
}

/** Mesure courante : `{ <fiche>: <restes routés> }` pour les fiches au-dessus du plafond. */
function mesure() {
  const compte = {}
  for (const f of readdirSync(SOLDES).filter((n) => n.endsWith('.md')).sort()) {
    const n = restesRoutants(readFileSync(join(SOLDES, f), 'utf8')).length
    if (n > 1) compte[f.replace(/\.md$/, '')] = n
  }
  return compte
}

test('CLIQUET soldes : aucune fiche NEUVE au-dessus du plafond d\'un reste routé', () => {
  const courant = mesure()
  const neufs = Object.keys(courant).filter((k) => !(k in STOCK))
  assert.deepEqual(
    neufs, [],
    `soldes hors stock qui routent plus d'un reste : ${neufs.map((k) => `${k}:${courant[k]}`).join(' ')} — ` +
    'une fermeture ne route qu\'UN reste (le lot grossit, ou le ticket reste ouvert).',
  )
})

test('CLIQUET soldes : le stock DÉCROÎT, jamais l\'inverse', () => {
  const courant = mesure()
  const remontees = Object.entries(courant).filter(([k, n]) => k in STOCK && n > STOCK[k])
  assert.deepEqual(
    remontees, [],
    `restes routés en hausse sur des fiches du stock : ${remontees.map(([k, n]) => `${k} ${STOCK[k]}→${n}`).join(', ')}`,
  )
  const soldees = Object.keys(STOCK).filter((k) => !(k in courant))
  assert.deepEqual(
    soldees, [],
    `fiches sorties du stock — retirer ces entrées de STOCK dans le même commit : ${soldees.join(', ')}`,
  )
})
