// Contrat de `docs:check` (#1679 L2 T1d, #1801, #1775) :
//   · CIBLÉ, un générateur dont toutes les cibles portent un pied qui signe LES MÊMES SOURCES et LEUR
//     PROPRE CORPS n'est pas rejoué ; tout le reste l'est, et le dit ;
//   · la fraîcheur est AVEUGLE à la plateforme qui a rendu un corps — `--tout` et `--plateforme`
//     (l'hôte compris) rejouent chaque générateur ;
//   · un rouge ne se dit guéri par `docs:build` que si l'hôte a DÉCLARÉ ses corps périmés, et chaque
//     plateforme les mêmes ;
//   · en `--check`, `executer` va au bout : chaque rouge est nommé avec sa nature.
//   node --test scripts/docs/build-all-check.test.mjs  (chaîné dans `npm run test:docs`)
//
// Chaque cas tourne sur un DÉPÔT JETABLE avec des générateurs FICTIFS (patron
// `scripts/docs/lib/enregistreur-lectures.test.mjs`) : la fraîcheur se juge sur l'INDEX et le DISQUE,
// donc elle ne se mesure que dans un dépôt dont on tient les deux. Les cas de bout en bout jouent
// `executer` pour de vrai, `generateurs` injectés, sur des générateurs RÉELS qui passent par
// `ecrireOuVerifier`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  ENTETE_ROUGES, fraicheurDesGenerateurs, guerissable, issueDe, motifRejeuComplet, natureDuRouge, PLATEFORMES, rougesNommes,
  SOURCES_LUES, verdictDuPied,
} from './build-all.mjs'
import {
  avecPied,
  CODE_CORPS_PERIME,
  lirePied,
  empreinteDuDisque,
  indexGit,
  motifDeRejeu,
  retirerPied,
  serialiserSourcesLues,
  sha1Corps,
} from './lib/empreinte-sources.mjs'
import { ignoresGit } from './lib/chemin-mesure.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte. Patron :
// `scripts/docs/lib/empreinte-sources.test.mjs`.
const doc = (nom) => ['docs', `${nom}.md`].join('/')
const DOC_A = doc('a')
const DOC_B = doc('b')

/** Trois générateurs FICTIFS : deux qui signent un doc, un qui n'injecte qu'un bloc. */
const GENERATEURS = [
  { runner: 'node', script: 'g/a.mjs', targets: [DOC_A] },
  { runner: 'node', script: 'g/b.mjs', targets: [DOC_B] },
  { runner: 'node', script: 'g/bloc.mjs', targets: [], injecte: ['MANUSCRIT.md'] },
]

const SOURCES = { 'g/a.mjs': ['src/a.ts'], 'g/b.mjs': ['src/b.ts'], 'g/bloc.mjs': ['src/a.ts'] }

/** Empreinte des sources d'un générateur, telle que le DISQUE les porte — ce que le pied signe. */
function empreinteDe(racine, script) {
  const lues = { fichiers: SOURCES[script], dossiers: new Map([['src', listerDossier(path.join(racine, 'src'))]]) }
  return empreinteDuDisque(racine, lues, new Set()).empreinte
}

/** Signe les cibles d'un générateur comme le ferait `docs:build`. */
function signer(racine, script) {
  const empreinte = empreinteDe(racine, script)
  for (const cible of GENERATEURS.find((g) => g.script === script).targets) {
    const chemin = path.join(racine, cible)
    writeFileSync(chemin, avecPied(readFileSync(chemin, 'utf8'), { empreinte, fichiers: 1, dossiers: 1 }))
  }
}

/** Dépôt jetable : deux sources, deux docs signés, un manuscrit, et le dérivé des sources mesurées. */
function depot() {
  const { racine } = instanceDeDepot({
    commit: false,
    fichiers: {
      'src/a.ts': 'export const a = 1\n',
      'src/b.ts': 'export const b = 1\n',
      [DOC_A]: '# a\n',
      [DOC_B]: '# b\n',
      'MANUSCRIT.md': '# manuscrit\n',
    },
  })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  signer(racine, 'g/a.mjs')
  signer(racine, 'g/b.mjs')
  writeFileSync(
    path.join(racine, SOURCES_LUES),
    serialiserSourcesLues({
      'g/a.mjs': { cibles: [DOC_A], fichiers: ['src/a.ts'], dossiers: ['src'] },
      'g/b.mjs': { cibles: [DOC_B], fichiers: ['src/b.ts'], dossiers: ['src'] },
      'g/bloc.mjs': { cibles: [], fichiers: ['src/a.ts'], dossiers: ['src'] },
    }),
  )
  git('add', '-A')
  return { racine, git }
}

/** La mesure de fraîcheur, telle que `--check` la joue. */
function mesurer(racine) {
  const lues = JSON.parse(readFileSync(path.join(racine, SOURCES_LUES), 'utf8'))
  return fraicheurDesGenerateurs(racine, indexGit(racine), lues, ignoresGit(racine), GENERATEURS)
}

test('tout frais : aucun générateur signé n’est rejoué', () => {
  const { racine } = depot()
  try {
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()].sort(), ['g/a.mjs', 'g/b.mjs'])
    // Celui qui n'injecte qu'un bloc n'a aucune cible signée : rien n'est jugeable, il est rejoué.
    assert.deepEqual([...motifs.keys()], ['g/bloc.mjs'])
    assert.match(motifs.get('g/bloc.mjs'), /aucune cible signée/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une source modifiée et STAGÉE sans régénération : SEUL son générateur est rejoué', () => {
  const { racine, git } = depot()
  try {
    writeFileSync(path.join(racine, 'src', 'a.ts'), 'export const a = 2\n')
    git('add', 'src/a.ts')
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/b.mjs'], 'le générateur intact doit rester frais')
    assert.ok(motifs.has('g/a.mjs'), 'le générateur dont une source a bougé doit être rejoué')
    // Stagée, la source est la MÊME au disque et à l'index : c'est le PIED du doc, signé avant la
    // modification, qui dénonce le décalage.
    assert.match(motifs.get('g/a.mjs'), new RegExp(`^${DOC_A} : sources [0-9a-f]{12} au pied, [0-9a-f]{12} mesurées$`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une source modifiée et NON stagée est rejouée aussi (le disque est ce que le générateur lirait)', () => {
  const { racine } = depot()
  try {
    writeFileSync(path.join(racine, 'src', 'b.ts'), 'export const b = 99\n')
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/a.mjs'])
    assert.ok(motifs.has('g/b.mjs'), 'une source modifiée hors index laisserait un doc périmé « frais »')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un doc dérivé ÉDITÉ À LA MAIN : corps divergent, donc rejoué — ses sources n’ont pas bougé', () => {
  const { racine, git } = depot()
  try {
    const cible = path.join(racine, DOC_A)
    const avant = readFileSync(cible, 'utf8')
    // Le pied est CONSERVÉ à l'octet : seul le corps change. Aucune source n'a bougé.
    writeFileSync(cible, avant.replace('# a\n', '# a\n\nligne ajoutée à la main\n'))
    git('add', DOC_A)
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/b.mjs'])
    assert.match(motifs.get('g/a.mjs'), /corps divergent \(pied [0-9a-f]{12}, doc [0-9a-f]{12}\)/)
    assert.match(motifs.get('g/a.mjs'), /édité hors de son générateur/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un pied de la graphie SANS « corps: » est traité comme non signé : rejoué', () => {
  const { racine, git } = depot()
  try {
    const cible = path.join(racine, DOC_A)
    const texte = readFileSync(cible, 'utf8')
    const ancien = texte.replace(/ corps: [0-9a-f]{40} -->/, ' -->')
    assert.notEqual(ancien, texte, 'la fixture n’a pas retiré le champ corps')
    writeFileSync(cible, ancien)
    git('add', DOC_A)
    const { motifs } = mesurer(racine)
    assert.match(motifs.get('g/a.mjs'), /pied sans « corps: »/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un doc absent du disque est rejoué, jamais tenu pour frais', () => {
  const { racine } = depot()
  try {
    rmSync(path.join(racine, 'docs', 'a.md'))
    const { frais, motifs } = mesurer(racine)
    assert.deepEqual([...frais.keys()], ['g/b.mjs'])
    assert.match(motifs.get('g/a.mjs'), new RegExp(`^${DOC_A} : absent du disque$`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FAIL-CLOSED : sans le dérivé des sources au commit, ou s’il diverge, on rejoue TOUT', () => {
  assert.match(motifRejeuComplet(null, '{}\n'), /n'est pas dans l'index/)
  assert.match(motifRejeuComplet('{}\n', '{"a":1}\n'), /du disque diffère de celui de l'index/)
  assert.equal(motifRejeuComplet('{}\n', '{}\n'), null)
  assert.ok(motifRejeuComplet(null, null).includes(SOURCES_LUES), 'le refus doit NOMMER le dérivé manquant')
})

test('motifDeRejeu : les deux moitiés de la signature sont NÉCESSAIRES', () => {
  const signe = avecPied('# doc\n', { empreinte: 'a'.repeat(40), fichiers: 1, dossiers: 1 })
  assert.equal(motifDeRejeu(signe, 'a'.repeat(40)), null, 'sources et corps concordent : frais')
  assert.match(motifDeRejeu(signe, 'b'.repeat(40)), /sources aaaaaaaaaaaa au pied, bbbbbbbbbbbb mesurées/)
  assert.match(motifDeRejeu('# doc\n', 'a'.repeat(40)), /sans pied/)
  // Le corps signé est bien celui du doc SANS son pied.
  assert.equal(retirerPied(signe), '# doc\n')
  assert.ok(signe.includes(`corps: ${sha1Corps(signe)}`))
})

test('verdictDuPied : corps identique ne dit RIEN des sources — le pied périmé est rouge, nommé', () => {
  const empreinte = 'b'.repeat(40)
  const signe = avecPied('# doc\n', { empreinte: 'a'.repeat(40), fichiers: 1, dossiers: 1 })
  assert.equal(
    verdictDuPied({ pied: lirePied(signe), empreinte: 'a'.repeat(40), cible: DOC_A }),
    null,
    'un pied qui signe les sources mesurées est à jour',
  )
  assert.equal(
    verdictDuPied({ pied: lirePied(signe), empreinte, cible: DOC_A }),
    `pied PÉRIMÉ sur ${DOC_A} : sources aaaaaaaaaaaa ≠ bbbbbbbbbbbb, corps identique`,
  )
  assert.equal(
    verdictDuPied({ pied: lirePied('# doc\n'), empreinte, cible: DOC_A }),
    `pied ABSENT sur ${DOC_A} : sources bbbbbbbbbbbb non signées, corps identique`,
  )
})

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

const PRIMITIVE = pathToFileURL(path.join(ICI, 'lib', 'empreinte-sources.mjs')).href
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
function executer(racine, argv, env = {}, verificateurs = []) {
  const harnais = path.join(racine, 'node_modules', 'harnais-executer.mjs')
  mkdirSync(path.dirname(harnais), { recursive: true })
  writeFileSync(harnais, [
    `import { executer } from ${JSON.stringify(BUILD_ALL)}`,
    `process.exitCode = await executer({ cwd: ${JSON.stringify(racine)}, argv: ${JSON.stringify(['--quiet', ...argv])}, generateurs: ${JSON.stringify(GENERATEURS_REELS)}, verificateurs: ${JSON.stringify(verificateurs)} })`,
  ].join('\n'))
  const r = spawnSync(process.execPath, [harnais], { cwd: racine, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, sortie: `${r.stdout}${r.stderr}` }
}

/** Dépôt jetable RÉGÉNÉRÉ par `executer` lui-même (docs, pieds, `.sources-lues.json`), puis stagé. */
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

test('ANGLE MORT de la fraîcheur : un corps « rendu sous une autre plateforme » re-signé passe `--check`, et `--check --tout` le rougit', () => {
  const { racine, git } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    const committe = readFileSync(cible, 'utf8')
    // Le corps que rendrait une plateforme à séparateur `\`, re-signé par le pied qu'il portait :
    // sources ET corps signés, la fraîcheur n'a plus rien à lui reprocher.
    const corpsAutrePlateforme = retirerPied(committe).replaceAll('src/a.ts', 'src\\a.ts')
    assert.notEqual(corpsAutrePlateforme, retirerPied(committe), 'la fixture n’a substitué aucun séparateur')
    writeFileSync(cible, avecPied(corpsAutrePlateforme, lirePied(committe)))
    git('add', DOC_A)

    const cible_ = executer(racine, ['--check'])
    assert.equal(cible_.status, 0, `--check ciblé : ${cible_.sortie}`)
    assert.match(cible_.sortie, /docs:check — g\/a\.mjs — frais \(sources [0-9a-f]{12}, corps [0-9a-f]{12}\), non rejoué/)

    // `--plateforme <hôte>` n'a aucune autre plateforme à rendre, mais rejoue chaque générateur.
    const hote = executer(racine, ['--check', '--plateforme', process.platform])
    assert.equal(hote.status, CODE_CORPS_PERIME, `--check --plateforme ${process.platform} : ${hote.sortie}`)
    assert.doesNotMatch(hote.sortie, /— frais \(/)
    assert.match(hote.sortie, /docs:check — g\/a\.mjs — corps périmé\n/)

    const tout = executer(racine, ['--check', '--tout'])
    assert.equal(tout.status, CODE_CORPS_PERIME, `--check --tout, seul rouge un corps périmé, que \`docs:build\` guérit : ${tout.sortie}`)
    assert.match(tout.sortie, /docs:check — g\/a\.mjs — corps périmé/)
    // Rendu sous chaque autre plateforme, le même corps périmé : l'hôte le guérit en régénérant.
    for (const p of Object.keys(PLATEFORMES).filter((p) => p !== process.platform)) {
      assert.ok(tout.sortie.includes(`docs:check — g/a.mjs — rendu sous ${p} — corps périmé\n`), tout.sortie)
    }
    assert.match(tout.sortie, /committé : "Source : `src\\\\a\.ts`/, 'la divergence nomme la graphie committée')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

const AUTRES_PLATEFORMES = Object.keys(PLATEFORMES).filter((p) => p !== process.platform)
/** Raison d'un corps périmé que `docs:build` ne guérit pas : l'hôte et `p` en déclarent d'autres. */
const DIVERGENT = (p) => ` : l'hôte et ${p} ne déclarent pas les mêmes corps périmés, \`docs:build\` ne le guérit pas\n`

test('`--check --tout` : corps committé périmé ET rendu propre à la plateforme — `docs:build` ne guérit pas l’écart de la plateforme, sortie 1', { skip: !AUTRES_PLATEFORMES.length && 'hôte sans autre plateforme à rendre' }, () => {
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

test('`--check --tout` : corps committé = rendu d’une AUTRE plateforme — le rouge de l’hôte ne guérit pas, sortie 1', { skip: !AUTRES_PLATEFORMES.length && 'hôte sans autre plateforme à rendre' }, () => {
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

test('`--check` : `.sources-lues.json` périmé est nommé par son DELTA (`deltaSourcesLues`), et se guérit en régénérant', () => {
  const { racine } = depotReel()
  try {
    const chemin = path.join(racine, SOURCES_LUES)
    const mesure = JSON.parse(readFileSync(chemin, 'utf8'))
    mesure['g/a.mjs'].fichiers.push('src/fantome.ts')
    writeFileSync(chemin, serialiserSourcesLues(mesure))
    const rouge = executer(racine, ['--check', '--tout'])
    assert.equal(rouge.status, CODE_CORPS_PERIME, rouge.sortie)
    assert.match(rouge.sortie, /^ {2}g\/a\.mjs fichiers : \+0 \/ -1$/m)
    assert.match(rouge.sortie, /src\/fantome\.ts/)
    assert.match(rouge.sortie, /docs:check — docs\/\.sources-lues\.json est PÉRIMÉ/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check` de bout en bout : un PIED périmé sous un corps identique est refusé, nommé, et `docs:build` le guérit', () => {
  const { racine, git } = depotReel()
  try {
    // Même longueur, autre contenu : le générateur rend un corps identique, seul le PIED signe
    // d'autres sources — le refus ne peut venir que du verdict du pied dans `executer`.
    writeFileSync(path.join(racine, 'src', 'a.ts'), 'export const a = 2\n')
    git('add', 'src/a.ts')
    const rouge = executer(racine, ['--check'])
    assert.equal(rouge.status, CODE_CORPS_PERIME, rouge.sortie)
    assert.match(
      rouge.sortie,
      new RegExp(`docs:check — g/a\\.mjs — pied PÉRIMÉ sur ${DOC_A.replace('.', '\\.')} : sources [0-9a-f]{12} ≠ [0-9a-f]{12}, corps identique — npm run docs:build`),
    )
    assert.doesNotMatch(rouge.sortie, /g\/a\.mjs — corps périmé/)

    assert.equal(executer(racine, []).status, 0)
    git('add', '-A')
    const vert = executer(racine, ['--check'])
    assert.equal(vert.status, 0, vert.sortie)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
