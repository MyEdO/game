// Banc de `murs/noms-par-ligne` (#3821) : la mise en forme pure, la règle sous la config RÉELLE (`lintFixtures`) et son
// correctif joué par oxlint `--fix` sous la config bornée de `npm run lint:noms-par-ligne`.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintFixtures, selectionnerMessages } from './lint.testkit.mjs'
import { unNomParLigne } from './declarationsDImport.mjs'
import { SEUIL_NOMS_PAR_LIGNE } from './nomsParLigneLint.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const REGLE = 'murs/noms-par-ligne'

/** `n` noms assez longs pour passer le seuil, à préfixe `p`. */
const noms = (p, n) => Array.from({ length: n }, (_, i) => `${p}${i}${'x'.repeat(30)}`)
/** Une déclaration d'une ligne de `longueur` caractères exactement : le dernier nom est allongé. */
function aLaLongueur(longueur) {
  const base = (dernier) => `import { ${[...noms('a', 3), dernier].join(', ')} } from './x';`
  return base(`z${'z'.repeat(longueur - base('z').length)}`)
}

/** Les lignes signalées par la règle, par fixture. */
function signalees(fixtures) {
  const resultats = lintFixtures(fixtures)
  return fixtures.map((_, i) => selectionnerMessages(resultats[i], (m) => m.ruleId === REGLE).map((m) => m.line))
}

/** Les fixtures après `oxlint --fix` sous la config de `npm run lint:noms-par-ligne`. */
function corriger(fixtures) {
  const cwd = mkdtempSync(join(tmpdir(), 'noms-par-ligne-'))
  try {
    for (const { filePath, code } of fixtures) {
      mkdirSync(dirname(join(cwd, filePath)), { recursive: true })
      writeFileSync(join(cwd, filePath), code)
    }
    const r = spawnSync(join(RACINE, 'node_modules/.bin/oxlint'), ['--config', join(RACINE, 'oxlint.noms-par-ligne.config.mjs'), '--disable-nested-config', '--fix', ...fixtures.map((f) => f.filePath)], { cwd, encoding: 'utf8' })
    return { code: r.status, sortie: r.stdout + r.stderr, textes: fixtures.map((f) => readFileSync(join(cwd, f.filePath), 'utf8')) }
  } finally { rmSync(cwd, { recursive: true, force: true }) }
}

describe('unNomParLigne', () => {
  it('pose un nom par ligne, indenté de deux espaces sous la déclaration, virgule finale', () => {
    assert.equal(
      unNomParLigne({ tete: 'import X, {', noms: ['a', 'type B', 'c as d'], queue: "} from './x';", indentation: '' }),
      "import X, {\n  a,\n  type B,\n  c as d,\n} from './x';",
    )
    assert.equal(
      unNomParLigne({ tete: 'export type {', noms: ['A'], queue: '} from "./y"', indentation: '    ' }),
      'export type {\n      A,\n    } from "./y"',
    )
  })
})

describe('murs/noms-par-ligne', () => {
  it('signale au-delà du seuil, partout où le lint lit, et laisse la ligne au seuil et la déclaration multi-lignes', () => {
    const au = aLaLongueur(SEUIL_NOMS_PAR_LIGNE)
    const dela = aLaLongueur(SEUIL_NOMS_PAR_LIGNE + 1)
    assert.equal(au.length, 160)
    assert.equal(dela.length, 161)
    const multi = `import {\n${noms('m', 6).map((n) => `  ${n},`).join('\n')}\n} from './x';\n`
    const exporte = `export { ${noms('e', 5).join(', ')} };\n`
    assert.deepEqual(signalees([
      { filePath: 'src/zz-noms/au.ts', code: `${au}\n` },
      { filePath: 'src/zz-noms/dela.ts', code: `${dela}\n` },
      { filePath: 'scripts/zz-noms/dela.mjs', code: `${dela}\n` },
      { filePath: 'hotes/zz-noms/dela.ts', code: `${dela}\n` },
      { filePath: 'src/zz-noms/multi.ts', code: multi },
      { filePath: 'src/zz-noms/exporte.ts', code: `const ${noms('e', 5).join(' = 1, ')} = 1;\n${exporte}` },
    ]), [[], [1], [1], [1], [], [2]])
  })

  it('corrige chaque forme à un nom par ligne et laisse le cas à commentaire signalé', () => {
    const [a, b, c, d] = noms('n', 4)
    const fixtures = [
      {
        filePath: 'src/zz-noms/formes.ts',
        code: [
          `import Defaut, { ${a}, type ${b}, ${c} as ${d} } from './x';`,
          `import type { ${noms('t', 4).join(', ')} } from "./y";`,
          `export type { ${noms('u', 4).join(', ')} } from './z';`,
          `export { ${noms('v', 5).join(', ')} } from './v';`,
          `import { ${noms('j', 4).join(', ')} } from './d.json' with { type: 'json' };`,
          'declare module "m" {',
          `  import { ${noms('k', 5).join(', ')} } from './k';`,
          '}',
          `export { ${a}, ${noms('w', 4).join(', ')} };`,
          '',
        ].join('\n'),
      },
      { filePath: 'scripts/zz-noms/sans-point-virgule.mjs', code: `import { ${noms('s', 5).join(', ')} } from './s.mjs'\n` },
      { filePath: 'src/zz-noms/commentaire.ts', code: `import { ${noms('c', 5).join(', ')} } from './c'; // note\n` },
      { filePath: 'src/zz-noms/directive.ts', code: `// @ts-expect-error - sonde\nimport { ${noms('d', 5).join(', ')} } from './d';\n` },
      { filePath: 'src/zz-noms/au-dessus.ts', code: `// note\nimport { ${noms('o', 5).join(', ')} } from './o';\n` },
    ]
    const lignes = (ind, liste) => liste.map((n) => `${ind}  ${n},`)
    const { code, sortie, textes } = corriger(fixtures)
    assert.deepEqual(textes[0].split('\n'), [
      'import Defaut, {', `  ${a},`, `  type ${b},`, `  ${c} as ${d},`, "} from './x';",
      'import type {', ...lignes('', noms('t', 4)), '} from "./y";',
      'export type {', ...lignes('', noms('u', 4)), "} from './z';",
      'export {', ...lignes('', noms('v', 5)), "} from './v';",
      'import {', ...lignes('', noms('j', 4)), "} from './d.json' with { type: 'json' };",
      'declare module "m" {',
      '  import {', ...lignes('  ', noms('k', 5)), "  } from './k';",
      '}',
      'export {', `  ${a},`, ...lignes('', noms('w', 4)), '};',
      '',
    ])
    assert.equal(textes[1], ['import {', ...lignes('', noms('s', 5)), "} from './s.mjs'", ''].join('\n'))
    assert.equal(textes[2], fixtures[2].code)
    assert.equal(textes[3], fixtures[3].code)
    assert.equal(textes[4], ['// note', 'import {', ...lignes('', noms('o', 5)), "} from './o';", ''].join('\n'))
    assert.equal(code, 1)
    assert.match(sortie, /commentaire\.ts.*Un commentaire est sur la ligne ou la vise/)
    assert.match(sortie, /directive\.ts.*Un commentaire est sur la ligne ou la vise/)
  })
})
