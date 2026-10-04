// PORTE DE RÔLE du lecteur à ordre total (#1679 L3b, incident #1620) — trois volets, zéro stock.
//
//  (a) PROPRIÉTÉ  : `listerDossier` rend l'ordre des unités de code, quel que soit l'ordre de création.
//      EFFET      : `listerArbre` rend le MÊME tableau quel que soit l'ordre de création.
//      Sous NTFS la preuve est TRIVIALE (le système rend déjà un listing trié) ; c'est la CI, sur
//      ext4 (ordre d'un hash), qui la porte réellement. Le test est ici pour y être JOUÉ, pas pour
//      être vert sur cette machine.
//  (b) MUR        : toute racine du registre des générateurs (`GENERATORS` ∪ `NON_GENERATOR_CHECKS`,
//      `scripts/docs/build-all.mjs`) est SOUS les globs `files:` de chaque bloc du mur « ordre total »
//      de `eslint.config.js` — les globs se LISENT depuis la config, jamais recopiés ici. Chaque règle
//      du mur y est déclarée par UN seul bloc, en `error` (UNICITÉ) ; aucun ignore global ne couvre un
//      fichier sous le mur (IGNORES) ; les seuls commentaires ESLint qui l'éteignent sont les exemptions
//      nommées (DIRECTIVES).
//  (c) CLÔTURE    : chaque module de la clôture d'imports NON bornée de ces racines (`clotureDImports`,
//      donc `scripts/**` compris — `closureOf` est bornée à `src/` et ne verrait pas les libs de garde
//      atteintes par un générateur, dont `fieldConsumers.mjs`, le fichier de l'incident fondateur) qui
//      vit HORS des globs du mur est linté par ESLint, la config du dépôt surmontée de
//      `REGLES_ORDRE_TOTAL` (les règles des deux blocs du mur, lues dans `eslint.config.js`) : les formes
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
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier, listerArbre, parUnitesDeCode, parLibelle, correspondGlob } from './lister.mjs'
import { clotureDImports, estModule } from './importGraph.mjs'
import { norm } from '../../../src/lib/normalize.ts'
import { scriptKindDe } from './dialecte.mjs'
import { ciblesSurDisque, GENERATORS, NON_GENERATOR_CHECKS } from '../../docs/build-all.mjs'
import { ESLint } from 'eslint'
import configEslint, { REGLES_ORDRE_TOTAL } from '../../../eslint.config.js'

/** Le parseur des commentaires ESLint, résolu DEPUIS `eslint` : la copie de `@eslint/plugin-kit` que le
 *  linter charge lui-même (`lib/languages/js/source-code/source-code.js`), jamais une autre. */
const { ConfigCommentParser } = createRequire(import.meta.resolve('eslint'))('@eslint/plugin-kit')

const RACINE_DEPOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '')

/** Le bloc de la config ESLint réelle qui déclare cette règle du mur — UN seul (volet UNICITÉ). */
function blocDe(regle) {
  const bloc = configEslint.find((c) => c?.rules && regle in c.rules)
  assert.ok(bloc, `\`${regle}\` n’est déclarée par aucun bloc d’eslint.config.js`)
  return bloc
}
/** Les blocs du mur de l'ordre total, un par règle de `REGLES_ORDRE_TOTAL`. */
const blocsDuMur = () => Object.keys(REGLES_ORDRE_TOTAL).map(blocDe)
const couvre = (bloc, rel) => bloc.files.some((g) => correspondGlob(rel, g))
const exempte = (bloc, rel) => (bloc.ignores ?? []).some((g) => correspondGlob(rel, g))
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
    `générateur N+1 hors du mur : ajoute son glob à \`GLOBS_GENERATEURS\` d’eslint.config.js (il arme les deux blocs du mur) —\n  ${hors.join('\n  ')}`,
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
  const sonde = sondeDesDirectives(Object.keys(REGLES_ORDRE_TOTAL))
  const eslint = new ESLint({
    cwd: RACINE_DEPOT,
    overrideConfig: [
      { files: horsDuMur, linterOptions: { reportUnusedDisableDirectives: 'off' }, rules: REGLES_ORDRE_TOTAL },
      sonde.bloc(horsDuMur),
    ],
  })
  const sites = []
  for (const { filePath, messages, suppressedMessages } of await eslint.lintFiles(horsDuMur)) {
    const rel = filePath.slice(RACINE_DEPOT.length + 1).split('\\').join('/')
    for (const m of messages) {
      // Un module NON linté (ignoré, illisible au parseur) rend un message sans `ruleId` : il est nommé,
      // jamais compté pour conforme.
      if (m.ruleId === null || m.ruleId in REGLES_ORDRE_TOTAL) sites.push(`${rel}:${m.line}: ${m.message}`)
    }
    // Une directive ÉTEINT le mur sans le faire parler : hors des globs, aucune exemption n'est nommée.
    for (const m of suppressedMessages) {
      if (m.ruleId in REGLES_ORDRE_TOTAL) sites.push(`${rel}:${m.line}: (éteint par une directive) ${m.message}`)
    }
  }
  // Un commentaire de configuration `/* eslint <mur>: … */` éteint le mur sans message ni suppression.
  for (const site of sonde.vues) sites.push(`${site}: (commentaire ESLint qui éteint le mur)`)
  assert.deepEqual(sites, [], `module de la clôture hors des globs du mur qui enfreint ses règles :\n  ${sites.join('\n  ')}`)
})

/** Les exemptions AU SITE du mur de l'ordre total, nommées : le crochet de l'enregistreur de lectures
 *  (il POSE le listing), la reproduction du filtre de Vitest (`toLocaleLowerCase`) et l'oracle naïf du
 *  banc de `sourceCorpus` (marche témoin indépendante de `listerArbre`). */
const EXEMPTIONS_DU_MUR = [
  'scripts/guards/lib/sourceCorpus.test.mjs:37',
  'scripts/docs/lib/enregistreur-lectures.mjs:81', 'scripts/docs/lib/enregistreur-lectures.mjs:87',
  'scripts/docs/lib/enregistreur-lectures.mjs:111', 'scripts/docs/lib/enregistreur-lectures.mjs:119',
  'scripts/docs/lib/enregistreur-lectures.mjs:123', 'scripts/docs/lib/enregistreur-lectures.mjs:133',
  'scripts/docs/lib/enregistreur-lectures.mjs:139',
  'scripts/test/partition.mjs:173', 'scripts/test/partition.mjs:178',
]

/** Sonde des commentaires ESLint qui ÉTEIGNENT l'une de ces règles, lus par la grammaire d'ESLint
 *  elle-même (`SourceCode#getDisableDirectives`/`applyInlineConfig`, `ConfigCommentParser#parseListConfig`
 *  de la copie de `@eslint/plugin-kit` que charge le linter) : la directive `eslint-disable…` qui la
 *  nomme ou n'en nomme aucune (elle éteint tout), et le commentaire de configuration
 *  `/* eslint <règle>: … *\/` qui la redéclare (sévérité ou options) ; `eslint-enable` n'éteint rien. `bloc(fichiers)` est le bloc de config à greffer au lint ; `vues` reçoit les
 *  sites `rel:ligne`. */
function sondeDesDirectives(regles) {
  const parseur = new ConfigCommentParser()
  const vues = []
  const lire = {
    create(ctx) {
      const rel = ctx.filename.slice(RACINE_DEPOT.length + 1).split('\\').join('/')
      const sc = ctx.sourceCode
      for (const d of sc.getDisableDirectives().directives) {
        if (d.type === 'enable') continue
        const noms = Object.keys(parseur.parseListConfig(d.value))
        if (noms.length === 0 || noms.some((n) => regles.includes(n))) vues.push(`${rel}:${d.node.loc.start.line}`)
      }
      for (const { config, loc } of sc.applyInlineConfig().configs) {
        if (Object.keys(config.rules ?? {}).some((n) => regles.includes(n))) vues.push(`${rel}:${loc.start.line}`)
      }
      return {}
    },
  }
  const bloc = (fichiers) => ({ files: fichiers, plugins: { sonde: { rules: { lire } } }, rules: { 'sonde/lire': 'error' } })
  return { vues, bloc }
}

/** La config du dépôt SANS ses règles : ses parseurs lisent chaque dialecte, ses ignores globaux restent,
 *  seule la sonde tourne. Sûr tant qu'aucun bloc à `rules` n'a d'`ignores` sans `files` (réduit, il
 *  deviendrait un ignore global) : asserté ici, à chaque lecture. */
function sansRegles(config = configEslint) {
  assert.ok(!config.some((c) => c?.rules && c.ignores && !c.files), 'réduire à `rules` près un bloc à `rules` et `ignores` sans `files` en ferait un ignore global')
  return config.map(({ rules: _regles, ...bloc }) => bloc)
}
const lintSonde = (sonde, fichiers) =>
  new ESLint({ cwd: RACINE_DEPOT, overrideConfigFile: true, overrideConfig: [...sansRegles(), sonde.bloc(fichiers)] })

/** Un commentaire ESLint s'ouvre par le mot `eslint` (`parseDirective`, `shared/directives.js`) : un
 *  source qui ne le porte pas n'en a aucun. */
const porteCommentaireEslint = (texte) => texte.includes('eslint')

/** Les fichiers de code qu'arme au moins une règle du mur, marchés depuis les racines que ses globs
 *  nomment (premier segment de chaque glob). */
function fichiersSousLeMur() {
  const blocs = blocsDuMur()
  const racines = [...new Set(blocs.flatMap((c) => c.files.map((g) => g.split('/')[0])))].sort(parUnitesDeCode)
  return racines
    .flatMap((racine) => listerArbre(join(RACINE_DEPOT, racine), { descendre: (r) => r !== 'node_modules' }).map((r) => `${racine}/${r}`))
    .filter((rel) => scriptKindDe(rel) !== scriptKindDe('.json') && blocs.some((c) => couvre(c, rel) && !exempte(c, rel)))
}

test('UNICITÉ — chaque règle du mur est déclarée par UN SEUL bloc d’eslint.config.js, en `error`, avec ses options', () => {
  for (const [regle, valeur] of Object.entries(REGLES_ORDRE_TOTAL)) {
    const blocs = configEslint.flatMap((c, i) => (c?.rules && regle in c.rules
      ? [`bloc ${i} [${(c.files ?? ['(tous les fichiers)']).join(', ')}] → ${JSON.stringify(c.rules[regle]).slice(0, 60)}`]
      : []))
    assert.equal(blocs.length, 1, `\`${regle}\` déclarée par ${blocs.length} blocs — un bloc postérieur qui la redéclare (\`off\`, \`warn\`, d’autres options) éteint le mur :\n  ${blocs.join('\n  ')}`)
    assert.equal(blocDe(regle).rules[regle], valeur, `\`${regle}\` : son bloc ne pose pas la valeur de \`REGLES_ORDRE_TOTAL\``)
    assert.equal(valeur[0], 'error', `\`${regle}\` n’est pas en \`error\``)
  }
})

test('IGNORES — aucun ignore GLOBAL d’eslint.config.js ne couvre un fichier sous le mur', async () => {
  // ESLint décide de ce qu'est un ignore global : la config du dépôt sans ses règles (`sansRegles`, qui
  // n'en crée aucun) arme tout fichier (`files: ['**']`) — un fichier qu'elle ignore l'est par un ignore
  // global, jamais faute de bloc.
  const lecteur = (config) => new ESLint({ cwd: RACINE_DEPOT, overrideConfigFile: true, overrideConfig: [...sansRegles(config), { files: ['**'] }] })
  const reel = lecteur(configEslint)
  const ignores = []
  for (const rel of fichiersSousLeMur()) if (await reel.isPathIgnored(join(RACINE_DEPOT, rel))) ignores.push(rel)
  assert.deepEqual(ignores, [], `fichier sous le mur éteint par un ignore global :\n  ${ignores.join('\n  ')}`)
  // Deux ignores globaux plantés DANS la config lue, nu et à `basePath` (champ méta de
  // `@eslint/config-array`).
  const temoin = 'scripts/docs/build-all.mjs'
  const plante = async (bloc) => lecteur([...configEslint, bloc]).isPathIgnored(join(RACINE_DEPOT, temoin))
  assert.equal(await plante({ ignores: [temoin] }), true, 'le lecteur ne voit plus un ignore global planté')
  assert.equal(await plante({ basePath: 'scripts', ignores: ['docs/build-all.mjs'] }), true, 'le lecteur ne voit pas un ignore global à `basePath`')
})

test('DIRECTIVES — sous les globs du mur, les seules directives qui l’éteignent sont les exemptions nommées', async () => {
  const regles = Object.keys(REGLES_ORDRE_TOTAL)
  const sousLeMur = fichiersSousLeMur()
  for (const temoin of ['scripts/docs/build-all.mjs', 'src/eslint-ordre-total-et-purete.test.ts']) {
    assert.ok(sousLeMur.includes(temoin), `la marche des globs du mur ne voit plus \`${temoin}\``)
  }
  const porteurs = sousLeMur.filter((rel) => porteCommentaireEslint(readFileSync(join(RACINE_DEPOT, rel), 'utf8')))
  const sonde = sondeDesDirectives(regles)
  const lint = lintSonde(sonde, porteurs)
  // Un porteur ignoré ou illisible au parseur tairait ses directives : il est nommé.
  const ignores = []
  for (const rel of porteurs) if (await lint.isPathIgnored(join(RACINE_DEPOT, rel))) ignores.push(`${rel}: ignoré`)
  assert.deepEqual(ignores, [])
  const resultats = await lint.lintFiles(porteurs)
  assert.deepEqual(resultats.flatMap((r) => r.messages.filter((m) => m.fatal).map((m) => `${r.filePath}:${m.line}: ${m.message}`)), [])
  assert.deepEqual(sonde.vues.sort(parUnitesDeCode), [...EXEMPTIONS_DU_MUR].sort(parUnitesDeCode))
  // La lecture des directives se prouve sur un cas planté de chaque forme, sous les globs du mur, après
  // le filtre des porteurs.
  const PLANTE = 'scripts/docs/zz-plante-directives.mjs'
  const plante = async (code) => {
    if (!porteCommentaireEslint(code)) return []
    const s = sondeDesDirectives(regles)
    await lintSonde(s, [PLANTE]).lintText(code, { filePath: join(RACINE_DEPOT, PLANTE) })
    return s.vues.map((v) => Number(v.slice(PLANTE.length + 1)))
  }
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
