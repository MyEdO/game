import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'
import { clotureDImports, estModule } from '../../guards/lib/importGraph.mjs'
import { lintFixtures, directivesLint, directivesLintCiblees, porteCommentaireEslint } from '../../guards/lib/lint.testkit.mjs'
import { cleDeContenu, lignesDuContenu } from '../../guards/lib/stock.mjs'
import { lancerLint } from '../../guards/lib/lintStage.mjs'
import configurationLint, { REGLES_ORDRE_TOTAL } from '../../../oxlint.config.mjs'
import { armeParUnMur, blocsDuMur, couvre, exempte, fichiersLus, fichiersSousUnMur, racinesDuRegistre } from '../../test/lib/bancLister.mjs'
import { depotDe, listerImage, SUIVI } from '../../guards/lib/gitPorte.mjs'
import { EXTENSIONS_DE_SCRIPT } from '../../guards/lib/dialecte.mjs'

const RACINE_DEPOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

// --- (c) CLÔTURE : les modules atteints hors des globs, lintés par les règles du mur -------------

test('CLÔTURE — aucun module atteint par une racine du registre, hors des globs du mur, n’enfreint ses règles', async () => {
  const cloture = [...clotureDImports(racinesDuRegistre(), { racine: RACINE_DEPOT })].sort()
  // Contrôle de MESURE par DEUX témoins NOMMÉS, un de chaque côté de la frontière que ce volet existe
  // pour franchir : une lib de `scripts/` (ce que `closureOf`, bornée à `src/`, ne rend JAMAIS — et
  // c'est par là que l'incident #1620 est entré) et un module de `src/`, hors des globs du mur. Jamais
  // un SEUIL sur la taille de la clôture : ce nombre est vivant, il se démode sans rien prouver.
  for (const temoin of ['scripts/guards/lib/fieldConsumers.mjs', 'src/data/index.ts']) {
    assert.ok(
      cloture.includes(temoin),
      `la clôture ne voit plus \`${temoin}\` : la marche ne mesure plus ce que ce volet doit couvrir`,
    )
  }

  const horsDuMur = cloture.filter(
    (rel) => estModule(rel) && !blocsDuMur().every((c) => couvre(c, rel)) && !blocsDuMur().some((c) => exempte(c, rel)),
  )
  assert.ok(horsDuMur.includes('src/data/index.ts'), 'le témoin `src/data/index.ts` n’est plus linté par ce volet')
  const fixtures = horsDuMur.map(filePath => ({filePath,code:readFileSync(join(RACINE_DEPOT,filePath),'utf8')}))
  const resultats = lintFixtures(fixtures, {overrides:[...configurationLint.overrides,{files:horsDuMur,rules:REGLES_ORDRE_TOTAL}],options:{reportUnusedDisableDirectives:'off'}})
  const sites = resultats.flatMap(r=>r.messages.filter(m=>m.ruleId===null||m.ruleId in REGLES_ORDRE_TOTAL).map(m=>r.filePath+':'+m.line+': '+m.message))
  for(const f of fixtures) for(const ligne of directivesLint(f.code,f.filePath,Object.keys(REGLES_ORDRE_TOTAL))) sites.push(f.filePath+':'+ligne+': directive qui éteint le mur')
  assert.deepEqual(sites, [], sites.join('\n'))
})

/** Les exemptions AU SITE du mur de l'ordre total, nommées : le crochet de l'enregistreur de lectures
 *  (il POSE le listing), la reproduction du filtre de Vitest (`toLocaleLowerCase`) et l'oracle naïf du
 *  banc de `sourceCorpus` (marche témoin indépendante de `listerArbre`). Une exemption est keyée par
 *  le CONTENU de la ligne que la directive ÉTEINT (`fichier :: <ligne trimée>`, `cleDeContenu`, #2200) :
 *  la suivante pour `-next-line`, la sienne pour `-line` ; la forme bloc, qui n'éteint pas UNE ligne,
 *  est refusée par `directivesMurs.test.mjs`. Le texte de la directive se répète (le même crochet dans `enregistreur-lectures.mjs`),
 *  la ligne qu'elle éteint non. */
const EXEMPTIONS_DU_MUR = [
  "scripts/guards/lib/sourceCorpus.test.mjs :: import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'",
  'scripts/docs/lib/enregistreur-lectures.mjs :: readdirSync: fs.readdirSync, opendirSync: fs.opendirSync, readdir: fs.readdir, globSync: fs.globSync, glob: fs.glob,',
  'scripts/docs/lib/enregistreur-lectures.mjs :: promisesReaddir: fs.promises.readdir, promisesOpendir: fs.promises.opendir, promisesGlob: fs.promises.glob,',
  "scripts/docs/lib/enregistreur-lectures.mjs :: const entreesDe = (abs) => brut.readdirSync(abs, { withFileTypes: true }).map((e) => ({ nom: e.name, nature: e.isSymbolicLink() ? 'link' : e.isFile() ? 'file' : e.isDirectory() ? 'directory' : 'other' })).sort((a, b) => parUnitesDeCode(a.nom, b.nom))",
  'scripts/docs/lib/enregistreur-lectures.mjs :: Object.assign(fs, { readdirSync: synchrone(brut.readdirSync, noterDossier), opendirSync: synchrone(brut.opendirSync, noterDossier), readdir: aRappel(brut.readdir, noterDossier), globSync: avantGlob(brut.globSync), glob: avantGlob(brut.glob) })',
  'scripts/docs/lib/enregistreur-lectures.mjs :: Object.assign(fs, { readdirSync: brut.readdirSync, opendirSync: brut.opendirSync, readdir: brut.readdir, globSync: brut.globSync, glob: brut.glob })',
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: fs.opendirSync(path.join(racine, 'o')).closeSync()",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: await (await fs.promises.opendir(path.join(racine, 'p'))).close()",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: await new Promise((fin, echec) => fs.readdir(path.join(racine, 'r'), (e) => (e ? echec(e) : fin())))",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: assert.deepEqual(fs.globSync('a/**/*.md', { cwd: racine }).map((p) => p.split(path.sep).join('/')), ['a/b/x.md'])",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: assert.deepEqual(fs.globSync('neuf/*.md', { cwd: racine }), [])",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: assert.deepEqual(await new Promise((fin, echec) => fs.glob('rappel/*.md', { cwd: racine }, (e, r) => (e ? echec(e) : fin(r)))), [])",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: assert.deepEqual(await Array.fromAsync(fs.promises.glob('promesse/*.md', { cwd: racine })), [])",
  "scripts/docs/lib/enregistreur-lectures.test.mjs :: const globSurPipe = (pipe) => fs.globSync('*', { cwd: pipe })",
  'scripts/test/partition.mjs :: const cible = relative(racine, t).toLocaleLowerCase()',
  'scripts/test/partition.mjs :: return cible.includes(f.toLocaleLowerCase()) || cible.includes(rel.toLocaleLowerCase())',
]

const estScript = (rel) => EXTENSIONS_DE_SCRIPT.some((ext) => rel.endsWith(ext))

/** Les fichiers de script qu'arme au moins une règle du mur de l'ordre total. */
const fichiersSousLeMur = () => fichiersSousUnMur(RACINE_DEPOT).filter((rel) => estScript(rel) && blocsDuMur().some((c) => couvre(c, rel) && !exempte(c, rel)))

/** Ce que la mesure copie : les fichiers armés et tout fichier d'ignore suivi (`.gitignore`, `.eslintignore`…). */
const estFichierDIgnore = (rel) => /(^|\/)\.[\w-]*ignore$/.test(rel)
const entreeDeLaGate = (armes, suivis) => [...armes, ...suivis.filter(estFichierDIgnore)]

test('IGNORES — la gate lint lit tout fichier de script suivi qu’arme un mur, et aucun autre dialecte', () => {
  const suivis = listerImage(depotDe(RACINE_DEPOT), SUIVI)
  const armes = suivis.filter(armeParUnMur)
  const scripts = armes.filter(estScript)
  for (const temoin of ['scripts/docs/build-all.mjs', 'src/state/rollSeam.ts', 'server/src/rand.ts']) {
    assert.ok(scripts.includes(temoin), `les fichiers suivis armés ne comptent plus \`${temoin}\``)
  }
  const lus = fichiersLus(RACINE_DEPOT, entreeDeLaGate(armes, suivis))
  assert.deepEqual(scripts.filter((rel) => !lus.has(rel)), [], 'fichier suivi armé SAUTÉ par la gate (`.gitignore`, `.eslintignore`, ignore de la config, ou ignore implicite d’oxlint)')
  assert.deepEqual([...lus].filter((rel) => !estScript(rel)), [], 'fichier armé lu par la gate dans un dialecte hors `EXTENSIONS_DE_SCRIPT`, que les gardes ne lisent pas')

  const L = 'export const a = setTimeout\n'
  const banc = new Map([
    ['.gitignore', 'src/state/zz-plante-racine.ts\n'], ['src/state/.gitignore', 'zz-plante-imbrique.ts\n'],
    ['.eslintignore', 'src/state/zz-plante-eslint-racine.ts\n'], ['src/state/.eslintignore', 'zz-plante-eslint-imbrique.ts\n'],
    ['src/state/zz-plante-eslint-racine.ts', L], ['src/state/zz-plante-eslint-imbrique.ts', L],
    ['src/state/zz-plante.ts', L], ['src/state/zz-plante.jsx', L],
    ['src/state/zz-plante-racine.ts', L], ['src/state/zz-plante-imbrique.ts', L],
    ['src/state/zz-plante-min.ts', L], ['src/state/zz-plante.min.ts', L], ['src/state/zz-plante_min.mjs', L],
    ['src/state/zz-plante.vue', `<script>\n${L}</script>\n`],
  ])
  const plantes = [...banc.keys()]
  assert.deepEqual([...fichiersLus(RACINE_DEPOT, entreeDeLaGate(plantes.filter((rel) => rel.startsWith('src/state/zz-plante')), plantes), banc)].sort(parUnitesDeCode),
    ['src/state/zz-plante.jsx', 'src/state/zz-plante.ts', 'src/state/zz-plante.vue'], 'la mesure voit les `.gitignore`, les `.eslintignore`, les ignores implicites et les dialectes lus')

  const temoin = 'scripts/docs/build-all.mjs'
  const dossier = mkdtempSync(join(tmpdir(), 'lint-ignores-'))
  try {
    mkdirSync(dirname(join(dossier, temoin)), { recursive: true })
    copyFileSync(join(RACINE_DEPOT, temoin), join(dossier, temoin))
    for (const motif of [temoin, 'scripts/docs/**']) {
      const plante = lancerLint(RACINE_DEPOT, [temoin], { cwd: dossier, configuration: { overrides: [], rules: {}, ignorePatterns: [...configurationLint.ignorePatterns, motif] } })
      assert.deepEqual(plante.defauts, [])
      assert.equal(JSON.parse(plante.stdout).number_of_files, 0)
    }
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('DIRECTIVES — sous les globs du mur, les seules directives qui l’éteignent sont les exemptions nommées', async () => {
  const regles = Object.keys(REGLES_ORDRE_TOTAL)
  const sousLeMur = fichiersSousLeMur()
  for (const temoin of ['scripts/docs/build-all.mjs', 'src/eslint-ordre-total-et-purete.test.ts']) {
    assert.ok(sousLeMur.includes(temoin), `la marche des globs du mur ne voit plus \`${temoin}\``)
  }
  const porteurs = sousLeMur.filter((rel) => porteCommentaireEslint(readFileSync(join(RACINE_DEPOT, rel), 'utf8')))
  const vues = []
  for (const rel of porteurs) {
    const code = readFileSync(join(RACINE_DEPOT, rel), 'utf8')
    for (const { cible } of directivesLintCiblees(code, rel, regles).filter((d) => d.cible !== null)) {
      const cle = cleDeContenu(rel, code, cible)
      assert.equal(lignesDuContenu(rel, code, cle).length, 1, `exemption AMBIGUË : « ${cle} » désigne plusieurs lignes`)
      vues.push(cle)
    }
  }
  assert.deepEqual(vues.sort(parUnitesDeCode), [...EXEMPTIONS_DU_MUR].sort(parUnitesDeCode), 'directive hors exemption, ou exemption PÉRIMÉE')
  const plante = code => directivesLint(code,'scripts/docs/zz-plante-directives.mjs',regles)
  const cibles = code => directivesLintCiblees(code,'scripts/docs/zz-plante-directives.mjs',regles).map(d => d.cible)
  assert.deepEqual(cibles('// oxlint-disable-next-line murs/ordre-total -- r\nfs.readdirSync(x)\nautre()'),[2],'`-next-line` vise la ligne suivante')
  assert.deepEqual(cibles('fs.readdirSync(x) // oxlint-disable-line murs/ordre-total -- r\nautre()'),[1],'`-line` vise sa ligne')
  assert.deepEqual(cibles('/* oxlint-disable murs/ordre-total */\nautre()\nfs.readdirSync(x)'),[null],'la forme bloc ne vise aucune ligne')
  assert.deepEqual(plante('// oxlint-disable-next-line murs/ordre-total -- r\nx()'),[1])
  assert.deepEqual(plante('/* oxlint-disable */\nx()'),[1])
  assert.deepEqual(plante('const re = /eslint-disable/;'),[])
  assert.deepEqual(await plante('// eslint-disable-next-line murs/marques -- autre mur\nx()\n'), [])
  assert.deepEqual(await plante('// eslint-disable-next-line murs/ordre-total-locale -- r\nx()\n'), [1])
  assert.deepEqual(await plante('// eslint-disable-next-line murs/ordre-total-locale --- raison\nx()\n'), [1])
  assert.deepEqual(await plante('// eslint-disable-next-line "murs/ordre-total-locale"\nx()\n'), [1])
  assert.deepEqual(await plante('a()\n// eslint-disable-next-line\nx()\n'), [2])
  assert.deepEqual(await plante('/* eslint-disable murs/marques, murs/ordre-total */\nx()\n'), [1])
  assert.deepEqual(await plante('/* eslint-enable */\nx()\n'), [], 'une réactivation n’éteint rien')
  assert.deepEqual(await plante('/* eslint-enable murs/ordre-total-locale */\nx()\n'), [])
  assert.deepEqual(await plante('const s = `/* eslint murs/ordre-total-locale: off */`\n'), [], 'une chaîne n’est pas une directive')
  // Le commentaire de CONFIGURATION redéclare le mur (sévérité ou options) : il l'éteint sans rien supprimer.
  assert.deepEqual(await plante('/* eslint murs/ordre-total-locale: "off" */\nx()\n'), [1])
  assert.deepEqual(await plante('/* eslint "murs/ordre-total-locale": "off" */\nx()\n'), [1])
  assert.deepEqual(await plante('/* eslint "murs\\u002fordre-total-locale": "off" */\nx()\n'), [1], 'échappement JSON')
  assert.deepEqual(await plante('/*eslint no-console: 0, "murs/ordre-total-imports": ["error", {}] */\nx()\n'), [1])
  assert.deepEqual(await plante('/* eslint murs/marques: "off" */\nx()\n'), [])
  assert.deepEqual(await plante('/* eslint no-console: off -- murs/ordre-total-locale: y */\nx()\n'), [], 'la justification n’est pas une règle')
})
