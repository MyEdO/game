import test from 'node:test'
import assert from 'node:assert/strict'
import { ciblesDEcritureJS } from './ecrituresFichiers.mjs'
test('provenance fs sous alias sans fabriquer les homonymes', () => {
  const cibles = text => ciblesDEcritureJS(text).map(c => c.chemin)
  assert.deepEqual(cibles("require('fs').writeFileSync('x','a')"), ['x'])
  assert.deepEqual(cibles("const fs=require('fs'); const a=fs; a.writeFileSync('x','a')"), ['x'])
  assert.deepEqual(cibles("const fs=require('fs'); function f(fs){fs.writeFileSync('x','a')}"), [])
  assert.deepEqual(cibles("let fs=require('fs'); fs={}; fs.writeFileSync('x','a')"), [])
})
