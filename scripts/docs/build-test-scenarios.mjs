/**
 * Génère `docs/test-scenarios.md` — catalogue des scénarios de test navigateur.
 * Re-run : `node scripts/docs/build-test-scenarios.mjs` (`npm run docs:test-scenarios`).
 * Mode --check (chaîné dans `npm run docs:check`) : régénère en mémoire, compare au .md committé,
 * exit 1 si diff — jamais d'écriture en mode --check. Composé via `emitOrCheck` de
 * `scripts/docs/lib/jsdocUnion.mjs`.
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
 * chaque fichier de scénario par `ts.createSourceFile`, comme `jsdocUnion.mjs` lit les unions —
 * source de vérité identique (le fichier `.ts` lui-même), zéro effet de bord runtime.
 *
 * Le reste du document (comment vérifier une feature, comment ajouter un scénario, les conventions)
 * est de l'INTENTION ÉDITORIALE non dérivable d'aucune donnée : elle vit ICI, en dur dans ce
 * générateur (même patron que les préambules de `build-systemes.mjs`), jamais dans le `.md` lui-même.
 */
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'
import { join } from 'node:path'
import { emitOrCheck } from './lib/jsdocUnion.mjs'

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
 *  sans substitution) — la seule forme mesurée dans `src/scenes/test-scenarios/*.ts` pour les champs
 *  `id`/`title`/`tests`/`partyNote`. `null` si la forme n'est pas reconnue (fail-fast en amont). */
function evalStaticString(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evalStaticString(node.left)
    const right = evalStaticString(node.right)
    return left != null && right != null ? left + right : null
  }
  // Gabarit AVEC substitution (`${creatures.length}`…) : mesuré une seule fois (galerie-modeles.ts,
  // #903bis) — un `${expr}` non résolu STATIQUEMENT (compte dérivé de src/data au chargement, hors
  // périmètre AST) est rendu comme `{expr}` littéral plutôt que fabriqué ou tronqué en silence.
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text
    for (const span of node.templateSpans) {
      const resolved = evalStaticString(span.expression) ?? evalNumber(span.expression)
      out += resolved != null ? String(resolved) : `{${span.expression.getText()}}`
      out += span.literal.text
    }
    return out
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

/** L'EXPRESSION que porte un champ du littéral : sa valeur (`tests: '…'`) ou, pour un champ rendu à
 *  la LECTURE (`get tests() { return \`…\` }` — un scénario dont le compte se lit vivant dans la donnée),
 *  l'expression de son unique `return`. Toute autre forme n'est pas évaluable ici. */
function valeurDuChamp(prop) {
  if (ts.isPropertyAssignment(prop)) return prop.initializer
  if (!ts.isGetAccessorDeclaration(prop) || !prop.body) return null
  const [seule] = prop.body.statements
  return prop.body.statements.length === 1 && ts.isReturnStatement(seule) ? (seule.expression ?? null) : null
}

function readScenario(file) {
  const path = join(DIR, file)
  const text = readFileSync(path, 'utf8')
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true)
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
    const expr = valeurDuChamp(prop)
    if (!expr) continue
    row[key] = key === 'order' ? evalNumber(expr) : evalStaticString(expr)
  }
  for (const key of FIELDS) {
    if (row[key] == null) {
      console.error(`build-test-scenarios — ${path} : champ \`${key}\` absent ou non STATIQUEMENT évaluable`)
      process.exit(1)
    }
  }
  return row
}

const scenarios = scenarioFiles().map(readScenario)
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
  "du littéral `export const scenario`), groupé par section dans le MÊME ordre que `TestScenariosScreen`",
  "(`SCENARIO_SECTIONS` filtré aux catégories présentes, tri `order` croissant dans chaque section) —",
  "un miroir du menu en jeu. Angle mort : aucun `import` runtime n'est fait (voir en-tête du générateur,",
  "cycle `store.ts` ⇄ `triggeredEffects.ts` sous Node ESM natif) — un scénario dont le champ `id`/`order`/",
  "`category`/`title`/`tests`/`partyNote` n'est PAS un littéral statique (variable, ou gabarit dont une",
  "substitution `${…}` ne se réduit à aucun littéral — mesuré une fois, `galerie-modeles.ts`, compte dérivé",
  "de `src/data` au chargement) affiche l'expression source entre accolades (`{creatures.length}`) plutôt",
  "que de fabriquer ou tronquer une valeur en silence. Les sections « Vérifier une feature », « Ajouter un",
  "scénario » et « Conventions »",
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
  '// (+ createHero / makePregens / itemFromTrappingById selon le groupe voulu)',
  '',
  "const scene = arena({ id: 'test-xxx', nom: '…', heroStart: { x: 2, y: 4 } });",
  "scene.encounters = [{ id: 'enc-xxx', enemies: [{ ref: 'Gobelin', pos: { x: 9, y: 4 } }] }];",
  '',
  'export const scenario: TestScenario = {',
  "  id: 'xxx', order: 7, category: 'combat', icon: 'scenario/ambush', title: '…',",
  "  tests: 'ce que ça vérifie', partyNote: 'le groupe',",
  "  makeParty: () => [/* … */], scene, autoCombat: 'enc-xxx',",
  '};',
  '```',
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
emitOrCheck({
  out,
  path,
  check: process.argv.includes('--check'),
  staleMsg: `docs:test-scenarios — ${path} est PÉRIMÉ (diverge de src/scenes/test-scenarios/*.ts).`,
  rerunMsg: '  → relancer `npm run docs:test-scenarios` et committer le résultat.',
  okMsg: `docs:test-scenarios — OK (${path} à jour, ${scenarios.length} scénarios)`,
  writeMsg: `${path} : ${scenarios.length} scénarios`,
})
