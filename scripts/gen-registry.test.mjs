// Importer `scripts/gen-registry.mjs` ne lance pas la génération : seul le point d'entrée du processus
// (`node scripts/gen-registry.mjs`, `npm run gen`) la déclenche (#1897). Une seule règle de lecture d'un
// littéral (`champsLitteraux`) pour l'union d'ids et la projection.
import { describe, test } from 'node:test'
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

describe('projection source', () => {
  const SOURCE = { module: 'registre.ts', symbole: 'PORTES' }
  const PROJECTION = { nom: 'PORTES_LABELS', champ: 'label', out: 'domaines.ts' }

  test('projection source : lecture statique, wrappers et ajout sans seconde déclaration', async () => {
    const { projeterSource } = await import(MODULE)
    const text = `throw new Error('ne doit pas être exécuté');
      export const PORTES = { alpha: { label: 'Première', test: () => introuvable() },
        beta: { label: 'Deuxième', test: () => true } } as const satisfies Record<string, unknown>;`
    assert.deepEqual(projeterSource(SOURCE, PROJECTION, text), [['alpha', 'Première'], ['beta', 'Deuxième']])
    assert.deepEqual(projeterSource(SOURCE, PROJECTION, text.replace('beta:', "gamma: { label: 'Troisième' }, beta:")),
      [['alpha', 'Première'], ['beta', 'Deuxième'], ['gamma', 'Troisième']])
  })

  test('projection source : racine absente, label inconnu, clé calculée et étalements refusés', async () => {
    const { projeterSource } = await import(MODULE)
    for (const text of [
      'export const AUTRE = {};',
      'export const PORTES = inconnu;',
      'export const PORTES = { alpha: { label: inconnu } };',
      "export const PORTES = { [cle]: { label: 'Texte' } };",
      "export const PORTES = { ...inconnu, alpha: { label: 'Texte' } };",
      "export const PORTES = { alpha: { ...inconnu, label: 'Texte' } };",
    ]) assert.throws(() => projeterSource(SOURCE, PROJECTION, text), /registre\.ts.*PORTES/)
  })

  test('projection source : filtre littéral, absence et ajout sans seconde déclaration', async () => {
    const { projeterSource } = await import(MODULE)
    const projection = { ...PROJECTION, quand: { champ: 'armable', valeur: true } }
    const text = `export const PORTES = {
      alpha: { label: 'Première', armable: true },
      beta: { label: 'Deuxième', armable: false },
      gamma: { label: 'Troisième' }
    };`
    assert.deepEqual(projeterSource(SOURCE, projection, text), [['alpha', 'Première']])
    const [{ body }] = (await import(MODULE)).renduDesProjections([{ source: SOURCE, projection: { ...projection, enumNomme: true } }], () => text)
    assert.match(body, /'alpha': 'Première'/)
    assert.doesNotMatch(body, /'beta'|'gamma'/)
    assert.deepEqual(projeterSource(SOURCE, projection, text.replace("gamma: { label: 'Troisième' }", "gamma: { label: 'Troisième', armable: true }")),
      [['alpha', 'Première'], ['gamma', 'Troisième']])
    assert.deepEqual(projeterSource(SOURCE, { ...PROJECTION, quand: { champ: 'genre', valeur: 'direct' } },
      "export const PORTES = { alpha: { label: 'Première', genre: 'direct' }, beta: { label: 'Deuxième', genre: 'differe' } };"), [['alpha', 'Première']])
    assert.deepEqual(projeterSource(SOURCE, { ...PROJECTION, quand: { champ: 'rang', valeur: 2 } },
      "export const PORTES = { alpha: { label: 'Première', rang: 2 }, beta: { label: 'Deuxième', rang: 1 } };"), [['alpha', 'Première']])
  })

  test('projection source : filtre indéterminé et entrée non résolue refusés', async () => {
    const { projeterSource } = await import(MODULE)
    const projection = { ...PROJECTION, quand: { champ: 'armable', valeur: true } }
    for (const text of [
      "export const PORTES = { alpha: { label: 'Première', armable: inconnu } };",
      "export const PORTES = { alpha: { label: 'Première', armable: () => true } };",
      'export const PORTES = { alpha: inconnu };',
    ]) assert.throws(() => projeterSource(SOURCE, projection, text), /registre\.ts.*PORTES.*alpha/)
  })

  test('projection source : syntaxe TypeScript malformée refusée avant extraction', async () => {
    const { projeterSource } = await import(MODULE)
    assert.throws(() => projeterSource(SOURCE, PROJECTION,
      "export const PORTES = { alpha: { label: 'Texte' test: () => true } };"),
    /registre\.ts.*PORTES.*syntaxe/)
  })

  test('projection source : sorties groupées et record littéral const consommable', async () => {
    const { renduDesProjections } = await import(MODULE)
    const source = SOURCE
    const rendus = renduDesProjections([
      { source, projection: PROJECTION },
      { source, projection: { ...PROJECTION, nom: 'AUTRES_LABELS', out: 'autres.ts' } },
      { source, projection: { ...PROJECTION, nom: 'MEMES_LABELS' } },
    ], () => "export const PORTES = { alpha: { label: 'Première', test: () => true } } as const;")
    assert.deepEqual(rendus.map(({ out }) => out), ['domaines.ts', 'autres.ts'])
    assert.match(rendus[0].body, /export const PORTES_LABELS = \{/)
    assert.match(rendus[0].body, /'alpha': 'Première',/)
    assert.match(rendus[0].body, /\} as const;/)
    assert.match(rendus[0].body, /export const MEMES_LABELS = \{/)
    assert.doesNotMatch(rendus[0].body, /import|readonly string\[\]|Record<string/)
  })

  test('projection source : enum nommé sans table détachée et libellés dérivés', async () => {
    const { renduDesProjections } = await import(MODULE)
    const projection = { ...PROJECTION, enumNomme: true }
    const [{ body }] = renduDesProjections([{ source: SOURCE, projection }],
      () => "export const PORTES = { alpha: { label: 'Première' }, beta: { label: 'Deuxième' } };")
    assert.match(body, /export const PORTES_LABELS = enumNomme\(\{/)
    assert.match(body, /'alpha': 'Première',/)
    assert.match(body, /'beta': 'Deuxième',/)
    assert.doesNotMatch(body, /as const|= \{/)
    assert.throws(() => renduDesProjections([{ source: SOURCE, projection: { nom: 'S', enumNomme: true } }],
      () => "export const PORTES = { alpha: { label: 'Première' } };"), /enumNomme exige un champ/)
  })

  test('projection source : schéma de production accepte le corpus et refuse une porte inconnue', async () => {
    const { tsImport } = await import('tsx/esm/api')
    const { schema } = await tsImport('../src/data/schemas/defs/actions.ts', import.meta.url)
    const corpus = JSON.parse(readFileSync(join(RACINE, 'src/data/actions.json'), 'utf8'))
    const parse = schema.safeParse(corpus)
    assert.equal(parse.success, true, JSON.stringify(parse.error?.issues))
    const inconnu = structuredClone(corpus)
    inconnu[0].gate = 'porte-inconnue-2968'
    assert.equal(schema.safeParse(inconnu).success, false)
  })

  test('projection source : déclaration propriétaire configurée et art préservé', async () => {
    const { REGISTRIES, SORTIES, renduDesProjections } = await import(MODULE)
    const config = REGISTRIES.find((r) => r.source?.symbole === 'ACTION_GATES')
    assert.equal(config.source.module, 'src/noyau/actionRegistry.ts')
    const rendus = renduDesProjections(REGISTRIES, (module) => readFileSync(join(RACINE, module), 'utf8'))
    const domaine = rendus.find((r) => r.out === config.projection.out)
    assert.ok(SORTIES.includes(domaine.out))
    assert.match(domaine.body, /import \{ enumNomme \} from '\.\/grammaire\/valeurs';/)
    assert.match(domaine.body, /export const gateDActionSchema = enumNomme\(\{/)
    assert.match(domaine.body, /\}\);/)
    assert.equal(rendus.find((r) => r.out.endsWith('_art.generated.ts')).body,
      readFileSync(join(RACINE, 'src/data/schemas/_art.generated.ts'), 'utf8'))
  })
})
