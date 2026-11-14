// Une cible PURE de `GENERATORS` (`ciblesPures`, scripts/docs/build-all.mjs) n'est jamais commitée
// (#2203 A2) : le bloc « Cibles PURES » de .gitignore les ignore TOUTES, n'ignore RIEN d'autre, et
// l'index n'en porte aucune.
//   node --test scripts/docs/cibles-pures.test.mjs  (chaîné dans `npm run test:docs`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { blocDesCiblesPures, ciblesPures, estCiblePure, GENERATORS, ignoresHorsCibles, motifsQuiIgnorent, renduDe } from './build-all.mjs'
import { gitDeLArbreReel } from '../test/gitDeBanc.mjs'

const ROOT = gitDeLArbreReel(undefined, { net: true })('rev-parse', '--show-toplevel')

test('chaque cible pure est ignorée par une ligne du bloc, et chaque ligne du bloc en ignore une', async () => {
  const bloc = new Set(blocDesCiblesPures(ROOT).keys())
  assert.ok(bloc.size > 0, '.gitignore ne porte pas le bloc « Cibles PURES »')
  // Un MOTIF de `targets` se déplie par le RENDU de son générateur (`renduDe`) : sur le disque, ses
  // cibles n'existent qu'après `docs:build`, que le job `docs-tests` de ci.yml ne joue pas.
  const aMotif = GENERATORS.filter((g) => g.targets.some((t) => t.includes('*')))
  const rendues = (await Promise.all(aMotif.map(async (g) => [...(await renduDe(g)).keys()]))).flat()
  const cibles = [...new Set([...ciblesPures(ROOT), ...rendues.filter((c) => estCiblePure(c, GENERATORS))])]
  const par = motifsQuiIgnorent(ROOT, cibles)
  assert.deepEqual(cibles.filter((c) => !bloc.has(par.get(c))), [], 'cible(s) pure(s) hors du bloc de .gitignore')
  const utilisees = new Set(cibles.map((c) => par.get(c)))
  assert.deepEqual([...bloc].filter((n) => !utilisees.has(n)), [], 'ligne(s) du bloc qui n’ignorent aucune cible pure')
})

test('le bloc n’ignore rien d’autre qu’une cible pure', () => {
  const candidats = gitDeLArbreReel(ROOT)('-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--others', '--', 'src', 'docs').split('\0').filter(Boolean)
  assert.deepEqual(ignoresHorsCibles(ROOT, candidats), [])
})

test('l’index ne porte aucune cible pure', () => {
  const suivies = gitDeLArbreReel(ROOT)('-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--', ...ciblesPures(ROOT)).split('\0').filter(Boolean)
  assert.deepEqual(suivies, [], 'git rm --cached -- $(node scripts/docs/build-all.mjs --cibles-pures)')
})
