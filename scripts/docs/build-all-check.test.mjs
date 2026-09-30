// Contrat de `docs:check` (#1679 L2 T1d, #1801, #1775, #2203) :
//   · `--check` rejoue chaque générateur et compare son rendu au DISQUE, sans rien écrire ;
//   · `--tout` et `--plateforme` rendent en plus sous une autre plateforme ;
//   · un rouge ne se dit guéri par `docs:build` que si l'hôte a DÉCLARÉ ses corps périmés, et chaque
//     plateforme les mêmes ;
//   · en `--check`, `executer` va au bout : chaque rouge est nommé avec sa nature.
//   node --test scripts/docs/build-all-check.test.mjs  (chaîné dans `npm run test:docs`)
//
// Les cas de bout en bout jouent `executer` pour de vrai, `generateurs` injectés, sur un DÉPÔT
// JETABLE et des générateurs RÉELS qui passent par `ecrireOuVerifier`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ENTETE_ROUGES, guerissable, issueDe, natureDuRouge, PLATEFORMES, rougesNommes } from './build-all.mjs'
import { CODE_CORPS_PERIME } from './lib/ecriture-derives.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte. Patron :
// `scripts/docs/lib/ecriture-derives.test.mjs`.
const doc = (nom) => ['docs', `${nom}.md`].join('/')
const DOC_A = doc('a')
const DOC_B = doc('b')

test('natureDuRouge : le bit du corps périmé ne se lit que sur les codes de la convention (2 et 3)', () => {
  assert.equal(natureDuRouge({ status: CODE_CORPS_PERIME }), 'corps périmé')
  assert.equal(natureDuRouge({ status: 1 | CODE_CORPS_PERIME }), 'corps périmé + sortie 1')
  assert.equal(natureDuRouge({ status: 1 }), 'sortie 1')
  // Codes réservés de Node (13 : top-level await inachevé ; 6, 7 : échecs internes) : jamais un corps.
  for (const status of [13, 6, 7]) assert.equal(natureDuRouge({ status }), `sortie ${status}`)
  assert.equal(natureDuRouge({ status: 3221225794 }), 'sortie 3221225794')
})

test('natureDuRouge : un processus tué ou coupé se nomme par son signal ou son errno, jamais « non démarré »', () => {
  assert.equal(natureDuRouge(issueDe({ status: null, signal: 'SIGKILL' })), 'tué par SIGKILL')
  assert.equal(natureDuRouge(issueDe({ status: null, signal: 'SIGTERM', code: 'ENOBUFS', message: 'spawnSync node ENOBUFS' })), 'ENOBUFS (tué par SIGTERM)')
  assert.equal(natureDuRouge(issueDe({ code: 'ENOENT', message: 'spawnSync x ENOENT' })), 'ENOENT')
})

test('guerissable : seul un corps périmé SEUL se guérit en régénérant', () => {
  assert.equal(guerissable({ status: CODE_CORPS_PERIME, signal: null, code: null }), true)
  for (const issue of [{ status: 1 | CODE_CORPS_PERIME }, { status: 1 }, { status: 13 }, { status: null, signal: 'SIGKILL' }, { status: null, code: 'ENOBUFS' }]) {
    assert.equal(guerissable(issueDe(issue)), false, JSON.stringify(issue))
  }
})

test('rougesNommes : les lignes du DERNIER bilan, rien d’autre', () => {
  const sortie = ['bruit', `${ENTETE_ROUGES} (2) :`, '  docs:check — a — corps périmé', '  docs:check — b — sortie 1', 'après'].join('\n')
  assert.deepEqual(rougesNommes(sortie), ['docs:check — a — corps périmé', 'docs:check — b — sortie 1'])
  assert.deepEqual(rougesNommes('docs:check — OK'), [])
})

// ── De bout en bout : `executer`, `generateurs` injectés, sur des générateurs RÉELS ─────────────

const PRIMITIVE = pathToFileURL(path.join(ICI, 'lib', 'ecriture-derives.mjs')).href
const BUILD_ALL = pathToFileURL(path.join(ICI, 'build-all.mjs')).href

/** Un générateur RÉEL : lit ses DEUX sources (`SEUIL_SOURCES`), rend un doc qui CITE un chemin, et
 *  passe par la primitive. `cliquet` : sous `BANC_SORTIE=<code>`, il pose ce code AVANT la
 *  primitive, comme `reconcile.mjs` — les deux rouges doivent alors se dire. `separateur` : le
 *  chemin cité est bâti par `path.join`, donc rendu dans la graphie de la plateforme. */
const generateurReel = (nom, { cliquet = false, separateur = false } = {}) => [
  "import { readFileSync } from 'node:fs'",
  "import path from 'node:path'",
  `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
  `const lu = readFileSync('src/${nom}.ts', 'utf8') + readFileSync('src/commun.ts', 'utf8')`,
  cliquet ? "if (process.env.BANC_SORTIE) { console.log('CLIQUET ROUGE'); process.exitCode = Number(process.env.BANC_SORTIE) }" : '',
  'ecrireOuVerifier({',
  `  out: \`# ${nom}\\n\\nSource : \\\`${separateur ? `\${path.join('src', '${nom}.ts')}` : `src/${nom}.ts`}\\\` (\${lu.length} octets)\\n\`,`,
  `  path: 'docs/${nom}.md',`,
  "  check: process.argv.includes('--check'),",
  `  staleMsg: 'docs/${nom}.md PÉRIMÉ', rerunMsg: 'relancer',`,
  '})',
].join('\n')

const GENERATEURS_REELS = [
  { runner: 'node', script: 'g/a.mjs', targets: [DOC_A] },
  { runner: 'node', script: 'g/b.mjs', targets: [DOC_B] },
]

/** Joue `executer` dans un processus À PART (il imprime sur stderr, que le banc lit), par un HARNAIS
 *  posé sous le `node_modules/` ignoré du dépôt jetable : un module qui en importe un autre par
 *  `file://` absolu, lancé comme tout script. */
function executer(racine, argv, env = {}, verificateurs = [], generateurs = GENERATEURS_REELS) {
  const harnais = path.join(racine, 'node_modules', 'harnais-executer.mjs')
  mkdirSync(path.dirname(harnais), { recursive: true })
  writeFileSync(harnais, [
    `import { executer } from ${JSON.stringify(BUILD_ALL)}`,
    `process.exitCode = await executer({ cwd: ${JSON.stringify(racine)}, argv: ${JSON.stringify(['--quiet', ...argv])}, generateurs: ${JSON.stringify(generateurs)}, verificateurs: ${JSON.stringify(verificateurs)} })`,
  ].join('\n'))
  const r = spawnSync(process.execPath, [harnais], { cwd: racine, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, sortie: `${r.stdout}${r.stderr}` }
}

/** Dépôt jetable RÉGÉNÉRÉ par `executer` lui-même (docs, `.sources-lues.json`), puis stagé. */
function depotReel({ separateur = false } = {}) {
  const { racine } = instanceDeDepot({
    commit: false,
    fichiers: {
      '.gitignore': 'node_modules/\n',
      'src/a.ts': 'export const a = 1\n',
      'src/b.ts': 'export const b = 1\n',
      'src/commun.ts': 'export const commun = 1\n',
      'g/a.mjs': generateurReel('a', { separateur }),
      'g/b.mjs': generateurReel('b', { cliquet: true }),
    },
  })
  mkdirSync(path.join(racine, 'docs'), { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  const build = executer(racine, [])
  assert.equal(build.status, 0, `docs:build du banc : ${build.sortie}`)
  git('add', '-A')
  return { racine, git }
}

test('`--check` rejoue chaque générateur : un corps « rendu sous une autre plateforme » posé sur le disque est périmé, et `--check --tout` le nomme', () => {
  const { racine } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    const rendu = readFileSync(cible, 'utf8')
    const corpsAutrePlateforme = rendu.replaceAll('src/a.ts', 'src\\a.ts')
    assert.notEqual(corpsAutrePlateforme, rendu, 'la fixture n’a substitué aucun séparateur')
    writeFileSync(cible, corpsAutrePlateforme)

    const cible_ = executer(racine, ['--check'])
    assert.equal(cible_.status, CODE_CORPS_PERIME, `--check : ${cible_.sortie}`)
    assert.match(cible_.sortie, /docs:check — g\/a\.mjs — corps périmé\n/)

    // `--plateforme <hôte>` n'a aucune autre plateforme à rendre.
    const hote = executer(racine, ['--check', '--plateforme', process.platform])
    assert.equal(hote.status, CODE_CORPS_PERIME, `--check --plateforme ${process.platform} : ${hote.sortie}`)
    assert.match(hote.sortie, /docs:check — g\/a\.mjs — corps périmé\n/)

    const tout = executer(racine, ['--check', '--tout'])
    assert.equal(tout.status, CODE_CORPS_PERIME, `--check --tout, seul rouge un corps périmé, que \`docs:build\` guérit : ${tout.sortie}`)
    assert.match(tout.sortie, /docs:check — g\/a\.mjs — corps périmé/)
    // Rendu sous chaque autre plateforme, le même corps périmé : l'hôte le guérit en régénérant.
    for (const p of Object.keys(PLATEFORMES).filter((p) => p !== process.platform)) {
      assert.ok(tout.sortie.includes(`docs:check — g/a.mjs — rendu sous ${p} — corps périmé\n`), tout.sortie)
    }
    assert.match(tout.sortie, /disque : "Source : `src\\\\a\.ts`/, 'la divergence nomme la graphie du disque')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

const AUTRES_PLATEFORMES = Object.keys(PLATEFORMES).filter((p) => p !== process.platform)
/** Raison d'un corps périmé que `docs:build` ne guérit pas : l'hôte et `p` en déclarent d'autres. */
const DIVERGENT = (p) => ` : l'hôte et ${p} ne déclarent pas les mêmes corps périmés, \`docs:build\` ne le guérit pas\n`

test('`--check --tout` : corps du disque périmé ET rendu propre à la plateforme — `docs:build` ne guérit pas l’écart de la plateforme, sortie 1', { skip: !AUTRES_PLATEFORMES.length && 'hôte sans autre plateforme à rendre' }, () => {
  const { racine, git } = depotReel({ separateur: true })
  try {
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    const rouge = executer(racine, ['--check', '--tout'])
    assert.equal(rouge.status, 1, `le corps rendu sous une autre plateforme n'est pas celui que \`docs:build\` écrit : ${rouge.sortie}`)
    const [premiere] = AUTRES_PLATEFORMES
    assert.ok(rouge.sortie.includes(`docs:check — g/a.mjs — corps périmé${DIVERGENT(premiere)}`), rouge.sortie)
    for (const p of AUTRES_PLATEFORMES) {
      assert.ok(rouge.sortie.includes(`docs:check — g/a.mjs — rendu sous ${p} — corps périmé${DIVERGENT(premiere)}`), rouge.sortie)
    }

    // `docs:build` régénère : le rouge de l'hôte guérit, celui de la plateforme SUBSISTE.
    assert.equal(executer(racine, []).status, 0)
    git('add', '-A')
    const apres = executer(racine, ['--check', '--tout'])
    assert.equal(apres.status, 1, apres.sortie)
    assert.doesNotMatch(apres.sortie, /docs:check — g\/a\.mjs — corps périmé/)
    for (const p of AUTRES_PLATEFORMES) {
      assert.ok(apres.sortie.includes(`docs:check — g/a.mjs — rendu sous ${p} — corps périmé${DIVERGENT(premiere)}`), apres.sortie)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check --tout` : corps du disque = rendu d’une AUTRE plateforme — le rouge de l’hôte ne guérit pas, sortie 1', { skip: !AUTRES_PLATEFORMES.length && 'hôte sans autre plateforme à rendre' }, () => {
  const { racine, git } = depotReel({ separateur: true })
  try {
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('`src/a.ts`', '`src\\a.ts`'))
    git('add', DOC_A)
    const rouge = executer(racine, ['--check', '--tout'])
    assert.equal(rouge.status, 1, `\`docs:build\` écrirait le rendu de l'hôte et ferait naître le rouge de l'autre plateforme : ${rouge.sortie}`)
    assert.ok(rouge.sortie.includes(`docs:check — g/a.mjs — corps périmé${DIVERGENT(AUTRES_PLATEFORMES[0])}`), rouge.sortie)
    for (const p of AUTRES_PLATEFORMES) assert.ok(!rouge.sortie.includes(`rendu sous ${p} — corps périmé`), rouge.sortie)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check --tout` va AU BOUT : un corps périmé ET un cliquet rouge dans le même run, nommés chacun par sa nature', () => {
  const { racine, git } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    const rouge = executer(racine, ['--check', '--tout'], { BANC_SORTIE: '1' })
    assert.equal(rouge.status, 1, `un cliquet ne se guérit pas en régénérant : ${rouge.sortie}`)
    // `g/a.mjs` est rouge le PREMIER : `g/b.mjs`, qui le suit, doit rendre son verdict quand même —
    // sur l'hôte, et sous chaque autre plateforme rendue par `--tout`.
    const autres = Object.keys(PLATEFORMES).filter((p) => p !== process.platform)
    assert.match(rouge.sortie, /docs:check — g\/a\.mjs — corps périmé\n/)
    assert.match(rouge.sortie, /docs:check — g\/b\.mjs — sortie 1\n/)
    for (const p of autres) {
      assert.ok(rouge.sortie.includes(`docs:check — g/a.mjs — rendu sous ${p} — corps périmé\n`), rouge.sortie)
      assert.ok(rouge.sortie.includes(`docs:check — g/b.mjs — rendu sous ${p} — sortie 1\n`), rouge.sortie)
    }
    assert.match(rouge.sortie, new RegExp(`docs:check — ROUGE \\(${2 * (1 + autres.length)}\\)`))

    // Tout re-rendu : vert.
    assert.equal(executer(racine, []).status, 0)
    git('add', '-A')
    const vert = executer(racine, ['--check', '--tout'])
    assert.equal(vert.status, 0, vert.sortie)
    assert.match(vert.sortie, /docs:check — OK/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check --tout` : une sortie 2 sans corps DÉCLARÉ périmé ne se dit pas guérissable, sortie 1', () => {
  const { racine } = depotReel()
  try {
    const rouge = executer(racine, ['--check', '--tout'], { BANC_SORTIE: String(CODE_CORPS_PERIME) })
    assert.equal(rouge.status, 1, `aucun corps déclaré : \`docs:build\` n'a rien de prouvé à guérir : ${rouge.sortie}`)
    assert.ok(
      rouge.sortie.includes('docs:check — g/b.mjs — corps périmé : aucun corps déclaré périmé (`declarerCorpsPerime`), `docs:build` ne le guérit pas\n'),
      rouge.sortie,
    )
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`executer` purge son cache de lectures et de corps à chaque sortie, verte, rouge ou en ARRÊT', () => {
  const { racine, git } = depotReel()
  const cache = path.join(racine, 'node_modules', '.cache', 'lectures-docs')
  const restes = () => listerDossier(cache, { absent: 'vide' })
  try {
    assert.deepEqual(restes(), [], 'après `docs:build` vert')
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    assert.equal(executer(racine, ['--check', '--tout']).status, CODE_CORPS_PERIME)
    assert.deepEqual(restes(), [], 'après `--check --tout` rouge')
    assert.equal(executer(racine, [], { BANC_SORTIE: '1' }).status, 1)
    assert.deepEqual(restes(), [], 'après un ARRÊT de `docs:build`')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check` : un VÉRIFICATEUR rouge est nommé, et sort à 1 (aucune régénération ne le guérit)', () => {
  const { racine } = depotReel()
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v', 'rouge.mjs'), "console.error('VÉRIFICATEUR ROUGE'); process.exitCode = 1\n")
    const rouge = executer(racine, ['--check', '--tout'], {}, ['v/rouge.mjs'])
    assert.equal(rouge.status, 1, rouge.sortie)
    assert.match(rouge.sortie, /VÉRIFICATEUR ROUGE/)
    assert.match(rouge.sortie, /docs:check — ROUGE \(1\) :\n {2}docs:check — v\/rouge\.mjs — sortie 1\n/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une cible LITTÉRALE déclarée que le rendu ne produit pas est REFUSÉE, nommément, en écriture comme en `--check`', () => {
  const { racine } = depotReel()
  const fantome = doc('fantome')
  const generateurs = [{ ...GENERATEURS_REELS[0], targets: [DOC_A, fantome] }, GENERATEURS_REELS[1]]
  const refus = `ARRÊT sur g/a.mjs : cible(s) LITTÉRALE(S) déclarée(s) que son rendu ne produit pas : ${fantome}.`
  try {
    const build = executer(racine, [], {}, [], generateurs)
    assert.equal(build.status, 1, build.sortie)
    assert.ok(build.sortie.includes(refus), build.sortie)
    const check = executer(racine, ['--check', '--tout'], {}, [], generateurs)
    assert.equal(check.status, 1, check.sortie)
    assert.ok(check.sortie.includes(refus), check.sortie)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
