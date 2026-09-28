// Garde de classe #2112 : aucun hook ne touche son stdin hors de `lireStdinBorne`.
// Le détecteur est prouvé sur des formes NUES, puis appliqué au dossier RÉEL des hooks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { accesStdin, hooksHorsBorne } from './stdinHorsBorne.mjs'

const HOOKS = fileURLToPath(new URL('../../hooks/', import.meta.url))

test('accesStdin : le flux et le descripteur 0 sont des accès, leur MENTION ne l’est pas', () => {
  const cas = [
    ['for await (const c of process.stdin) raw += c', true, 'for await sur le flux'],
    ["process.stdin.on('end', () => {})", true, 'écouteur du flux'],
    ['process.stdin.resume()', true, 'reprise du flux'],
    ["const raw = readFileSync(0, 'utf8')", true, 'lecture synchrone du descripteur 0'],
    ['fs.readSync(0, tampon)', true, 'readSync du descripteur 0'],
    ['// process.stdin en commentaire', false, 'commentaire'],
    ["const s = 'process.stdin'", false, 'chaîne'],
    ['const raw = await lireStdinBorne()', false, 'primitive bornée'],
    ["readFileSync(10, 'utf8')", false, 'autre descripteur'],
  ]
  for (const [source, attendu, quoi] of cas) {
    assert.equal(accesStdin(source).length > 0, attendu, `${quoi} — source : ${source}`)
  }
})

test('accesStdin : chaque accès est rapporté à SA ligne, texte source inclus', () => {
  const source = ['// en-tête', 'let raw = ""', 'for await (const c of process.stdin) raw += c'].join('\n')
  assert.deepEqual(accesStdin(source), [{ ligne: 3, texte: 'for await (const c of process.stdin) raw += c' }])
})

test('aucun hook de scripts/hooks/ ne lit son stdin hors de lireStdinBorne (scripts/guards/lib/stdinBorne.mjs)', () => {
  const fautes = hooksHorsBorne(HOOKS)
  assert.deepEqual(
    fautes.map((f) => `scripts/hooks/${f.fichier}:${f.ligne} ${f.texte}`),
    [],
    'un hook qui attend la fin de son stdin sans minuteur vit tant que le harnais ne le ferme pas (#2112) ; ' +
      'remède : `const brut = await lireStdinBorne()` (scripts/guards/lib/stdinBorne.mjs)',
  )
})
