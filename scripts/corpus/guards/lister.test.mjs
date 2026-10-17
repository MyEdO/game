import test from 'node:test'

import assert from 'node:assert/strict'

import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import { dirname, join } from 'node:path'

import { fileURLToPath } from 'node:url'

import { listerArbre, parUnitesDeCode, correspondGlob } from '../../guards/lib/lister.mjs'

import { clotureDImports, estModule } from '../../guards/lib/importGraph.mjs'

import { ciblesSurDisque } from '../../docs/build-all.mjs'

import { lintFixtures, directivesLint } from '../../guards/lib/lint.testkit.mjs'

import { lancerLint } from '../../guards/lib/lintStage.mjs'

import configurationLint, { REGLES_ORDRE_TOTAL } from '../../../oxlint.config.mjs'

import { banclistertestmjs } from '../../guards/lib/bancLister.mjs'
const { blocsDuMur, couvre, exempte, racinesDuRegistre } = banclistertestmjs

const RACINE_DEPOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

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

const EXEMPTIONS_DU_MUR = [
  'scripts/guards/lib/sourceCorpus.test.mjs:37',
  'scripts/docs/lib/enregistreur-lectures.mjs:104', 'scripts/docs/lib/enregistreur-lectures.mjs:110',
  'scripts/docs/lib/enregistreur-lectures.mjs:140', 'scripts/docs/lib/enregistreur-lectures.mjs:173',
  'scripts/docs/lib/enregistreur-lectures.mjs:177', 'scripts/docs/lib/enregistreur-lectures.mjs:198',
  'scripts/docs/lib/enregistreur-lectures.mjs:204',
  'scripts/test/partition.mjs:191', 'scripts/test/partition.mjs:196',
]

const porteCommentaireEslint = texte => texte.includes('eslint') || texte.includes('oxlint')

function fichiersSousLeMur() {
  const blocs = blocsDuMur()
  const racines = [...new Set(blocs.flatMap((c) => c.files.map((g) => g.split('/')[0])))].sort(parUnitesDeCode)
  return racines
    .flatMap((racine) => listerArbre(join(RACINE_DEPOT, racine), { descendre: (r) => r !== 'node_modules' }).map((r) => `${racine}/${r}`))
    .filter((rel) => estModule(rel) && blocs.some((c) => couvre(c, rel) && !exempte(c, rel)))
}

test('IGNORES — aucun ignore global ne couvre un fichier sous le mur', () => {
  const fichiers = fichiersSousLeMur()
  const dossier = mkdtempSync(join(tmpdir(), 'lint-ignores-'))
  try {
    for (const fichier of fichiers) {
      const cible = join(dossier, fichier)
      mkdirSync(dirname(cible), { recursive: true })
      copyFileSync(join(RACINE_DEPOT, fichier), cible)
    }
    const resultat = lancerLint(RACINE_DEPOT,fichiers,{cwd:dossier,configuration:{overrides:[],rules:{},options:{reportUnusedDisableDirectives:'off'}}})
    assert.deepEqual(resultat.defauts,[])
    assert.equal(JSON.parse(resultat.stdout).number_of_files,new Set(fichiers).size)
    const temoin='scripts/docs/build-all.mjs'
    for(const motif of [temoin,'scripts/docs/**']) {
      const plante=lancerLint(RACINE_DEPOT,[temoin],{cwd:dossier,configuration:{overrides:[],rules:{},ignorePatterns:[...configurationLint.ignorePatterns,motif]}})
      assert.deepEqual(plante.defauts,[])
      assert.equal(JSON.parse(plante.stdout).number_of_files,0)
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
  const vues=porteurs.flatMap(rel=>directivesLint(readFileSync(join(RACINE_DEPOT,rel),'utf8'),rel,regles).map(l=>rel+':'+l))
  assert.deepEqual(vues.sort(parUnitesDeCode), [...EXEMPTIONS_DU_MUR].sort(parUnitesDeCode))
  const plante = code => directivesLint(code,'scripts/docs/zz-plante-directives.mjs',regles)
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

test('correspondGlob : `*` ne franchit PAS un séparateur', () => {
  assert.equal(correspondGlob('pages/raw/catalogue-divers.md', 'pages/raw/catalogue-*.md'), true)
  // Le cas qui compte : `pages/*.md` NE couvre PAS une page d'un sous-dossier — sans quoi un
  // manuscrit de `pages/raw/` passerait pour dérivé.
  assert.equal(correspondGlob('pages/raw/catalogue-divers.md', 'pages/*.md'), false)
  assert.equal(correspondGlob('pages/systemes.md', 'pages/*.md'), true)
})

test('correspondGlob : `**` vaut ZÉRO ou plusieurs dossiers', () => {
  const motif = 'pages/raw/**/catalogue-*.md'
  assert.equal(correspondGlob('pages/raw/un-coeur/catalogue-divers.md', motif), true)
  assert.equal(correspondGlob('pages/raw/catalogue-divers.md', motif), true)
  assert.equal(correspondGlob('pages/raw/un-coeur/plus-bas/catalogue-divers.md', motif), true)
  // Ce que `**` n'autorise pas : sortir de la racine du motif, ni changer le nom visé.
  assert.equal(correspondGlob('pages/autre/un-coeur/catalogue-divers.md', motif), false)
  assert.equal(correspondGlob('pages/raw/un-coeur/combat.md', motif), false)
})

test('correspondGlob : `{a,b}` vaut l’une de ses alternatives, dans son segment', () => {
  const motif = 'pages/*/{index,_registre.genere}.md'
  assert.equal(correspondGlob('pages/un-coeur/index.md', motif), true)
  assert.equal(correspondGlob('pages/un-coeur/_registre.genere.md', motif), true)
  assert.equal(correspondGlob('pages/un-coeur/_registreXgenere.md', motif), false)
  assert.equal(correspondGlob('pages/un-coeur/autre.md', motif), false)
  assert.equal(correspondGlob('pages/un-coeur/index/x.md', 'pages/*/{index,autre}/x.md'), true)
})

test('correspondGlob : un chemin rendu par Windows se lit en POSIX', () => {
  assert.equal(correspondGlob('pages\\raw\\un-coeur\\catalogue-divers.md', 'pages/raw/**/catalogue-*.md'), true)
})

const PAGES_FORGEES = [
  'pages/00-index.md',
  'pages/systemes.md',
  'pages/raw/00-index.md',
  'pages/raw/combat.md',
  'pages/raw/un-coeur/00-index.md',
  'pages/raw/un-coeur/combat.md',
  'pages/raw/un-coeur/plus-bas/00-index.md',
  'pages/autre/00-index.md',
]

test('ciblesSurDisque ⇔ correspondGlob : les DEUX lecteurs du motif s’accordent sur un arbre FORGÉ', () => {
  const racine = mkdtempSync(join(tmpdir(), 'cibles-'))
  try {
    for (const page of PAGES_FORGEES) {
      mkdirSync(join(racine, dirname(page)), { recursive: true })
      writeFileSync(join(racine, page), '')
    }
    // Joker MÉDIAN (`**` et `*`), joker FINAL, motif sans joker : le dépliage du disque doit rendre
    // exactement ce que le filtre retient — ni plus (une marche trop large), ni moins (un motif
    // inerte, qu'aucune page ne satisfait alors que le filtre dit vrai).
    for (const motif of [
      'pages/raw/**/00-index.md', 'pages/raw/*/00-index.md', 'pages/*.md', 'pages/**/combat.md',
      'pages/**/*.md', 'pages/raw/00-index.md',
    ]) {
      assert.deepEqual(
        ciblesSurDisque([motif], racine).sort(),
        PAGES_FORGEES.filter((p) => correspondGlob(p, motif)).sort(),
        `déplié ≠ filtré pour « ${motif} »`,
      )
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
