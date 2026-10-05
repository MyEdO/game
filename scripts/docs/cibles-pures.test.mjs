// Une cible PURE de `GENERATORS` (`ciblesPures`, scripts/docs/build-all.mjs) n'est jamais commitée
// (#2203 A2) : le bloc « Cibles PURES » de .gitignore les ignore TOUTES, n'ignore RIEN d'autre, et
// l'index n'en porte aucune.
//   node --test scripts/docs/cibles-pures.test.mjs  (chaîné dans `npm run test:docs`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ciblesPures, estCiblePure, GENERATORS, renduDe } from './build-all.mjs'
import { gitDeLArbreReel } from '../test/gitDeBanc.mjs'

const ROOT = gitDeLArbreReel(undefined, { net: true })('rev-parse', '--show-toplevel')

const DEBUT = '# Cibles PURES de `GENERATORS`'
const FIN = '# fin des cibles pures'

/** Numéros (1-based) des lignes de MOTIF du bloc de .gitignore. */
function lignesDuBloc() {
  const lignes = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n')
  const debut = lignes.findIndex((l) => l.startsWith(DEBUT))
  const fin = lignes.findIndex((l, i) => i > debut && l === FIN)
  assert.ok(debut >= 0 && fin > debut, `.gitignore ne porte pas le bloc « ${DEBUT} … ${FIN} »`)
  return new Set(lignes.flatMap((l, i) => (i > debut && i < fin && l && !l.startsWith('#') ? [i + 1] : [])))
}

/** Chemin → numéro de ligne du motif de .gitignore qui l'ignore (`git check-ignore -v`), pour les
 *  seuls chemins qu'un motif de .gitignore ignore. */
function motifsQuiIgnorent(chemins) {
  let sortie
  try {
    sortie = gitDeLArbreReel(ROOT, { input: chemins.join('\0') })('-c', 'core.quotepath=false', 'check-ignore', '--no-index', '-v', '-z', '--stdin')
  } catch (e) {
    if (e.status === 1) return new Map()
    throw e
  }
  const champs = sortie.split('\0')
  const par = new Map()
  for (let i = 0; i + 3 < champs.length; i += 4) {
    const [source, ligne, , chemin] = champs.slice(i, i + 4)
    if (source === '.gitignore') par.set(chemin, Number(ligne))
  }
  return par
}

test('chaque cible pure est ignorée par une ligne du bloc, et chaque ligne du bloc en ignore une', async () => {
  const bloc = lignesDuBloc()
  // Un MOTIF de `targets` se déplie par le RENDU de son générateur (`renduDe`) : sur le disque, ses
  // cibles n'existent qu'après `docs:build`, que le job `docs-tests` de ci.yml ne joue pas.
  const aMotif = GENERATORS.filter((g) => g.targets.some((t) => t.includes('*')))
  const rendues = (await Promise.all(aMotif.map(async (g) => [...(await renduDe(g)).keys()]))).flat()
  const cibles = [...new Set([...ciblesPures(ROOT), ...rendues.filter((c) => estCiblePure(c, GENERATORS))])]
  const par = motifsQuiIgnorent(cibles)
  assert.deepEqual(cibles.filter((c) => !bloc.has(par.get(c))), [], 'cible(s) pure(s) hors du bloc de .gitignore')
  const utilisees = new Set(cibles.map((c) => par.get(c)))
  assert.deepEqual([...bloc].filter((n) => !utilisees.has(n)), [], 'ligne(s) du bloc qui n’ignorent aucune cible pure')
})

test('le bloc n’ignore rien d’autre qu’une cible pure', () => {
  const bloc = lignesDuBloc()
  const cibles = new Set(ciblesPures(ROOT))
  const candidats = gitDeLArbreReel(ROOT)('-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--others', '--', 'src', 'docs').split('\0').filter(Boolean)
  const par = motifsQuiIgnorent(candidats)
  assert.deepEqual(candidats.filter((c) => bloc.has(par.get(c)) && !cibles.has(c)), [])
})

test('l’index ne porte aucune cible pure', () => {
  const suivies = gitDeLArbreReel(ROOT)('-c', 'core.quotepath=false', 'ls-files', '-z', '--cached', '--', ...ciblesPures(ROOT)).split('\0').filter(Boolean)
  assert.deepEqual(suivies, [], 'git rm --cached -- $(node scripts/docs/build-all.mjs --cibles-pures)')
})
