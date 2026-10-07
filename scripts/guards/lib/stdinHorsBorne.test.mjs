// Garde de classe #2112 : aucun hook ne touche son stdin hors de `lireStdinBorne`.
// Le détecteur est prouvé sur des formes NUES, puis appliqué au dossier RÉEL des hooks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENTREES_OUTIL, HOOKS_DE_SESSION, SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks } from '../../agents/compat-core.mjs'
import { accesStdin, demandes, effetsDeModule, gardesAEffets, hooksHorsBorne, modulesQuiDemandent } from './stdinHorsBorne.mjs'

const HOOKS = fileURLToPath(new URL('../../hooks/', import.meta.url))
const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
/** Les points d'entrée des hooks : ceux des appels d'outil, puis ceux de session. */
const POINTS_D_ENTREE = new Set([...ENTREES_OUTIL, ...HOOKS_DE_SESSION].map((e) => e.script))

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

test('effetsDeModule : stdin, fin et code de sortie, écriture sur stdout, console, `let`/`var` de premier niveau, conteneur de module muté ; leur MENTION ne l’est pas', () => {
  const cas = [
    ['process.exit(0)', true, 'fin du processus'],
    ['process.exitCode = 1', true, 'code de sortie'],
    ["process.stdout.write('x')", true, 'écriture sur stdout'],
    ["process.stdin.on('end', f)", true, 'stdin'],
    ['let chemin = null', true, 'état de module'],
    ['export let n = 0', true, 'état de module exporté'],
    ['  let local = 0', false, '`let` local'],
    ["process.stderr.write('x')", false, 'stderr'],
    ['// process.exit(0)', false, 'commentaire'],
    ["const s = 'process.exit(0)'", false, 'chaîne'],
    ['const env = process.env', false, 'lecture de l’environnement'],
    ['console.log(JSON.stringify({ hookSpecificOutput: {} }))', true, 'console.log'],
    ["  console.error('x')", true, 'console.error'],
    ["console.warn('x')", true, 'console.warn'],
    ['console.info(1)', true, 'console.info'],
    ['console.dir(o)', true, 'console.dir'],
    ['console.table(t)', true, 'console.table'],
    ['const raw = await lireStdinBorne()', true, 'lecture bornée hors point d’entrée'],
    ['await lireStdinBorne()', true, 'lecture bornée nue'],
    ['var n = 0', true, 'var de module'],
    ['export var n = 0', true, 'var de module exporté'],
    ['const pannesDuHook = []\nfunction f() { pannesDuHook.push(1) }', true, 'tableau de module muté'],
    ['const vus = new Set()\nexport const f = (x) => vus.add(x)', true, 'Set de module muté'],
    ['const m = new Map()\nexport const f = (k, v) => m.set(k, v)', true, 'Map de module muté'],
    ['const o = {}\nexport function f(k) { o[k] = 1 }', true, 'objet de module muté par indice'],
    ['const o = { n: 0 }\nexport function f() { o.n += 1 }', true, 'objet de module muté par membre'],
    ["const T = ['a', 'b']\nexport const n = T.length", false, 'table figée'],
    ["const T = new Set(['a'])\nexport const a = (x) => T.has(x)", false, 'Set figé'],
    ['function f() { const local = []; local.push(1) }', false, 'conteneur local'],
    ['const m = new Map() // mémo-pur : clé → valeur\nexport const f = (k) => m.set(k, 1)', false, 'mémo pur marqué AU SITE'],
    ['const m = new Map() // mémo pur\nexport const f = (k) => m.set(k, 1)', true, 'marqueur sans clé'],
  ]
  for (const [source, attendu, quoi] of cas) {
    assert.equal(effetsDeModule(source).length > 0, attendu, `${quoi} — source : ${source}`)
  }
})

/** Les modules de `scripts/hooks/` qu'un point d'entrée charge DIRECTEMENT (`from`, `import()`) : sa machinerie
 *  (la barrière et `executer`, #2187), qui lit, écrit et sort pour lui. */
const chargesPar = (script) => [...readFileSync(join(HOOKS, script), 'utf8').matchAll(/(?:from |import\()\s*'\.\/([\w.-]+\.mjs)'/g)].map((m) => m[1])

test('aucune garde de scripts/hooks/ hors des points d’entrée ne porte un effet de processus ni un état de module (#2125)', () => {
  const machinerie = new Set([...POINTS_D_ENTREE].flatMap((script) => [script, ...chargesPar(script)]))
  assert.ok(machinerie.has('barriere-outil.mjs') && machinerie.has('repartition.mjs'), [...machinerie].join(', '))
  assert.deepEqual(
    gardesAEffets(HOOKS, machinerie).map((f) => `scripts/hooks/${f.fichier}:${f.ligne} ${f.texte}`),
    [],
    'une garde est PURE (scripts/guards/lib/contratGarde.mjs) : le point d’entrée (scripts/hooks/repartiteur.mjs) lit, écrit et sort',
  )
})

test('demandes : le littéral `ask` du CODE, toute quote ; sa MENTION en commentaire ne l’est pas', () => {
  const cas = [
    ["return { decision: 'ask', raison }", true, 'quote simple'],
    ['x.permissionDecision = "ask"', true, 'quote double'],
    ['if (d === `ask`) f()', true, 'gabarit'],
    ["// Aucune garde ne DEMANDE ('ask')", false, 'commentaire'],
    ["const t = 'on ask rien'", false, 'mot dans une chaîne'],
    ["return { decision: 'deny', raison }", false, 'deny'],
  ]
  for (const [source, attendu, quoi] of cas) {
    assert.equal(demandes(source).length > 0, attendu, `${quoi} — source : ${source}`)
  }
  assert.deepEqual(demandes("// l1\nconst d = 'ask'"), [{ ligne: 2, texte: "const d = 'ask'" }])
})

test('aucun module de scripts/hooks/ ni de scripts/guards/lib/ ne rend une décision `ask` (arbitrage 2026-09-28, #2125)', () => {
  assert.deepEqual(
    modulesQuiDemandent([HOOKS, fileURLToPath(new URL('.', import.meta.url))]).map((f) => `${f.fichier}:${f.ligne} ${f.texte}`),
    [],
    'une garde REFUSE (deny, raison actionnable) ou AVERTIT (contexte) : scripts/guards/lib/contratGarde.mjs',
  )
})

test('chaque script déclaré dans `.claude/settings.json` et `.codex/hooks.json` est un point d’entrée (#2125)', () => {
  const declares = [SURFACE_CLAUDE, SURFACE_CODEX].flatMap((surface) => aplatirHooks(JSON.parse(readFileSync(`${RACINE}${surface}`, 'utf8')), surface))
  assert.ok(declares.length > 0, 'aucun hook déclaré : la lecture est cassée')
  assert.deepEqual(declares.filter((h) => !POINTS_D_ENTREE.has(h.script)).map((h) => `${h.path} ${h.command}`), [])
})
