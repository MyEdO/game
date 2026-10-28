// Contrat de la porte de lint du pre-commit. Les deux morsures qui comptent sont jouées avec le VRAI
// oxlint et la VRAIE `oxlint.config.mjs` du dépôt (jamais un rapport forgé) : c'est la configuration
// réelle qui décide si un fichier est jugé ou ignoré.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONFIG_LINT, appelDuLint, defautsDeRapport, fermetureDeConfig, lancerLint, lintDeLIndex, lotsDeLigne } from './lintStage.mjs'
import { depotReel, envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
import { clotureDImports } from './importGraph.mjs'
import { installer } from '../../docs/lib/enregistreur-lectures.mjs'
import configurationLint from '../../../oxlint.config.mjs'
import { gitDeLArbreReel, lancerGit } from '../../test/gitDeBanc.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const NBSP = String.fromCharCode(0x00a0)

/** Les fixtures vivent en dossier temporaire : `lancerLint` y envoie oxlint par `--cwd`, avec la
 *  config du dépôt passée en argument. L'arbre reste intact pendant que les autres lanes le lisent
 *  (`oxlint .` de la gate `lint` voit tout fichier posé sous la racine : mesuré, status=1). */
const dossierDeFixtures = () => mkdtempSync(join(tmpdir(), 'lint-fixtures-'))

test('rapport : chaque message devient un site `fichier:ligne:colonne` relatif à la racine', () => {
  const json = JSON.stringify({diagnostics:[{filename:'src/ui/A.tsx',message:"'x' is defined but never used.",code:'eslint(no-unused-vars)',severity:'error',labels:[{span:{line:12,column:3}}]}]})
  assert.deepEqual(defautsDeRapport(json, RACINE, () => '\n'.repeat(11)+' '.repeat(3)), [
    { site: 'src/ui/A.tsx:12:3', gravite: 'erreur', regle: 'no-unused-vars', message: "'x' is defined but never used." },
  ])
})

test('FAIL-CLOSED — un rapport pollué par stderr rend un défaut NOMMÉ, jamais un lot vide', () => {
  // Le chemin d'échec est le SEUL qui compte : c'est là que le hook décide de refuser. Un octet
  // étranger collé au JSON (avertissement du moteur node, message du lanceur local) cassait le
  // parse, un `catch { return [] }` rendait « aucun défaut » et le commit passait avec un lint ROUGE.
  const json = JSON.stringify({diagnostics:[{filename:'src/x.ts',message:'Irregular whitespace not allowed',code:'eslint(no-irregular-whitespace)',severity:'error',labels:[{span:{line:3,column:1}}]}]})
  const AVERTISSEMENT = '(node:8124) ExperimentalWarning: Type Stripping is an experimental feature'
  const LANCEUR = 'outillage local: oxlint resolu depuis node_modules'

  assert.equal(defautsDeRapport(json, RACINE, () => '\n\nx').length, 1, 'stdout pur : le défaut du fichier')
  for (const [nom, bruit] of [['avertissement node', AVERTISSEMENT], ['message du lanceur local', LANCEUR]]) {
    const defauts = defautsDeRapport(`${json}\n${bruit}\n`, RACINE)
    assert.equal(defauts.length, 1, `${nom} : le rapport pollué doit rendre UN défaut, pas un lot vide`)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /rapport illisible/)
  }
  // Une sortie VIDE reste un lot vide : rien à lire n'est pas une erreur (aucun fichier à juger).
  assert.deepEqual(defautsDeRapport('   ', RACINE), [])
})

test('FAIL-CLOSED — oxlint qui échoue SANS rapport (outil absent) est un refus nommé', () => {
  // Arbre COMPLET du lanceur (sa clôture d'imports, #2603) mais sans `node_modules/oxlint` : le refus vient de
  // la décision d'outillage, jamais d'un import manquant — c'est le refus que la porte doit NOMMER.
  const racine = mkdtempSync(join(tmpdir(), 'lint-sans-outil-'))
  try {
    for (const rel of [...clotureDImports(['scripts/lancer-local.mjs'], { racine: RACINE }), 'package.json']) {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      copyFileSync(join(RACINE, rel), join(racine, rel))
    }
    writeFileSync(join(racine, 'a.ts'), 'export const a = 1\n')
    const { defauts } = lancerLint(racine, ['a.ts'], { cwd: racine })
    assert.equal(defauts.length, 1)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /oxlint a échoué sans rapport/)
    assert.match(defauts[0].message, /n'est pas installé dans cet arbre/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FAIL-CLOSED — un diagnostic sans position ou hors caractère est un refus nommé', () => {
  const diagnostic={filename:'a.ts',message:'debugger',code:'eslint(no-debugger)',severity:'error'}
  for(const span of [undefined,{line:0,column:1},{line:1,column:0},{line:2,column:1},{line:1,column:2}]) {
    const rapport=JSON.stringify({diagnostics:[{...diagnostic,labels:[{span}]}]})
    const defauts=defautsDeRapport(rapport,RACINE,()=> 'é')
    assert.equal(defauts.length,1)
    assert.equal(defauts[0].regle,'(outillage)')
    assert.match(defauts[0].message,/rapport illisible/)
  }
  for(const rapport of ['{}','{"diagnostics":{}}','{"diagnostics":[{}]}']) assert.equal(defautsDeRapport(rapport,RACINE)[0].regle,'(outillage)')
})

test('MORSURE — un fichier fautif est refusé, un fichier IGNORÉ par la config ne l’est pas', () => {
  const dossier = dossierDeFixtures()
  const relIgnore = 'lint-fixture.config.ts'
  try {
    // `oxlint.config.mjs` — `no-irregular-whitespace`.
    writeFileSync(join(dossier, 'fautif.ts'), `export const a =${NBSP}1\n`)
    writeFileSync(join(dossier, 'sain.ts'), 'export const b = 1\n')
    // `oxlint.config.mjs` ignore `*.config.*` : cité EXPLICITEMENT, ce fichier rendrait un
    // avertissement — donc un échec sous `--max-warnings 0` — sans `--no-warn-ignored`.
    writeFileSync(join(dossier, relIgnore), `export const c =${NBSP}1\n`)

    const { defauts, brut } = lancerLint(RACINE, ['fautif.ts', 'sain.ts', relIgnore], { cwd: dossier })
    assert.ok(defauts.length >= 1, `aucun défaut rendu — sortie brute : ${brut.slice(0, 400)}`)
    assert.deepEqual(
      defauts.filter((d) => d.site.startsWith('fautif.ts:')).map((d) => d.regle),
      ['no-irregular-whitespace'],
    )
    assert.deepEqual(defauts.filter((d) => d.site.includes('sain.ts')), [])
    assert.deepEqual(defauts.filter((d) => d.site.includes('lint-fixture')), [])

    // NOMINATIVE : la morsure ne dépose RIEN dans l'arbre que les autres lanes lisent au même moment.
    // Seuls les chemins de fixture sont regardés — un écrivain d'une autre gate ne rougit pas ce test.
    const statut = gitDeLArbreReel(RACINE)('status', '--porcelain')
    assert.deepEqual(statut.split('\n').filter((l) => l.includes('lint-fixture')), [])
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('configuration fournie : une écriture .lint- dans la fixture temporaire, supprimée après le lint', () => {
  const dossier = dossierDeFixtures()
  const rel = 'src/noyau/rollSeam.ts'
  mkdirSync(dirname(join(dossier, rel)), { recursive: true })
  copyFileSync(join(RACINE, rel), join(dossier, rel))
  const collecteur = installer({ racine: dossier, ignores: new Set() })
  try {
    const { defauts, stdout, codeSortie } = lancerLint(RACINE, [rel], { cwd: dossier, configuration: configurationLint })
    assert.equal(codeSortie, 0)
    assert.deepEqual(defauts, [])
    assert.equal(JSON.parse(stdout).number_of_files, 1)
    const { ecrits } = collecteur.rendu()
    assert.equal(ecrits.length, 1, JSON.stringify(ecrits))
    assert.match(ecrits[0], new RegExp(`^\\.lint-${process.pid}-[a-z0-9]+\\.config\\.mjs$`))
    assert.equal(existsSync(join(dossier, ecrits[0])), false)
  } finally {
    collecteur.restaurer()
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('appelDuLint : le script `lint` de package.json sans sa cible `.` ; un script hors forme est une panne NOMMÉE de lancerLint', () => {
  const racine = dossierDeFixtures()
  try {
    const poser = (lint) => writeFileSync(join(racine, 'package.json'), JSON.stringify({ scripts: { lint } }))
    poser('node l.mjs ox -- ox --config c.mjs --x . --max-warnings 0')
    assert.deepEqual(appelDuLint(racine), ['node', 'l.mjs', 'ox', '--', 'ox', '--config', 'c.mjs', '--x', '--max-warnings', '0'])
    for (const horsForme of ['node l.mjs ox -- ox --config c.mjs src', 'ox --config c.mjs .', 'node l.mjs ox -- ox .']) {
      poser(horsForme)
      assert.throws(() => appelDuLint(racine), /script `lint` hors de la forme/, horsForme)
      writeFileSync(join(racine, 'a.ts'), 'export const a = 1\n')
      const { defauts, codeSortie } = lancerLint(racine, ['a.ts'], { cwd: racine })
      assert.deepEqual([defauts.map((d) => [d.site, d.regle]), codeSortie], [[['(lint)', '(outillage)']], 1], horsForme)
      assert.match(defauts[0].message, /^script lint illisible — script `lint` hors de la forme/)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('lots de ligne : ordre gardé, chaque lot tient dans le budget, un chemin trop long part seul', () => {
  const chemins = ['aaaa', 'bb', 'cccccc', 'd', 'eeeeeeeeeeee', 'ff']
  const lots = lotsDeLigne(chemins, 8)
  assert.deepEqual(lots, [['aaaa', 'bb'], ['cccccc'], ['d'], ['eeeeeeeeeeee'], ['ff']])
  assert.deepEqual(lots.flat(), chemins)
  for (const lot of lots.filter((l) => l.length > 1)) assert.ok(lot.reduce((n, f) => n + f.length + 1, 0) <= 8)
})

test('MORSURE EN PLUSIEURS LANCEMENTS : les défauts de chaque lot s’additionnent, aucun fichier ne se perd', () => {
  const dossier = dossierDeFixtures()
  try {
    writeFileSync(join(dossier, 'fautif-a.ts'), `export const a =${NBSP}1\n`)
    writeFileSync(join(dossier, 'sain.ts'), 'export const b = 1\n')
    writeFileSync(join(dossier, 'fautif-c.ts'), `export const c =${NBSP}1\n`)
    // Budget 1 : chaque fichier part dans SON lancement.
    const { defauts, stdout } = lancerLint(RACINE, ['fautif-a.ts', 'sain.ts', 'fautif-c.ts'], { cwd: dossier, budget: 1 })
    assert.deepEqual(defauts.map((d) => `${d.site.split(':')[0]} ${d.regle}`), ['fautif-a.ts no-irregular-whitespace', 'fautif-c.ts no-irregular-whitespace'])
    assert.equal(JSON.parse(stdout).number_of_files, 3)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('lot vide : aucun processus lancé, aucun défaut', () => {
  assert.deepEqual(lancerLint(RACINE, [], { cwd: RACINE }), { defauts: [], brut: '', stdout: '', codeSortie: 0 })
})

// ── `lintDeLIndex` : la porte du pre-commit juge l'INDEX (#2327 A5) ───────────────────────────────
// L'index vient d'un dépôt FORGÉ (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en finally) : son disque
// et son index divergent à volonté ; l'outil et la config sont ceux de CET arbre, jamais écrit.
const PROPRE = 'export const a = 1\n'
const CASSE = `export const a =${NBSP}1\n`
const FIXTURE = 'src/lint-index-fixture.ts'
const CONFIG = readFileSync(join(RACINE, CONFIG_LINT), 'utf8')
/** La fermeture de la config de CET arbre, chemin → texte du disque. */
const FERMETURE = tableTotale(await fermetureDeConfig(RACINE), (rel) => readFileSync(join(RACINE, rel), 'utf8'))

/** Dépôt forgé : `index` (chemin → texte) posé dans l'INDEX seul — la fermeture de la config de CET
 *  arbre y est posée aussi, sauf `config: false` —, `disque` (chemin → texte) sur le disque seul. */
function forge({ index = {}, disque = {}, config = true }) {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({ message: 'socle' })
  const blobs = new Map()
  const lignes = Object.entries(config ? { ...FERMETURE, ...index } : index).map(([rel, texte]) => {
    if (!blobs.has(texte)) blobs.set(texte, lancerGit(['hash-object', '-w', '--stdin'], { cwd: racine, env, input: texte, net: true }))
    return `100644 ${blobs.get(texte)}\t${rel}\n`
  })
  if (lignes.length) lancerGit(['update-index', '--add', '--index-info'], { cwd: racine, env, input: lignes.join('') })
  for (const [rel, texte] of Object.entries(disque)) {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    writeFileSync(join(racine, rel), texte)
  }
  return { racine, depot: depotReel(racine) }
}

/** `lintDeLIndex` de CET arbre sur l'index du dépôt forgé, qui est jeté après. */
async function lintForge(params, chemins) {
  const { racine, depot } = forge(params)
  try {
    return await lintDeLIndex(RACINE, depot, chemins)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

test('LIGNE DE PROD : un fichier réel de l’index est jugé sous la config du dépôt, au site de son chemin', async () => {
  // `pre-commit.mjs` : `lintDeLIndex(ROOT, depot, staged)`. Le seul défaut rendu est celui ajouté au
  // texte stagé : le fichier n'est pas ignoré par la config, et son texte réel la passe.
  const rel = 'src/noyau/rollSeam.ts'
  const texte = readFileSync(join(RACINE, rel), 'utf8')
  const ligne = texte.split('\n').length
  const vu = await lintForge({ index: { [rel]: `${texte}${CASSE}` } }, [rel])
  assert.equal(vu.saut, null)
  assert.deepEqual(vu.defauts.map((d) => `${d.site} ${d.regle}`), [`${rel}:${ligne}:17 no-irregular-whitespace`])
})

test('LIGNE DE PROD au-delà de 32 767 caractères de chemins : le lot est JUGÉ, jamais refusé sans rapport', async () => {
  const fichiers = Array.from({ length: 2000 }, (_, i) => `src/lib/lint-index-lot/fichier-${String(i).padStart(4, '0')}.ts`)
  assert.ok(fichiers.join(' ').length > 32767, 'le lot dépasse la ligne de commande que Windows sait créer')
  const dernier = fichiers.at(-1)
  const vu = await lintForge({ index: { ...tableTotale(fichiers, () => PROPRE), [dernier]: CASSE } }, fichiers)
  assert.equal(vu.saut, null)
  assert.deepEqual(vu.defauts.map((d) => `${d.site} ${d.regle}`), [`${dernier}:1:17 no-irregular-whitespace`])
})

test('`mursLint.mjs` STAGÉ qui diffère du disque : SAUT qui le nomme ; toute la fermeture identique, le lot est jugé', async () => {
  const MURS = 'scripts/guards/lib/mursLint.mjs'
  const differe = await lintForge({ index: { [FIXTURE]: CASSE, [MURS]: `${FERMETURE[MURS]}\n` } }, [FIXTURE])
  assert.deepEqual(differe.defauts, [])
  assert.match(differe.saut ?? '', /^scripts\/guards\/lib\/mursLint\.mjs de l'index diffère du disque/)
  const identique = await lintForge({ index: { [FIXTURE]: CASSE } }, [FIXTURE])
  assert.equal(identique.saut, null)
  assert.deepEqual(identique.defauts.map((d) => d.regle), ['no-irregular-whitespace'])
})

test('fichier LU par la config au chargement (`LECTURES_DE_CONFIG`), stagé qui diffère du disque : SAUT qui le nomme', async () => {
  const LU = 'src/data/index.ts'
  assert.ok(LU in FERMETURE)
  const differe = await lintForge({ index: { [FIXTURE]: CASSE, [LU]: `${FERMETURE[LU]}\n` } }, [FIXTURE])
  assert.deepEqual(differe.defauts, [])
  assert.match(differe.saut ?? '', /^src\/data\/index\.ts de l'index diffère du disque/)
})

test('INDEX : stagé CASSÉ, disque PROPRE — le défaut, au site du chemin stagé', async () => {
  const vu = await lintForge({ index: { [FIXTURE]: CASSE }, disque: { [FIXTURE]: PROPRE } }, [FIXTURE])
  assert.equal(vu.saut, null)
  assert.deepEqual(vu.defauts.map((d) => `${d.site} ${d.regle}`), [`${FIXTURE}:1:17 no-irregular-whitespace`])
})

test('INDEX : stagé PROPRE, disque CASSÉ — aucun défaut', async () => {
  assert.deepEqual(await lintForge({ index: { [FIXTURE]: PROPRE }, disque: { [FIXTURE]: CASSE } }, [FIXTURE]), { defauts: [], saut: null })
})

test('`oxlint.config.mjs` STAGÉ qui diffère du disque : SAUT nommé ; identique, le lot est jugé', async () => {
  const differe = await lintForge({ index: { [FIXTURE]: CASSE, [CONFIG_LINT]: `${CONFIG}\n` } }, [FIXTURE, CONFIG_LINT])
  assert.deepEqual(differe.defauts, [])
  assert.match(differe.saut ?? '', /oxlint\.config\.mjs de l'index diffère du disque/)
  const identique = await lintForge({ index: { [FIXTURE]: CASSE } }, [FIXTURE, CONFIG_LINT])
  assert.equal(identique.saut, null)
  assert.deepEqual(identique.defauts.map((d) => d.regle), ['no-irregular-whitespace'])
})

test('`oxlint.config.mjs` NON stagé dont le disque diffère de l’index : SAUT nommé, aucun verdict', async () => {
  const vu = await lintForge({ index: { [FIXTURE]: CASSE, [CONFIG_LINT]: `${CONFIG}\n` } }, [FIXTURE])
  assert.deepEqual(vu.defauts, [])
  assert.match(vu.saut ?? '', /oxlint\.config\.mjs de l'index diffère du disque/)
})

test('aucun chemin à extension jugée : rien n’est lu ni lancé', async () => {
  assert.deepEqual(await lintDeLIndex(RACINE, null, ['docs/architecture.md', 'src/data/etats.json']), { defauts: [], saut: null })
})

test('PANNE — oxlint absent de l’arbre jugé : défaut d’outillage NOMMÉ, jamais un lot vide', async () => {
  const { racine, depot } = forge({ index: { 'a.ts': PROPRE }, disque: { 'package.json': readFileSync(join(RACINE, 'package.json'), 'utf8') }, config: false })
  try {
    const { defauts } = await lintDeLIndex(racine, depot, ['a.ts'])
    assert.equal(defauts.length, 1)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /^oxlint a échoué sans rapport/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('PANNE — un chemin que l’index ne rend pas (tabulation) : défaut d’outillage NOMMÉ', async () => {
  const { defauts } = await lintForge({}, ['src/x\t.ts'])
  assert.equal(defauts.length, 1)
  assert.equal(defauts[0].site, '(lint)')
  assert.match(defauts[0].message, /^index illisible — /)
})
