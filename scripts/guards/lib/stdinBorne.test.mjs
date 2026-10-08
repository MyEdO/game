// Contrat de la lecture bornée (#2112) : un VRAI hook lancé par `node`, stdin jamais fermé, sort de
// lui-même en exit 0 ; le délai tient sous le `timeout` déclaré (arithmétique sur `settings.json`) ;
// et le minuteur ne borne que la LECTURE — un stdin fermé laisse au hook le code de son verdict.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DELAI_STDIN_MS } from './stdinBorne.mjs'
import { SURFACE_CLAUDE, aplatirHooks } from '../../agents/compat-core.mjs'
import { ATTENTE_BARRIERE } from '../../hooks/barriere-outil.mjs'

const PRIMITIVE = new URL('./stdinBorne.mjs', import.meta.url).href
const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
/** Au-delà, le hook est tué par le test lui-même : aucun processus ne survit à la mesure. */
const COUPE_MS = 30_000

/** Les hooks déclarés dans `.claude/settings.json` : script `scripts/hooks/*.mjs` et `timeout` (s). */
function hooksDeclares() {
  return aplatirHooks(JSON.parse(readFileSync(`${RACINE}${SURFACE_CLAUDE}`, 'utf8')), SURFACE_CLAUDE)
    .flatMap((h) => (h.script ? [{ script: h.script, timeout: h.timeout }] : []))
}

/** Le source d'un module de `scripts/hooks/`. */
const sourceDe = (module) => readFileSync(`${RACINE}scripts/hooks/${module}`, 'utf8')

/** Les modules de `scripts/hooks/` qu'un point d'entrée charge DIRECTEMENT (`from`, `import()`), lui compris. */
const chargesPar = (script) => [script, ...[...sourceDe(script).matchAll(/(?:from |import\()\s*'\.\/([\w.-]+\.mjs)'/g)].map((m) => m[1])]

test('chaque hook déclaré qui lit son stdin a un `timeout` au-dessus de DELAI_STDIN_MS, plus l’attente de la barrière qui le précède (#2187)', () => {
  const lecteurs = hooksDeclares().filter(({ script }) => chargesPar(script).some((m) => sourceDe(m).includes('lireStdinBorne(')))
  assert.ok(lecteurs.length > 0, 'aucun hook déclaré ne lit son stdin : la déclaration est illisible')
  for (const { script, timeout } of lecteurs) {
    const barriere = chargesPar(script).includes('barriere-outil.mjs') ? ATTENTE_BARRIERE.echeanceMs : 0
    assert.ok(
      typeof timeout === 'number' && timeout * 1000 > DELAI_STDIN_MS + barriere,
      `${script} : timeout ${timeout} s déclaré, la barrière attend ${barriere} ms et la lecture bornée sort à ${DELAI_STDIN_MS} ms`,
    )
  }
  assert.ok(lecteurs.some(({ script }) => chargesPar(script).includes('barriere-outil.mjs')), 'les hooks d’outil passent la barrière')
})

/** Code et signal de sortie d'un enfant, tué par la coupe s'il ne sort pas seul. */
async function sortie(enfant) {
  const coupe = setTimeout(() => enfant.kill(), COUPE_MS)
  try {
    return await new Promise((resoudre) => enfant.on('exit', (code, signal) => resoudre({ code, signal })))
  } finally {
    clearTimeout(coupe)
    enfant.kill()
  }
}

test('un vrai hook dont le stdin n’est JAMAIS fermé sort seul, en exit 0', async () => {
  const enfant = spawn(process.execPath, ['scripts/hooks/repartiteur.mjs'], {
    cwd: RACINE,
    stdio: ['pipe', 'ignore', 'ignore'],
  })
  const { code, signal } = await sortie(enfant)
  assert.equal(signal, null, `hook tué par la coupe du test après ${COUPE_MS} ms : il ne sort pas seul`)
  assert.equal(code, 0)
})

test('stdin FERMÉ : le minuteur est désarmé, un verdict plus long que le délai garde son code', async () => {
  const code = [
    `import { lireStdinBorne } from ${JSON.stringify(PRIMITIVE)}`,
    'await lireStdinBorne(1000)',
    'setTimeout(() => process.exit(7), 3000)',
  ].join('\n')
  const enfant = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['pipe', 'ignore', 'ignore'] })
  enfant.stdin.end('{}')
  const { code: sorti, signal } = await sortie(enfant)
  assert.equal(signal, null, `enfant tué par la coupe du test après ${COUPE_MS} ms`)
  assert.equal(sorti, 7, 'le minuteur de lecture a tranché le verdict : il n’a pas été désarmé à end')
})

test('lecteur borné : le flux injecté est lu et sa limite retourne vide sans conserver de listeners', () => {
  for (const [texte, limite, attendu] of [['entrée injectée', 100, 'entrée injectée'], ['trop-long', 2, '']]) {
    const code = `import assert from 'node:assert/strict'; import { Readable } from 'node:stream'; import { lireStdinBorne } from ${JSON.stringify(PRIMITIVE)}; const stdin=Readable.from([${JSON.stringify(texte)}]); const brut=await lireStdinBorne(1000,{stdin,limite:${limite}}); assert.equal(brut,${JSON.stringify(attendu)}); assert.equal(stdin.listenerCount('data'),0); assert.equal(stdin.listenerCount('end'),0); assert.equal(stdin.listenerCount('error'),0)`
    const vu = spawnSync(process.execPath, ['--input-type=module', '-e', code], { input: 'flux réel distinct', encoding: 'utf8', timeout: 5000 })
    assert.equal(vu.status, 0, vu.stderr); assert.equal(vu.error, undefined)
  }
})
