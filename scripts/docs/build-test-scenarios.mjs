import { analyserCorpus } from '../guards/lib/dialecte.mjs';
/**
 * Génère `docs/test-scenarios.md` — catalogue des scénarios de test navigateur.
 * Re-run : `node scripts/docs/build-test-scenarios.mjs` (`npm run docs:test-scenarios`).
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 * Objet (#903 suite) — la table « Catalogue actuel » recopiait à la main un sous-ensemble du
 * registre réel (`_registry.generated.ts`, 34 scénarios) : mesuré 9 scénarios ABSENTS du .md
 * manuscrit avant ce générateur (`grimpant`, `presets-edo`, `enquete-carnet`, `conditions-
 * etendues`, `revisit`, `dialogue-multi`, `echeance`, `duel-naval`, `zones-pieces`) — un doublon
 * manuscrit d'une donnée déjà en donnée pourrit silencieusement à chaque scénario ajouté sans
 * mise à jour du .md.
 *
 * Lecture par AST (jamais un `import` runtime des scénarios) : le module `TestScenario` importe
 * transitivement `src/state/store.ts` (via `combatFlow.ts`…) — un `import` direct sous Node ESM
 * (`tsx`/`node`, hors bundler Vite/Vitest) lève `ReferenceError: Cannot access 'testRouter' before
 * initialization` (cycle `store.ts` ⇄ `triggeredEffects.ts`, mesuré #903bis) : Vite/Vitest tolèrent
 * ce cycle (transform SSR à liaisons tardives), Node ESM natif l'interdit (TDZ stricte). On lit donc
 * chaque fichier de scénario par AST, comme `jsdocUnion.mjs` lit les unions —
 * source de vérité identique (le fichier `.ts` lui-même), zéro effet de bord runtime.
 *
 * Le reste du document (comment vérifier une feature, comment ajouter un scénario, les conventions)
 * est de l'INTENTION ÉDITORIALE non dérivable d'aucune donnée : elle vit ICI, en dur dans ce
 * générateur (même patron que les préambules de `build-systemes.mjs`), jamais dans le `.md` lui-même.
 */
import * as ts from 'typescript/unstable/ast'
import { readFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'
import { join } from 'node:path'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const DIR = 'src/scenes/test-scenarios'
  const SECTIONS = [
    { key: 'combat', label: 'Combat' },
    { key: 'magie', label: 'Magie' },
    { key: 'creatures', label: 'Créatures' },
    { key: 'survie', label: 'Survie' },
    { key: 'marche', label: 'Marché' },
    { key: 'scenarios', label: 'Scénarios complets' },
    { key: 'naval', label: 'Naval' },
    { key: 'rendu', label: 'Rendu' },
  ]

  /** Même filtre que `scripts/gen-registry.mjs` (entrée `test-scenarios`) — SOURCE UNIQUE du périmètre. */
  function scenarioFiles() {
    return listerDossier(DIR)
      .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('_') && !estFichierVitest(f) && !f.endsWith('.ascii.ts') && f !== 'index.ts')
  }

  /** Évalue une expression de chaîne STATIQUE (littéral, ou concaténation `+` de littéraux/gabarits
   *  sans substitution) — la seule forme admise dans la FICHE d'un scénario pour les champs
   *  `id`/`title`/`tests`/`partyNote`. `null` si la forme n'est pas reconnue (fail-fast en amont). */
  function evalStaticString(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = evalStaticString(node.left)
      const right = evalStaticString(node.right)
      return left != null && right != null ? left + right : null
    }
    return null
  }

  function evalNumber(node) {
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
      return -Number(node.operand.text)
    }
    return null
  }

  /** Objet littéral de `export const scenario: TestScenario = { … }` (`null` si absent). */
  function scenarioLiteral(sf) {
    let found
    sf.forEachChild((node) => {
      if (!ts.isVariableStatement(node)) return
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === 'scenario' && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          found = decl.initializer
        }
      }
    })
    return found ?? null
  }

  const FIELDS = ['id', 'order', 'category', 'icon', 'title', 'tests', 'partyNote']

  function readScenario(path, sf) {
    const literal = scenarioLiteral(sf)
    if (!literal) {
      console.error(`build-test-scenarios — ${path} n'exporte pas de \`const scenario: TestScenario = { … }\` littéral`)
      process.exit(1)
    }
    const row = {}
    for (const prop of literal.properties) {
      if (!ts.isIdentifier(prop.name ?? {})) continue
      const key = prop.name.text
      if (!FIELDS.includes(key)) continue
      if (!ts.isPropertyAssignment(prop)) continue
      row[key] = key === 'order' ? evalNumber(prop.initializer) : evalStaticString(prop.initializer)
    }
    for (const key of FIELDS) {
      if (row[key] == null) {
        console.error(`build-test-scenarios — ${path} : champ \`${key}\` absent ou non STATIQUEMENT évaluable`)
        process.exit(1)
      }
    }
    return row
  }

  const fichiers = scenarioFiles().map((file) => ({ rel: join(DIR, file), text: readFileSync(join(DIR, file), 'utf8') }))
  const scenarios = [...analyserCorpus(fichiers)].map(({ fichier, sourceFile }) => readScenario(fichier.rel, sourceFile))
  const ids = new Set()
  for (const s of scenarios) {
    if (ids.has(s.id)) {
      console.error(`build-test-scenarios — id de scénario dupliqué : ${s.id}`)
      process.exit(1)
    }
    ids.add(s.id)
  }

  function groupBySection(list) {
    const byCat = new Map()
    for (const sc of list) {
      const bucket = byCat.get(sc.category) ?? []
      bucket.push(sc)
      byCat.set(sc.category, bucket)
    }
    return SECTIONS.filter((s) => byCat.has(s.key)).map((s) => ({
      section: s,
      items: [...byCat.get(s.key)].sort((a, b) => a.order - b.order),
    }))
  }

  const lines = [
    '# Scénarios de test',
    '',
    '> GÉNÉRÉ par `node scripts/docs/build-test-scenarios.mjs` (`npm run docs:test-scenarios`) — NE PAS ÉDITER À LA MAIN.',
    "> Source : `src/scenes/test-scenarios/*.ts` (même périmètre que le registre `_registry.generated.ts`,",
    "> ramassé par `scripts/gen-registry.mjs`) — le catalogue ci-dessous reflète CHAQUE fichier de scénario,",
    "> jamais un sous-ensemble recopié à la main.",
    '',
    '**Périmètre mesuré / angles morts** — la section « Catalogue actuel » énumère chaque fichier',
    '`src/scenes/test-scenarios/<NN>-<slug>.ts` (hors `_*`, `*.test.ts`, `*.ascii.ts`, `index.ts` — même',
    "filtre que `scripts/gen-registry.mjs`), lu par AST (`id`/`order`/`category`/`title`/`tests`/`partyNote`",
    "de la FICHE, le littéral `export const scenario`), groupé par section dans le MÊME ordre que `TestScenariosScreen`",
    "(`SCENARIO_SECTIONS` filtré aux catégories présentes, tri `order` croissant dans chaque section) —",
    "un miroir du menu en jeu. Angle mort : aucun `import` runtime n'est fait (voir en-tête du générateur,",
    "cycle `store.ts` ⇄ `triggeredEffects.ts` sous Node ESM natif) — un scénario dont le champ `id`/`order`/",
    "`category`/`title`/`tests`/`partyNote` n'est PAS un littéral statique fait échouer le générateur : la",
    "fiche ne lit aucun dataset, ce qui se construit vit dans la fabrique `construire`. Les sections",
    "« Vérifier une feature », « Ajouter un scénario » et « Conventions »",
    "ci-dessous sont de l'INTENTION ÉDITORIALE (comment écrire un scénario, pourquoi la densité) non",
    "dérivable d'aucune donnée — maintenue à la main DANS CE GÉNÉRATEUR, jamais dans le .md.",
    '',
    '## Vérifier une feature au navigateur',
    '',
    '1. Lance `npm run dev`, ouvre le menu → **Scénarios de test**.',
    "2. **Passe par le scénario adapté.** S'il n'en existe pas pour ce que tu vérifies, **crée-en un**.",
    '',
    "**Angle mort du catalogue, mesuré (recette #1852, 2026-09-21)** : AUCUN scénario n'isole « une",
    "créature à attaque gratuite face à un héros ». Tant qu'il n'existe pas, la composition MINIMALE qui",
    'le monte, au kit de recette (helpers de `src/state/devtools.ts`, vérifiés au code) :',
    '',
    '```js',
    "await evaluate(session, `window.__wfrp.scenario('entrainement')`);        // terrain nu, groupe complet",
    "await evaluate(session, `window.__wfrp.fight('enc-entrainement')`);       // l'affrontement du scénario",
    "await evaluate(session, `window.__wfrp.spawn('ours', { x: 8, y: 5 }, { side: 'enemy' })`);",
    "await evaluate(session, `window.__wfrp.quality('hero-1', undefined, 3)`); // 3 Avantages au héros",
    '```',
    '',
    "`spawn(creatureId, pos, { side })` prend un id de `src/data/creatures.json` (`'ours'`, pas son",
    "libellé) ; `quality(id, label, advantage)` crédite les Avantages — son 2ᵉ argument RESTE une qualité",
    "d'arme (défaut « Déstabilisante »), passer `undefined` la laisse au défaut, ça n'annule rien. C'est",
    'du MONTAGE d\'état : le geste TESTÉ, lui, se joue au clic et au clavier.',
    '',
    '## Ajouter un scénario = un fichier',
    '',
    'Dépose un fichier `src/scenes/test-scenarios/<NN>-<slug>.ts` exportant `scenario` :',
    '',
    '```ts',
    "import { arena } from './_shared';",
    "import type { TestScenario } from './_shared';",
    "import type { Scene } from '../../state/scene';",
    '// (+ createHero / makePregens / itemFromTrappingById selon le groupe voulu)',
    '',
    "function construireScene(): Scene {",
    "  const scene = arena({ id: 'test-xxx', label: '…', heroStart: { x: 2, y: 4 } });",
    "  scene.encounters = [{ id: 'enc-xxx', enemies: [{ ref: 'gobelin', pos: { x: 9, y: 4 } }] }];",
    '  return scene;',
    '}',
    '',
    'export const scenario: TestScenario = {',
    "  id: 'xxx', order: 7, category: 'combat', icon: 'scenario/ambush', title: '…',",
    "  tests: 'ce que ça vérifie', partyNote: 'le groupe',",
    "  construire: () => ({ party: [/* … */], scene: construireScene() }), autoCombat: 'enc-xxx',",
    '};',
    '```',
    '',
    "La FICHE (`id`…`partyNote`, `autoCombat`, `money`, `rules`, `interludeWeeks`) ne lit aucun dataset ;",
    "tout ce qui se construit (groupe, scène, `extraScenes`, `worldMap`, `narratif`, `vessel`, `massBattle`)",
    "sort de la fabrique `construire`, appelée à chaque lancement par `lancerScenario` (`src/state/scenarioFlow.ts`).",
    '',
    "`category` est une clé SANS emoji (`'combat' | 'magie' | 'creatures' | 'survie' | 'marche' |",
    "'scenarios' | 'naval' | 'rendu'`, `SCENARIO_SECTIONS` dans `_shared.ts`) — le libellé/icône de",
    'section sont portés par la donnée, pas par le scénario. `icon` est un `IconId` du registre SVG',
    '(`src/ui/icons`, famille `scenario/*`), jamais un emoji.',
    '',
    '`index.ts` le ramasse via le **registre généré** (`scripts/gen-registry.mjs` → `_registry.generated.ts`,',
    'auto en dev ; après ajout/suppression d\'un fichier, lance `npm run gen`). Les scénarios sont triés par',
    '`order`, puis **groupés par `category`** en sections dans le menu (`TestScenariosScreen`). Les `*.test.ts`',
    'et les fichiers `_*` sont exclus.',
    '',
    '## Conventions',
    '',
    '- **Équipement à la main** : `createHero(...)` puis réassigner `items` (`itemFromTrappingById` +',
    '  `recomputeLoadout`). Ex. arbalétrier = Arbalète + Carreaux équipés (`recomputeLoadout` dérive',
    '  `reload`/`subType`).',
    '- **Ennemis** : vraies créatures du bestiaire via `ref` (`creatures.json`, LDB/ADE) ; fixture',
    '  (`statblock` inline) seulement quand aucun équivalent canon n\'existe (ex. le **mannequin** passif',
    '  `M 0`, beaucoup de Blessures).',
    '- Le moteur reste couvert par Vitest ; les scénarios sont des fixtures de vérif manuelle/visuelle.',
    '',
    '## Catalogue actuel (par section)',
    '',
    'Chaque scénario est volontairement DENSE : il exerce une famille de systèmes liés plutôt qu\'une seule',
    'mécanique (un terrain bien agencé, des mannequins bien placés).',
    '',
    '| Section | Scénario | Vérifie | Groupe |',
    '|---|---|---|---|',
  ]

  for (const { section, items } of groupBySection(scenarios)) {
    for (const sc of items) {
      lines.push(`| ${section.label} | ${sc.title} | ${sc.tests.replace(/\|/g, '\\|')} | ${sc.partyNote.replace(/\|/g, '\\|')} |`)
    }
  }

  lines.push(
    '',
    'Un scénario peut embarquer **plusieurs scènes** (`extraScenes`) et une **carte du monde** (`worldMap`) :',
    'il est alors chargé comme un projet (`loadProject`).',
  )

  const out = lines.join('\n') + '\n'
  const path = 'docs/test-scenarios.md'
  return {
    out,
    path,
    staleMsg: `docs:test-scenarios — ${path} est PÉRIMÉ (diverge de src/scenes/test-scenarios/*.ts).`,
    rerunMsg: '  → relancer `npm run docs:test-scenarios` (dérivé jamais commité, #2203).',
    okMsg: `docs:test-scenarios — OK (${path} à jour, ${scenarios.length} scénarios)`,
    writeMsg: `${path} : ${scenarios.length} scénarios`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })
