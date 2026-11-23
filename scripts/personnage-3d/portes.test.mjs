// Les portes des presets touchés (#4814) : éléments changés, presets touchés et commandes de leur porte, sur fixtures.
import test from 'node:test'
import assert from 'node:assert/strict'
import { elementsChanges, portesDuPreset, presetsTouches } from './portes.mjs'

const [A, B, C] = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]
const CAPE = 'humanoide--vetement--cape'
const DAGUE = 'humanoide--rigide--dague'
const NEUF = 'humanoide--accessoire--neuf'
const element = (sha, base = 'humanoide') => ({ schema: 3, base, glb: { sha256: sha, octets: 1 } })

test('elementsChanges retient les éléments sur base dont l’empreinte change, neufs compris, et rien d’autre', () => {
  const avant = { [CAPE]: element(A), [DAGUE]: element(B), 'decor--tonneau': { schema: 3, glb: { sha256: A } }, 'humanoide--vetement--retiree': element(C) }
  const apres = { [CAPE]: element(C), [DAGUE]: element(B), [NEUF]: element(A), 'decor--tonneau': { schema: 3, glb: { sha256: B } }, 'humanoide--vetement--retiree': null }
  assert.deepEqual(elementsChanges(avant, apres), [
    { id: NEUF, base: 'humanoide', avant: null },
    { id: CAPE, base: 'humanoide', avant: A },
  ])
})

test('presetsTouches garde, par tenue, les ids changés qu’elle monte sur leur base, une fois chacun', () => {
  const changes = [{ id: CAPE, base: 'humanoide', avant: A }, { id: DAGUE, base: 'humanoide', avant: B }]
  const tenues = [
    { preset: 'pretre', base: 'humanoide', ids: ['humanoide--tete--humain', CAPE] },
    { preset: 'soldat', base: 'humanoide', ids: [DAGUE, 'humanoide--vetement--bottes', DAGUE, CAPE] },
    { preset: 'mendiant', base: 'humanoide', ids: ['humanoide--vetement--bure'] },
    { preset: 'navire', base: 'vehicule', ids: [CAPE] },
  ]
  assert.deepEqual(presetsTouches(tenues, changes), [
    { preset: 'pretre', base: 'humanoide', ids: [CAPE] },
    { preset: 'soldat', base: 'humanoide', ids: [DAGUE, CAPE] },
  ])
})

const BASE = { glb: 'm/humanoide.glb', manifeste: 'm/humanoide.manifeste.json' }
const COMMUNE = ['hotes/godot/asset/evaluer.mjs', '--tenue', 'soldat', '--base', BASE.glb, '--manifeste', BASE.manifeste, '--porte', '--portee']

test('portesDuPreset : le témoin monte le GLB de main de l’élément du manifeste, la mesure le GLB local, sous la même portée', () => {
  const changes = [{ id: CAPE, base: 'humanoide', avant: A }, { id: DAGUE, base: 'humanoide', avant: B }]
  assert.deepEqual(portesDuPreset({ preset: 'soldat', base: 'humanoide', ids: [DAGUE, CAPE] }, { base: BASE, changes, temoins: { [CAPE]: '/t/cape.glb' }, locaux: { [DAGUE]: '/l/dague.glb' }, sortie: '/t' }), {
    temoin: [...COMMUNE, `${DAGUE},${CAPE}`, '--local', `${CAPE}=/t/cape.glb`, '--json', '/t/soldat.temoin.json'],
    mesure: [...COMMUNE, `${DAGUE},${CAPE}`, '--local', `${DAGUE}=/l/dague.glb`, '--temoin', '/t/soldat.temoin.json'],
  })
})

test('portesDuPreset : un élément absent de main ôte le témoin, et la mesure rend tous les écarts de la portée', () => {
  const changes = [{ id: NEUF, base: 'humanoide', avant: null }, { id: CAPE, base: 'humanoide', avant: A }]
  assert.deepEqual(portesDuPreset({ preset: 'soldat', base: 'humanoide', ids: [NEUF, CAPE] }, { base: BASE, changes, temoins: { [CAPE]: '/t/cape.glb' }, locaux: {}, sortie: '/t' }), {
    temoin: null,
    mesure: [...COMMUNE, `${NEUF},${CAPE}`],
  })
})
