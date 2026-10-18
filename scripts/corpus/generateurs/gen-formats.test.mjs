// `gen-formats.mjs` (#2404) : le format d'une donnée persistée est STABLE (entre processus, entre ordres
// de chargement, indépendant des ids internes), SENSIBLE (un champ optionnel ajouté, un type de champ
// changé le changent) et TOTAL (any/unknown et drapeau non traité échouent, chemin nommé).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RACINES, calculerFormats, defsDeSequence } from '../../gen-formats.mjs'
import { readCorpus } from '../../guards/lib/sourceCorpus.mjs'
import { parConstante } from '../../test/lib/bancFormats.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

const BASE = parConstante(calculerFormats())

test('stable entre deux processus', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import { calculerFormats } from './scripts/gen-formats.mjs'; process.stdout.write(JSON.stringify(calculerFormats()))"], { cwd: RACINE, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(parConstante(JSON.parse(r.stdout)), BASE)
})

test('stable entre deux racines de programme qui chargent les fichiers dans des ordres différents', () => {
  const autreOrdre = calculerFormats({
    racines: [...RACINES].reverse(),
    avant: ['src/state/traceLayer.ts', 'src/ui/creator/draft.ts', 'src/engine/types.ts', 'src/state/store.ts'],
  })
  assert.deepEqual(parConstante(autreOrdre), BASE)
})

test('sensible : un champ optionnel ajouté, un type de champ changé', () => {
  const types = readFileSync(new URL('../../../src/engine/types.ts', import.meta.url), 'utf8')
  assert.ok(types.includes('export interface Combatant {'))
  const avecChamp = parConstante(calculerFormats({
    recouvrement: { 'src/engine/types.ts': types.replace('export interface Combatant {', 'export interface Combatant {\n  zzNouveau?: number;') },
  }))
  for (const c of ['FORMAT_SAVE', 'FORMAT_ROSTER', 'FORMAT_EXPORT_HEROS']) assert.notEqual(avecChamp[c], BASE[c], c)
  assert.equal(avecChamp.FORMAT_CALQUE, BASE.FORMAT_CALQUE)

  const calque = readFileSync(new URL('../../../src/state/traceLayer.ts', import.meta.url), 'utf8')
  assert.ok(calque.includes('  opacity: number;'))
  const autreType = parConstante(calculerFormats({ recouvrement: { 'src/state/traceLayer.ts': calque.replace('  opacity: number;', '  opacity: string;') } }))
  assert.notEqual(autreType.FORMAT_CALQUE, BASE.FORMAT_CALQUE)
  assert.equal(autreType.FORMAT_SAVE, BASE.FORMAT_SAVE)
})

test('FORMAT_SAVE couvre CHAQUE famille de séquence de production : les `def` vus par le générateur sont les ids des `registerSequence(` de src hors tests', () => {
  const corpus = readCorpus(['src'])
  const constantes = new Map(corpus.flatMap((f) => [...f.text.matchAll(/export const (\w+) = '([^']+)'/g)].map((m) => [m[1], m[2]])))
  const ids = corpus.flatMap((f) => [...f.text.matchAll(/registerSequence\(\s*(?:'([^']+)'|(\w+))/g)]
    .map((m) => m[1] ?? constantes.get(m[2]) ?? `${f.rel} : ${m[2]} non résolu`))
  assert.ok(ids.length > 0, 'aucun site `registerSequence(` lu : la garde ne mesurerait rien')
  assert.deepEqual(defsDeSequence(), [...new Set(ids)].sort())
})
