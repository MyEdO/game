// Contrat de la mécanique `scanMemeRef` sur des formes NUES (patron de `codeSeul.test.mjs`) : le motif
// est attrapé dans le CODE, sous ses formes normalisée et nue, et ignoré en prose, en donnée et dans
// une couverture par joker.
import test from 'node:test'
import assert from 'node:assert/strict'
import { scanMemeRef } from './memeRef.mjs'

test('scanMemeRef : le motif recodé est attrapé, le prédicat et la prose passent', () => {
  const cas = [
    ["xs.find((s) => s.id === id && (s.spec ?? '') === (spec ?? ''));", 1, 'forme symétrique'],
    ["xs.some((s) => (s.spec ?? '') === prev);", 1, 'spec normalisée contre une valeur'],
    ["xs.some((s) => (s.spec ?? '') !== (b.spec ?? ''));", 1, 'inégalité'],
    ["ok = prev === (o.spec ?? '');", 1, 'forme miroir'],
    ["xs.find((s) => memeRef(s, { id, spec }));", 0, 'le prédicat'],
    ["// (s.spec ?? '') === (spec ?? '') en commentaire", 0, 'commentaire'],
    ["const doc = \"(s.spec ?? '') === x\";", 0, 'chaîne'],
    ["const v = s.spec ?? '';", 0, 'normalisation sans comparaison'],
    ["xs.find((s) => s.id === skillId && s.spec === spec);", 1, 'conjonction nue id/spec'],
    ["xs.find((t) => t.talentId === 'resistance' && t.spec === menaceId);", 1, 'conjonction nue talentId/spec'],
    ["if (s.id !== ref.id || s.spec !== ref.spec) continue;", 1, 'négation de la conjonction nue'],
    ["xs.find((x) => x.id === skillId && (spec == null || x.spec === spec));", 0, 'couverture par joker'],
    ["xs.filter((s) => s.id === id && s.spec == null);", 0, 'spec absente, pas une identité à deux membres'],
    ["const ms = xs.filter((s) => s.id === skillId);\nconst sk = ms.find((s) => s.spec === w.spec);", 1, 'identité en deux temps'],
    ["const ms = xs.filter((s) => s.id === skillId);\nif (ms.some((m) => m.spec !== spec)) return;", 1, 'identité en deux temps, négation'],
    ["const ms = xs.filter((s) => s.id === skillId);\nconst sk = ms.find((s) => memeRef(s, { id: skillId, spec }));", 0, 'deux temps par le prédicat'],
    ["const ms = xs.filter((s) => s.id === skillId);\nif (wanted.some((w) => w.spec === ANY)) return;", 0, 'spec comparée sur une AUTRE collection'],
    ["const ms = xs.filter((s) => s.advances > 0);\nconst sk = ms.find((s) => s.spec === spec);", 0, 'collection non filtrée par id'],
    ["function a() {\n  const ms = xs.filter((s) => s.id === skillId);\n  return ms;\n}\nfunction b(ms) {\n  return ms.find((s) => s.spec === spec);\n}", 0, 'homonyme hors de la portée du filtre'],
    ["function a() {\n  const ms = xs.filter((s) => s.id === skillId);\n  if (ok) {\n    return ms.find((s) => s.spec === spec);\n  }\n}", 1, 'deux temps dans un bloc imbriqué de la portée'],
    ["function a() { const ms = xs.filter((s) => s.id === skillId);\n  return ms; }\nfunction b(ms) {\n  return ms.find((s) => s.spec === spec);\n}", 0, 'déclaration après l’accolade ouvrante de sa ligne, homonyme hors portée'],
    ["function a() {\n  if (q) { r(); } const ms = xs.filter((s) => s.id === skillId);\n  return ms.find((s) => s.spec === spec);\n}", 1, 'bloc refermé puis déclaration sur la même ligne'],
  ]
  for (const [source, attendu, quoi] of cas) assert.equal(scanMemeRef(source).length, attendu, `${quoi} — ${source}`)
})

test('scanMemeRef : le numéro de ligne désigne la ligne source', () => {
  assert.deepEqual(scanMemeRef("const a = 1;\nconst b = (x.spec ?? '') === y;").map((f) => f.line), [2])
})
