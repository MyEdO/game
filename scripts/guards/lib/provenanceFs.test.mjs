import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyserCorpus, typescript } from './dialecte.mjs'
import { creerProvenanceFs } from './provenanceFs.mjs'

// #2475 / #2477
test('realpathSync.native : provenance canonique FS pendant la session AST, alias et mutations', () => {
  const text = "import fs from 'node:fs'\nimport * as fichiers from 'fs'\nimport { realpathSync as physique } from 'node:fs'\n" +
    "import { realpathSync as faux } from 'etranger'\n" +
    "fs.realpathSync.native('a')\nfichiers.realpathSync['native']('b')\nphysique.native('c')\n" +
    "const alias = fs.realpathSync.native\nalias('d')\n" +
    "const {realpathSync: commun} = require('node:fs')\ncommun.native('e')\n" +
    "faux.native('f')\nfunction ombre(fs) { fs.realpathSync.native('g') }\n" +
    "function locale() { function realpathSync() {} ; realpathSync.native('h') }\n" +
    "function masque(require) { require('node:fs').realpathSync.native('i') }\n" +
    "fs.readFileSync.native('j')\nlet modifiable = physique\nmodifiable = faux\nmodifiable.native('k')\n" +
    "import altere from 'node:fs'\nconst derive = altere\nderive.realpathSync.native = faux\naltere.realpathSync.native('l')\n"
  const ts = typescript()
  const rendus = []
  for (const { sourceFile, checker } of analyserCorpus([{ rel: 'native.mjs', text }])) {
    const provenance = creerProvenanceFs({ sourceFile, checker, ts })
    const visiter = (n) => {
      if (ts.isCallExpression(n) && n.arguments[0] && ts.isStringLiteralLikeNode(n.arguments[0]) && /^[a-l]$/.test(n.arguments[0].text))
        rendus.push([n.arguments[0].text, provenance(n.expression)])
      n.forEachChild(visiter)
    }
    visiter(sourceFile)
  }
  assert.deepEqual(rendus, Array.from('abcdefghijkl', (lettre, i) => [lettre, i < 5 ? { operation: 'realpathSync' } : null]))
})
