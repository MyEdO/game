// LA SUITE D'UNE ZONE sur l'arbre réel (#5037 L2) : pour chaque projet de `COUCHES`, la sélection contient chaque test
// du projet et chaque test dont la clôture d'imports atteint le projet ou la porte des projets ; une zone qui n'est pas
// un projet joue la suite entière.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { COUCHES, dossierDe, estProjet } from '../guards/lib/couches.mjs'
import { arbreDuDisque, clotureDImports } from '../guards/lib/importGraph.mjs'
import { TRAVAIL, depotDe, listerImage } from '../guards/lib/gitPorte.mjs'
import { porteDeTousLesProjets } from '../guards/lib/porteDesProjets.mjs'
import { suiteVitestDuDepot } from '../guards/lib/suiteVitest.mjs'
import { PORTE, selectionDeLaZone } from './selectionDeZone.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '').split('\\').join('/')
const suite = suiteVitestDuDepot(RACINE)
const projets = Object.keys(COUCHES).filter(estProjet)

/** La clôture de chaque test de la suite, parcourue en avant test par test sur le graphe d'une seule marche : l'oracle,
 *  indépendant de la remontée de la sélection. */
function cloturesParTest() {
  const arbre = arbreDuDisque(listerImage(depotDe(RACINE, { porte: porteDeTousLesProjets }), TRAVAIL).map((f) => `${RACINE}/${f}`))
  const cache = new Map()
  clotureDImports(suite, { racine: RACINE, typesEffaces: true, cache, arbre, porte: porteDeTousLesProjets })
  const relatif = (a) => a.slice(RACINE.length + 1)
  return new Map(suite.map((t) => {
    const vus = new Set()
    for (const pile = [`${RACINE}/${t}`]; pile.length;) {
      const a = pile.pop()
      if (vus.has(a)) continue
      vus.add(a)
      for (const { cible } of cache.get(a) ?? []) pile.push(cible)
    }
    return [t, new Set([...vus].map(relatif))]
  }))
}

test('chaque projet : la sélection contient ses tests et chaque test dont la clôture atteint le projet ou la porte', () => {
  assert.ok(projets.length >= 2, `projets lus : ${projets.join(', ')}`)
  const clotures = cloturesParTest()
  for (const zone of projets) {
    const dossier = `${dossierDe(zone)}/`
    const { fichiers, entiere } = selectionDeLaZone({ racine: RACINE, suite, zone })
    assert.equal(entiere, null, `${zone} : la sélection joue la suite entière`)
    assert.ok(fichiers.length < suite.length, `${zone} : ${fichiers.length} fichier(s) sur ${suite.length}`)
    const retenus = new Set(fichiers)
    const attendus = suite.filter((t) => t.startsWith(dossier) || [...clotures.get(t)].some((m) => m === PORTE || m.startsWith(dossier)))
    assert.ok(attendus.some((t) => !t.startsWith(dossier)), `${zone} : aucun lecteur hors du projet, le cas ne mesure rien`)
    assert.deepEqual(attendus.filter((t) => !retenus.has(t)), [], `${zone} : lecteurs absents de la sélection`)
  }
})

test('une zone qui n’est pas un projet joue la suite entière', () => {
  const zone = Object.keys(COUCHES).find((z) => !estProjet(z))
  const { fichiers, entiere } = selectionDeLaZone({ racine: RACINE, suite, zone })
  assert.match(entiere ?? '', /n’est pas un projet/)
  assert.deepEqual(fichiers, suite)
})
