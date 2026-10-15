// Contrat de l'ÉCRIVAIN UNIQUE des dérivés (#2603) : une passe détachée PRÉEMPTÉE par un post-hook n'écrit plus,
// et le registre de code que le hook laisse n'est jamais plus vieux que ses sources.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { attendreSync, BACKOFFS_MS } from '../../guards/lib/spawnResilient.mjs'
import { gitDirDe } from '../../hooks/barriere-outil.mjs'
import { reconstruireApresGit } from '../../git-hooks/docs-rebuild.mjs'
import { executer, GENERATORS } from '../build-all.mjs'
import { ATTENTE_DU_HOOK, cheminsDeLEcrivain, ENV_EPOQUE, MARGE_DU_HOOK_MS, ENV_TENU, envDeLaPasse, epoqueDe, operationEnCours, preempterLesDerives, sousLEpoque } from './ecrivain-derives.mjs'
import { ecrireDoc } from './ecriture-derives.mjs'
import { prendreVerrou } from '../../test/verrou.mjs'

const url = (rel) => pathToFileURL(fileURLToPath(new URL(rel, import.meta.url))).href

/** Attend `existsSync(chemin)`, au plus `ms`. */
function attendreFichier(chemin, ms = 60_000) {
  const fin = Date.now() + ms
  while (!existsSync(chemin)) {
    if (Date.now() > fin) throw new Error(`${chemin} absent après ${ms} ms`)
    attendreSync(50)
  }
}

test('#2603 — banc de la course : la passe en vol lit l’ancienne source, le post-hook écrit le registre, la passe ne le réécrit pas plus vieux', async () => {
  const { racine } = instanceDeDepot({ fichiers: { 'src/s.txt': 'v1\n' } })
  const registre = join(racine, 'reg.js')
  const signaux = mkdtempSync(join(tmpdir(), 'course-'))
  const generateur = join(signaux, 'gen-lent.mjs')
  writeFileSync(generateur, [
    `import { appendFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'`,
    `import { ecrireDoc } from ${JSON.stringify(url('./ecriture-derives.mjs'))}`,
    `const runs = ${JSON.stringify(join(signaux, 'runs'))}`,
    `const n = (existsSync(runs) ? readFileSync(runs, 'utf8').length : 0) + 1`,
    `appendFileSync(runs, 'x')`,
    `const source = readFileSync(${JSON.stringify(join(racine, 'src/s.txt'))}, 'utf8').trim()`,
    `writeFileSync(${JSON.stringify(join(signaux, 'lu'))}, source)`,
    `while (!existsSync(${JSON.stringify(join(signaux, 'go'))})) await new Promise((r) => setTimeout(r, 50))`,
    `try { ecrireDoc(${JSON.stringify(registre)}, \`// depuis \${source}\\n\`) }`,
    `finally { writeFileSync(${JSON.stringify(join(signaux, 'apres-'))} + n, readFileSync(${JSON.stringify(registre)}, 'utf8')) }`,
  ].join('\n'))
  const passe = join(signaux, 'passe.mjs')
  writeFileSync(passe, [
    `import { spawnSync } from 'node:child_process'`,
    `import { demanderLaReconstruction, servirLesDemandes } from ${JSON.stringify(url('../../git-hooks/reconstruction.mjs'))}`,
    `const racine = ${JSON.stringify(racine)}`,
    `demanderLaReconstruction(racine, { detacher: () => 0 })`,
    `servirLesDemandes({ racine, passe: ({ env }) => spawnSync(process.execPath, [${JSON.stringify(generateur)}], { env: { ...process.env, ...env }, stdio: 'inherit' }).status ?? 1 })`,
  ].join('\n'))
  const enfant = spawn(process.execPath, [passe], { cwd: racine, stdio: ['ignore', 'inherit', 'inherit'] })
  const fini = once(enfant, 'exit')
  try {
    attendreFichier(join(signaux, 'lu'))
    writeFileSync(join(racine, 'src/s.txt'), 'v2\n')
    const vu = reconstruireApresGit({
      cwd: racine, hook: 'post-merge', annoncer: () => {}, demander: () => 1,
      generateurs: [{ script: 'gen.mjs', targets: ['reg.js'] }],
      code: () => {
        ecrireDoc(registre, `// depuis ${readFileSync(join(racine, 'src/s.txt'), 'utf8').trim()}\n`)
        return 0
      },
    })
    assert.deepEqual(vu, { code: 0, seq: 1 })
    assert.equal(readFileSync(registre, 'utf8'), '// depuis v2\n')
    writeFileSync(join(signaux, 'go'), '')
    const [code] = await fini
    assert.equal(code, 0)
    assert.equal(readFileSync(join(signaux, 'apres-1'), 'utf8'), '// depuis v2\n', 'la passe préemptée n’écrit pas le registre lu sur l’ancienne source')
    assert.equal(readFileSync(registre, 'utf8'), '// depuis v2\n', 'le registre que le hook a laissé n’est jamais réécrit plus vieux que sa source')
  } finally {
    if (enfant.exitCode === null) enfant.kill()
    rmSync(signaux, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 })
  }
})

test('#2603 — sousLEpoque : sans passe, écrit ; à l’époque attendue, écrit ; préemptée, LÈVE sans écrire', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ecrivain-'))
  try {
    mkdirSync(join(racine, '.git'))
    const chemins = cheminsDeLEcrivain(join(racine, '.git'))
    let ecrits = 0
    const ecrire = () => ++ecrits
    assert.equal(sousLEpoque(ecrire, { env: {}, cwd: racine }), 1)
    const env = envDeLaPasse(epoqueDe(chemins))
    assert.equal(sousLEpoque(ecrire, { env, cwd: racine }), 2)
    assert.equal(preempterLesDerives(chemins, 'banc', () => process.env[ENV_TENU]), epoqueDe(chemins))
    assert.equal(process.env[ENV_TENU], undefined)
    assert.notEqual(epoqueDe(chemins), '')
    assert.throws(() => sousLEpoque(ecrire, { env, cwd: racine }), /passe préemptée/)
    assert.equal(ecrits, 2)
    assert.equal(sousLEpoque(ecrire, { env: envDeLaPasse(epoqueDe(chemins)), cwd: racine }), 3)
    assert.deepEqual(env, { [ENV_EPOQUE]: env[ENV_EPOQUE], GIT_OPTIONAL_LOCKS: '0' })
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2603 — preempterLesDerives : verrou tenu à l’échéance → refus nommé, époque inchangée, rien joué', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ecrivain-'))
  try {
    const chemins = cheminsDeLEcrivain(racine)
    const avant = epoqueDe(chemins)
    const prise = prendreVerrou({ chemin: chemins.verrou, libelle: 'tenant', commande: 'tenant' })
    assert.equal(prise.etat, 'pris')
    try {
      let joue = false
      const vu = preempterLesDerives(chemins, 'banc', () => { joue = true }, { attente: { echeanceMs: 100, pasMs: 20 } })
      assert.match(/** @type {any} */ (vu).refus, /tenu par le PID/)
      assert.equal(joue, false)
      assert.equal(epoqueDe(chemins), avant)
    } finally {
      prise.liberer()
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2603 — les chemins de l’écrivain vivent sous le répertoire git de l’arbre', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  try {
    assert.equal(cheminsDeLEcrivain(gitDirDe(racine)).epoque, join(racine, '.git', 'hooks-git', 'derives-epoque'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2603 — sousLEpoque : une opération git en cours préempte la passe, rien n’écrit ; hors passe, le verrou tenu par un tiers LÈVE', () => {
  const racine = mkdtempSync(join(tmpdir(), 'ecrivain-'))
  try {
    mkdirSync(join(racine, '.git'))
    const gitDir = join(racine, '.git')
    const chemins = cheminsDeLEcrivain(gitDir)
    const env = envDeLaPasse(epoqueDe(chemins))
    writeFileSync(join(gitDir, 'index.lock'), '')
    assert.equal(operationEnCours(gitDir), 'index.lock')
    let ecrits = 0
    assert.throws(() => sousLEpoque(() => ++ecrits, { env, cwd: racine }), /index\.lock en cours/)
    assert.notEqual(epoqueDe(chemins), env[ENV_EPOQUE])
    rmSync(join(gitDir, 'index.lock'))
    assert.equal(operationEnCours(gitDir), null)
    assert.throws(() => sousLEpoque(() => ++ecrits, { env, cwd: racine }), /passe préemptée/)
    const prise = prendreVerrou({ chemin: chemins.verrou, libelle: 'tenant', commande: 'tenant' })
    try {
      assert.throws(() => sousLEpoque(() => ++ecrits, { env: {}, cwd: racine, attente: { echeanceMs: 100, pasMs: 20 } }), /tenu par le PID/)
    } finally {
      prise.liberer()
    }
    assert.equal(ecrits, 0)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Une passe détachée (`servirLesDemandes`) de `racine` qui joue un générateur lent : il lit la source, signale
 *  `lu-<n>`, attend `go`, puis écrit `reg.js` par `ecrireDoc` ; `ecrit-<n>` porte l'`index.lock` vu après
 *  l'écriture, `refus-<n>` le refus. REND le processus et sa fin. */
function passeLente(racine, signaux) {
  const generateur = join(signaux, 'gen-lent.mjs')
  writeFileSync(generateur, [
    `import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'`,
    `import { join } from 'node:path'`,
    `import { ecrireDoc } from ${JSON.stringify(url('./ecriture-derives.mjs'))}`,
    `const s = (nom) => join(${JSON.stringify(signaux)}, nom)`,
    `const n = (existsSync(s('runs')) ? readFileSync(s('runs'), 'utf8').length : 0) + 1`,
    `appendFileSync(s('runs'), 'x')`,
    `const source = readFileSync(${JSON.stringify(join(racine, 'src/s.txt'))}, 'utf8').trim()`,
    `writeFileSync(s('lu-' + n), source)`,
    `while (!existsSync(s('go'))) await new Promise((r) => setTimeout(r, 50))`,
    `try {`,
    `  ecrireDoc(${JSON.stringify(join(racine, 'reg.js'))}, '// depuis ' + source)`,
    `  writeFileSync(s('ecrit-' + n), String(existsSync(${JSON.stringify(join(racine, '.git', 'index.lock'))})))`,
    `} catch (e) { writeFileSync(s('refus-' + n), String(e.message)) }`,
  ].join('\n'))
  const passe = join(signaux, 'passe.mjs')
  writeFileSync(passe, [
    `import { spawnSync } from 'node:child_process'`,
    `import { demanderLaReconstruction, servirLesDemandes } from ${JSON.stringify(url('../../git-hooks/reconstruction.mjs'))}`,
    `const racine = ${JSON.stringify(racine)}`,
    `demanderLaReconstruction(racine, { detacher: () => 0 })`,
    `servirLesDemandes({ racine, attenteArbre: { echeanceMs: 60_000, pasMs: 50 }, passe: ({ env }) => spawnSync(process.execPath, [${JSON.stringify(generateur)}], { env: { ...process.env, ...env }, stdio: 'inherit' }).status ?? 1 })`,
  ].join('\n'))
  const enfant = spawn(process.execPath, [passe], { cwd: racine, stdio: ['ignore', 'inherit', 'inherit'] })
  return { enfant, fini: once(enfant, 'exit') }
}

test('#2603 — executer --code concurrent à une passe la PRÉEMPTE : la passe ne l’écrit pas, se rejoue, puis écrit', async () => {
  const { racine } = instanceDeDepot({ fichiers: { 'src/s.txt': 'v1\n' } })
  const signaux = mkdtempSync(join(tmpdir(), 'preempte-'))
  const { enfant, fini } = passeLente(racine, signaux)
  try {
    attendreFichier(join(signaux, 'lu-1'))
    const chemins = cheminsDeLEcrivain(join(racine, '.git'))
    const avant = epoqueDe(chemins)
    assert.equal(executer({ cwd: racine, argv: ['--code'], generateurs: [] }), 0)
    assert.notEqual(epoqueDe(chemins), avant, 'executer --code pose une époque neuve')
    writeFileSync(join(signaux, 'go'), '')
    const [code] = await fini
    assert.equal(code, 0)
    assert.match(readFileSync(join(signaux, 'refus-1'), 'utf8'), /passe préemptée/)
    assert.equal(existsSync(join(signaux, 'ecrit-1')), false)
    assert.equal(readFileSync(join(signaux, 'ecrit-2'), 'utf8'), 'false', 'la passe rejouée écrit')
    assert.equal(readFileSync(join(racine, 'reg.js'), 'utf8'), '// depuis v1')
  } finally {
    if (enfant.exitCode === null) enfant.kill()
    rmSync(signaux, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 })
  }
})

test('#2603 — banc : une passe lente et un git checkout concurrent, zéro écriture pendant l’opération, la passe se rejoue après', async () => {
  const { racine } = instanceDeDepot({ fichiers: { 'src/s.txt': 'v1\n' } })
  const signaux = mkdtempSync(join(tmpdir(), 'checkout-'))
  const git = (...args) => {
    const vu = spawnSync('git', args, { cwd: racine, encoding: 'utf8' })
    assert.equal(vu.status, 0, `git ${args.join(' ')} : ${vu.stderr}`)
    return vu.stdout.trim()
  }
  const lent = join(signaux, 'smudge-lent.mjs')
  writeFileSync(lent, [
    'const morceaux = []',
    'for await (const m of process.stdin) morceaux.push(m)',
    'await new Promise((r) => setTimeout(r, 3000))',
    'process.stdout.write(Buffer.concat(morceaux))',
  ].join('\n'))
  const tronc = git('rev-parse', '--abbrev-ref', 'HEAD')
  git('checkout', '-q', '-b', 'autre')
  writeFileSync(join(racine, '.gitattributes'), '*.lent filter=lent\n')
  writeFileSync(join(racine, 'f.lent'), 'lent\n')
  git('add', '.gitattributes', 'f.lent')
  git('-c', 'user.name=banc', '-c', 'user.email=banc@exemple.invalid', 'commit', '-q', '-m', 'lent')
  git('checkout', '-q', tronc)
  const posix = (p) => p.split('\\').join('/')
  git('config', 'filter.lent.smudge', `"${posix(process.execPath)}" "${posix(lent)}"`)
  const { enfant, fini } = passeLente(racine, signaux)
  let checkout
  try {
    attendreFichier(join(signaux, 'lu-1'))
    checkout = spawn('git', ['checkout', '-q', 'autre'], { cwd: racine, stdio: 'ignore' })
    const checkoutFini = once(checkout, 'exit')
    attendreFichier(join(racine, '.git', 'index.lock'))
    writeFileSync(join(signaux, 'go'), '')
    const [codeCheckout] = await checkoutFini
    assert.equal(codeCheckout, 0)
    const [code] = await fini
    assert.equal(code, 0)
    assert.match(readFileSync(join(signaux, 'refus-1'), 'utf8'), /index\.lock en cours/)
    assert.equal(existsSync(join(signaux, 'ecrit-1')), false, 'aucune écriture pendant le checkout')
    assert.equal(readFileSync(join(signaux, 'ecrit-2'), 'utf8'), 'false', 'la passe rejouée écrit, arbre libre')
  } finally {
    if (checkout && checkout.exitCode === null) checkout.kill()
    if (enfant.exitCode === null) enfant.kill()
    rmSync(signaux, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 })
  }
})

/** Les écritures directes de `node:fs` qu'un générateur ne fait jamais sur ses cibles : il passe par `ecrireDoc`. */
const ECRITURE_DIRECTE = /\b(?:writeFileSync|writeFile|appendFileSync|createWriteStream)\s*\(/

test('#2603 — tout générateur de GENERATORS écrit ses cibles et ses blocs injectés par ecrireDoc, jamais en écriture directe', () => {
  const racine = fileURLToPath(new URL('../../../', import.meta.url))
  const directs = GENERATORS.filter((g) => ECRITURE_DIRECTE.test(readFileSync(join(racine, g.script), 'utf8'))).map((g) => g.script)
  assert.deepEqual(directs, [])
})

test('#2603 — ATTENTE_DU_HOOK couvre les paliers de BACKOFFS_MS et sa marge, dans la borne de 10 s', () => {
  assert.equal(ATTENTE_DU_HOOK.echeanceMs, BACKOFFS_MS.reduce((s, ms) => s + ms, 0) + MARGE_DU_HOOK_MS)
  assert.ok(ATTENTE_DU_HOOK.echeanceMs <= 10_000, 'attente du hook dans sa borne de 10 s (#2603)')
})
