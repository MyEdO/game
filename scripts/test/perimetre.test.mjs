// Banc du périmètre de tests (#2400) : un dépôt git FORGÉ par classe de lien, sous mkdtempSync.
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { registerHooks } from 'node:module'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gitDe } from './gitDeBanc.mjs'
import { fermetureSurDisque } from '../guards/lib/porteDEre.mjs'
import { sitesDuDepot } from '../guards/lib/gitHorsHote.mjs'
import { REPLI_FACTEUR_CI, REPLI_SURCOUT_MS, SURCOUTS, apprendre, executerLancements, principal, ligneDeRelance, argumentsVitest, bilanDuLancement, paquetsDeLancement, ordreDuLanceur, planDuLancement, texteDuReel, derivationBornee, ecrireLesMesures, entreeDuCli, estimationsDe, facteursCi, lintDesTouches, nomDuMemo, paliersDe, perimetreDuDepot, planDExecution, planDuPerimetre, rapportDuLancement, surcoutObserve, texteDeLEchec, texteDeLEstimation, texteDuMur } from './perimetre.mjs'
import { exportsTouches, signalDe, versionDesMemosDeDerivation } from './perimetreDerivation.mjs'
import { memosDe } from '../guards/lib/memosDAnalyse.mjs'
import { lireArguments } from './argumentsPerimetre.mjs'
import { memoCiDe } from './dureesCi.mjs'
import { profilsDuLancement } from './memoire.mjs'
import { dossierDesMesures, mesuresDe } from './mesures.mjs'
import { PORTEE_LOT_S, regimeDeArgv } from './partition.mjs'
import DureesVitest from './dureesVitest.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'

// #2586
function bancDeCloture(t, fichier, familles) {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-cloture-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const lancements = familles.map((famille, i) => ({
    famille, sortie: famille ? join(racine, i + '.json') : null,
    args: famille ? [fichier] : ['scripts/docs/build-all.mjs', '--check'],
  }))
  const journal = [], ecritures = [], spawns = []
  let retenues = 0
  const options = {
    lancements, racine, cache: racine, node: [fichier], env: {}, mesures: {
      lire: () => ({}), ecrire: (...args) => { ecritures.push(args) },
    }, workers: { node: 1, vitest: 1 }, code: 0,
    journal: (texte) => { journal.push(texte) }, retenir: () => { retenues++ },
  }
  const rapport = JSON.stringify({ workers: 1, durees: { [join(racine, fichier)]: 42 }, echecs: [] })
  const lancer = (resultat) => async () => {
    const charge = lancements[spawns.length]
    spawns.push(charge.famille)
    if (charge.sortie) writeFileSync(charge.sortie, rapport)
    return resultat
  }
  return { options, journal, ecritures, spawns, rapport, lancer, retenues: () => retenues }
}

test('clôture non confirmée : stoppe tous les lancements et conserve les rapports sans apprendre, même code zéro ou arrêt absent', async (t) => {
  for (const famille of ['node', 'vitest', null]) {
    for (const arret of [{ etat: 'indetermine' }, undefined]) {
      for (const code of [0, 1]) {
        const b = bancDeCloture(t, 'scripts/a.test.mjs', [famille, 'vitest', 'node', null])
        for (const charge of b.options.lancements.slice(1)) if (charge.sortie) writeFileSync(charge.sortie, 'rapport suivant intact')
        const lancer = b.lancer({ code, arret })
        const rendu = await executerLancements(b.options, { lancer, lancerNode: lancer })
        assert.deepEqual(b.spawns, [famille])
        assert.equal(b.retenues(), 1)
        assert.notEqual(rendu.code, 0)
        assert.deepEqual(b.ecritures, [])
        assert.deepEqual(rendu.reels, {})
        assert.equal(rendu.joues.length, 1)
        assert.notEqual(rendu.joues[0].code, 0)
        assert.match(b.journal[0], /clôture non confirmée/)
        assert.match(ligneDeRelance({ code: rendu.code, lancements: rendu.joues, lint: { code: 0, defauts: [] } }), /^rouge/)
        if (b.options.lancements[0].sortie) assert.equal(readFileSync(b.options.lancements[0].sortie, 'utf8'), b.rapport)
        for (const charge of b.options.lancements.slice(1)) if (charge.sortie) assert.equal(readFileSync(charge.sortie, 'utf8'), 'rapport suivant intact')
      }
    }
  }
})

test('clôture morte : autorise les familles suivantes et les docs, apprend puis retire leurs rapports', async (t) => {
  const b = bancDeCloture(t, 'scripts/a.test.mjs', ['vitest', 'node', null])
  const lancer = b.lancer({ code: 0, arret: { etat: 'mort' } })
  const rendu = await executerLancements(b.options, { lancer, lancerNode: lancer })
  assert.deepEqual(b.spawns, ['vitest', 'node', null])
  assert.equal(b.retenues(), 0)
  assert.equal(rendu.code, 0)
  assert.equal(rendu.joues.length, 3)
  assert.deepEqual(Object.keys(rendu.reels), ['vitest', 'node'])
  assert.equal(b.ecritures.filter(([nom]) => nom === 'durees.json').length, 2)
  for (const charge of b.options.lancements) if (charge.sortie) assert.equal(existsSync(charge.sortie), false)
})

test('refus d’admission : un lanceur qui rend `CODE_DIFFERE` est nommé avec sa raison, jamais compté rouge sans fichier', async (t) => {
  const b = bancDeCloture(t, 'scripts/a.test.mjs', ['vitest', 'node'])
  const ligne = '[memoire] MEMOIRE_INSUFFISANTE : minimum 5408 Mo, disponible 4656 Mo'
  const lancer = async () => { b.spawns.push('vitest'); return { code: CODE_DIFFERE, sortie: '[verrou] attente\n' + ligne + '\n', arret: { etat: 'mort' } } }
  const lancerNode = async () => { b.spawns.push('node'); return { code: CODE_DIFFERE, message: ligne.replace('5408', '3328'), arret: { etat: 'mort' } } }
  const rendu = await executerLancements(b.options, { lancer, lancerNode })
  assert.deepEqual(b.spawns, ['vitest', 'node'])
  assert.equal(rendu.code, CODE_DIFFERE)
  assert.deepEqual(rendu.joues.map((j) => j.refus), [ligne, ligne.replace('5408', '3328')])
  const relance = ligneDeRelance({ code: rendu.code, lancements: rendu.joues, lint: { code: 0, defauts: [] } })
  assert.equal(relance, `rouge — refus d'admission, aucun test joué : vitest : ${ligne} ; node : ${ligne.replace('5408', '3328')}`)
})

test('principal : annonce le propriétaire du verrou pendant son attente', async (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-attente-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const chemin = join(racine, 'verrou')
  const tenant = { pid: process.pid, cwd: racine, commande: 'charge propriétaire', date: '2026-10-16T10:51:24Z' }
  writeFileSync(chemin, JSON.stringify(tenant))
  const journal = []
  t.mock.method(console, 'error', (texte) => { journal.push(texte) })
  let instant = 0
  const code = await principal([], racine, { env: {}, verrou: { chemin, libelle: 'banc', horloge: () => instant++, attente: { echeanceMs: 3, pasMs: 1 } } })
  assert.equal(code, CODE_DIFFERE)
  assert.ok(journal.some((texte) => texte.startsWith('[verrou] PID ' + tenant.pid + ' · ') && texte.includes(tenant.commande) && texte.includes(tenant.cwd) && texte.includes(tenant.date)))
})

test('dérivation échouée : diagnostic depuis la sortie bornée sans relire le journal', async () => {
  const erreur = Object.assign(new Error('capture supérieure à 5 octets'), { code: 'ENOBUFS' })
  let traces
  await assert.rejects(derivationBornee({ racine: tmpdir() }, {
    limiteMs: 123,
    lancer: async ({ argv }) => {
      traces = dirname(argv.at(-1))
      writeFileSync(argv.at(-1), JSON.stringify({ stade: 'lectures', module: 'module-du-banc' }))
      return { code: 1, sortie: 'préfixe capturé', error: erreur, arret: { etat: 'indetermine' } }
    },
  }), (e) => {
    assert.equal(e.cause, erreur)
    assert.match(e.message, /stade lectures, module module-du-banc, durée \d+ ms, limite 123 ms, code 1, arrêt indetermine/)
    assert.match(e.message, /ENOBUFS : capture supérieure à 5 octets\npréfixe capturé$/)
    return true
  })
  assert.ok(existsSync(traces), 'arrêt indéterminé conserve les traces')
  rmSync(traces, { recursive: true, force: true })
})

const TEMOIN = { 'scripts/temoin.test.mjs': "import './seul.mjs'\n", 'scripts/seul.mjs': 'export const seul = 1\n' }


// #2586
 test('slots gelés owner : N+1, lecture directe et prélue, mémos JSON froids/chauds et blob changé', async () => {
  const urls = ['prelue', 'directe'].map((mode) => new URL('./perimetreDerivation.mjs?slots-owner-' + mode, import.meta.url).href)
  const hook = registerHooks({ load(specifier, contexte, suivant) {
    const rendu = suivant(specifier, contexte)
    if (!urls.includes(specifier)) return rendu
    let texte = Buffer.from(rendu.source).toString('utf8')
    const constructeur = 'APPEL_DE_LECTURE, evaluateurDuDepot,'
    assert.equal(texte.split(constructeur).length, 2)
    texte = texte.replace(constructeur, 'APPEL_DE_LECTURE, evaluateurDuDepot as construireEvaluateur,')
    texte += '\nfunction evaluateurDuDepot(options) { if (options.clesStructurelles !== true) throw new Error("MODE_STRUCTUREL_OWNER_ABSENT"); return construireEvaluateur(options); }\n'
    texte = texte.replace('  const lectures = new Map()', '  const lectures = new Map()\n  lectures.set = (f, lu) => { if (lu) verifierGel(lu); return Map.prototype.set.call(lectures, f, lu) }')
    if (specifier === urls[1]) texte = texte.replace('    prelire(new Set(', '    if (false) prelire(new Set(')
    texte += '\nexport const observationsSlots = [];\nfunction verifierGel(lu) { const pile = [lu]; const vus = new Set(); while (pile.length) { const o = pile.pop(); if (!o || typeof o !== "object" || vus.has(o)) continue; vus.add(o); if (!Object.isFrozen(o)) throw new Error("lecture owner non gelée"); pile.push(...Object.values(o)); } observationsSlots.push(lu); }\n'
    return { ...rendu, source: texte }
  } })
  try {
    for (const url of urls) {
      const { deriverPerimetre, observationsSlots } = await import(url)
      const modules = new Map([
        ['scripts/nouveau.test.mjs', "import { inédit } from './nouveau.mjs'; inédit(true)"],
        ['scripts/nouveau.mjs', "import { readFileSync } from 'node:fs'; export function inédit(flag) { if (flag) readFileSync('src/a.json') }"],
      ])
      const json = new Map()
      let hits = 0
      const memos = {
        lire(nature, cle) { if (nature === 'evaluations') return undefined; const bytes = json.get(nature + ':' + cle); if (bytes === undefined) return undefined; if (nature === 'lectures') hits++; return JSON.parse(bytes) },
        ecrire(nature, cle, lu) { json.set(nature + ':' + cle, JSON.stringify(lu)) },
      }
      const entree = { racine: new URL('../..', import.meta.url).pathname.replace(/^\/(?=[A-Z]:)/, ''), touches: ['src/a.json'], post: [...modules.keys(), 'src/a.json'], avant: [], lire: (rels) => new Map(rels.map((f) => [f, modules.get(f) ?? null])), memos }
      const froid = deriverPerimetre(entree)
      const nombre = observationsSlots.length
      assert.ok(nombre > 0)
      const chaud = deriverPerimetre(entree)
      assert.deepEqual(chaud, froid)
      assert.ok(hits > 0)
      assert.ok(observationsSlots.length > nombre)
      assert.ok(froid.retenus.has('scripts/nouveau.test.mjs'))
      modules.set('scripts/nouveau.mjs', modules.get('scripts/nouveau.mjs').replace('src/a.json', 'src/b.json'))
      const change = deriverPerimetre(entree)
      assert.equal(change.retenus.has('scripts/nouveau.test.mjs'), false)
      assert.notDeepEqual(change, froid)
    }
  } finally { hook.deregister() }
})

test('#2586 périmètre : corpus touché ou importé retenu, gate CI explicite, partition sans doublon', () => {
  const corpus = ['scripts/corpus/ops/un.test.mjs', 'scripts/corpus/guards/deux.test.mjs', 'scripts/corpus-isole/guards/trois.test.mjs']
  const local = 'scripts/test/local.test.mjs'
  const retenus = new Map([[corpus[0], { rang: 0 }], [corpus[1], { rang: 2 }], [corpus[2], { rang: 3 }], [local, { rang: 0 }]])
  const plan = planDExecution(retenus, { budget: 100, estimations: new Map([...retenus.keys()].map((t) => [t, { ms: 1 }])) })
  assert.deepEqual(plan.lances, [local])
  assert.deepEqual(plan.aLaCI, corpus)
  assert.deepEqual([...plan.lances, ...plan.aLaCI].sort(), [...retenus.keys()].sort())
  assert.equal(new Set([...plan.lances, ...plan.aLaCI]).size, retenus.size)
})

/** Un dépôt jetable : `base` commité, puis `apres` (texte, `null` = supprimé, `{ de }` = renommé) commité
 *  si `commiter`, laissé dans l'arbre de travail sinon. */
function forger(t, base, apres, { commiter = true } = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const git = gitDe(racine)
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'perimetre@example.test')
  git('config', 'user.name', 'Perimetre fixture')
  const ecrire = (rel, texte) => {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    writeFileSync(join(racine, rel), texte)
  }
  for (const [rel, texte] of Object.entries({ ...TEMOIN, ...base })) ecrire(rel, texte)
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  for (const [rel, texte] of Object.entries(apres)) {
    if (texte === null) git('rm', '-q', '--', rel)
    else if (typeof texte === 'object') {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      git('mv', '--', texte.de, rel)
    } else ecrire(rel, texte)
  }
  if (commiter) {
    git('add', '-A')
    git('commit', '-q', '-m', 'apres')
  }
  return racine
}

const deriver = (racine, bornes = { base: 'HEAD~1', tete: 'HEAD' }) =>
  perimetreDuDepot(racine, bornes, { dossierDesMemos: join(racine, '.git', 'perimetre') })

const lienDe = (perimetre, test) => {
  const lien = perimetre.retenus.get(test)
  assert.ok(lien, `${test} non retenu ; retenus : ${[...perimetre.retenus.keys()].join(', ')}`)
  assert.equal(perimetre.retenus.has('scripts/temoin.test.mjs'), false, 'le témoin sans lien est retenu')
  return lien
}

// #2586
test('garde réelle des instruments : ajout et modification sous scripts, sélection avant budget', async (t) => {
  const garde = 'scripts/guards/lib/gitHorsHote.test.mjs'
  const fermeture = Object.fromEntries(fermetureSurDisque(garde).filter(([, texte]) => texte !== null))
  const texte = `import { execFileSync } from 'node:child_process'\n${'execFileSync'}('git', ['status'])\n`
  for (const modification of [false, true]) {
    const probe = 'scripts/selection-probe.test.mjs'
    const racine = forger(t, { ...fermeture, ...(modification ? { [probe]: 'export const avant = true\n' } : {}) }, { [probe]: texte })
    assert.deepEqual(sitesDuDepot(racine), [{ chemin: probe, ligne: 2, forme: 'lanceur', extrait: texte.trim().split('\n')[1] }])
    const perimetre = await deriver(racine)
    assert.deepEqual(perimetre.toolchain, [])
    assert.equal(perimetre.retenus.get(probe)?.rang, 0)
    const lien = lienDe(perimetre, garde)
    assert.deepEqual([lien.nature, lien.touche, lien.rang], ['racine balayée', probe, 1], JSON.stringify(lien))
    assert.ok(['.', 'scripts'].includes(lien.racine), JSON.stringify(lien))
    const site = lien.site.match(/^(.+):(\d+) (.+)$/)
    assert.ok(site, lien.site)
    const source = fermeture[site[1]]
    assert.equal(typeof source, 'string', lien.site)
    assert.ok(source.split('\n')[Number(site[2]) - 1].includes(site[3]), lien.site)
    const estimations = new Map([...perimetre.retenus.keys()].map((f) => [f, { ms: 1000 }]))
    for (const [budget, local] of [[2, true], [0.5, false]]) {
      const plan = planDExecution(perimetre.retenus, { budget, estimations, workers: { node: 1 }, surcouts: { node: 0 } })
      assert.equal(plan.lances.includes(garde), local)
      assert.equal(plan.aLaCI.includes(garde), !local)
      assert.ok(plan.lances.includes(probe))
      const union = [...plan.lances, ...plan.aLaCI]
      assert.deepEqual([...union].sort(), [...perimetre.retenus.keys()].sort())
      assert.equal(new Set(union).size, perimetre.retenus.size)
    }
  }
  const probe = 'src/selection-probe.test.mjs'
  const racine = forger(t, fermeture, { [probe]: texte })
  assert.deepEqual(sitesDuDepot(racine), [])
  const perimetre = await deriver(racine)
  assert.deepEqual(perimetre.toolchain, [])
  assert.equal(perimetre.retenus.has('scripts/temoin.test.mjs'), false)
})

test('import direct : le test qui importe le fichier touché est retenu, distance 1', async (t) => {
  const racine = forger(t, { 'scripts/a.test.mjs': "import './lib.mjs'\n", 'scripts/lib.mjs': 'export const a = 1\n' },
    { 'scripts/lib.mjs': 'export const a = 2\n' })
  const lien = lienDe((await deriver(racine)), 'scripts/a.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 1, ['scripts/a.test.mjs', 'scripts/lib.mjs']])
})

test('import transitif : la chaîne la plus courte et sa distance', async (t) => {
  const racine = forger(t, {
    'scripts/b.test.mjs': "import './mid.mjs'\n",
    'scripts/mid.mjs': "export { f } from './feuille.mjs'\n",
    'scripts/feuille.mjs': 'export const f = 1\n',
  }, { 'scripts/feuille.mjs': 'export const f = 2\n' })
  const lien = lienDe((await deriver(racine)), 'scripts/b.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 2, ['scripts/b.test.mjs', 'scripts/mid.mjs', 'scripts/feuille.mjs']])
})

test('importeur pendu vers un fichier SUPPRIMÉ : la résolution contre la base garde l’arc', async (t) => {
  const racine = forger(t, {
    'scripts/c.test.mjs': "import './importeur.mjs'\n",
    'scripts/importeur.mjs': "import './parti.mjs'\n",
    'scripts/parti.mjs': 'export const p = 1\n',
  }, { 'scripts/parti.mjs': null })
  const lien = lienDe((await deriver(racine)), 'scripts/c.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.touche], ['import', 2, 'scripts/parti.mjs'])
})

test('fichier AJOUTÉ, non suivi, sous une racine balayée littérale', async (t) => {
  const racine = forger(t, { 'scripts/d.test.mjs': "import { readdirSync } from 'node:fs'\nreaddirSync('donnees')\n", 'donnees/un.json': '{}' },
    { 'donnees/deux.json': '{}' }, { commiter: false })
  const lien = lienDe((await deriver(racine, { base: 'HEAD' })), 'scripts/d.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site, lien.touche], ['racine balayée', 'donnees', 'scripts/d.test.mjs:2 readdirSync', 'donnees/deux.json'])
})

test('racine portée par une constante IMPORTÉE', async (t) => {
  const racine = forger(t, {
    'scripts/e.test.mjs': "import { RACINES_SCAN } from './scan.mjs'\nimport { readdirSync } from 'node:fs'\nreaddirSync(RACINES_SCAN)\n",
    'scripts/scan.mjs': "export const RACINES_SCAN = ['corpus']\n",
    'corpus/x.ts': 'export const x = 1\n',
  }, { 'corpus/x.ts': 'export const x = 2\n' })
  const lien = lienDe((await deriver(racine)), 'scripts/e.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site], ['racine balayée', 'corpus', 'scripts/e.test.mjs:3 readdirSync'])
})

test('import.meta.glob à motif littéral : arc vers chaque fichier visé', async (t) => {
  const racine = forger(t, {
    'src/f.test.ts': "const jeux = import.meta.glob('./jeux/*.json', { eager: true })\nexport default jeux\n",
    'src/jeux/a.json': '{}',
  }, { 'src/jeux/a.json': '{"a":1}' })
  const lien = lienDe((await deriver(racine)), 'src/f.test.ts')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 1, ['src/f.test.ts', 'src/jeux/a.json']])
})

test('setupFiles : chaque test Vitest est retenu au rang `setup`, sans distance propagée par eux', async (t) => {
  const racine = forger(t, {
    'vite.config.ts': "import { fileURLToPath } from 'node:url'\nexport default { test: { setupFiles: [fileURLToPath(new URL('./src/setup.ts', import.meta.url))] } }\n",
    'src/setup.ts': "import './store'\n",
    'src/store.ts': 'export const s = 1\n',
    'src/g.test.ts': 'export const g = 1\n',
    'src/h.test.ts': "import './store'\n",
  }, { 'src/store.ts': 'export const s = 2\n' })
  const perimetre = (await deriver(racine))
  const g = lienDe(perimetre, 'src/g.test.ts')
  assert.deepEqual([g.nature, g.touche], ['setup', 'src/store.ts'])
  const h = lienDe(perimetre, 'src/h.test.ts')
  assert.deepEqual([h.nature, h.distance, h.chaine], ['import', 1, ['src/h.test.ts', 'src/store.ts']])
  const estimations = new Map([['src/h.test.ts', { ms: 1000 }], ['src/g.test.ts', { ms: 1000 }]])
  assert.deepEqual(planDExecution(perimetre.retenus, { budget: 1, estimations }).aLaCI, ['src/g.test.ts'])
  assert.deepEqual(paliersDe(perimetre.retenus), { 'touché': 0, 'racine balayée': 0, 'import d=1': 1, 'import d=2': 0, 'import d=3': 0, 'import d≥4': 0, 'setup seul': 1, 'toolchain seule': 0 })
})

// #2586
test('setupFiles : une lambda locale de configuration conserve son lexique autonome', async (t) => {
  const racine = forger(t, {
    'vite.config.ts': "const holder={rappel:(nom='src/setup.ts')=>nom};const rappel=holder.rappel;export default {test:{setupFiles:[rappel()]}}",
    'src/setup.ts': "import './store'",
    'src/store.ts': 'export const s = 1',
    'src/g.test.ts': 'export const g = 1',
  }, { 'src/store.ts': 'export const s = 2' })
  const lien = lienDe((await deriver(racine)), 'src/g.test.ts')
  assert.deepEqual([lien.nature, lien.touche], ['setup', 'src/store.ts'])
})

test('racine balayée dont le site n’est atteint que par les setupFiles : rang `setup`', async (t) => {
  const racine = forger(t, {
    'vite.config.ts': "export default { test: { setupFiles: ['src/setup.ts'] } }\n",
    'src/setup.ts': "import { readdirSync } from 'node:fs'\nreaddirSync('donnees')\n",
    'donnees/x.json': '{}',
    'src/g.test.ts': 'export const g = 1\n',
  }, { 'donnees/x.json': '{"x":1}' })
  const g = lienDe((await deriver(racine)), 'src/g.test.ts')
  assert.deepEqual([g.nature, g.racine, g.site, g.touche], ['setup', 'donnees', 'src/setup.ts:2 readdirSync', 'donnees/x.json'])
})

test('relais de la clôture des setupFiles appelé par un test : la racine s’attribue au site où elle devient concrète, rang racine balayée', async (t) => {
  const racine = forger(t, {
    'vite.config.ts': "export default { test: { setupFiles: ['src/setup.ts'] } }\n",
    'src/setup.ts': "import '../scripts/lib/corpus.mjs'\n",
    'scripts/lib/corpus.mjs': "import { readdirSync } from 'node:fs'\nimport { join } from 'node:path'\n" +
      "export function lireCorpus(dirs) {\n  const bases = dirs.map((d) => join('.', d))\n  return bases.flatMap((b) => readdirSync(b))\n}\n",
    'src/n.test.ts': "import { lireCorpus } from '../scripts/lib/corpus.mjs'\nlireCorpus(['donnees'])\n",
    'src/g.test.ts': 'export const g = 1\n',
    'donnees/x.json': '{}',
  }, { 'donnees/x.json': '{"x":1}' })
  const perimetre = (await deriver(racine))
  const n = lienDe(perimetre, 'src/n.test.ts')
  assert.deepEqual([n.nature, n.rang, n.racine, n.site], ['racine balayée', 1, 'donnees', 'src/n.test.ts:2 lireCorpus'])
  assert.equal(perimetre.retenus.has('src/g.test.ts'), false)
})

test('mémo d’évaluation par module : un module CONSULTÉ qui change invalide l’évaluation de son appelant, mémos internes compris', async (t) => {
  const depot = (corps) => forger(t, {
    'scripts/lib/r.mjs': "import { readdirSync } from 'node:fs'\nimport { base } from './q.mjs'\nexport function lister(d) { return readdirSync(base(d)) }\n",
    'scripts/lib/q.mjs': `import { join } from 'node:path'\nexport const base = (d) => ${corps}\n`,
    'scripts/a.test.mjs': "import { lister } from './lib/r.mjs'\nlister('donnees')\n",
    'scripts/b.test.mjs': "import { lister } from './lib/r.mjs'\nlister('donnees')\n",
    'autre/donnees/x.json': '{}',
  }, { 'autre/donnees/x.json': '{"x":1}' })
  const memos = mkdtempSync(join(tmpdir(), 'perimetre-memos-'))
  t.after(() => rmSync(memos, { recursive: true, force: true }))
  const avecMemos = (racine) => perimetreDuDepot(racine, { base: 'HEAD~1', tete: 'HEAD' }, { dossierDesMemos: memos })
  const premier = (await avecMemos(depot('d'))).retenus
  assert.deepEqual(['scripts/a.test.mjs', 'scripts/b.test.mjs'].map((f) => premier.has(f)), [false, false])
  const { retenus } = (await avecMemos(depot("join('autre', d)")))
  assert.deepEqual(['scripts/a.test.mjs', 'scripts/b.test.mjs'].map((f) => [retenus.get(f)?.nature, retenus.get(f)?.racine]),
    [['racine balayée', 'autre/donnees'], ['racine balayée', 'autre/donnees']])
})

test('toolchain touchée (lectures des dépendances comprises) ⇒ suite entière', async (t) => {
  const racine = forger(t, { 'tsconfig.json': '{}', 'server/package.json': '{}', 'src/h.test.ts': 'export const h = 1\n' },
    { 'tsconfig.json': '{ "compilerOptions": {} }', 'server/package.json': '{ "private": true }' })
  const perimetre = (await deriver(racine))
  assert.deepEqual(perimetre.toolchain, ['server/package.json', 'tsconfig.json'])
  assert.deepEqual([...perimetre.retenus.keys()].sort(), ['scripts/temoin.test.mjs', 'src/h.test.ts'])
  assert.equal(perimetre.retenus.get('src/h.test.ts').nature, 'toolchain')
})

/** Mesures d'un dossier temporaire où les tests `durees` (`{ [test]: ms }`) ont une durée apprise, surcoûts nuls. */
function mesuresDuLancement(t, durees) {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-regime-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const mesures = mesuresDe(commun)
  mesures.ecrire('durees.json', durees)
  mesures.ecrire(SURCOUTS, { vitest: 0, node: 0 })
  return mesures
}
const lireNode = (rels) => new Map(rels.map((r) => [r, 'export {}\n']))
/** Workers vitest de chaque régime, distincts : le plan dit sous lesquels il a été calculé. */
const WORKERS_DU_REGIME = { lot: { vitest: 4, node: 1 }, suite: { vitest: 2, node: 1 } }
const workersDe = (regime) => WORKERS_DU_REGIME[regime]

test('régime du lancement : tout retenu (setup touché) mais le budget borne le lancement sous la portée ⇒ `lot`', (t) => {
  const tests = Array.from({ length: 40 }, (_, i) => `src/s${String(i).padStart(2, '0')}.test.ts`)
  const mesures = mesuresDuLancement(t, tableTotale(tests, () => 30000))
  const retenus = new Map(tests.map((f) => [f, { rang: 1_000_000 }]))
  const r = planDuLancement(retenus, { mesures, lire: lireNode, budget: 180, workersDe })
  assert.equal(r.regime, 'lot')
  assert.deepEqual(r.workers, WORKERS_DU_REGIME.lot)
  assert.deepEqual([r.plan.lances.length, r.plan.aLaCI.length, r.plan.murParFamille.vitest], [24, 16, 180000])
})

test('régime du lancement : un rang touché massif dont le mur sous `lot` dépasse la portée ⇒ `suite`, plan RECALCULÉ sous ses workers', (t) => {
  const tests = Array.from({ length: 10 }, (_, i) => `src/t${i}.test.ts`)
  const mesures = mesuresDuLancement(t, tableTotale(tests, () => 200000))
  const retenus = new Map(tests.map((f) => [f, { rang: 0 }]))
  const r = planDuLancement(retenus, { mesures, lire: lireNode, budget: 180, workersDe })
  // Sous lot, 4 workers : 3 × 200 s = 600 s > 294,4 s. Sous suite, 2 workers : 5 × 200 s.
  assert.equal(r.regime, 'suite')
  assert.deepEqual(r.workers, WORKERS_DU_REGIME.suite)
  assert.deepEqual([r.plan.lances.length, r.plan.murParFamille.vitest], [10, 1000000])
})

test('régime du lancement : un mur vitest ÉGAL à la portée reste `lot`', (t) => {
  const mesures = mesuresDuLancement(t, { 'src/a.test.ts': PORTEE_LOT_S * 1000 })
  const r = planDuLancement(new Map([['src/a.test.ts', { rang: 0 }]]), { mesures, lire: lireNode, budget: 180, workersDe })
  assert.deepEqual([r.regime, r.plan.murParFamille.vitest], ['lot', 294400])
})

test('régime du lancement : les workers d’un régime se mesurent UNE fois — les workers rendus sont ceux du plan', (t) => {
  const mesures = mesuresDuLancement(t, { 'src/a.test.ts': 100000, 'src/b.test.ts': 100000 })
  let appels = 0
  // Chaque mesure rend une autre valeur : 1 worker, puis 2.
  const changeant = () => ({ vitest: ++appels, node: 1 })
  const r = planDuLancement(new Map([['src/a.test.ts', { rang: 0 }], ['src/b.test.ts', { rang: 0 }]]), { mesures, lire: lireNode, budget: 180, workersDe: changeant })
  assert.deepEqual([r.regime, r.workers.vitest, r.plan.murParFamille.vitest, appels], ['lot', 1, 200000, 1])
})

test('lancement vitest : `run.mjs` reçoit `--regime=<r>`, que son lanceur lit et retire', () => {
  for (const regime of ['lot', 'suite']) {
    const args = argumentsVitest(['src/a.test.ts', 'src/b.test.ts'], 'rapport.json', regime)
    assert.deepEqual(args.slice(0, 4), ['scripts/test/run.mjs', `--regime=${regime}`, 'src/a.test.ts', 'src/b.test.ts'])
    const lu = regimeDeArgv(args.slice(1))
    assert.equal(lu.regime, regime)
    assert.deepEqual(lu.argv, args.slice(2))
  }
})

test('renommage : le chemin QUITTÉ reste touché sous la racine qui le balayait', async (t) => {
  const racine = forger(t, { 'scripts/i.test.mjs': "import { readdirSync } from 'node:fs'\nreaddirSync('anciens')\n", 'anciens/a.md': 'a\n', 'anciens/b.md': 'b\n' },
    { 'nouveaux/a.md': { de: 'anciens/a.md' } })
  const lien = lienDe((await deriver(racine)), 'scripts/i.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.touche], ['racine balayée', 'anciens', 'anciens/a.md'])
})

test('readFileSync d’un fichier EXACT : retenu quand ce fichier change, pas quand son voisin change', async (t) => {
  const base = { 'scripts/j.test.mjs': "import { readFileSync } from 'node:fs'\nreadFileSync('donnees/lu.json', 'utf8')\n", 'donnees/lu.json': '{}', 'donnees/voisin.json': '{}' }
  const lien = lienDe((await deriver(forger(t, base, { 'donnees/lu.json': '{"a":1}' }))), 'scripts/j.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.touche], ['racine balayée', 'donnees/lu.json', 'donnees/lu.json'])
  assert.equal((await deriver(forger(t, base, { 'donnees/voisin.json': '{"a":1}' }))).retenus.has('scripts/j.test.mjs'), false)
})

test('existsSync d’un fichier qui APPARAÎT : la sonde d’absence est une lecture', async (t) => {
  const racine = forger(t, { 'scripts/k.test.mjs': "import { existsSync } from 'node:fs'\nexistsSync('donnees/drapeau.json')\n" },
    { 'donnees/drapeau.json': '{}' })
  const lien = lienDe((await deriver(racine)), 'scripts/k.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site], ['racine balayée', 'donnees/drapeau.json', 'scripts/k.test.mjs:2 existsSync'])
})

test('RELAIS inter-module : le site d’appel, ses arguments liés, déclare la racine', async (t) => {
  const racine = forger(t, {
    'scripts/lib/lister.mjs': "import { readdirSync } from 'node:fs'\nexport function listerTests(racine = process.cwd()) {\n  return readdirSync(racine)\n}\n",
    'scripts/l.test.mjs': "import { listerTests } from './lib/lister.mjs'\nlisterTests('donnees')\n",
    'donnees/a.json': '{}',
  }, { 'donnees/a.json': '{"a":1}' })
  const lien = lienDe((await deriver(racine)), 'scripts/l.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site, lien.specificite], ['racine balayée', 'donnees', 'scripts/l.test.mjs:2 listerTests', 1])
})

test('deux racines balayées couvrent le fichier touché : la plus SPÉCIFIQUE est retenue', async (t) => {
  const racine = forger(t, {
    'scripts/s.test.mjs': "import { readdirSync } from 'node:fs'\nreaddirSync('.')\nreaddirSync('donnees')\n",
    'donnees/a.json': '{}',
  }, { 'donnees/a.json': '{"a":1}' })
  const lien = lienDe((await deriver(racine)), 'scripts/s.test.mjs')
  assert.deepEqual([lien.racine, lien.site, lien.specificite], ['donnees', 'scripts/s.test.mjs:3 readdirSync', 1])
})

/** Rangs : touché 0, racine balayée 1, import d=1 2, import d=2 3. */
const RETENUS = new Map([['t.test.mjs', { rang: 0 }], ['r.test.mjs', { rang: 1 }], ['b.test.mjs', { rang: 2 }], ['a.test.mjs', { rang: 2 }], ['z.test.mjs', { rang: 3 }]])

/** Estimations : 10 s chacun, sauf `b` (2 s). */
const ESTIMATIONS = new Map([...RETENUS.keys()].map((t) => [t, { ms: t === 'b.test.mjs' ? 2000 : 10_000 }]))

test('planDExecution : sous budget, tout est lancé ; seul le touché est hors budget', () => {
  const plan = planDExecution(RETENUS, { budget: 32, estimations: ESTIMATIONS })
  assert.deepEqual([plan.lances, plan.aLaCI, plan.murMs, plan.murBudgeteMs], [['t.test.mjs', 'r.test.mjs', 'b.test.mjs', 'a.test.mjs', 'z.test.mjs'], [], 42_000, 32_000])
  assert.deepEqual(planDExecution(RETENUS, { budget: 31, estimations: ESTIMATIONS }).aLaCI, ['z.test.mjs'], 'la racine balayée compte au budget')
})

test('planDExecution : la coupe passe À L’INTÉRIEUR d’un rang, le moins cher d’abord ; ce qui ne tient plus part à la CI', () => {
  const plan = planDExecution(RETENUS, { budget: 12, estimations: ESTIMATIONS })
  assert.deepEqual([plan.lances, plan.aLaCI], [['t.test.mjs', 'r.test.mjs', 'b.test.mjs'], ['a.test.mjs', 'z.test.mjs']])
  assert.deepEqual(plan.rangs.map((r) => [r.rang, r.murMs, r.lances, r.aLaCI]),
    [['touché', 10_000, 1, 0], ['racine balayée', 10_000, 1, 0], ['import d=1', 2000, 1, 1], ['import d=2', 0, 0, 1]])
})

test('planDExecution : budget 0 = touché seul, hors budget ; la racine balayée part à la CI', () => {
  assert.deepEqual(planDExecution(RETENUS, { budget: 0, estimations: ESTIMATIONS }).lances, ['t.test.mjs'])
  assert.deepEqual(planDExecution(RETENUS, { budget: 0 }).lances, ['t.test.mjs'])
  assert.deepEqual(planDExecution(RETENUS, { budget: 5, estimations: ESTIMATIONS }).aLaCI, ['r.test.mjs', 'a.test.mjs', 'z.test.mjs'])
})

test('planDExecution : le SAC se remplit — A tient, B déborde et part à la CI, C tient dans le reste et est lancé (#2474)', () => {
  const retenus = new Map([['a.test.mjs', { rang: 1, specificite: 1 }], ['b.test.mjs', { rang: 1, specificite: 2 }], ['c.test.mjs', { rang: 1, specificite: 3 }]])
  const estimations = new Map([['a.test.mjs', { ms: 4000 }], ['b.test.mjs', { ms: 9000 }], ['c.test.mjs', { ms: 2000 }]])
  const plan = planDExecution(retenus, { budget: 10, estimations, workers: { node: 1 } })
  assert.deepEqual([plan.lances, plan.aLaCI], [['a.test.mjs', 'c.test.mjs'], ['b.test.mjs']])
})

test('planDExecution : dans un rang, le SIGNAL passe avant le prix', () => {
  const signaux = new Map([['a.test.mjs', { signal: 'symbole' }], ['b.test.mjs', { signal: 'module' }]])
  const plan = planDExecution(RETENUS, { budget: 20, estimations: ESTIMATIONS, signaux })
  assert.deepEqual([plan.lances, plan.aLaCI], [['t.test.mjs', 'r.test.mjs', 'a.test.mjs'], ['b.test.mjs', 'z.test.mjs']])
})

test('planDExecution : la racine balayée s’ordonne par SPÉCIFICITÉ (fichier exact, `src/ui`, `src`, `.`), puis par coût', () => {
  const retenus = new Map([['racine.test.ts', { rang: 1, specificite: 9000 }], ['src.test.ts', { rang: 1, specificite: 800 }],
    ['exact.test.ts', { rang: 1, specificite: 1 }], ['ui.test.ts', { rang: 1, specificite: 60 }], ['ui-bis.test.ts', { rang: 1, specificite: 60 }]])
  const estimations = new Map([['racine.test.ts', { ms: 1000 }], ['src.test.ts', { ms: 1000 }], ['exact.test.ts', { ms: 5000 }], ['ui.test.ts', { ms: 3000 }], ['ui-bis.test.ts', { ms: 1000 }]])
  const plan = planDExecution(retenus, { budget: 10, estimations })
  assert.deepEqual([plan.lances, plan.aLaCI], [['exact.test.ts', 'ui-bis.test.ts', 'ui.test.ts', 'src.test.ts'], ['racine.test.ts']])
})

test('planDExecution : le budget porte sur le MUR, la somme répartie sur les workers', () => {
  const retenus = new Map(['a', 'b', 'c', 'd'].map((n) => [`src/${n}.test.ts`, { rang: 2 }]))
  const estimations = new Map([...retenus.keys()].map((t) => [t, { ms: 4000 }]))
  assert.deepEqual(planDExecution(retenus, { budget: 5, estimations, workers: { vitest: 4 } }).aLaCI, [])
  assert.deepEqual(planDExecution(retenus, { budget: 5, estimations, workers: { vitest: 1 } }).lances, ['src/a.test.ts'])
  assert.deepEqual(planDExecution(retenus, { budget: 5, estimations, workers: { vitest: 4 }, surcouts: { vitest: 2000 } }).lances, [],
    'le surcoût de lancement compte au mur')
})

test('mur du plan : ordonnancement simulé sur les workers effectifs + surcoût, par famille lancée ; les familles s’additionnent', () => {
  const estimations = new Map([['src/a.test.ts', { ms: 4000 }], ['src/b.test.ts', { ms: 2000 }], ['scripts/n.test.mjs', { ms: 3000 }]])
  const workers = { vitest: 4, node: 8 }
  const plan = (tests, options) => planDExecution(new Map(tests.map((t) => [t, { rang: 0 }])), { estimations, ...options })
  assert.equal(plan(['src/a.test.ts', 'src/b.test.ts'], { workers }).murMs, 4000, 'le plus long fichier borne le mur')
  assert.equal(plan(['src/a.test.ts', 'src/b.test.ts'], { workers: { vitest: 1 } }).murMs, 6000)
  const deux = plan(['src/a.test.ts', 'src/b.test.ts', 'scripts/n.test.mjs'], { workers, surcouts: { vitest: 500, node: 700 } })
  assert.deepEqual([deux.murMs, deux.murParFamille], [4000 + 500 + 3000 + 700, { vitest: 4500, node: 3700 }])
  assert.deepEqual(plan(['scripts/n.test.mjs'], { workers, surcouts: { vitest: 500, node: 700 } }).murParFamille, { vitest: 0, node: 3700 }, 'une famille non lancée ne paie pas son surcoût')
  assert.equal(plan([], { workers, surcouts: { vitest: 500 } }).murMs, 0)
})

test('mur du plan : un surcoût par LANCEMENT — des chemins assez longs pour deux paquets d’argv en paient deux', () => {
  const tests = Array.from({ length: 160 }, (_, i) => `src/${'x'.repeat(200)}${String(i).padStart(3, '0')}.test.ts`)
  assert.equal(paquetsDeLancement(tests).length, 2)
  const estimations = new Map(tests.map((t) => [t, { ms: 1000 }]))
  const plan = planDExecution(new Map(tests.map((t) => [t, { rang: 0 }])), { estimations, workers: { vitest: 160 }, surcouts: { vitest: 500 } })
  assert.equal(plan.murParFamille.vitest, 2 * 1000 + 2 * 500)
  assert.equal(paquetsDeLancement(tests.slice(0, 2)).length, 1)
})

test('paquets utiles : budget séquentiel, inconnues et longues isolées, union exacte puis plafond argv', () => {
  const tests = ['f', 'd', 'b', 'e', 'a', 'c']
  const estimations = new Map([['a', { ms: 2 }], ['b', { ms: 3 }], ['c', { ms: 0 }], ['e', { ms: 8 }], ['f', { ms: 2 }]])
  const paquets = paquetsDeLancement(tests, { estimations, budgetMs: 5 })
  assert.deepEqual(paquets, [['a', 'b'], ['c'], ['d'], ['e'], ['f']])
  assert.deepEqual(paquets.flat(), [...tests].sort())
  assert.equal(new Set(paquets.flat()).size, tests.length)
  assert.deepEqual(paquetsDeLancement([...tests, 'a'], { estimations, budgetMs: 5 }), paquets)
  assert.deepEqual(paquetsDeLancement(tests, { estimations, budgetMs: 0 }), [...tests].sort().map((t) => [t]))
  const longs = Array.from({ length: 160 }, (_, i) => `${String(i).padStart(3, '0')}${'x'.repeat(200)}`)
  const groupes = paquetsDeLancement(longs, { estimations: new Map(longs.map((t) => [t, { ms: 1 }])), budgetMs: 100 })
  assert.deepEqual(groupes.map((p) => p.length), [100, 60])
  const argv = paquetsDeLancement(longs, { estimations: new Map(longs.map((t) => [t, { ms: 1 }])), budgetMs: 160 })
  assert.equal(argv.length, 2)
  assert.deepEqual(argv.flat(), longs)
  assert.equal(new Set(argv.map((_, i) => rapportDuLancement('/r', 42)('node', i))).size, argv.length)
})

test('plan Node : acquisition simulée sur un worker, mêmes paquets séquentiels et plafond trente minutes', () => {
  const tests = ['scripts/a.test.mjs', 'scripts/b.test.mjs', 'scripts/c.test.mjs']
  const retenus = new Map(tests.map((t) => [t, { rang: 0 }]))
  const estimations = new Map(tests.map((t) => [t, { ms: 1000 }]))
  const plan = planDExecution(retenus, { estimations, budget: 2, workers: { node: 8 }, workersNode: () => 1, surcouts: { node: 10 } })
  assert.deepEqual(plan.paquets.node, [tests.slice(0, 2), tests.slice(2)])
  assert.deepEqual(plan.concurrencesNode, [1, 1])
  assert.equal(plan.murParFamille.node, 3020)
  const grands = new Map(tests.map((t) => [t, { ms: 1_000_000 }]))
  assert.deepEqual(planDExecution(retenus, { estimations: grands, budget: 9000 }).paquets.node, tests.map((t) => [t]))
})

test('plan Node : profils de la configuration reporters effective, source modifiée et réacquisition', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-profils-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const tests = ['scripts/a.test.mjs', 'scripts/b.test.mjs']
  mkdirSync(join(racine, 'scripts'))
  for (const fichier of tests) writeFileSync(join(racine, fichier), 'export {}')
  const memos = { 'durees.json': tableTotale(tests, () => 1000) }
  const mesures = { lire: (nom, valider = (x) => x) => valider(memos[nom] ?? {}) }
  const configurationNode = { racine, env: {} }
  const p = { mesures, lire: () => new Map(), budget: 180, workers: { node: 8 }, configurationNode }
  const retenus = new Map(tests.map((f) => [f, { rang: 0 }]))
  const mur = () => planDuPerimetre(retenus, p).plan.murParFamille.node
  assert.equal(mur(), 2000 + REPLI_SURCOUT_MS.node)
  const argv = ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout',
    `--test-reporter=${new URL('./dureesNodeTest.mjs', import.meta.url).href}`, '--test-reporter-destination=ailleurs.json']
  const profils = profilsDuLancement({ racine, fichiers: tests, argv, mesures, env: {} })
  memos['memoire-node.json'] = Object.fromEntries(profils.entrees.map((e) => [e.cle, {
    fichier: e.fichier, blob: e.blob, picOctets: 100, parentOctets: 20, descendantsInclus: true, metrique: 'working-set',
  }]))
  assert.equal(mur(), 1000 + REPLI_SURCOUT_MS.node)
  configurationNode.forcer = true
  assert.equal(mur(), 2000 + REPLI_SURCOUT_MS.node)
  configurationNode.forcer = false
  writeFileSync(join(racine, tests[0]), 'export const modifie = 1')
  assert.equal(mur(), 2000 + REPLI_SURCOUT_MS.node)
})

test('paquet achevé : apprentissage visible avant le suivant interrompu, rouge agrégé sans rejeu', async (t) => {
  const b = bancDeCloture(t, 'scripts/a.test.mjs', ['node', 'node', 'node'])
  let appels = 0
  b.options.workers.node = 8
  const rendu = await executerLancements(b.options, { lancerNode: async () => {
    const lancement = b.options.lancements[appels++]
    writeFileSync(lancement.sortie, b.rapport)
    if (appels === 1) return { code: 1, concurrence: 1, arret: { etat: 'mort' } }
    assert.equal(b.ecritures.filter(([nom]) => nom === 'durees.json').length, 1)
    assert.ok(b.journal.some((s) => s.includes('servis 1, plan 8')))
    return { code: 0, concurrence: 1, annulee: true, arret: { etat: 'mort' } }
  } })
  assert.equal(appels, 2)
  assert.equal(rendu.code, 1)
  assert.equal(rendu.joues.length, 2)
  assert.equal(b.ecritures.filter(([nom]) => nom === 'durees.json').length, 1)
  assert.equal(existsSync(b.options.lancements[1].sortie), true)
})

/** Le mur du plan de `durees` (`{ [test]: ms }`), tous au rang touché, sur `workers`. */
const murDuPlan = (durees, workers) => planDExecution(new Map(Object.keys(durees).map((t) => [t, { rang: 0 }])),
  { estimations: new Map(Object.entries(durees).map(([t, ms]) => [t, { ms }])), workers }).murMs

test('mur simulé (sonde 1 #2474) : node démarre ses fichiers dans l’ordre LEXICAL — a, b à 1 s puis c à 3 s sur 2 workers : 4 s ; Vitest par durée décroissante : 3 s', () => {
  assert.equal(murDuPlan({ 'scripts/c.test.mjs': 3000, 'scripts/b.test.mjs': 1000, 'scripts/a.test.mjs': 1000 }, { node: 2 }), 4000)
  assert.equal(murDuPlan({ 'src/a.test.ts': 1000, 'src/b.test.ts': 1000, 'src/c.test.ts': 3000 }, { vitest: 2 }), 3000)
})

/** 30 fichiers de 10 s, puis le plus long (100 s) en FIN de lexique, sur 15 workers (sonde 3 #2474, durées synthétiques). */
const LONG_EN_FIN = { ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`scripts/a${String(i).padStart(2, '0')}.test.mjs`, 10_000])), 'scripts/z.test.mjs': 100_000 }

test('mur simulé : trois parents Node sous budget de 180 s, les dix-huit puis douze courts puis le long', () => {
  assert.equal(murDuPlan(LONG_EN_FIN, { node: 15 }), 20_000 + 10_000 + 100_000)
})

test('surcoutObserve : mur réel − mur simulé sur les workers effectifs, plancher 0 ; le démarrage tardif du plus long n’est pas du surcoût', () => {
  assert.equal(surcoutObserve('node', 120_300, LONG_EN_FIN, { node: 15 }), 300)
  assert.equal(surcoutObserve('node', 52_500, { 'scripts/a.test.mjs': 50_000, 'scripts/b.test.mjs': 500, 'scripts/c.test.mjs': 500 }, { node: 15 }), 2500, 'le plus long fichier n’est pas du surcoût')
  assert.equal(surcoutObserve('node', 10_000, { 'scripts/a.test.mjs': 4000, 'scripts/b.test.mjs': 4000 }, { node: 4 }), 6000)
  assert.equal(surcoutObserve('vitest', 10_000, { 'src/a.test.ts': 4000, 'src/b.test.ts': 4000 }, { vitest: 1, node: 4 }), 2000)
  assert.equal(surcoutObserve('vitest', 1000, { 'src/a.test.ts': 4000, 'src/b.test.ts': 4000 }, { vitest: 1 }), 0)
})

/** Les durées d'une course CI (`memoCiDe`) et l'environnement Vitest de chaque test (`null` : illisible). */
const CI = { run: 37724465833, vitest: { 'src/n.test.ts': 1000, 'src/j.test.tsx': 1000, 'src/l.test.ts': 9999, 'src/illisible.test.ts': 100 }, node: { 'scripts/c.test.mjs': 2000, 'scripts/l.test.mjs': 1 } }
const environnementDuTest = (t) => ({ 'src/n.test.ts': 'node', 'src/j.test.tsx': 'jsdom', 'src/l.test.ts': 'node' })[t] ?? null

test('estimationsDe : la durée apprise ICI prime, puis la durée CI × le facteur de sa population, sinon INCONNUE', () => {
  const locales = { 'src/l.test.ts': 500, 'scripts/l.test.mjs': 700 }
  const facteurs = facteursCi({ locales, ci: CI, environnementDe: environnementDuTest })
  const tests = ['src/l.test.ts', 'scripts/l.test.mjs', 'src/n.test.ts', 'src/j.test.tsx', 'scripts/c.test.mjs', 'src/illisible.test.ts', 'scripts/z.test.mjs']
  const estimations = estimationsDe(tests, { locales, ci: CI, facteurs, environnementDe: environnementDuTest })
  assert.deepEqual([...estimations].map(([t, { ms, source, population }]) => [t, ms, source, population ?? null]), [
    ['src/l.test.ts', 500, 'locale', null],
    ['scripts/l.test.mjs', 700, 'locale', null],
    ['src/n.test.ts', Math.round(1000 * REPLI_FACTEUR_CI['vitest-node']), 'ci', 'vitest-node'],
    ['src/j.test.tsx', Math.round(1000 * REPLI_FACTEUR_CI['vitest-jsdom']), 'ci', 'vitest-jsdom'],
    ['scripts/c.test.mjs', Math.round(2000 * REPLI_FACTEUR_CI.node), 'ci', 'node'],
    ['src/illisible.test.ts', null, 'inconnue', null],
    ['scripts/z.test.mjs', null, 'inconnue', null],
  ])
  assert.deepEqual([estimations.get('src/n.test.ts').run, estimations.get('src/n.test.ts').ciMs], [37724465833, 1000])
  assert.deepEqual([...estimationsDe(tests, { locales })].map(([, { source }]) => source), ['locale', 'locale', 'inconnue', 'inconnue', 'inconnue', 'inconnue', 'inconnue'], 'sans CI : apprise ou inconnue')
})

test('facteursCi : Σlocal/ΣCI des paires dès 10 ; dessous, le repli de banc, pour CHAQUE population', () => {
  for (const population of ['vitest-node', 'vitest-jsdom', 'node']) assert.ok(Number.isFinite(REPLI_FACTEUR_CI[population]) && REPLI_FACTEUR_CI[population] > 0, `repli de banc mesuré pour ${population}`)
  const noms = (n, prefixe, ext) => Array.from({ length: n }, (_, i) => `${prefixe}${i}.test.${ext}`)
  const [vitestNode, jsdom, node] = [noms(10, 'src/n', 'ts'), noms(9, 'src/j', 'tsx'), noms(3, 'scripts/m', 'mjs')]
  const ci = { vitest: tableTotale([...vitestNode, ...jsdom], () => 100), node: tableTotale(node, () => 100) }
  const locales = Object.fromEntries([...vitestNode.map((t, i) => [t, i < 5 ? 100 : 300]), ...jsdom.map((t) => [t, 1000]), ...node.map((t) => [t, 50])])
  const environnementDe = (t) => t.endsWith('.tsx') ? 'jsdom' : 'node'
  assert.deepEqual(facteursCi({ locales, ci, environnementDe }), {
    'vitest-node': { valeur: 2, paires: 10, origine: 'paires' },
    'vitest-jsdom': { valeur: REPLI_FACTEUR_CI['vitest-jsdom'], paires: 9, origine: 'repli' },
    node: { valeur: REPLI_FACTEUR_CI.node, paires: 3, origine: 'repli' },
  })
  const node10 = noms(10, 'scripts/p', 'mjs')
  assert.deepEqual(facteursCi({ locales: tableTotale(node10, () => 50), ci: { node: tableTotale(node10, () => 100) }, environnementDe }).node,
    { valeur: 0.5, paires: 10, origine: 'paires' }, 'node se calibre dès 10 paires')
})

test('texte d’une estimation et d’un mur : apprise ici, CI calibrée ou non, inconnue ; un mur qui ignore des tests sans durée est un MINORANT', () => {
  assert.equal(texteDeLEstimation({ ms: 2500, source: 'locale' }), ' ~2.5 s (apprise ici)')
  assert.equal(texteDeLEstimation({ ms: 900, source: 'ci', run: 37724465833, population: 'vitest-node', facteur: { valeur: 0.9, paires: 3, origine: 'repli' } }),
    ' ~0.9 s (CI 37724465833 × 0.90 repli de banc, vitest-node)')
  assert.equal(texteDeLEstimation({ ms: 2100, source: 'ci', run: 1, population: 'vitest-jsdom', facteur: { valeur: 2.1, paires: 40, origine: 'paires' } }), ' ~2.1 s (CI 1 × 2.10, vitest-jsdom)')
  assert.equal(texteDeLEstimation({ ms: 11_700, source: 'ci', run: 1, population: 'node', facteur: { valeur: 5.85, paires: 0, origine: 'repli' } }), ' ~11.7 s (CI 1 × 5.85 repli de banc, node)')
  assert.equal(texteDeLEstimation({ ms: null, source: 'inconnue' }), ' durée inconnue')
  assert.equal(texteDuMur(3000), '3.0 s')
  assert.equal(texteDuMur(1000, { sansDuree: 2 }), '≥ 1.0 s (minorant : 2 test(s) sans durée)')
})

test('mur : la part estimée depuis la CI se nomme — ABSORBÉE par le plus long quand il est appris ici (DoD 3 #2497)', () => {
  const retenus = new Map(['long', 'x1', 'x2'].map((n) => [`scripts/${n}.test.mjs`, { rang: 1 }]))
  const estimations = new Map([['scripts/long.test.mjs', { ms: 150_000, source: 'locale' }], ['scripts/x1.test.mjs', { ms: 1000, source: 'ci' }], ['scripts/x2.test.mjs', { ms: 1000, source: 'ci' }]])
  const plan = planDExecution(retenus, { budget: 300, estimations, workers: { node: 15 } })
  assert.deepEqual([plan.lances.length, plan.murMs, plan.murCiMs, plan.nCi], [3, 150_000, 0, 2])
  assert.equal(texteDuMur(plan.murMs, plan), '150.0 s, dont 0.0 s estimées depuis la CI (2 test(s), absorbées par le plus long)')
  assert.equal(texteDuMur(plan.rangs[0].murMs, plan.rangs[0]), '150.0 s, dont 0.0 s estimées depuis la CI (2 test(s), absorbées par le plus long)')
})

test('mur : quand les durées CI font le mur, toute sa part se dit estimée depuis la CI (DoD 3 #2497, cas opposé)', () => {
  const retenus = new Map(['long', 'x1', 'x2'].map((n) => [`scripts/${n}.test.mjs`, { rang: 1 }]))
  const estimations = new Map([['scripts/long.test.mjs', { ms: 150_000, source: 'ci' }], ['scripts/x1.test.mjs', { ms: 1000, source: 'ci' }], ['scripts/x2.test.mjs', { ms: 1000, source: 'ci' }]])
  const plan = planDExecution(retenus, { budget: 300, estimations, workers: { node: 15 } })
  assert.equal(texteDuMur(plan.murMs, plan), '150.0 s, dont 150.0 s estimées depuis la CI (3 test(s))')
})

test('planDExecution : une durée INCONNUE part à la CI hors du rang touché, sans couper les suivants ; touchée, elle est lancée et son mur se dit MINORANT', () => {
  const retenus = new Map([['scripts/t.test.mjs', { rang: 0 }], ['src/u.test.ts', { rang: 0 }], ['scripts/a.test.mjs', { rang: 1 }], ['src/i.test.ts', { rang: 1 }], ['scripts/b.test.mjs', { rang: 2 }]])
  const estimations = estimationsDe([...retenus.keys()], { locales: { 'scripts/t.test.mjs': 1000, 'scripts/a.test.mjs': 2000, 'scripts/b.test.mjs': 3000 } })
  const plan = planDExecution(retenus, { budget: 10, estimations })
  assert.deepEqual([plan.lances, plan.aLaCI], [['src/u.test.ts', 'scripts/t.test.mjs', 'scripts/a.test.mjs', 'scripts/b.test.mjs'], ['src/i.test.ts']])
  assert.deepEqual(plan.rangs.map((r) => [r.rang, r.lances, r.aLaCI, r.inconnues, r.sansDuree]),
    [['touché', 2, 0, 1, 1], ['racine balayée', 1, 1, 1, 0], ['import d=1', 1, 0, 0, 0]])
  assert.equal(plan.sansDuree, 1)
})


test('exportsTouches : modifié, ajouté, supprimé, renommé ; inchangé exclu ; module neuf = tout', () => {
  const avant = 'export const a = 1\nexport function b() { return 1 }\nexport const c = 3\nexport const d = 4\nconst e = 5\nexport { e }\n'
  const apres = 'export const a = 2\nexport function b() { return 1 }\nexport const f = 6\nexport const d2 = 4\nconst e = 5\nexport { e }\n'
  assert.deepEqual([...exportsTouches('m.ts', avant, apres)].sort(), ['a', 'c', 'd', 'd2', 'f'])
  assert.deepEqual([...exportsTouches('m.ts', null, 'export const x = 1\nexport default 2\n')].sort(), ['default', 'x'])
})

test('signalDe : symbole touché importé par nom, module sinon ; espace de noms = module ; d≥2 module ou reste', () => {
  const nommee = (nom) => ({ forme: 'nommee', importe: { nom } })
  const touches = new Set(['a'])
  assert.deepEqual(signalDe({ distance: 1 }, [nommee('a'), nommee('b')], touches), { signal: 'symbole', noms: ['a'] })
  assert.deepEqual(signalDe({ distance: 1 }, [nommee('b')], touches), { signal: 'module', noms: [] })
  assert.deepEqual(signalDe({ distance: 1 }, [{ forme: 'espace', importe: { nom: '*' } }], touches), { signal: 'module', noms: [] })
  assert.deepEqual(signalDe({ distance: 2 }, [nommee('a')], touches), { signal: 'module', noms: ['a'] })
  assert.deepEqual(signalDe({ distance: 2 }, [{ forme: 'espace', importe: { nom: '*' } }], touches), { signal: 'reste', noms: [] })
})

test('signal dérivé sur un dépôt : l’import par nom d’un export modifié est un SYMBOLE', async (t) => {
  const racine = forger(t, {
    'scripts/lib.mjs': 'export const a = 1\nexport const b = 1\n',
    'scripts/s.test.mjs': "import { a } from './lib.mjs'\n",
    'scripts/m.test.mjs': "import { b } from './lib.mjs'\n",
    'scripts/e.test.mjs': "import * as lib from './lib.mjs'\nexport default lib\n",
  }, { 'scripts/lib.mjs': 'export const a = 2\nexport const b = 1\n' })
  const { signaux } = (await deriver(racine))
  assert.deepEqual(['scripts/s.test.mjs', 'scripts/m.test.mjs', 'scripts/e.test.mjs'].map((f) => signaux.get(f)),
    [{ signal: 'symbole', noms: ['a'] }, { signal: 'module', noms: [] }, { signal: 'module', noms: [] }])
})

test('mémos signés par le tsconfig : le même blob sous deux tsconfig ne partage pas son mémo (T3)', (t) => {
  const [a, b, c] = ['{}', '{ "compilerOptions": { "verbatimModuleSyntax": true } }', '{}'].map((tsconfig) => {
    const racine = mkdtempSync(join(tmpdir(), 'perimetre-tsconfig-'))
    t.after(() => rmSync(racine, { recursive: true, force: true }))
    writeFileSync(join(racine, 'tsconfig.json'), tsconfig)
    return racine
  })
  const dossier = mkdtempSync(join(tmpdir(), 'perimetre-memos-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const ecrits = memosDe(dossier, versionDesMemosDeDerivation(a))
  ecrits.ecrire('specificateurs', '.ts:blob', [])
  ecrits.sauver()
  assert.equal(memosDe(dossier, versionDesMemosDeDerivation(b)).lire('specificateurs', '.ts:blob'), undefined)
  assert.deepEqual(memosDe(dossier, versionDesMemosDeDerivation(c)).lire('specificateurs', '.ts:blob'), [])
})

test('mémos signés par la fermeture du propriétaire, hors CLI (C2)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-versionnant-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const meme = { fermeture: () => [['scripts/test/perimetreDerivation.mjs', 'texte']] }
  const autre = { fermeture: () => [['scripts/test/perimetreDerivation.mjs', 'autre texte']] }
  assert.equal(versionDesMemosDeDerivation(racine, meme), versionDesMemosDeDerivation(racine, meme))
  assert.notEqual(versionDesMemosDeDerivation(racine, autre), versionDesMemosDeDerivation(racine, meme))
})

test('lint : lancé sur les fichiers touchés PRÉSENTS à extension lintée, son code de sortie compte', () => {
  const appels = []
  const lancer = (racine, fichiers, { cwd }) => { appels.push([racine, fichiers, cwd]); return { defauts: [], codeSortie: 1 } }
  const lint = lintDesTouches('/r', ['a.ts', 'b.json', 'parti.mjs', 'c.mjs'], ['a.ts', 'b.json', 'c.mjs'], lancer)
  assert.deepEqual([appels, lint.code], [[['/r', ['a.ts', 'c.mjs'], '/r']], 1])
  assert.deepEqual(lintDesTouches('/r', ['b.json'], ['b.json'], lancer), { fichiers: [], defauts: [], code: 0 })
})

test('lireArguments : --tete exige --base, --budget exige un entier de secondes', () => {
  assert.deepEqual(lireArguments(['--liste', '--base', 'b', '--tete', 't', '--budget', '40', '--docs']), { liste: true, base: 'b', tete: 't', budget: 40, docs: true })
  assert.throws(() => lireArguments(['--tete', 't']), /--tete exige --base/)
  assert.throws(() => lireArguments(['--budget', 'beaucoup']), /--budget attend un entier/)
})

/** Un module Vitest de durée `ms` (`TestModule.diagnostic()`), pour `DureesVitest`. */
const moduleVitest = (moduleId, ms, etat = 'passed') => ({ moduleId, state: () => etat, diagnostic: () => ({ environmentSetupDuration: 0, prepareDuration: 0, collectDuration: 0, setupDuration: 0, duration: ms }) })

/** Le reporter Vitest réel d'un lancement sous `maxWorkers` résolus : il écrit le rapport `sortie` des modules `modules`. */
const lancerVitest = (sortie, modules, maxWorkers = 2) => {
  const reporter = new DureesVitest()
  reporter.onInit({ config: { outputFile: { durees: sortie }, maxWorkers } })
  reporter.onTestRunEnd(modules)
}

test('dureesVitest : le rapport porte les workers résolus de la config (`maxWorkers`), `null` sans eux, et les modules en échec', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'perimetre-reporter-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const sortie = join(dossier, 'rapport.json')
  lancerVitest(sortie, [moduleVitest('/r/a.test.ts', 12)], 3)
  assert.deepEqual(JSON.parse(readFileSync(sortie, 'utf8')), { workers: 3, durees: { '/r/a.test.ts': 12 }, echecs: [] })
  lancerVitest(sortie, [moduleVitest('/r/a.test.ts', 12), moduleVitest('/r/b.test.ts', 3, 'failed')], null)
  assert.deepEqual(JSON.parse(readFileSync(sortie, 'utf8')), { workers: null, durees: { '/r/a.test.ts': 12, '/r/b.test.ts': 3 }, echecs: ['/r/b.test.ts'] })
})

test('apprendre : un rapport vitest SANS workers valides apprend ses durées, et aucun workers servis', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-sans-workers-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const rapport = rapportDuLancement(racine, 7)
  const ecrits = []
  const mesures = { lire: () => ({}), ecrire: (nom, e) => { ecrits.push([nom, e]) } }
  for (const [i, workers] of [[0, null], [1, 0], [2, 2.5], [3, '4']]) {
    writeFileSync(rapport('vitest', i), JSON.stringify({ workers, durees: { [join(racine, 'src', 'a.test.ts')]: 10 } }))
    assert.deepEqual(apprendre(racine, rapport('vitest', i), mesures, 'vitest', 3), { appris: { 'src/a.test.ts': 10 }, workers: null, echecs: [] }, JSON.stringify(workers))
  }
  assert.equal(ecrits.length, 4)
})

test('ligneDeRelance : un run rouge nomme la commande qui ne relance QUE ses fichiers en échec, par famille, lint compris ; rien sur un run vert', () => {
  const vert = { code: 0, defauts: [] }
  const appelLint = () => ['node', 'lanceur.mjs', 'oxlint', '--', 'oxlint', '--config', 'c.mjs']
  const tete = 'rouge — relancer les SEULS fichiers en échec, puis un dernier test:perimetre : '
  const rouge = (famille, ...echecs) => ({ famille, code: 1, echecs, args: [] })
  assert.equal(ligneDeRelance({ code: 0, lancements: [{ famille: 'vitest', code: 0, echecs: [], args: [] }], lint: vert, appelLint }), null)
  assert.equal(ligneDeRelance({ code: 1, lancements: [rouge('vitest', 'src/b.test.ts', 'src/a.test.ts'), rouge('node', 'scripts/n.test.mjs'), rouge('vitest', 'src/b.test.ts')], lint: vert, appelLint }),
    `${tete}npm test -- src/a.test.ts src/b.test.ts ; node --test scripts/n.test.mjs`)
  assert.equal(ligneDeRelance({ code: 1, lancements: [rouge('node', 'scripts/un dossier/n.test.mjs')], lint: vert, appelLint }),
    `${tete}node --test "scripts/un dossier/n.test.mjs"`)
  const lint = { code: 1, defauts: [
    { site: 'src/b.ts:3:1', gravite: 'erreur', regle: 'r', message: 'm' },
    { site: 'src/a.ts:1:2', gravite: 'avertissement', regle: 'r', message: 'm' },
    { site: 'src/b.ts:9:4', gravite: 'erreur', regle: 'r', message: 'm' },
  ] }
  assert.equal(ligneDeRelance({ code: 1, lancements: [], lint, appelLint }), `${tete}node lanceur.mjs oxlint -- oxlint --config c.mjs src/a.ts src/b.ts`)
  assert.equal(ligneDeRelance({ code: 1, lancements: [], lint: vert, appelLint }), 'rouge — aucun rapport ne nomme de fichier en échec')
})

test('ligneDeRelance : chaque rouge SANS fichier nommé est nommé, à côté des fichiers d’une autre famille ou d’un autre lot', () => {
  const vert = { code: 0, defauts: [] }
  const appelLint = () => ['oxlint']
  const lintMixte = { code: 1, defauts: [
    { site: 'src/a.ts:1:1', gravite: 'erreur', regle: 'r', message: 'm' },
    { site: '(lint)', gravite: 'erreur', regle: '(outillage)', message: 'oxlint a échoué sans rapport : boum' },
  ] }
  assert.equal(ligneDeRelance({ code: 1, lancements: [{ famille: 'vitest', code: 1, echecs: ['src/a.test.ts'], args: [] }], lint: lintMixte, appelLint }),
    'rouge — relancer les SEULS fichiers en échec, puis un dernier test:perimetre : npm test -- src/a.test.ts ; oxlint src/a.ts'
    + ' — rouge sans fichier nommé : lint (lint) : oxlint a échoué sans rapport : boum')
  assert.equal(ligneDeRelance({ code: 1, lancements: [], lint: { code: 1, defauts: [] }, appelLint }),
    'rouge — rouge sans fichier nommé : lint rouge, son rapport ne nomme aucun défaut')
  const docs = { famille: 'docs', code: 1, echecs: [], args: ['scripts/docs/build-all.mjs', '--check', '--only', 'docs:x'] }
  assert.equal(ligneDeRelance({ code: 1, lancements: [{ famille: 'node', code: 1, echecs: ['scripts/n.test.mjs'], args: [] }, docs], lint: vert, appelLint }),
    'rouge — relancer les SEULS fichiers en échec, puis un dernier test:perimetre : node --test scripts/n.test.mjs'
    + ' — rouge sans fichier nommé : docs dérivés rouges : node scripts/docs/build-all.mjs --check --only docs:x')
  assert.equal(ligneDeRelance({ code: 1, lancements: [{ famille: 'vitest', code: 1, echecs: ['src/a.test.ts'], args: [] }, { famille: 'vitest', code: 1, echecs: [], args: [] }], lint: vert, appelLint }),
    'rouge — relancer les SEULS fichiers en échec, puis un dernier test:perimetre : npm test -- src/a.test.ts'
    + ' — rouge sans fichier nommé : vitest : 1 lancement(s) rouge(s) sans fichier en échec rapporté')
})

/** Le lancement `principal` du dépôt `racine` sur son dernier commit, sous la plateforme `platform` (celle du
 *  processus par défaut), en sous-processus HORS du contexte de ce test (`NODE_TEST_CONTEXT` retiré : ses `node --test`
 *  lancent leurs fichiers) : sa sortie et son code. */
const lancerPrincipal = (racine, options = [], platform = process.platform) => {
  const module = pathToFileURL(join(import.meta.dirname, 'perimetre.mjs')).href
  const code = `import { principal } from ${JSON.stringify(module)}; process.exitCode = await principal(['--base', 'HEAD~1', '--tete', 'HEAD', ...${JSON.stringify(options)}], ${JSON.stringify(racine)}, { platform: ${JSON.stringify(platform)} })`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: racine, encoding: 'utf8', env: { ...process.env, NODE_TEST_CONTEXT: undefined } })
}

/** Le lint d'un dépôt forgé : le script `lint` de son `package.json` (`appelDuLint`), un lanceur au rapport vide. */
const LINT_FORGE = {
  'package.json': JSON.stringify({ scripts: { lint: 'node scripts/lint-forge.mjs oxlint -- oxlint --config oxlint.config.mjs .' } }),
  'scripts/lint-forge.mjs': 'process.stdout.write(JSON.stringify({ diagnostics: [], number_of_files: 0 }))\n',
}

test('principal : un test node touché ROUGE → code non nul et ligne de relance de ce seul fichier ; vert → code 0, aucune ligne rouge ; sous Linux, aucune vue ni profil, concurrence fixe, et --reacquerir-memoire échoue fermé ENONSUPPORTE', (t) => {
  const forgerAvec = (attendu) => forger(t, LINT_FORGE, { 'scripts/n.test.mjs':
    `import { test } from 'node:test'
import assert from 'node:assert/strict'\ntest('n', () => assert.equal(1, ${attendu}))\n` })
  const lignes = (sortie) => sortie.split(/\r?\n/)
  const rouge = lancerPrincipal(forgerAvec(2))
  assert.notEqual(rouge.status, 0, rouge.stdout + rouge.stderr)
  assert.ok(lignes(rouge.stdout).includes('[perimetre] rouge — relancer les SEULS fichiers en échec, puis un dernier test:perimetre : node --test scripts/n.test.mjs'),
    rouge.stdout + rouge.stderr)
  const vert = lancerPrincipal(forgerAvec(1))
  assert.equal(vert.status, 0, vert.stdout + vert.stderr)
  assert.deepEqual(lignes(vert.stdout).filter((l) => l.startsWith('[perimetre] rouge')), [], vert.stdout)
  const sansMesure = '[perimetre] [memoire] mesure indisponible sous linux, concurrence fixe 1 : scripts/n.test.mjs'
  const mesure = (sortie) => lignes(sortie).filter((l) => /^\[perimetre\] \[memoire\] (acquisition|admission|observation|MESURE_MEMOIRE_INCOMPLETE|cause)/.test(l))
  if (process.platform === 'win32') assert.ok(lignes(vert.stdout).some((l) => l.startsWith('[perimetre] [memoire] observation Node : ')), vert.stdout)
  const racineLinux = forgerAvec(1)
  const linux = lancerPrincipal(racineLinux, [], 'linux')
  assert.equal(linux.status, 0, linux.stdout + linux.stderr)
  assert.ok(lignes(linux.stdout).includes(sansMesure), linux.stdout)
  assert.deepEqual(mesure(linux.stdout), [], linux.stdout)
  assert.equal(existsSync(join(racineLinux, '.git', 'perimetre', 'memoire-node.json')), false)
  const force = lancerPrincipal(racineLinux, ['--reacquerir-memoire'], 'linux')
  assert.notEqual(force.status, 0, force.stdout + force.stderr)
  assert.ok(lignes(force.stdout).includes('[perimetre] [memoire] ENONSUPPORTE : --reacquerir-memoire : mesure mémoire indisponible sous linux'), force.stdout)
  assert.deepEqual(mesure(force.stdout), [], force.stdout)
  assert.equal(existsSync(join(racineLinux, '.git', 'perimetre', 'memoire-node.json')), false)
})

test('apprendre : un rapport aux échecs mal formés n’en rapporte aucun', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-echecs-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const rapport = rapportDuLancement(racine, 9)
  const mesures = { lire: () => ({}), ecrire: () => {} }
  for (const [i, echecs] of [[0, null], [1, 'src/a.test.ts'], [2, [3]]]) {
    writeFileSync(rapport('node', i), JSON.stringify({ durees: {}, echecs }))
    assert.deepEqual(apprendre(racine, rapport('node', i), mesures, 'node', 2).echecs, [], JSON.stringify(echecs))
  }
})

test('bilanDuLancement : le surcoût se simule sur les workers SERVIS, pas ceux du plan ; sans servis, aucun surcoût', () => {
  const appris = { 'src/a.test.ts': 4000, 'src/b.test.ts': 4000, 'src/c.test.ts': 4000, 'src/d.test.ts': 4000 }
  // Servis 4 : mur simulé 4 s, surcoût 10 − 4 = 6 s ; sur les 2 du plan, il serait de 10 − 8 = 2 s.
  assert.deepEqual(bilanDuLancement('vitest', 10_000, { appris, workers: 4 }, 2),
    { surcout: 6000, texte: 'vitest : 4 fichier(s), mur réel 10.0 s, servis 4, plan 2 ; surcoût observé 6.0 s' })
  assert.deepEqual(bilanDuLancement('vitest', 10_000, { appris, workers: 4 }, 4),
    { surcout: 6000, texte: 'vitest : 4 fichier(s), mur réel 10.0 s ; surcoût observé 6.0 s' })
  assert.deepEqual(bilanDuLancement('vitest', 10_000, { appris, workers: null }, 2),
    { surcout: null, texte: 'vitest : 4 fichier(s), mur réel 10.0 s ; workers servis non rapportés : aucun surcoût appris' })
})


test('apprendre : le rapport d’UN lancement (arrondi) se fusionne dans les mesures, chemins relatifs, puis s’efface ; celui d’un autre lancement reste', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cache = join(racine, 'cache')
  const commun = join(racine, 'commun')
  mkdirSync(cache)
  const rapport = rapportDuLancement(cache, 1)
  mesuresDe(commun).ecrire('durees.json', { 'src/ancien.test.ts': 7, 'src/v.test.ts': 1 })
  writeFileSync(rapport('vitest', 0), JSON.stringify({ workers: 3, durees: { [join(racine, 'src', 'v.test.ts')]: 250.2 }, echecs: [join(racine, 'src', 'v.test.ts')] }))
  writeFileSync(rapport('node', 1), JSON.stringify({ durees: { [join(racine, 'scripts', 'n.test.mjs')]: 41.6 }, echecs: [] }))
  assert.deepEqual(apprendre(racine, rapport('vitest', 0), mesuresDe(commun), 'vitest', 4), { appris: { 'src/v.test.ts': 250 }, workers: 3, echecs: ['src/v.test.ts'] })
  assert.deepEqual([existsSync(rapport('vitest', 0)), existsSync(rapport('node', 1))], [false, true])
  assert.deepEqual(apprendre(racine, rapport('node', 1), mesuresDe(commun), 'node', 15), { appris: { 'scripts/n.test.mjs': 42 }, workers: 15, echecs: [] })
  assert.deepEqual(mesuresDe(commun).lire('durees.json'), { 'src/ancien.test.ts': 7, 'src/v.test.ts': 250, 'scripts/n.test.mjs': 42 })
  assert.equal(existsSync(rapport('node', 1)), false)
})

test('apprendre : le rapport du paquet 1 n’est JAMAIS attribué au paquet 2, même après un échec d’écriture (sonde C3 du juge, inversée)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-c3-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  t.mock.method(console, 'log', () => {})
  const rapport = rapportDuLancement(racine, 4242)
  assert.notEqual(rapport('vitest', 0), rapport('vitest', 1), 'un rapport par lancement')
  let echecs = 1
  const ecrits = []
  const mesures = { lire: () => ({}), ecrire: (nom, e) => { if (echecs-- > 0) throw new Error('verrou tenu'); ecrits.push([nom, e]) } }
  lancerVitest(rapport('vitest', 0), [moduleVitest(join(racine, 'src', 'a.test.ts'), 60000)])
  assert.deepEqual(apprendre(racine, rapport('vitest', 0), mesures, 'vitest', 2), { appris: { 'src/a.test.ts': 60000 }, workers: 2, echecs: [] })
  lancerVitest(rapport('vitest', 1), [moduleVitest(join(racine, 'src', 'b.test.ts'), 1000)])
  assert.deepEqual(apprendre(racine, rapport('vitest', 1), mesures, 'vitest', 2), { appris: { 'src/b.test.ts': 1000 }, workers: 2, echecs: [] })
  assert.deepEqual(ecrits, [['durees.json', { 'src/b.test.ts': 1000 }]])
})

test('apprendre : un paquet SANS rapport apprend {} — le rapport du paquet précédent, écriture échouée, est effacé (sonde C3-bis du juge, inversée)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-c3b-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  t.mock.method(console, 'log', () => {})
  const rapport = rapportDuLancement(racine, 4242)
  const mesures = { lire: () => ({}), ecrire: () => { throw new Error('verrou tenu') } }
  lancerVitest(rapport('vitest', 0), [moduleVitest(join(racine, 'src', 'a.test.ts'), 60000)])
  assert.deepEqual(apprendre(racine, rapport('vitest', 0), mesures, 'vitest', 2), { appris: { 'src/a.test.ts': 60000 }, workers: 2, echecs: [] })
  assert.equal(existsSync(rapport('vitest', 0)), false, 'le rapport ne survit pas à son lancement')
  assert.deepEqual(apprendre(racine, rapport('vitest', 1), mesures, 'vitest', 2), { appris: {}, workers: null, echecs: [] })
})

test('mesures : sous le répertoire git COMMUN, le même depuis un worktree lié', (t) => {
  const racine = forger(t, {}, {}, { commiter: false })
  const lie = mkdtempSync(join(tmpdir(), 'perimetre-lie-'))
  rmSync(lie, { recursive: true, force: true })
  t.after(() => rmSync(lie, { recursive: true, force: true }))
  gitDe(racine)('worktree', 'add', '-q', lie)
  assert.equal(dossierDesMesures(lie), dossierDesMesures(racine))
  assert.equal(dossierDesMesures(racine).split(/[\\/]/).slice(-2).join('/'), '.git/perimetre')
})

test('mesures : une durée qui n’est pas un nombre fini ≥ 0 ne se lit pas — le budget coupe toujours (sonde NaN du juge)', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-memo-valeurs-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  writeFileSync(join(commun, 'durees.json'), JSON.stringify({ 'scripts/a.test.mjs': 'lent', 'scripts/b.test.mjs': 500000, 'scripts/c.test.mjs': 1000, 'scripts/d.test.mjs': -1, 'scripts/e.test.mjs': null }))
  const durees = mesuresDe(commun).lire('durees.json')
  assert.deepEqual(durees, { 'scripts/b.test.mjs': 500000, 'scripts/c.test.mjs': 1000 })
  const retenus = new Map([['scripts/a.test.mjs', { rang: 2 }], ['scripts/b.test.mjs', { rang: 2 }], ['scripts/c.test.mjs', { rang: 2 }]])
  const plan = planDExecution(retenus, { budget: 180, estimations: estimationsDe([...retenus.keys()], { locales: durees }), workers: { node: 1, vitest: 1 }, surcouts: { node: 0, vitest: 0 } })
  assert.deepEqual([plan.lances, plan.aLaCI, plan.murMs], [['scripts/c.test.mjs'], ['scripts/a.test.mjs', 'scripts/b.test.mjs'], 1000])
})

test('apprendre : une écriture des mesures qui échoue s’imprime avec sa cause, ne lève pas, et EFFACE le rapport de son lancement', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-echec-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const rapport = rapportDuLancement(racine, 1)
  writeFileSync(rapport('node', 0), JSON.stringify({ durees: { [join(racine, 'scripts', 'n.test.mjs')]: 41.6 }, echecs: [] }))
  const imprime = []
  t.mock.method(console, 'log', (texte) => { imprime.push(texte) })
  const enPanne = { lire: () => ({}), ecrire: () => { throw new Error('verrou tenu') } }
  assert.deepEqual(apprendre(racine, rapport('node', 0), enPanne, 'node', 15), { appris: { 'scripts/n.test.mjs': 42 }, workers: 15, echecs: [] })
  assert.deepEqual(imprime, ['[perimetre] mesures non écrites — verrou tenu'])
  assert.equal(existsSync(rapport('node', 0)), false, 'le rapport ne survit pas à son lancement')
  assert.equal(ecrireLesMesures(enPanne, 'surcouts.json', { node: 1 }), false)
})

test('mesures illisibles : le plan lève AVANT tout lancement, l’entrée et l’écriture impriment la cause (SyntaxError, EISDIR) (#2586)', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-memo-illisible-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const imprime = []
  t.mock.method(console, 'log', (texte) => { imprime.push(texte) })
  for (const [poser, cause] of [[(f) => writeFileSync(f, '{ tronqu'), 'SyntaxError'], [(f) => mkdirSync(f), 'EISDIR']]) {
    const dossier = mkdtempSync(join(commun, 'm-'))
    poser(join(dossier, 'durees.json'))
    const mesures = mesuresDe(dossier)
    assert.throws(() => planDuPerimetre(new Map(), { mesures, lire: () => new Map() }),
      (e) => new RegExp(`illisible — cause ${cause} : `).test(texteDeLEchec(e)))
    imprime.length = 0
    assert.equal(ecrireLesMesures(mesures, 'durees.json', { 'scripts/n.test.mjs': 1 }), false)
    assert.match(imprime.join('\n'), new RegExp(`^\\[perimetre\\] mesures non écrites — .*illisible — cause ${cause} : `))
  }
})

test('entrée du CLI : un mémo des mesures corrompu sort en 2 et imprime sa cause (#2586)', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'perimetre-entree-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  writeFileSync(join(dossier, 'durees.json'), '{ tronqu')
  const erreurs = []
  t.mock.method(console, 'error', (texte) => { erreurs.push(texte) })
  const executer = async (argv, racine) => planDuPerimetre(new Map(), { mesures: mesuresDe(racine), lire: () => new Map() })
  assert.equal(await entreeDuCli([], dossier, { executer }), 2)
  assert.match(erreurs.join('\n'), /^\[perimetre\] .*illisible — cause SyntaxError : /)
})

test('mesures : un mémo JSON valide qui n’est pas un objet (null, tableau, nombre) se lit vide et se fusionne sans lever', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-memo-forme-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  for (const texte of ['null', '[1, 2]', '42']) {
    writeFileSync(join(commun, 'durees.json'), texte)
    assert.deepEqual(mesuresDe(commun).lire('durees.json'), {}, texte)
    mesuresDe(commun).ecrire('durees.json', { 'src/v.test.ts': 250 })
    assert.deepEqual(mesuresDe(commun).lire('durees.json'), { 'src/v.test.ts': 250 }, texte)
  }
})

test('mesures : des écrivains CONCURRENTS ne perdent aucune écriture', async (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-concurrents-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const module = new URL('./mesures.mjs', import.meta.url).href
  const ecrivain = (i) => `const { mesuresDe } = await import(${JSON.stringify(module)})
const m = mesuresDe(${JSON.stringify(commun)})
for (let k = 0; k < 15; k += 1) m.ecrire('durees.json', { ['e${i}-' + k]: k })`
  const { spawn } = await import('node:child_process')
  const codes = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => new Promise((fini) =>
    spawn(process.execPath, ['--input-type=module', '-e', ecrivain(i)], { stdio: 'inherit' }).on('exit', fini))))
  assert.deepEqual(codes, [0, 0, 0, 0, 0, 0])
  assert.equal(Object.keys(mesuresDe(commun).lire('durees.json')).length, 6 * 15)
})

test('mesures : remplacer écrit la valeur ENTIÈRE, sans fusion ; le mémo CI se lit par son lecteur validé', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-remplacer-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const mesures = mesuresDe(commun)
  mesures.remplacer('durees-ci.json', { run: 1, attempt: 1, sha: 'a', date: 'd1', vitest: { 'src/a.test.ts': 5, 'src/x.test.ts': 6 }, node: {} })
  mesures.remplacer('durees-ci.json', { run: 2, attempt: null, sha: 'b', date: 'd2', vitest: { 'src/b.test.ts': 7 }, node: { 'scripts/n.test.mjs': 8 } })
  assert.deepEqual(mesures.lire('durees-ci.json', memoCiDe), { run: 2, attempt: null, sha: 'b', date: 'd2', vitest: { 'src/b.test.ts': 7 }, node: { 'scripts/n.test.mjs': 8 } })
  mesures.ecrire('durees.json', { 'src/a.test.ts': 1, 'src/b.test.ts': 2 })
  mesures.remplacer('durees.json', { 'src/b.test.ts': 3 })
  assert.deepEqual(mesures.lire('durees.json'), { 'src/b.test.ts': 3 }, 'l’entrée absente de la valeur sort du mémo')
})

test('planDuPerimetre : sur des mesures d’un dossier temporaire, la durée CI estime le test sans durée apprise, calibrée par l’environnement lu', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-plan-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  mesuresDe(commun).ecrire('durees.json', { 'src/a.test.ts': 100 })
  mesuresDe(commun).remplacer('durees-ci.json', { run: 5, attempt: 1, sha: 'abc', date: 'd', vitest: { 'src/a.test.ts': 50, 'src/j.test.tsx': 1000 }, node: {} })
  const lus = []
  const lire = (rels) => { lus.push(...rels); return new Map(rels.map((r) => [r, r.endsWith('.tsx') ? '/** @vitest-environment jsdom */\n' : 'export {}\n'])) }
  const retenus = new Map([['src/a.test.ts', { rang: 1 }], ['src/j.test.tsx', { rang: 1 }]])
  const { ci, facteurs, estimations, plan } = planDuPerimetre(retenus, { mesures: mesuresDe(commun), lire, budget: 180, workers: { vitest: 1 } })
  assert.deepEqual([ci.run, [...lus].sort()], [5, ['src/a.test.ts', 'src/j.test.tsx']])
  assert.deepEqual([estimations.get('src/a.test.ts').source, estimations.get('src/j.test.tsx').ms, estimations.get('src/j.test.tsx').population], ['locale', Math.round(1000 * REPLI_FACTEUR_CI['vitest-jsdom']), 'vitest-jsdom'])
  assert.deepEqual([facteurs['vitest-node'].origine, facteurs['vitest-node'].paires], ['repli', 1])
  assert.deepEqual([plan.nCi, plan.murCiMs], [1, Math.round(1000 * REPLI_FACTEUR_CI['vitest-jsdom'])])
})

test('surcoûts : le mémo porte le MODÈLE du mur dans son nom — un surcoût écrit sous un autre modèle, ou dans l’ancien `surcouts.json`, n’est pas lu ; repli de banc', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-surcouts-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const mesures = mesuresDe(commun)
  const surcoutsLus = () => planDuPerimetre(new Map(), { mesures, lire: () => new Map(), workers: {} }).surcouts
  mesures.ecrire('surcouts.json', { vitest: 7077, node: 42170 })
  mesures.ecrire(nomDuMemo('surcouts', 'un-autre-modele'), { vitest: 1, node: 2 })
  assert.deepEqual(surcoutsLus(), { ...REPLI_SURCOUT_MS })
  mesures.ecrire(SURCOUTS, { node: 337 })
  assert.deepEqual(surcoutsLus(), { ...REPLI_SURCOUT_MS, node: 337 })
  assert.match(SURCOUTS, /^surcouts\.[^.]+\.json$/)
})

/** L'ordre de démarrage MESURÉ de `node --test` sous Windows (juge de diff #2497, node v22) sur ces fichiers. */
const ORDRE_WINDOWS = ['B2/x', 'Z', 'a-b/x', 'a.test', 'a2/x', 'aB/x', 'a/Y2', 'a/x', 'a/y', 'a_b/x', 'b', 'é/x'].map((n) => `${n}.test.mjs`)

test('ordreDuLanceur : node trie le chemin au séparateur NATIF — l’ordre mesuré sous Windows avec \\, l’ordre POSIX avec /', () => {
  const melange = [...ORDRE_WINDOWS].reverse().map((t) => [t, 1])
  assert.deepEqual(ordreDuLanceur('node', melange, '\\').map(([t]) => t), ORDRE_WINDOWS)
  assert.deepEqual(ordreDuLanceur('node', melange, '/').map(([t]) => t),
    ['B2/x', 'Z', 'a-b/x', 'a.test', 'a/Y2', 'a/x', 'a/y', 'a2/x', 'aB/x', 'a_b/x', 'b', 'é/x'].map((n) => `${n}.test.mjs`))
})

test('minorant PAR FAMILLE (sonde du juge de diff) : la famille qui porte un test sans durée dit « ≥ » et son écart un majorant', () => {
  const retenus = new Map([['scripts/neuf.test.mjs', { rang: 0 }], ['scripts/connu.test.mjs', { rang: 0 }]])
  const estimations = estimationsDe([...retenus.keys()], { locales: { 'scripts/connu.test.mjs': 1000 } })
  const plan = planDExecution(retenus, { budget: 180, estimations, workers: { node: 15 }, surcouts: { node: 2911 } })
  assert.deepEqual(plan.sansDureeParFamille, { vitest: 0, node: 1 })
  assert.equal(texteDuReel(5000, plan.murParFamille.node, plan.sansDureeParFamille.node),
    'mur réel 5.0 s pour ≥ 6.8 s estimés (écart ≤ -27 %, estimation minorante : 1 test(s) sans durée)')
  assert.equal(texteDuReel(5000, 4000, 0), 'mur réel 5.0 s pour 4.0 s estimés (écart +25 %)')
})

test('part CI PAR RANG (sonde du juge de mesure #2497) : seules les durées CI de CE rang s’annulent, les rangs précédents gardent les leurs', () => {
  const retenus = new Map([['scripts/a.test.mjs', { rang: 1 }], ['scripts/b.test.mjs', { rang: 2 }], ['scripts/c.test.mjs', { rang: 2 }]])
  const estimations = new Map([['scripts/a.test.mjs', { ms: 100_000, source: 'ci' }], ['scripts/b.test.mjs', { ms: 100_000, source: 'locale' }], ['scripts/c.test.mjs', { ms: 50_000, source: 'ci' }]])
  const plan = planDExecution(retenus, { budget: 300, estimations, workers: { node: 2 } })
  const [, second] = plan.rangs
  assert.deepEqual([plan.murMs, second.murMs, second.murCiMs], [150_000, 50_000, 150_000 - 100_000], 'annuler c seul baisse le mur de 150 s à 100 s')
  assert.equal(texteDuMur(second.murMs, second), '50.0 s, dont 50.0 s estimées depuis la CI (1 test(s))')
  assert.equal(texteDuMur(plan.murMs, plan), '150.0 s, dont 50.0 s estimées depuis la CI (2 test(s))')
})

test('part CI NÉGATIVE (anomalie d’ordonnancement) : « non séparable », jamais planchée en 0 ni dite absorbée', () => {
  assert.equal(texteDuMur(180_000, { murCiMs: -1702, nCi: 54 }), '180.0 s, part CI non séparable (54 test(s) estimés depuis la CI)')
})

test('--liste : empreinte intégrale du dépôt conserve fichiers, mémos et mesures après deux passages', (t) => {
  const racine = forger(t, { 'scripts/a.test.mjs': "import {readFileSync} from 'node:fs';readFileSync('donnees/a.json')", 'donnees/a.json': '{}' }, { 'donnees/a.json': '{"a":1}' })
  const empreintes = () => new Map(readdirSync(racine, { recursive: true }).filter((r) => statSync(join(racine, r)).isFile())
    .sort().map((r) => [r, createHash('sha256').update(readFileSync(join(racine, r))).digest('hex')]))
  const avant = empreintes()
  for (let i = 0; i < 2; i++) {
    const vu = lancerPrincipal(racine, ['--liste'])
    assert.equal(vu.status, 0, vu.stdout + vu.stderr)
    assert.match(vu.stdout, /CI non rapatriée — --liste n’écrit rien/)
    assert.deepEqual(empreintes(), avant)
  }
})

test('diagnostic périmètre : clôture conserve causes, certificat natif et défaut collecte au journal', async (t) => {
  const b = bancDeCloture(t, 'scripts/a.test.mjs', ['node', 'vitest'])
  const error = new Error('enveloppe', { cause: Object.assign(new Error('lecture native'), { code: 'EIO' }) })
  const lancer = b.lancer({ code: 1, error, defautCollecte: new Error('collecte parallèle'),
    arret: { etat: 'indetermine', pid: 42, echeance: 1234, methode: 'job-windows', zeroNatif: false,
      erreurs: [{ operation: 'constat', pid: 42, code: 'EACCES', message: 'preuve absente' }] } })
  await executerLancements(b.options, { lancer, lancerNode: lancer })
  const texte = b.journal.join('')
  assert.match(texte, /EIO — lecture native/)
  assert.match(texte, /constat PID 42 EACCES — preuve absente/)
  assert.match(texte, /collecte parallèle/)
  assert.match(texte, /"arret":\{"etat":"indetermine","pid":42,"echeance":1234,"methode":"job-windows","zeroNatif":false,/)
  for (const ligne of b.journal) assert.match(ligne, /^[^\n]+$/, `ligne de journal non unique : ${JSON.stringify(ligne)}`)
  assert.equal(b.spawns.length, 1)
  assert.deepEqual(b.ecritures, [])
})

test('apprendre : un rapport illisible lève avec sa cause et s’efface (#2586)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-illisible-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const rapport = rapportDuLancement(racine, 4243)('vitest', 0)
  mkdirSync(dirname(rapport), { recursive: true })
  writeFileSync(rapport, '{ tronqu')
  const mesures = { lire: () => ({}), ecrire: () => { throw new Error('écriture inattendue') } }
  assert.throws(() => apprendre(racine, rapport, mesures, 'vitest', 2), (e) => /rapport .* illisible/.test(e.message) && e.cause instanceof SyntaxError)
  assert.equal(existsSync(rapport), false, 'le rapport illisible survit à son lancement')
})
