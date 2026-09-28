// Contrat des LANES du REJEU LOCAL `npm run gates` (#1776) : les gates de `ci.yml` sont toutes
// placées, aucune lane n'écrit ce qu'une autre lit, `--serie` joue les mêmes, `--gates a,b` n'en
// joue que les nommées, un enfant qui dépasse son plafond tombe AVEC SON ARBRE, le refus du verrou
// de suite se reconnaît à sa sortie — et la POLITIQUE D'ARRÊT comme le RÉSUMÉ se mesurent pour de
// bon, sur un dépôt jetable à trois gates factices (c'est ce que
// `principal({ racine, lanes, ecritLu, journal })` rend possible).
//   node --test scripts/gates/toutes.test.mjs
import { tableTotale } from '../../src/lib/tableTotale.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import {
  ATTENTE_VERROU,
  COEURS_SUITE_EN_LANES,
  lanesPortees,
  ECRIT_LU,
  LANES,
  TIMEOUTS,
  conflitsEntreLanes,
  descendantsDe,
  estRefusDuVerrou,
  fichierDeSortie,
  lanesAJouer,
  limiteDe,
  photoArbre,
  prerequisAbsents,
  principal,
  queue,
  spawnBorne,
  refusDeCouverture,
  tuerArbre,
} from './toutes.mjs'
import { gatesDeCi } from './gatesDeCi.mjs'
import { refusVerrou } from '../test/verrou.mjs'
import { coeurs, repartitionWorkers } from '../test/partition.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const NOMS = gatesDeCi({ cwd: RACINE }).map((g) => g.nom)
const gate = (nom) => ({ nom, commande: `npm run ${nom}` })

test('toute gate de ci.yml a une place — une lane', () => {
  assert.deepEqual(refusDeCouverture(NOMS), [], 'LANES / ECRIT_LU ne couvrent pas ci.yml')
  const placees = LANES.flatMap((l) => l.gates)
  assert.equal(placees.length, NOMS.length, `${NOMS.length} gates dans ci.yml, ${placees.length} placées`)
  assert.equal(new Set(placees).size, placees.length, 'une gate placée deux fois')
})

test('la couverture est un DÉTECTEUR : une gate déplacée hors de toute place est nommée', () => {
  const ampute = LANES.map((l) => (l.nom === 'types' ? { ...l, gates: l.gates.filter((g) => g !== 'lint') } : l))
  const refus = refusDeCouverture(NOMS, ampute)
  assert.equal(refus.length, 1, refus.join(' · '))
  assert.match(refus[0], /^lint : gate de ci\.yml sans place/)

  const inconnue = [...LANES, { nom: 'neuve', gates: ['gate-qui-nexiste-pas'] }]
  assert.match(refusDeCouverture(NOMS, inconnue).join('\n'), /gate-qui-nexiste-pas : nommée par la lane neuve/)
  assert.match(
    refusDeCouverture(['vigie'], [{ nom: 'seule', gates: ['vigie'] }], {}).join('\n'),
    /vigie : aucune entrée ÉCRIT\/LU/,
  )
  // `lit` VIDE est un refus à part : c'est `lit` qui décide si la gate est sautable sur un push
  // documentaire (`gatesSautables`, scripts/gates/classerPush.mjs).
  assert.match(
    refusDeCouverture(['muette'], [{ nom: 'seule', gates: ['muette'] }], { muette: { ecrit: [], lit: [] } }).join('\n'),
    /muette : entrée ÉCRIT\/LU sans « lit »/,
  )
  // Une gate dans deux lanes serait jouée deux fois.
  assert.match(
    refusDeCouverture(['x'], [{ nom: 'l', gates: ['x'] }, { nom: 'm', gates: ['x'] }], { x: { ecrit: [], lit: ['src/'] } }).join('\n'),
    /x : placée deux fois \(la lane l ET la lane m\)/,
  )
})

test('aucune gate de ci.yml n’écrit dans l’arbre — aucune lane n’écrit ce qu’une AUTRE lit', () => {
  assert.deepEqual(conflitsEntreLanes(), [])
  for (const lane of LANES)
    for (const g of lane.gates)
      assert.deepEqual(ECRIT_LU[g].ecrit, [], `${g} écrit à chaque run : un dérivé se VÉRIFIE (\`--check\`), il ne se réécrit pas en gate`)
})

test('le détecteur de course VOIT : un écrivain mis en lane ouvre le conflit', () => {
  // MORSURE : un écrivain fictif de docs/raw/coverage.md dans la lane docs, alors que la suite LIT
  // docs/ — le conflit doit être nommé, sinon la table ne protège plus rien.
  const lanes = LANES.map((l) => (l.nom === 'docs' ? { ...l, gates: [...l.gates, 'ecrivain'] } : l))
  const ecritLu = { ...ECRIT_LU, ecrivain: { ecrit: ['docs/raw/coverage.md'], lit: ['docs/'] } }
  assert.match(
    conflitsEntreLanes(lanes, ecritLu).join('\n'),
    /lane docs : ecrivain ÉCRIT docs\/raw\/coverage\.md · lane suite : test LIT docs\//,
  )
})

test('chaque gate porte une RAISON, et chaque écriture fermée porte SA porte', () => {
  for (const nom of NOMS) {
    const e = ECRIT_LU[nom]
    assert.ok(e.raison?.length > 20, `${nom} : raison absente ou creuse`)
    for (const [chemin, porte] of Object.entries(e.ecritFerme ?? {}))
      assert.ok(porte?.length > 40, `${nom} : « ${chemin} » est fermé sans dire par quoi`)
  }
})

test('--serie joue EXACTEMENT les mêmes gates que les lanes, dans l’ordre de ci.yml', () => {
  const aJouer = NOMS.map(gate)
  assert.deepEqual(lanesAJouer(aJouer, { serie: true })[0].gates, NOMS)
  const sous = ['test', 'lint', 'docs:check:tout'].map(gate)
  assert.deepEqual(lanesAJouer(sous, { serie: true })[0].gates, ['test', 'lint', 'docs:check:tout'])
  assert.deepEqual(new Set(lanesAJouer(sous).flatMap((l) => l.gates)), new Set(['test', 'lint', 'docs:check:tout']))
  assert.deepEqual(lanesAJouer(sous).map((l) => l.nom), ['suite', 'types', 'docs'], 'une lane vide ne se lance pas')
})

test('un plafond par gate, jamais un défaut muet', () => {
  assert.equal(limiteDe('gate-inconnue'), TIMEOUTS.defaut * 1000)
  assert.equal(limiteDe('test'), TIMEOUTS.test * 1000)
  assert.ok(TIMEOUTS.test > TIMEOUTS.defaut)
  assert.ok(limiteDe('docs:check:tout') >= 423 * 1000, 'docs:check:tout vaut 141 s au pire observé — ×3 = 423 s au moins')
})

test('un enfant qui dépasse son plafond est EXPIRÉ, et son ARBRE tombe avec lui', async () => {
  const base = mkdtempSync(join(tmpdir(), 'gates-timeout-'))
  try {
    // Le PETIT-FILS écrit un témoin toutes les 200 ms : s'il survit au plafond, le fichier grossit
    // encore APRÈS. Il est spawné `detached` — sans quoi Windows le met dans le job du parent et un
    // simple `enfant.kill()` l'emporterait aussi, ce qui rendrait cette mesure aveugle (vérifié :
    // sans `detached`, remplacer `tuerArbre` par `enfant.kill()` laisse le test VERT).
    const temoin = join(base, 'temoin.txt')
    writeFileSync(
      join(base, 'petit-fils.mjs'),
      `import { appendFileSync } from 'node:fs'\n` +
        `setInterval(() => appendFileSync(${JSON.stringify(temoin)}, 'x'), 200)\n`,
    )
    writeFileSync(
      join(base, 'parent.mjs'),
      `import { spawn } from 'node:child_process'\n` +
        `spawn(process.execPath, [${JSON.stringify(join(base, 'petit-fils.mjs'))}], ` +
        `{ stdio: 'ignore', detached: true }).unref()\n` +
        `setInterval(() => {}, 1000)\n`,
    )
    const r = await spawnBorne({ argv: [join(base, 'parent.mjs')], fichier: join(base, 'sortie.txt'), limiteMs: 1500, cwd: base })
    assert.equal(r.expiree, true, 'le plafond n’a pas mordu')
    assert.notEqual(r.code, 0, 'un enfant tué ne réussit pas')
    const apresMort = readFileSync(temoin, 'utf8').length
    await new Promise((patienter) => setTimeout(patienter, 1200))
    assert.equal(
      readFileSync(temoin, 'utf8').length,
      apresMort,
      'le PETIT-FILS écrit encore : l’arbre n’a pas été tué, il garderait le verrou de suite et des cœurs',
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// Sortie `ps -A -o pid=,ppid=` telle que Linux la rend : colonnes alignées à droite, largeur variable.
// L'arbre posé : 100 → 200 → {300, 301}, 300 → 400 ; 999 est un étranger, 1 est le père de tous.
const PS_FIXTURE = [
  '    1     0',
  '  100     1',
  '  200   100',
  '  300   200',
  '  301   200',
  '  400   300',
  '  999     1',
  'entete illisible',
  '',
].join('\n')

test('la descendance se lit dans `ps`, LES FEUILLES D’ABORD', () => {
  const ordre = descendantsDe(100, PS_FIXTURE)
  assert.deepEqual(new Set(ordre), new Set([200, 300, 301, 400]), '999 n’est pas de la famille')
  // Chaque parent vient APRÈS ses enfants : tuer une feuille déjà orpheline est sans effet.
  assert.ok(ordre.indexOf(400) < ordre.indexOf(300), '400 est fils de 300')
  assert.ok(ordre.indexOf(300) < ordre.indexOf(200), '300 est fils de 200')
  assert.ok(ordre.indexOf(301) < ordre.indexOf(200), '301 est fils de 200')
  assert.deepEqual(descendantsDe(400, PS_FIXTURE), [], 'une feuille n’a pas de descendance')
  assert.deepEqual(descendantsDe(100, ''), [], 'sans `ps`, on retombe sur le groupe seul')
})

test('INVARIANT de la descendance : chaque enfant vient AVANT son parent, quelle que soit sa profondeur', () => {
  // « Les feuilles d'abord » est plus FAIBLE que ce qui compte : une feuille peu profonde (500, fille
  // directe de 100) n'a aucune raison de précéder un petit-fils (400). Ce qui doit tenir, c'est que
  // personne ne soit tué avant sa descendance — sinon un orphelin se ré-attache et survit.
  const ps = ['  200   100', '  300   200', '  400   300', '  500   100', '  900   999'].join('\n')
  const ordre = descendantsDe(100, ps)
  assert.deepEqual(new Set(ordre), new Set([200, 300, 400, 500]))
  for (const [enfant, parent] of [[200, 100], [300, 200], [400, 300], [500, 100]]) {
    const iParent = ordre.indexOf(parent)
    assert.ok(
      ordre.indexOf(enfant) < iParent || iParent === -1,
      `${enfant} (fils de ${parent}) est tué APRÈS son parent : ordre ${ordre.join(',')}`,
    )
  }
  assert.ok(!ordre.includes(900), 'un pid HORS de l’arbre ne doit jamais être visé')
})

test('la descendance ne boucle pas sur un `ps` qui se contredit', () => {
  // Vu en vrai : un processus dont le ppid est lui-même, et un cycle 10 → 11 → 10.
  assert.deepEqual(descendantsDe(7, '    7     7\n'), [])
  assert.deepEqual(new Set(descendantsDe(10, '   11    10\n   10    11\n')), new Set([11]))
})

test('sur POSIX, on tue la DESCENDANCE, puis le fils, puis son groupe', () => {
  // MORSURE de la CI ubuntu (run 33866600011) : `process.kill(-pid)` seul ne frappe que le groupe du
  // fils, et un petit-fils `detached` a le SIEN — il survivait. L’ordre est vérifiable ici, sous
  // Windows ; que les signaux portent, seule la CI POSIX peut le prouver.
  const tues = []
  tuerArbre(100, { plateforme: 'linux', lister: () => PS_FIXTURE, tuer: (p) => tues.push(p) })
  assert.equal(tues.at(-1), -100, 'le GROUPE se tire en dernier : il rattrape ce qui naît après `ps`')
  assert.equal(tues.at(-2), 100, 'le fils tombe après sa descendance')
  assert.ok(tues.includes(400) && tues.includes(301), 'les petits-fils doivent tomber')
  assert.ok(tues.indexOf(400) < tues.indexOf(300), 'les feuilles d’abord')
  assert.deepEqual(tues.slice(0, -2).sort((a, b) => a - b), [200, 300, 301, 400])
})

test('sur win32, `taskkill /T` suffit : aucune énumération', () => {
  let liste = 0
  tuerArbre(0, { plateforme: 'win32', lister: () => { liste += 1; return PS_FIXTURE } })
  // PID hors de la plage Windows : `taskkill` le refuse, aucun processus réel n'est visé.
  tuerArbre(4294967295, { plateforme: 'win32', lister: () => { liste += 1; return PS_FIXTURE }, tuer: () => {} })
  assert.equal(liste, 0, '`ps` n’existe pas sous Windows, et la filiation y est déjà suivie par taskkill')
})

test('un enfant qui finit sous son plafond rend son code et sa sortie', async () => {
  const base = mkdtempSync(join(tmpdir(), 'gates-ok-'))
  try {
    writeFileSync(join(base, 'court.mjs'), "console.log('bonjour')\nprocess.exit(3)\n")
    const r = await spawnBorne({ argv: [join(base, 'court.mjs')], fichier: join(base, 'sortie.txt'), limiteMs: 30_000, cwd: base })
    assert.equal(r.expiree, false)
    assert.equal(r.code, 3)
    assert.match(r.sortie, /bonjour/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('le refus du VERROU DE SUITE se reconnaît sur le message RÉEL, pas sur le code seul', () => {
  const verrouFictif = join(tmpdir(), 'wfrp-suite.lock')
  const message = refusVerrou({
    chemin: verrouFictif,
    tenant: { pid: 4242, commande: 'node scripts/test/run.mjs', cwd: join(tmpdir(), 'autre-arbre') },
  })
  assert.equal(estRefusDuVerrou(2, `${message}\n`), true, 'le message de scripts/test/verrou.mjs n’est pas reconnu')
  assert.equal(estRefusDuVerrou(2, '[gates] usage : node scripts/gates/toutes.mjs [--gates a,b] [--serie]\n'), false)
  assert.equal(estRefusDuVerrou(1, `${message}\n`), false, 'seul l’exit 2 du lanceur dit « rien joué »')
  assert.equal(
    estRefusDuVerrou(2, `[verrou] verrou disputé (${verrouFictif}) : un autre lanceur le reprend en boucle — relancer.\n`),
    true,
  )
  assert.ok(ATTENTE_VERROU.borneMs > ATTENTE_VERROU.pasMs, 'une borne au-dessous du pas n’attendrait jamais')
})

test('la SUITE est bornée pendant les lanes, par la couture qui existe déjà', () => {
  assert.ok(COEURS_SUITE_EN_LANES > 0 && COEURS_SUITE_EN_LANES < 16)
  assert.equal(coeurs({ WFRP_TEST_COEURS: String(COEURS_SUITE_EN_LANES) }, () => 16), COEURS_SUITE_EN_LANES)
  const borne = repartitionWorkers(COEURS_SUITE_EN_LANES)
  const plein = repartitionWorkers(16)
  assert.ok(borne.node + borne.jsdom < plein.node + plein.jsdom, 'la borne ne borne rien')
})

test('les LANES ne tournent que sur une machine AU-DELÀ de la borne de la suite', () => {
  assert.equal(lanesPortees(16), true)
  assert.equal(lanesPortees(COEURS_SUITE_EN_LANES + 1), true)
  for (const machine of [1, 4, COEURS_SUITE_EN_LANES]) assert.equal(lanesPortees(machine), false, `machine de ${machine} cœurs`)
})

test('une sortie de gate porte un nom de fichier LÉGAL sous NTFS', () => {
  assert.equal(fichierDeSortie('docs:check', 123), 'docs%3Acheck-123.txt')
  for (const nom of NOMS) assert.ok(!fichierDeSortie(nom, 1).includes(':'), `${nom} : « : » est un flux ADS sous NTFS`)
})

test('la queue d’un rouge rend les DERNIÈRES lignes utiles', () => {
  assert.deepEqual(queue('a\n\nb\n\n\nc\n', 2), ['b', 'c'])
  assert.deepEqual(queue('seule\n', 40), ['seule'])
})

test('une photo de l’arbre IMPOSSIBLE ne LÈVE pas : elle se rend', () => {
  const base = mkdtempSync(join(tmpdir(), 'sans-git-'))
  try {
    const photo = photoArbre(base)
    assert.equal(photo.texte, null)
    assert.ok(photo.erreur, 'une photo impossible doit porter sa cause')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/**
 * Dépôt jetable : un `ci.yml` de gates FACTICES, un `package.json` qui les porte, un commit.
 * `principal` y est joué pour de vrai — c'est la seule façon de mesurer la politique d'arrêt et le
 * résumé sans payer les vraies gates.
 */
function depotDeGates(gatesFactices) {
  // Le gabarit est VIDE (donc partagé par tous les cas : les gates factices diffèrent à chaque
  // appel) ; les fichiers du cas entrent dans le MÊME et unique commit `jetable`.
  const { racine } = instanceDeDepot({ commit: false })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8' })
  mkdirSync(join(racine, '.github', 'workflows'), { recursive: true })
  writeFileSync(
    join(racine, '.github', 'workflows', 'ci.yml'),
    ['name: CI', 'jobs:', '  build:', '    steps:', ...gatesFactices.map((g) => `      - run: npm run ${g.nom}`), ''].join('\n'),
  )
  // Le lanceur écrit ses sorties et ses durées sous `node_modules/.cache/gates/` (`dossierSorties` de toutes.mjs) :
  // sans cet ignore, tout run réel finirait sur « l'arbre a CHANGÉ », et le code du lanceur ne
  // discriminerait plus rien.
  writeFileSync(join(racine, '.gitignore'), 'node_modules/\n')
  const scripts = { gen: 'node gen.mjs' }
  writeFileSync(join(racine, 'gen.mjs'), '\n')
  for (const g of gatesFactices) {
    // `:` sépare un flux de données alternatif sous NTFS : `docs:check.mjs` y est un nom illégal.
    const fichier = `${g.nom.replace(/:/g, '-')}.mjs`
    scripts[g.nom] = `node ${fichier}`
    writeFileSync(join(racine, fichier), g.corps)
  }
  writeFileSync(join(racine, 'package.json'), `${JSON.stringify({ name: 'jetable', version: '0.0.0', scripts }, null, 2)}\n`)
  git('add', '-A')
  git('commit', '-qm', 'jetable')
  return { racine, git }
}

/** Machine qui porte les lanes : les cas ci-dessous décrivent les LANES, quel que soit l'hôte du test. */
const MACHINE_A_LANES = COEURS_SUITE_EN_LANES + 1

const LENTE = "setTimeout(() => { console.log('fini'); process.exit(0) }, 2500)\n"

const ROUGE = (mot, code) => `console.error(${JSON.stringify(mot)})\nprocess.exit(${code})\n`

test('un ROUGE ne coupe RIEN : ce qui le suit dans sa lane est JOUÉ, et le résumé les nomme tous', async () => {
  const { racine } = depotDeGates([
    { nom: 'lente', corps: LENTE },
    { nom: 'rouge', corps: ROUGE('ce rouge est le sujet', 4) },
    { nom: 'apres', corps: LENTE },
    { nom: 'lente2', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      // `rouge` et `apres` dans la MÊME lane : la première tombe, la seconde lit le MÊME arbre propre
      // et rend donc un verdict JUSTE — la payer maintenant évite un passage de plus (#1772).
      lanes: [
        { nom: 'a', gates: ['lente'] },
        { nom: 'b', gates: ['rouge', 'apres'] },
        { nom: 'c', gates: ['lente2'] },
      ],
      ecritLu: tableTotale(['lente', 'rouge', 'apres', 'lente2'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1, 'un rouge doit rendre 1')
    assert.match(sortie, /——— résumé ———/)
    // Le code de sortie de CHAQUE gate est imprimé : `build` a rendu ROUGE sans une ligne exploitable.
    assert.match(sortie, /\[gates\] rouge — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] lente — vert \(exit 0\) — /)
    assert.match(sortie, /\[gates\] lente2 — vert \(exit 0\) — /)
    assert.match(sortie, /\[gates\] apres — vert \(exit 0\) — /, '`apres` suit un rouge dans SA lane : elle est jouée')
    assert.match(sortie, /ce rouge est le sujet/, 'la queue du rouge doit être imprimée')
    assert.match(sortie, /0 spawn rejoué/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DEUX rouges dans DEUX lanes distinctes sont rendus par UN SEUL run', async () => {
  const { racine } = depotDeGates([
    { nom: 'rouge1', corps: ROUGE('premier rouge', 4) },
    { nom: 'rouge2', corps: ROUGE('second rouge', 7) },
    { nom: 'lente', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [
        { nom: 'a', gates: ['rouge1'] },
        { nom: 'b', gates: ['lente', 'rouge2'] },
      ],
      ecritLu: tableTotale(['rouge1', 'rouge2', 'lente'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /\[gates\] rouge1 — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] rouge2 — ROUGE \(exit 7\) — /)
    assert.match(sortie, /premier rouge/)
    assert.match(sortie, /second rouge/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une machine qui ne porte pas les lanes joue en SÉRIE, et le dit', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: "console.log('alpha')\n" },
    { nom: 'beta', corps: "console.log('beta')\n" },
  ])
  try {
    const jouer = async (machine) => {
      const lignes = []
      const code = await principal({
        racine,
        machine,
        argv: ['node', 'toutes.mjs'],
        journal: (t) => lignes.push(t),
        lanes: [
          { nom: 'a', gates: ['alpha'] },
          { nom: 'b', gates: ['beta'] },
        ],
        ecritLu: { alpha: { ecrit: [], lit: ['src/'] }, beta: { ecrit: [], lit: ['src/'] } },
      })
      return { code, sortie: lignes.join('') }
    }
    const petite = await jouer(COEURS_SUITE_EN_LANES)
    assert.equal(petite.code, 0, petite.sortie)
    assert.match(petite.sortie, /machine de 10 cœur\(s\), pas au-delà des 10 de la suite : une seule lane/)
    assert.match(petite.sortie, /lanes : serie /)
    const grande = await jouer(MACHINE_A_LANES)
    assert.equal(grande.code, 0, grande.sortie)
    assert.doesNotMatch(grande.sortie, /une seule lane/)
    assert.match(grande.sortie, /lanes : a .* · b /)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--serie rend les MÊMES verdicts que les lanes : deux rouges, deux lignes, exit 1', async () => {
  // La morsure de `lanesAJouer` (l.104) ne mesure que l'ensemble et l'ORDRE des gates ; elle ne dit
  // rien des VERDICTS. Ici c'est `principal` entier qui est rejoué en `--serie` sur le même cas que
  // le test des deux lanes distinctes : `--serie` ne change que la COMPOSITION des lanes.
  const { racine } = depotDeGates([
    { nom: 'rouge1', corps: ROUGE('premier rouge', 4) },
    { nom: 'rouge2', corps: ROUGE('second rouge', 7) },
    { nom: 'lente', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs', '--serie'],
      journal: (t) => lignes.push(t),
      lanes: [
        { nom: 'a', gates: ['rouge1'] },
        { nom: 'b', gates: ['lente', 'rouge2'] },
      ],
      ecritLu: tableTotale(['rouge1', 'rouge2', 'lente'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /\[gates\] rouge1 — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] rouge2 — ROUGE \(exit 7\) — /)
    assert.match(sortie, /\[gates\] lente — vert \(exit 0\) — /)
    assert.match(sortie, /premier rouge/)
    assert.match(sortie, /second rouge/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DEUX rouges dans la MÊME lane sont tous deux JOUÉS et rendus', async () => {
  const { racine } = depotDeGates([
    { nom: 'rouge1', corps: ROUGE('premier rouge', 3) },
    { nom: 'rouge2', corps: ROUGE('second rouge', 5) },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['rouge1', 'rouge2'] }],
      ecritLu: tableTotale(['rouge1', 'rouge2'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /\[gates\] rouge1 — ROUGE \(exit 3\) — /)
    assert.match(sortie, /\[gates\] rouge2 — ROUGE \(exit 5\) — /)
    assert.match(sortie, /premier rouge/)
    assert.match(sortie, /second rouge/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le RÉSUMÉ s’imprime même si la photo de fin devient impossible', async () => {
  // Le 2026-09-04, `git status` a rendu STATUS_DLL_INIT_FAILED APRÈS sept minutes de gates : l'appel
  // levait, et vingt-deux verdicts payés n'ont jamais été imprimés. Ici la gate emporte le `.git`.
  const { racine } = depotDeGates([
    { nom: 'saborde', corps: `import { renameSync } from 'node:fs'\nrenameSync(${JSON.stringify(join('.git'))}, '.git-parti')\n` },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['saborde'] }],
      ecritLu: { saborde: { ecrit: [], lit: ['src/'] } },
    })
    const sortie = lignes.join('')
    assert.match(sortie, /——— résumé ———/, 'le résumé doit être imprimé AVANT la photo de fin')
    assert.match(sortie, /\[gates\] saborde — vert \(exit 0\)/)
    assert.match(sortie, /photo de l'arbre IMPOSSIBLE/)
    assert.equal(code, 0, 'une photo impossible se DIT, elle ne fabrique pas un rouge')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une gate qui réécrit l’arbre fait REFUSER le run à la photo de fin', async () => {
  const { racine } = depotDeGates([
    { nom: 'ecrivain', corps: `import { writeFileSync } from 'node:fs'\nwriteFileSync('rapport.md', 'périmé\\n')\n` },
    { nom: 'lecteur', corps: LENTE },
  ])
  try {
    writeFileSync(join(racine, 'rapport.md'), 'à jour\n')
    execFileSync('git', ['add', '-A'], { cwd: racine })
    execFileSync('git', ['commit', '-qm', 'rapport'], { cwd: racine })
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['ecrivain', 'lecteur'] }],
      ecritLu: {
        ecrivain: { ecrit: [], lit: ['src/'] },
        lecteur: { ecrit: [], lit: ['rapport.md'] },
      },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1, 'un arbre réécrit rend le run ROUGE, même quand chaque gate est verte')
    assert.match(sortie, /\[gates\] ecrivain — vert/)
    assert.match(sortie, /\[gates\] lecteur — vert/, 'un écrivain ne fait sauter aucune gate')
    assert.match(sortie, /——— résumé ———[\s\S]*l'arbre a CHANGÉ pendant le run/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('pré-vol : un registre périmé est un REFUS nommé, avant toute gate, et rien n’est écrit (#1801)', async () => {
  const { racine, git } = depotDeGates([{ nom: 'lente', corps: LENTE }])
  try {
    writeFileSync(
      join(racine, 'gen.mjs'),
      "import { writeFileSync } from 'node:fs'\n" +
        "if (process.argv.includes('--check')) { console.error('registre.generated.ts est PÉRIMÉ'); process.exit(2) }\n" +
        "writeFileSync('registre.generated.ts', 'régénéré\\n')\n",
    )
    git('commit', '-qam', 'registre périmé')
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      lanes: [{ nom: 'a', gates: ['lente'] }],
      ecritLu: { lente: { ecrit: [], lit: ['src/'] } },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1, sortie)
    assert.match(sortie, /REFUS — « npm run gen -- --check » rouge \(exit 2\)[\s\S]*registre\.generated\.ts est PÉRIMÉ/)
    assert.doesNotMatch(sortie, /\[gates\] lente — (?:vert|ROUGE)/, 'le refus du pré-vol précède toute gate')
    assert.equal(git('status', '--porcelain'), '', 'le pré-vol n’écrit rien dans l’arbre')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/**
 * PRÉREQUIS (#1708 geste 2) : une gate dont le prérequis manque ne mesure rien — `server:typecheck`
 * sans `server/node_modules` rend un TS2688 brut, qui ne nomme ni le dossier absent ni la commande
 * qui le pose. Le dépôt jetable porte une gate qui écrit un TÉMOIN HORS de l'arbre : sa présence dit
 * si elle a été spawnée, et l'arbre reste propre dans les deux cas.
 */
function depotATemoin() {
  const hors = mkdtempSync(join(tmpdir(), 'gates-prerequis-'))
  const temoin = join(hors, 'temoin.txt')
  const { racine, git } = depotDeGates([
    {
      nom: 'serveur',
      corps: `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(temoin)}, 'jouee')\n`,
    },
  ])
  return { racine, git, hors, temoin }
}

// `argv` vient du CORPS du test : un littéral de module qui nomme un fichier serait une entrée de
// stock nominatif de plus (scripts/guards/lib/stocksNominatifs.mjs) — ici c'est une donnée de cas.
const jouerAvecPrerequis = (racine, prerequis, lignes, argv) =>
  principal({
    racine,
    argv,
    machine: MACHINE_A_LANES,
    journal: (t) => lignes.push(t),
    lanes: [{ nom: 'a', gates: ['serveur'] }],
    ecritLu: { serveur: { ecrit: [], lit: ['deps/'], prerequis } },
  })

test('un PRÉREQUIS absent rend un ROUGE qui NOMME le chemin et la commande qui le pose — sans rien jouer', async () => {
  const { racine, hors, temoin } = depotATemoin()
  try {
    const lignes = []
    const code = await jouerAvecPrerequis(racine, [{ chemin: 'deps/absent', pose: 'cmd qui pose' }], lignes, ['node', 'toutes.mjs'])
    const sortie = lignes.join('')
    assert.match(sortie, /prérequis absent : `deps\/absent` \(le pose : `cmd qui pose`\)/)
    assert.equal(existsSync(temoin), false, 'la gate a été SPAWNÉE : son erreur brute aurait remplacé le refus')
    assert.match(sortie, /\[gates\] serveur — ROUGE \(exit 1\)/)
    assert.equal(code, 1, 'un prérequis absent est un ROUGE')
    // Le fichier de sortie porte le même refus : c'est lui que le résumé imprime en queue.
    const fichier = join(racine, 'node_modules', '.cache', 'gates', fichierDeSortie('serveur', process.pid))
    assert.match(readFileSync(fichier, 'utf8'), /`deps\/absent` \(le pose : `cmd qui pose`\)/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(hors, { recursive: true, force: true })
  }
})

test('un PRÉREQUIS absent ne fait sauter AUCUNE gate — ni sa lane, ni les autres', async () => {
  // #1772 : le refus de prérequis est un ROUGE comme un autre. Il ne concerne que la gate qui LIT ce
  // chemin — `prerequisAbsents` est appelé PAR GATE (toutes.mjs, `jouerUneFois`) — donc les autres
  // lisent le même arbre propre et leur verdict est JUSTE. Les faire sauter coûtait un passage entier.
  const { racine } = depotDeGates([
    { nom: 'serveur', corps: "console.log('jamais spawnée')\nprocess.exit(0)\n" },
    { nom: 'suivante', corps: LENTE },
    { nom: 'voisine', corps: ROUGE('la voisine a son propre rouge', 9) },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      // `serveur` (prérequis absent) et `suivante` dans la MÊME lane ; `voisine` dans une AUTRE.
      lanes: [
        { nom: 'a', gates: ['serveur', 'suivante'] },
        { nom: 'b', gates: ['voisine'] },
      ],
      ecritLu: {
        serveur: { ecrit: [], lit: ['deps/'], prerequis: [{ chemin: 'deps/absent', pose: 'cmd qui pose' }] },
        suivante: { ecrit: [], lit: ['src/'] },
        voisine: { ecrit: [], lit: ['src/'] },
      },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    // Le refus NOMME encore le chemin et la commande : le sujet du test l.529 est intact.
    assert.match(sortie, /prérequis absent : `deps\/absent` \(le pose : `cmd qui pose`\)/)
    assert.match(sortie, /\[gates\] serveur — ROUGE \(exit 1\) — /)
    assert.match(sortie, /\[gates\] suivante — vert \(exit 0\) — /, 'la MÊME lane continue après un refus de prérequis')
    assert.match(sortie, /\[gates\] voisine — ROUGE \(exit 9\) — /, 'une AUTRE lane rend son verdict réel')
    assert.match(sortie, /la voisine a son propre rouge/, 'les DEUX rouges sont rendus par un seul run')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un PRÉREQUIS présent ne change RIEN : la gate est jouée et rend son verdict réel', async () => {
  const { racine, git, hors, temoin } = depotATemoin()
  try {
    mkdirSync(join(racine, 'deps', 'present'), { recursive: true })
    writeFileSync(join(racine, 'deps', 'present', 'marqueur.txt'), 'posé\n')
    git('add', '-A')
    git('commit', '-qm', 'prérequis posé')
    const lignes = []
    const code = await jouerAvecPrerequis(racine, [{ chemin: 'deps/present', pose: 'cmd qui pose' }], lignes, ['node', 'toutes.mjs'])
    const sortie = lignes.join('')
    assert.equal(code, 0, 'un prérequis présent ne coûte aucun verdict')
    assert.match(sortie, /\[gates\] serveur — vert \(exit 0\)/)
    assert.doesNotMatch(sortie, /prérequis absent/)
    assert.equal(readFileSync(temoin, 'utf8'), 'jouee', 'la gate n’a pas été jouée')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(hors, { recursive: true, force: true })
  }
})

/** Un prérequis est un chemin RELATIF à la racine, et la gate qui l'exige le LIT (sinon il ne la
 *  concerne pas) — chaque entrée porte aussi la commande qui le pose, sans quoi le refus est muet. */
const incoherencesDePrerequis = (ecritLu) => {
  const refus = []
  for (const [nom, e] of Object.entries(ecritLu))
    for (const p of e.prerequis ?? []) {
      if (!p.chemin || isAbsolute(p.chemin) || p.chemin.startsWith('..'))
        refus.push(`${nom} : « ${p.chemin} » n’est pas un chemin relatif à la racine`)
      else if (!(e.lit ?? []).some((lu) => p.chemin.startsWith(lu)))
        refus.push(`${nom} : exige « ${p.chemin} » sans déclarer le LIRE — le prérequis ne la concerne pas`)
      if (!p.pose) refus.push(`${nom} : « ${p.chemin} » est exigé sans dire la commande qui le pose`)
    }
  return refus
}

test('tout PRÉREQUIS de la table est relatif, posé par une commande, et LU par sa gate', () => {
  assert.deepEqual(incoherencesDePrerequis(ECRIT_LU), [])
  const exiges = Object.values(ECRIT_LU).flatMap((e) => e.prerequis ?? [])
  assert.ok(exiges.length, 'aucun prérequis déclaré : ce contrat ne mesure plus rien')
  assert.deepEqual(
    ECRIT_LU['server:typecheck'].prerequis,
    [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }],
    'le sous-projet serveur a ses propres dépendances (step `npm --prefix server ci` de .github/workflows/ci.yml)',
  )
  // Le détecteur VOIT : un chemin absolu, un chemin hors des lectures, une pose absente.
  assert.match(
    incoherencesDePrerequis({ g: { lit: ['server/'], prerequis: [{ chemin: join(tmpdir(), 'x'), pose: 'c' }] } }).join('\n'),
    /n’est pas un chemin relatif/,
  )
  assert.match(
    incoherencesDePrerequis({ g: { lit: ['server/'], prerequis: [{ chemin: 'autre/dep', pose: 'c' }] } }).join('\n'),
    /sans déclarer le LIRE/,
  )
  assert.match(
    incoherencesDePrerequis({ g: { lit: ['server/'], prerequis: [{ chemin: 'server/node_modules' }] } }).join('\n'),
    /sans dire la commande qui le pose/,
  )
})

test('`prerequisAbsents` ne rend que ce qui MANQUE sous la racine', () => {
  const base = mkdtempSync(join(tmpdir(), 'gates-prereq-unite-'))
  try {
    const entree = { lit: ['server/'], prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] }
    assert.deepEqual(prerequisAbsents(entree, base), entree.prerequis)
    mkdirSync(join(base, 'server', 'node_modules'), { recursive: true })
    assert.deepEqual(prerequisAbsents(entree, base), [])
    assert.deepEqual(prerequisAbsents({ lit: [] }, base), [], 'une gate sans prérequis n’en a aucun d’absent')
    assert.deepEqual(prerequisAbsents(undefined, base), [], 'une gate hors table ne fait pas lever le lanceur')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// ── `--gates a,b` : rejouer le rouge d'un run CI sans repayer les vingt autres (#1776) ──────────

const lanceParGates = async (racine, argv, lignes) =>
  principal({
    racine,
    argv,
    machine: MACHINE_A_LANES,
    journal: (t) => lignes.push(t),
    lanes: [{ nom: 'a', gates: ['alpha', 'beta'] }],
    ecritLu: { alpha: { ecrit: [], lit: ['src/'] }, beta: { ecrit: [], lit: ['src/'] } },
  })

test('--gates ne joue QUE les gates nommées, et le dit avec le total', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: "console.log('alpha')\n" },
    { nom: 'beta', corps: "console.log('beta')\n" },
  ])
  const lignes = []
  try {
    const code = await lanceParGates(racine, ['node', 'toutes.mjs', '--gates', 'beta', '--serie'], lignes)
    const sortie = lignes.join('')
    assert.equal(code, 0, sortie)
    assert.match(sortie, /1 gate\(s\) lues dans ci\.yml \(sur 2\)/)
    assert.match(sortie, /\[gates\] beta — vert \(exit 0\)/)
    assert.doesNotMatch(sortie, /\[gates\] alpha —/, 'une gate non nommée ne se joue ni ne se résume')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--gates sur un nom que ci.yml ne porte PAS est un REFUS nommé, jamais un run vide', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: '\n' },
    { nom: 'beta', corps: '\n' },
  ])
  const lignes = []
  try {
    const code = await lanceParGates(racine, ['node', 'toutes.mjs', '--gates', 'beta,gamma'], lignes)
    const sortie = lignes.join('')
    assert.equal(code, 1, 'une faute de frappe qui jouerait zéro gate en s’annonçant verte est le pire verdict')
    assert.match(sortie, /REFUS — ci\.yml ne porte aucune gate nommée gamma/)
    assert.match(sortie, /gates lisibles : alpha, beta/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('sans --gates, TOUTES les gates de ci.yml sont à jouer', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: '\n' },
    { nom: 'beta', corps: '\n' },
  ])
  const lignes = []
  try {
    await lanceParGates(racine, ['node', 'toutes.mjs', '--liste'], lignes)
    const sortie = lignes.join('')
    assert.match(sortie, /2 gate\(s\) lues dans ci\.yml\n/, 'sans restriction, aucun « (sur N) »')
    assert.match(sortie, /\[gates\] alpha — à jouer : npm run alpha/)
    assert.match(sortie, /\[gates\] beta — à jouer : npm run beta/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
