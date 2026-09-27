// Importer `scripts/gen-registry.mjs` ne lance pas la génération : seul le point d'entrée du processus
// (`node scripts/gen-registry.mjs`, `npm run gen`) la déclenche (#1897). Une seule règle de lecture d'un
// littéral (`champsLitteraux`) pour l'union d'ids et la projection.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const MODULE = pathToFileURL(fileURLToPath(new URL('./gen-registry.mjs', import.meta.url))).href

test("un import depuis la racine du dépôt ne lance pas genAll", () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(MODULE)})`], {
    cwd: RACINE,
    encoding: 'utf8',
  })
  assert.equal(r.status, 0, r.stderr)
  assert.doesNotMatch(r.stdout, /gen-registry:/)
})

test("champsLitteraux : un littéral en guillemets simples ou doubles est lu, dans l'ordre de la source", async () => {
  const { champsLitteraux } = await import(MODULE)
  const src = "export const icons = [\n  { \n    id: 'simple',\n  },\n  {\n    id: \"double\",\n  },\n];\n"
  assert.deepEqual(champsLitteraux(src, 'id', 'a.ts', 'auMoinsUn'), ['simple', 'double'])
})

test("champsLitteraux : un id calculé lève en nommant le def", async () => {
  const { champsLitteraux } = await import(MODULE)
  const src = "export const icons = [\n  {\n    id: 'fixe',\n  },\n  { id: slug(label) },\n];\n"
  assert.throws(() => champsLitteraux(src, 'id', 'b.ts', 'auMoinsUn'), /b\.ts : 1 champ\(s\) « id » non littéral\(aux\)/)
})

test("champsLitteraux : zéro littéral en « auMoinsUn » lève en nommant le def", async () => {
  const { champsLitteraux } = await import(MODULE)
  assert.throws(
    () => champsLitteraux('export const icons = [];\n', 'id', 'c.ts', 'auMoinsUn'),
    /c\.ts : 0 champ\(s\) « id » littéral\(aux\) — le registre en exige AU MOINS un/,
  )
})

test("champsLitteraux : en « un », un seul littéral est lu ; zéro ou deux lèvent en nommant le def", async () => {
  const { champsLitteraux } = await import(MODULE)
  assert.deepEqual(champsLitteraux("export const d = {\n  id: 'seul',\n};\n", 'id', 'd.ts', 'un'), ['seul'])
  assert.throws(
    () => champsLitteraux("export const d = {\n  nom: 'x',\n};\n", 'id', 'e.ts', 'un'),
    /e\.ts : 0 champ\(s\) « id » littéral\(aux\) — le registre en exige EXACTEMENT un/,
  )
  assert.throws(
    () => champsLitteraux("export const d = {\n  id: 'un',\n  id: \"deux\",\n};\n", 'id', 'f.ts', 'un'),
    /f\.ts : 2 champ\(s\) « id » littéral\(aux\) — le registre en exige EXACTEMENT un/,
  )
})

// `src/ui/icons/defs` : le registre `idUnion` le plus large (plusieurs ids par def), lu sans écrire.
test("unionDesIds : l'union des ids d'un dossier de defs commité est triée et dédupliquée", async () => {
  const { champsLitteraux, unionDesIds } = await import(MODULE)
  const dir = join(RACINE, 'src/ui/icons/defs')
  const defs = readdirSync(dir).filter((f) => /\.tsx?$/.test(f))
  const ids = defs.flatMap((f) => champsLitteraux(readFileSync(join(dir, f), 'utf8'), 'id', f, 'auMoinsUn'))
  const union = unionDesIds(dir, [...defs].reverse().concat(defs), 'id')
  assert.ok(union.length > 1)
  union.slice(1).forEach((id, i) => assert.ok(union[i] < id, `${union[i]} puis ${id}`))
  assert.deepEqual(new Set(union), new Set(ids))
})
