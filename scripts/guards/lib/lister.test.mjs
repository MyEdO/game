// PORTE DE RÔLE du lecteur à ordre total (#1679 L3b, incident #1620) — trois volets, zéro stock.
//
//  (a) PROPRIÉTÉ  : `listerDossier` rend l'ordre des unités de code, quel que soit l'ordre de création.
//      EFFET      : `listerArbre` rend le MÊME tableau quel que soit l'ordre de création.
//      Sous NTFS la preuve est TRIVIALE (le système rend déjà un listing trié) ; c'est la CI, sur
//      ext4 (ordre d'un hash), qui la porte réellement. Le test est ici pour y être JOUÉ, pas pour
//      être vert sur cette machine.
//  (b) MUR        : toute racine du registre des générateurs (`GENERATORS` ∪ `NON_GENERATOR_CHECKS`,
//      `scripts/docs/build-all.mjs`) est SOUS les globs `files:` de chaque bloc du mur « ordre total »
//      de `oxlint.config.mjs` — les globs se LISENT depuis la config, jamais recopiés ici. Chaque règle
//      du mur y est déclarée par UN seul bloc, en `error` (UNICITÉ) ; aucun ignore global ne couvre un
//      fichier sous le mur (IGNORES) ; les seuls commentaires de lint qui l'éteignent sont les exemptions
//      nommées (DIRECTIVES).
//  (c) CLÔTURE    : chaque module de la clôture d'imports NON bornée de ces racines (`clotureDImports`,
//      donc `scripts/**` compris — `closureOf` est bornée à `src/` et ne verrait pas les libs de garde
//      atteintes par un générateur, dont `fieldConsumers.mjs`, le fichier de l'incident fondateur) qui
//      vit HORS des globs du mur est linté par Oxlint, la config du dépôt surmontée de
//      `REGLES_ORDRE_TOTAL` (les règles des deux blocs du mur, lues dans `oxlint.config.mjs`) : les formes
//      que le mur ferme s'expriment UNE fois, dans ses sélecteurs. Ce que le mur refuse dans un de ces
//      modules est nommé `fichier:ligne: message`.
//  (d) MOTIF     : `correspondGlob` lit un motif aux règles du PATHSPEC git — `*` ne franchit pas un
//      `/`, `**` vaut ZÉRO ou plusieurs dossiers. Le cas qui fait la fonction : une cible de
//      générateur descendue d'un dossier (`docs/raw/<coeur>/catalogue-*.md`). Et l'ACCORD des deux
//      lecteurs de cette grammaire : le dépliage sur disque (`ciblesSurDisque`) rend EXACTEMENT ce
//      que le filtre rend — une grammaire de motif locale à un site rendrait un motif inerte.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier, listerArbre, parUnitesDeCode, parLibelle, correspondGlob } from './lister.mjs'
import { clotureDImports, estModule } from './importGraph.mjs'
import { norm } from '../../../src/lib/normalize.ts'
import { ciblesSurDisque, GENERATORS, NON_GENERATOR_CHECKS } from '../../docs/build-all.mjs'
import { lintFixtures, directivesLint } from './lint.testkit.mjs'
import { lancerLint } from './lintStage.mjs'
import configurationLint, { BLOCS_LINT as configEslint, REGLES_ORDRE_TOTAL } from '../../../oxlint.config.mjs'


const RACINE_DEPOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/** Le bloc de la config réelle qui déclare cette règle du mur — UN seul (volet UNICITÉ). */
function blocDe(regle) {
  const bloc = configEslint.find((c) => c?.rules && regle in c.rules)
  assert.ok(bloc, `\`${regle}\` n’est déclarée par aucun bloc d’oxlint.config.mjs`)
  return bloc
}
/** Les blocs du mur de l'ordre total, un par règle de `REGLES_ORDRE_TOTAL`. */
const blocsDuMur = () => Object.keys(REGLES_ORDRE_TOTAL).map(blocDe)
const couvre = (bloc, rel) => bloc.files.some((g) => correspondGlob(rel, g))
const exempte = (bloc, rel) => (bloc.excludeFiles ?? []).some((g) => correspondGlob(rel, g))
/** Sous le mur ENTIER (chaque règle l'arme) : la clôture des générateurs. */
const sousLeMurEntier = (rel) => blocsDuMur().every((c) => couvre(c, rel) && !exempte(c, rel))

const racinesDuRegistre = () => [...new Set([...GENERATORS.map((g) => g.script), ...NON_GENERATOR_CHECKS])].sort()

// --- (a) PROPRIÉTÉ et EFFET -------------------------------------------------------------------

test('PROPRIÉTÉ — `listerDossier` rend l’ordre des unités de code, jamais celui de la création', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-'))
  try {
    // Pas deux noms qui ne diffèrent QUE par la casse : NTFS les confondrait (un seul fichier).
    for (const nom of ['z.md', 'b.md', 'A.md', '_x.md', 'c.md']) writeFileSync(join(dir, nom), '')
    // 'A'=0x41 < '_'=0x5F < 'b'=0x62 : l'ordre des unités de code, pas celui — insensible à la casse —
    // que NTFS rendrait ('_x.md', 'A.md', 'b.md', …).
    assert.deepEqual(listerDossier(dir), ['A.md', '_x.md', 'b.md', 'c.md', 'z.md'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` rend le MÊME tableau quel que soit l’ordre de création des entrées', () => {
  const poser = (ordre) => {
    const dir = mkdtempSync(join(tmpdir(), 'lister-'))
    for (const rel of ordre) {
      const parts = rel.split('/')
      if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true })
      writeFileSync(join(dir, ...parts), '')
    }
    return dir
  }
  const chemins = ['b/z.ts', 'a.ts', 'b/a.ts', 'c.ts', 'b/c/d.ts']
  const d1 = poser(chemins)
  const d2 = poser([...chemins].reverse())
  try {
    assert.deepEqual(listerArbre(d1), ['a.ts', 'b/a.ts', 'b/c/d.ts', 'b/z.ts', 'c.ts'])
    assert.deepEqual(listerArbre(d2), listerArbre(d1))
  } finally {
    rmSync(d1, { recursive: true, force: true })
    rmSync(d2, { recursive: true, force: true })
  }
})

test('EFFET — `listerArbre` honore `filtre` (fichiers) et `descendre` (dossiers)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lister-'))
  try {
    mkdirSync(join(dir, 'node_modules'))
    writeFileSync(join(dir, 'node_modules', 'p.ts'), '')
    writeFileSync(join(dir, 'a.ts'), '')
    writeFileSync(join(dir, 'a.md'), '')
    assert.deepEqual(
      listerArbre(dir, { filtre: (r) => r.endsWith('.ts'), descendre: (r) => r !== 'node_modules' }),
      ['a.ts'],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('`parLibelle` — alphabétique ACCENTS et CASSE ignorés, là où `parUnitesDeCode` les fait décider', () => {
  // Les trois désalphabétisations mesurées sur les docs routés par CLAUDE.md quand un libellé est trié
  // en unités de code : accent APRÈS la lettre nue, majuscule AVANT toute minuscule.
  assert.deepEqual(['Transformation', 'États'].sort(parLibelle), ['États', 'Transformation'])
  assert.deepEqual(['Transformation', 'États'].sort(parUnitesDeCode), ['Transformation', 'États'])
  assert.deepEqual(['Magie Mineure', 'Magie des Arcanes'].sort(parLibelle), ['Magie des Arcanes', 'Magie Mineure'])
  assert.deepEqual(['activityById', 'ACTIVITIES'].sort(parLibelle), ['ACTIVITIES', 'activityById'])
  assert.deepEqual(['zeta', 'ACTIVITIES'].sort(parLibelle), ['ACTIVITIES', 'zeta'])
  assert.deepEqual(['zeta', 'ACTIVITIES'].sort(parUnitesDeCode), ['ACTIVITIES', 'zeta'])
})

test('`parLibelle` — ordre TOTAL et DÉTERMINISTE : deux libellés de même clé sont départagés, jamais égaux', () => {
  // Sans le départage par unités de code brutes, « Béni » et « beni » seraient ÉGAUX : l'ordre
  // retomberait sur celui de l'entrée, c'est-à-dire sur la machine.
  assert.equal(parLibelle('Béni', 'beni') === 0, false)
  assert.equal(Math.sign(parLibelle('Béni', 'beni')), -Math.sign(parLibelle('beni', 'Béni')))
  const mots = ['beni', 'Béni', 'Bénédiction', 'Beni', 'États', 'Etats', 'zeta', 'ACTIVITIES']
  const attendu = [...mots].sort(parLibelle)
  assert.deepEqual([...mots].reverse().sort(parLibelle), attendu, 'l’ordre dépend encore de l’entrée : il n’est pas TOTAL')
  assert.deepEqual([...mots].sort(parUnitesDeCode).sort(parLibelle), attendu)
})

test('`parLibelle` — les LIGATURES que NFD ne décompose pas se replient (`œ` → `oe`), `norm` compose le même repli', () => {
  assert.deepEqual(['Orateur', 'Œil du chasseur', 'Obstiné'].sort(parLibelle), ['Obstiné', 'Œil du chasseur', 'Orateur'])
  assert.deepEqual(['Criminel', 'Combat déloyal', 'Cœur vaillant'].sort(parLibelle), ['Cœur vaillant', 'Combat déloyal', 'Criminel'])
  assert.equal(norm('  Cœur '), 'coeur')
})

test('`parLibelle` — la PONCTUATION se classe après l’espace, avant tout chiffre et toute lettre (apostrophe, guillemets, tiret demi-cadratin, barre)', () => {
  assert.deepEqual(['Le Prévôt arrive', 'L’étreinte de Morr'].sort(parLibelle), ['L’étreinte de Morr', 'Le Prévôt arrive'])
  assert.deepEqual(['Rat géant', '« Prototype » du Clan Skryre'].sort(parLibelle), ['« Prototype » du Clan Skryre', 'Rat géant'])
  assert.deepEqual(['61–65', '6–10'].sort(parLibelle), ['6–10', '61–65'])
  assert.deepEqual(['Lire/Écrire', 'Lire sur les lèvres'].sort(parLibelle), ['Lire sur les lèvres', 'Lire/Écrire'], 'la ponctuation suit l’espace')
  assert.deepEqual(['Lire/Écrire', 'Lire\u202Fsur les lèvres'].sort(parLibelle), ['Lire\u202Fsur les lèvres', 'Lire/Écrire'], 'une espace fine insécable est une espace')
})

test('`absent` — `vide` rend `[]` sur un dossier absent, `lever` (défaut) lève', () => {
  const absent = join(tmpdir(), 'lister-absent-' + process.pid)
  assert.deepEqual(listerDossier(absent, { absent: 'vide' }), [])
  assert.throws(() => listerDossier(absent))
})

// --- (b) MUR : la portée du lint COUVRE le registre ---------------------------------------------

test('MUR — toute racine du registre des générateurs est sous les globs de chaque bloc du mur « ordre total »', () => {
  const hors = racinesDuRegistre().filter((r) => !sousLeMurEntier(r))
  assert.deepEqual(
    hors,
    [],
    `générateur N+1 hors du mur : ajoute son glob à \`GLOBS_GENERATEURS\` d’oxlint.config.mjs (il arme les deux blocs du mur) —\n  ${hors.join('\n  ')}`,
  )
})

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
 *  banc de `sourceCorpus` (marche témoin indépendante de `listerArbre`). */
const EXEMPTIONS_DU_MUR = [
  'scripts/guards/lib/sourceCorpus.test.mjs:37',
  'scripts/docs/lib/enregistreur-lectures.mjs:105', 'scripts/docs/lib/enregistreur-lectures.mjs:111',
  'scripts/docs/lib/enregistreur-lectures.mjs:140', 'scripts/docs/lib/enregistreur-lectures.mjs:172',
  'scripts/docs/lib/enregistreur-lectures.mjs:176', 'scripts/docs/lib/enregistreur-lectures.mjs:197',
  'scripts/docs/lib/enregistreur-lectures.mjs:203',
  'scripts/test/partition.mjs:173', 'scripts/test/partition.mjs:178',
]

const porteCommentaireEslint = texte => texte.includes('eslint') || texte.includes('oxlint')

/** Les fichiers de code qu'arme au moins une règle du mur, marchés depuis les racines que ses globs
 *  nomment (premier segment de chaque glob). */
function fichiersSousLeMur() {
  const blocs = blocsDuMur()
  const racines = [...new Set(blocs.flatMap((c) => c.files.map((g) => g.split('/')[0])))].sort(parUnitesDeCode)
  return racines
    .flatMap((racine) => listerArbre(join(RACINE_DEPOT, racine), { descendre: (r) => r !== 'node_modules' }).map((r) => `${racine}/${r}`))
    .filter((rel) => estModule(rel) && blocs.some((c) => couvre(c, rel) && !exempte(c, rel)))
}

test('UNICITÉ — chaque règle du mur est déclarée par UN SEUL bloc d’oxlint.config.mjs, en `error`, avec ses options', () => {
  for (const [regle, valeur] of Object.entries(REGLES_ORDRE_TOTAL)) {
    const blocs = configEslint.flatMap((c, i) => (c?.rules && regle in c.rules
      ? [`bloc ${i} [${(c.files ?? ['(tous les fichiers)']).join(', ')}] → ${JSON.stringify(c.rules[regle]).slice(0, 60)}`]
      : []))
    assert.equal(blocs.length, 1, `\`${regle}\` déclarée par ${blocs.length} blocs — un bloc postérieur qui la redéclare (\`off\`, \`warn\`, d’autres options) éteint le mur :\n  ${blocs.join('\n  ')}`)
    assert.equal(blocDe(regle).rules[regle], valeur, `\`${regle}\` : son bloc ne pose pas la valeur de \`REGLES_ORDRE_TOTAL\``)
    assert.equal(valeur[0], 'error', `\`${regle}\` n’est pas en \`error\``)
  }
})

test('IGNORES — aucun ignore global ne couvre un fichier sous le mur', () => {
  const fichiers = fichiersSousLeMur()
  const resultat = lancerLint(RACINE_DEPOT,fichiers,{cwd:RACINE_DEPOT,configuration:{overrides:[],rules:{},options:{reportUnusedDisableDirectives:'off'}}})
  assert.deepEqual(resultat.defauts,[])
  assert.equal(JSON.parse(resultat.stdout).number_of_files,new Set(fichiers).size)
  const temoin='scripts/docs/build-all.mjs'
  for(const motif of [temoin,'scripts/docs/**']) {
    const plante=lancerLint(RACINE_DEPOT,[temoin],{cwd:RACINE_DEPOT,configuration:{overrides:[],rules:{},ignorePatterns:[...configurationLint.ignorePatterns,motif]}})
    assert.deepEqual(plante.defauts,[])
    assert.equal(JSON.parse(plante.stdout).number_of_files,0)
  }
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

// ── (d) MOTIF ──────────────────────────────────────────────────────────────────────────
// Chemins de fixture sous une racine INVENTÉE (`pages/`) : ce banc juge la GRAMMAIRE d'un motif,
// pas l'arbre du jour — et un chemin de doc écrit ici serait, lui, confronté au disque par le
// sens 5 de `scripts/docs/check-doc-refs.mjs`.

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

/** L'arbre FORGÉ du volet (d) : deux niveaux de dossier, la page posée à la racine du motif comme
 *  celle posée dessous, et un voisin qu'aucun motif ne doit attraper. */
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
