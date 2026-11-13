// Garde du pilote de fusion des imports (scripts/git-hooks/merge-imports.mjs). `npm run test:hooks`.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fusionnerImports } from './merge-imports.mjs'
import { threeWay } from './three-way.mjs'

const CORPS = '\nexport const k = 1;\n'
const fusion = (base, ours, theirs, chemin = 'src/x.ts') => fusionnerImports({ base, ours, theirs, chemin })
const ordinaire = (base, ours, theirs) => threeWay(ours, base, theirs)
/** La fusion par le pilote de trois en-têtes d'imports posés devant le même corps. */
const enTetes = async (base, ours, theirs) => {
  const r = await fusion(base + CORPS, ours + CORPS, theirs + CORPS)
  return r.conflict ? r : { ...r, text: r.text.slice(0, -CORPS.length) }
}

test('une fusion ordinaire propre est rendue telle quelle', async () => {
  const base = `import { a } from './a';\n\nconst x = 1;\nconst y = 2;\nconst z = 3;\n`
  const ours = base.replace('x = 1', 'x = 10')
  const theirs = base.replace('z = 3', 'z = 30')
  assert.deepEqual(await fusion(base, ours, theirs), ordinaire(base, ours, theirs))
  assert.deepEqual(await fusion(base, ours, base), { text: ours, conflict: false })
  assert.deepEqual(await fusion(base, base, theirs), { text: theirs, conflict: false })
})

test('deux déclarations ajoutées au même endroit : les deux, la courante d’abord', async () => {
  const base = `import { a } from './a';\n`
  assert.equal(ordinaire(base + CORPS, `${base}import { b } from './b';\n${CORPS}`, `${base}import c from './c';\n${CORPS}`).conflict, true)
  assert.deepEqual(await enTetes(base, `${base}import { b } from './b';\n`, `${base}import c from './c';\n`), {
    text: `import { a } from './a';\nimport { b } from './b';\nimport c from './c';\n`, conflict: false,
  })
})

test('deux noms ajoutés à la même déclaration : réimprimée à un nom par ligne', async () => {
  assert.deepEqual(await enTetes(`import { a } from './a';\n`, `import { a, b } from './a';\n`, `import { a, type C as D } from './a';\n`), {
    text: `import {\n  a,\n  b,\n  type C as D,\n} from './a';\n`, conflict: false,
  })
  const liste = (...noms) => `import {\n${noms.map((n) => `  ${n},\n`).join('')}} from './a';\n`
  assert.deepEqual(await enTetes(liste('a', 'z'), liste('a', 'b', 'z'), liste('a', 'c', 'z')), { text: liste('a', 'b', 'z', 'c'), conflict: false })
})

test('un retrait d’un côté, un ajout de l’autre : le retrait tient', async () => {
  assert.deepEqual(await enTetes(`import { a, b } from './a';\n`, `import { a } from './a';\n`, `import { a, b, c } from './a';\n`), {
    text: `import {\n  a,\n  c,\n} from './a';\n`, conflict: false,
  })
})

test('un nom déplacé vers un autre module d’un côté, un nom ajouté de l’autre', async () => {
  assert.deepEqual(await enTetes(`import { v } from './p';\n`, `import { v, type F } from './p';\n`, `import { v } from './r';\n`), {
    text: `import { v } from './r';\nimport { type F } from './p';\n`, conflict: false,
  })
})

test('une déclaration remise en forme d’un côté, complétée de l’autre : un nom par ligne', async () => {
  assert.deepEqual(await enTetes(`import { a, b } from './a';\n`, `import { a, b, c } from './a';\n`, `import {\n  a,\n  b,\n} from './a';\n`), {
    text: `import {\n  a,\n  b,\n  c,\n} from './a';\n`, conflict: false,
  })
})

test('une déclaration que seul un côté a touchée garde son texte', async () => {
  const base = `import { a, b } from './a';\nimport { x } from './x';\n`
  const r = await enTetes(base, `import { a, b } from './a';\nimport { x, y } from './x';\nimport o from './o';\n`, `import { a,  b } from './a';\nimport { x } from './x';\nimport t from './t';\n`)
  assert.deepEqual(r, { text: `import { a,  b } from './a';\nimport { x, y } from './x';\nimport o from './o';\nimport t from './t';\n`, conflict: false })
})

test('deux déclarations du même module : l’ajout rejoint celle qui lui ressemble', async () => {
  const base = `import { a } from './m';\nimport { z } from './m';\n`
  assert.deepEqual(await enTetes(base, `import { a } from './m';\nimport { z, y } from './m';\n`, `import { a } from './m';\nimport { z, w } from './m';\n`), {
    text: `import { a } from './m';\nimport {\n  z,\n  y,\n  w,\n} from './m';\n`, conflict: false,
  })
})

test('un import d’effet ajouté d’un seul côté, une déclaration de l’autre : l’effet garde son rang courant', async () => {
  const base = `import './a.css';\n`
  assert.deepEqual(await enTetes(base, `${base}import './reset.css';\n`, `${base}import { c } from './c';\n`), {
    text: `import './a.css';\nimport './reset.css';\nimport { c } from './c';\n`, conflict: false,
  })
})

test('exports d’un module sans point-virgule', async () => {
  const base = `export { a } from './a.mjs'\n`
  const r = await fusion(base, `${base}export * from './b.mjs'\n`, `${base}export { c as d } from './c.mjs'\n`, 'scripts/x.mjs')
  assert.deepEqual(r, { text: `export { a } from './a.mjs'\nexport * from './b.mjs'\nexport { c as d } from './c.mjs'\n`, conflict: false })
})

test('les autres conflits du fichier restent, étiquetés, les imports résolus', async () => {
  const fichier = (imports, x) => `${imports}\nconst x = ${x};\n`
  const r = await fusionnerImports({
    base: fichier(`import { a } from './a';\n`, 1), ours: fichier(`import { a, b } from './a';\n`, 2), theirs: fichier(`import { a, c } from './a';\n`, 3),
    chemin: 'src/x.ts', labels: { ours: 'courant', base: 'ancêtre', theirs: 'entrant' },
  })
  assert.deepEqual(r, { text: `import {\n  a,\n  b,\n  c,\n} from './a';\n\n<<<<<<< courant\nconst x = 2;\n=======\nconst x = 3;\n>>>>>>> entrant\n`, conflict: true })
})

for (const [nom, base, ours, theirs] of [
  ['le même nom lié à deux modules', `import { a } from './a';\n`, `import { a } from './a';\nimport { z } from './b';\n`, `import { a } from './a';\nimport { z } from './c';\n`],
  ['un nom retiré d’un côté, déplacé de l’autre', `import { a, b } from './a';\n`, `import { a } from './a';\n`, `import { a } from './a';\nimport { b } from './b';\n`],
  ['un commentaire dans la déclaration à réimprimer', `import {\n  a, // premier\n} from './a';\n`, `import {\n  a, // premier\n  b,\n} from './a';\n`, `import {\n  a, // premier\n  c,\n} from './a';\n`],
  ['un commentaire entre les déclarations en conflit', `import { a } from './a';\n`, `import { a } from './a';\n// b\nimport { b } from './b';\n`, `import { a } from './a';\nimport { c } from './c';\n`],
  ['un espace de noms et un nom pour le même module', `import { a } from './a';\n`, `import { a } from './a';\nimport * as m from './m';\n`, `import { a } from './a';\nimport { n } from './m';\n`],
  ['un import d’effet ajouté de chaque côté', `import './a.css';\n`, `import './a.css';\nimport './reset.css';\n`, `import './a.css';\nimport './theme.css';\n`],
  ['le même nom lié à deux modules, d’une région à une autre', `import { a } from './a';\n// outils\nimport { z } from './z';\n`, `import { a } from './a';\nimport { x } from './p';\n// outils\nimport { z } from './z';\n`, `import { a } from './a';\nimport { c } from './c';\n// outils\nimport { z } from './z';\nimport { x } from './q';\n`],
  ['la même liaison ajoutée des deux côtés, dans deux régions', `import { a } from './a';\n// outils\nimport { z } from './z';\n`, `import { a } from './a';\nimport { x } from './p';\n// outils\nimport { z } from './z';\n`, `import { a } from './a';\nimport { c } from './c';\n// outils\nimport { z } from './z';\nimport { x } from './p';\n`],
]) test(`repli sur la fusion ordinaire : ${nom}`, async () => {
  assert.deepEqual(await fusion(base + CORPS, ours + CORPS, theirs + CORPS), ordinaire(base + CORPS, ours + CORPS, theirs + CORPS))
})

test('repli : une déclaration que ne suit aucun saut de ligne', async () => {
  const [base, ours, theirs] = [`export { a } from './a';`, `export { a } from './a';\nexport { b } from './b';`, `export { a } from './a';\nexport { c } from './c';`]
  assert.deepEqual(await fusion(base, ours, theirs), ordinaire(base, ours, theirs))
})

test('repli : un nom que le code de l’autre côté lie ou exporte déjà ; lié sans être exporté, il s’exporte', async () => {
  const code = `\nf1();\nf2();\nf3();\n\n`
  const base = `import { a } from './a';\n${code}`
  const versions = (courant, entrant) => [base, `import { a, b } from './a';\n${code}${courant}`, `import { a, c } from './a';\n${entrant}${code}`]
  for (const [courant, entrant] of [
    [`export function x() {}\n`, `export { x };\n`],
    [`export const x = 1;\n`, `export { x } from './m';\n`],
    [`const [x] = [1];\n`, `import { x } from './m';\n`],
    [`export default class {}\n`, `export { c as default } from './c';\n`],
  ]) assert.deepEqual(await fusion(...versions(courant, entrant)), ordinaire(...versions(courant, entrant)))
  assert.deepEqual(await fusion(...versions(`function x() {}\n`, `export { x };\n`)), {
    text: `import {\n  a,\n  b,\n  c,\n} from './a';\nexport { x };\n${code}function x() {}\n`, conflict: false,
  })
})

test('repli : un bloc qui mêle import et code', async () => {
  const [base, ours, theirs] = [1, 2, 3].map((n) => `import { a${n > 1 ? `, n${n}` : ''} } from './a';\nconst x = ${n};\n`)
  assert.deepEqual(await fusion(base, ours, theirs), ordinaire(base, ours, theirs))
})

test('repli : des lignes d’import dans un gabarit de chaîne ne sont pas des déclarations', async () => {
  const gabarit = (ligne) => `const source = \`\nimport { a } from './a';\n${ligne}\`;\n`
  const [base, ours, theirs] = [gabarit(''), gabarit(`import { b } from './b';\n`), gabarit(`import { c } from './c';\n`)]
  assert.deepEqual(await fusion(base, ours, theirs), ordinaire(base, ours, theirs))
})

test('repli : une version qui ne se parse pas', async () => {
  const [base, ours, theirs] = [`import { a } from './a';\n`, `import { a, b } from './a';\nconst = ;\n`, `import { a, c } from './a';\n`]
  assert.deepEqual(await fusion(base, ours, theirs), ordinaire(base, ours, theirs))
})

test('le pilote lancé par git : %A écrit, sortie 0 résolu, 1 en conflit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'merge-imports-test-'))
  try {
    const lancer = (base, ours, theirs) => {
      const [fO, fA, fB] = ['O', 'A', 'B'].map((n) => join(dir, n))
      writeFileSync(fO, base)
      writeFileSync(fA, ours)
      writeFileSync(fB, theirs)
      const r = spawnSync(process.execPath, ['scripts/git-hooks/merge-imports.mjs', fO, fA, fB, 'src/x.ts'], { encoding: 'utf8' })
      return { status: r.status, texte: readFileSync(fA, 'utf8'), stderr: r.stderr }
    }
    const base = `import { a } from './a';\n`
    const resolu = lancer(base, `${base}import { b } from './b';\n`, `${base}import { c } from './c';\n`)
    assert.deepEqual([resolu.status, resolu.texte], [0, `${base}import { b } from './b';\nimport { c } from './c';\n`], resolu.stderr)
    const conflit = lancer('const x = 1;\n', 'const x = 2;\n', 'const x = 3;\n')
    assert.deepEqual([conflit.status, conflit.texte], [1, '<<<<<<< src/x.ts (courant)\nconst x = 2;\n=======\nconst x = 3;\n>>>>>>> src/x.ts (entrant)\n'], conflit.stderr)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
