/**
 * Génère docs/ajouter-un-sort.md — la recette d'ajout/curation d'un sort (ou Prière/Bénédiction/
 * Miracle/Rituel : même document `spells.json`).
 *
 * Part FACTUELLE, DÉRIVÉE à chaque génération :
 *  - la FORME d'une entrée : les champs propres du def zod `src/data/schemas/defs/spells.ts`
 *    (nom, optionalité, libellé et aide d'édition tels que la donnée les DÉCLARE) ;
 *  - les formes de `range`/`target`/`duration` : membres des `z.discriminatedUnion('kind', …)` du
 *    MÊME def, lus par `readZodUnionMembers` (socle `scripts/docs/lib/jsdocUnion.mjs`) ;
 *  - les rubriques d'un RITUEL (`ritualSchema`) ;
 *  - l'INVENTAIRE mesuré sur `src/data/spells.json` : compte total, curées, familles, et la
 *    population RÉELLE de chaque forme de portée/cible/durée — le manuscrit figeait « 416 entrées
 *    au 2026-07-05, dont 278 curated », un chiffre qui se périme en silence ;
 *  - la classification `spellSupport` : ses issues lues au type de retour de `src/engine/spellspec.ts`.
 * La part ÉDITORIALE (ordre de la curation, pièges de vocabulaire, doctrine verbatim) vit ICI.
 *
 * Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
 * exit 1 si diff — jamais d'écriture en mode --check.
 *
 *   node scripts/docs/build-sort.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
import { emitOrCheck, loadSource, renderFields, jsdocRole } from './lib/jsdocUnion.mjs'

const OUTIL = 'build-sort'
const DEF = 'src/data/schemas/defs/spells.ts'
const JSON_SORTS = 'src/data/spells.json'
const SPEC = 'src/engine/spellspec.ts'
const RANGE = 'src/engine/spellRange.ts'
const DURATION = 'src/engine/spellDuration.ts'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}
const ancre = (p, quoi) => {
  if (!existsSync(p)) abandon(`${quoi} : \`${p}\` introuvable (renommé/supprimé ?)`)
  return p
}
const plat = (s) => s.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')

for (const p of [DEF, JSON_SORTS, SPEC, RANGE, DURATION]) ancre(p, 'source du générateur')

// ── La FORME d'une entrée : champs propres + méta d'édition, lus au def ───────────────────────────

const { text: DEF_SRC, sf: DEF_SF } = loadSource(DEF)

/** Objet littéral d'un `const NOM = { … }` de premier niveau. */
function objetConst(nom) {
  let out
  DEF_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === nom && d.initializer && ts.isObjectLiteralExpression(d.initializer)) out = d.initializer
    }
  })
  if (!out) abandon(`\`${nom}\` illisible dans ${DEF} (renommé, ou n'est plus un objet littéral)`)
  return out
}

/** `champs` du def : nom (+ `?` si `.optional()`/`.nullable()` est dans la chaîne) + JSDoc. */
const CHAMPS = objetConst('champs').properties.filter(ts.isPropertyAssignment).map((p) => {
  const src = p.initializer.getText(DEF_SF)
  return {
    nom: p.name.getText(DEF_SF).replace(/^['"]|['"]$/g, ''),
    optionnel: /\.optional\(\)/.test(src),
    nullable: /\.nullable\(\)/.test(src),
    role: jsdocRole(DEF_SRC.slice(p.getFullStart(), p.getStart(DEF_SF))),
  }
})
if (CHAMPS.length < 5) abandon(`moins de 5 champs propres lus dans \`champs\` de ${DEF} — la forme a dérivé`)

/** Méta d'édition (3ᵉ argument de `document(...)`) : `{ label, hint? }` par champ. */
const META = (() => {
  let appel
  const visite = (n) => {
    if (ts.isCallExpression(n) && n.expression.getText(DEF_SF) === 'document') appel = n
    n.forEachChild(visite)
  }
  DEF_SF.forEachChild(visite)
  if (!appel || !ts.isObjectLiteralExpression(appel.arguments[3])) abandon(`appel \`document(...)\` sans objet de méta d'édition dans ${DEF}`)
  const m = new Map()
  for (const p of appel.arguments[3].properties) {
    if (!ts.isPropertyAssignment(p) || !ts.isObjectLiteralExpression(p.initializer)) continue
    const cle = p.name.getText(DEF_SF).replace(/^['"]|['"]$/g, '')
    const val = {}
    for (const q of p.initializer.properties) {
      if (ts.isPropertyAssignment(q) && ts.isStringLiteral(q.initializer)) val[q.name.getText(DEF_SF)] = q.initializer.text
    }
    m.set(cle, val)
  }
  return m
})()
const sansMeta = CHAMPS.filter((c) => !META.has(c.nom)).map((c) => c.nom)
if (sansMeta.length) abandon(`champs sans méta d'édition dans ${DEF} : ${sansMeta.join(', ')}`)

// ── Les trois unions structurées (portée / cible / durée) + les rubriques de Rituel ───────────────

/** Membres d'un `z.discriminatedUnion('kind', [ … ])` dont chaque membre est un `z.strictObject`
 *  INLINE (le socle `readZodUnionMembers` ne lit que les membres NOMMÉS par un identifiant).
 *  Rend la même forme `{ rows: [{ name, fieldGroups }] }` — `renderFields` s'y applique tel quel. */
function formesZod(nom) {
  let appel
  DEF_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === nom && d.initializer && ts.isCallExpression(d.initializer)) appel = d.initializer
    }
  })
  if (!appel || !/discriminatedUnion$/.test(appel.expression.getText(DEF_SF)) || !ts.isArrayLiteralExpression(appel.arguments[1])) {
    abandon(`\`${nom}\` n'est plus un \`z.discriminatedUnion('kind', [ … ])\` dans ${DEF}`)
  }
  const rows = appel.arguments[1].elements.map((m) => {
    if (!ts.isCallExpression(m) || !ts.isObjectLiteralExpression(m.arguments[0])) {
      abandon(`membre de \`${nom}\` illisible (attendu \`z.strictObject({ … })\` inline)`)
    }
    let name = null
    const fields = []
    for (const p of m.arguments[0].properties) {
      if (!ts.isPropertyAssignment(p)) continue
      const cle = p.name.getText(DEF_SF).replace(/^['"]|['"]$/g, '')
      const src = p.initializer.getText(DEF_SF)
      const litt = src.match(/^z\.literal\(\s*'([^']*)'\s*\)$/)
      if (cle === 'kind' && litt) {
        name = litt[1]
        continue
      }
      fields.push(cle + (/\.optional\(\)/.test(src) ? '?' : ''))
    }
    if (!name) abandon(`membre de \`${nom}\` sans \`kind: z.literal('…')\``)
    return { name, fieldGroups: [fields] }
  })
  if (!rows.length) abandon(`\`${nom}\` ne déclare plus aucune forme`)
  return { rows }
}

const PORTEE = formesZod('spellRangeSchema')
const CIBLE = formesZod('spellTargetSchema')
const DUREE = formesZod('spellDurationSchema')

const RUBRIQUES = (() => {
  let appel
  DEF_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'ritualSchema' && ts.isCallExpression(d.initializer)) appel = d.initializer
    }
  })
  if (!appel || !ts.isObjectLiteralExpression(appel.arguments[0])) abandon(`\`ritualSchema\` n'est plus un \`z.strictObject({ … })\` dans ${DEF}`)
  return appel.arguments[0].properties.filter(ts.isPropertyAssignment).map((p) => ({
    nom: p.name.getText(DEF_SF).replace(/^['"]|['"]$/g, '') + (/\.optional\(\)/.test(p.initializer.getText(DEF_SF)) ? '?' : ''),
    role: jsdocRole(DEF_SRC.slice(p.getFullStart(), p.getStart(DEF_SF))),
  }))
})()

// ── L'INVENTAIRE : mesuré sur la donnée, jamais figé ──────────────────────────────────────────────

const SORTS = JSON.parse(readFileSync(JSON_SORTS, 'utf8'))
if (!Array.isArray(SORTS) || !SORTS.length) abandon(`${JSON_SORTS} n'est plus une liste non vide`)

const compte = (f) => {
  const m = new Map()
  for (const s of SORTS) {
    const k = f(s)
    if (k == null) continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
const CURES = SORTS.filter((s) => s.curated === true).length
const RITUELS = SORTS.filter((s) => s.isRitual === true).length
const FAMILLES = compte((s) => s.family)
const PAR_PORTEE = new Map(compte((s) => s.range?.kind))
const PAR_CIBLE = new Map(compte((s) => s.target?.kind))
const PAR_DUREE = new Map(compte((s) => s.duration?.kind))
const SANS_PORTEE = SORTS.filter((s) => s.range == null).length
const MISSILES = SORTS.filter((s) => s.missile === true).length
const SOUFFLES = SORTS.filter((s) => s.breathAttack != null).length
const OPPOSES = compte((s) => s.opposed?.kind)
const AVEC_EFFETS = SORTS.filter((s) => s.effects != null).length

/** Chaque forme déclarée au schéma doit être RETROUVABLE dans la donnée, ou nommée « aucune » —
 *  une forme jamais exercée est un fait, pas un silence. */
const population = (rows, index) => rows.map((r) => ({ ...r, n: index.get(r.name) ?? 0 }))

// ── La classification : ses issues lues au TYPE DE RETOUR de spellSupport ─────────────────────────

const { sf: SPEC_SF } = loadSource(SPEC)
const CLASSES = (() => {
  let fn
  SPEC_SF.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'spellSupport') fn = n
  })
  if (!fn?.type || !ts.isUnionTypeNode(fn.type)) abandon(`\`spellSupport\` n'expose plus un type de retour en union dans ${SPEC}`)
  return fn.type.types.filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)).map((t) => t.literal.text)
})()
const LIGNE_SPEC = SPEC_SF.getLineAndCharacterOfPosition(
  (() => {
    let fn
    SPEC_SF.forEachChild((n) => {
      if (ts.isFunctionDeclaration(n) && n.name?.text === 'spellSupport') fn = n
    })
    return fn.name.getStart(SPEC_SF)
  })(),
).line + 1

// ── Gardes : chemin ancré + intitulé RÉEL de leur `describe(...)` ─────────────────────────────────

function intituleGarde(p) {
  const m = readFileSync(p, 'utf8').match(/describe\(\s*(['"`])([\s\S]*?)\1/)
  if (!m) abandon(`\`${p}\` n'expose plus de \`describe('…')\` — l'intitulé de la garde est illisible`)
  return plat(m[2])
}
const GARDES = [
  'src/state/spell-flow-completeness.test.ts',
  'src/engine/spellspec.test.ts',
  'src/engine/spellRange.test.ts',
  'src/engine/spellDuration.test.ts',
  'src/data/fixed-damage-spells.test.ts',
  'src/state/spell-impure-ops.test.ts',
  'src/data/vdm-spells-variantes.test.ts',
  'src/ui/compendium/no-json-fields.test.ts',
  'src/data/id-collisions.test.ts',
].map((p) => ancre(p, 'garde citée par le doc — corriger la liste plutôt que la laisser mentir'))
const GARDES_MESUREES = GARDES.map((p) => ({ p, quoi: intituleGarde(p) }))

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, ligne) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(ligne).join('\n')}`

const tableFormes = (u, index) =>
  table(population(u.rows, index), ['Forme (`kind`)', 'Champs', 'Entrées de `spells.json`'], (r) => `| \`${r.name}\` | ${renderFields(r.fieldGroups)} | ${r.n} |`)

const out = `# Ajouter / curer un sort

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-sort.mjs\` (\`npm run docs:sort\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les ${CHAMPS.length} champs propres
d'une entrée et leurs libellés d'édition (AST du def zod \`${DEF}\`), les
${PORTEE.rows.length} formes de portée, ${CIBLE.rows.length} de cible et ${DUREE.rows.length} de durée (les
\`z.discriminatedUnion('kind', …)\` du même def), les ${RUBRIQUES.length} rubriques d'un Rituel, les
${CLASSES.length} issues de \`spellSupport\` (type de retour de \`${SPEC}\`), et l'INVENTAIRE
mesuré sur les ${SORTS.length} entrées de \`${JSON_SORTS}\` (curées, familles, population de chaque
forme). **Angles morts** : l'état d'implémentation SORT PAR SORT n'est pas ici — il vit dans le
tableau de bord \`docs/sorts-implementation.md\` (généré à part, avec ses propres angles morts, dont
le fait que la mesure est STRUCTURELLE et non une preuve d'exécution) ; le vocabulaire des \`GameOp\`
utilisables dans \`effects\` vit dans \`docs/vocabulaire-mecanique.md\` ; la FIDÉLITÉ d'une \`desc\` à
sa source ne se mesure pas — elle se relit au \`Source/\` ; l'ordre de la curation et les pièges de
vocabulaire sont de l'ÉDITORIAL fixé dans le script.

Un sort — ou une Prière, une Bénédiction, un Miracle, un **Rituel** — vit **entièrement en donnée**
dans \`${JSON_SORTS}\`, sous le document déclaré par \`${DEF}\`. Il n'y a
aucun fichier de moteur par sort : métadonnées de résolution ET effets mécaniques sont dans la même
entrée, éditée au Compendium en jeu (Codex → catégorie « Sorts »).

## 0. Tableau de bord — \`docs/sorts-implementation.md\`

Fichier **généré** (\`npm run docs:sorts\`) : chaque sort avec son état ✅ mécanique / 🟡 partiel /
📜 narratif, sa colonne « Curé », et le texte « arbitrage MJ » restant à journaliser. C'est le point
d'entrée pour repérer un sort à curer, ou vérifier qu'un ajout a bien basculé.

**État du catalogue au moment de cette génération** : ${SORTS.length} entrées, dont ${CURES} curées
(\`curated: true\`), ${RITUELS} Rituels (\`isRitual\`), ${AVEC_EFFETS} portant un \`effects\`.
Répartition par \`family\` : ${FAMILLES.map(([k, n]) => `\`${k}\` ${n}`).join(' · ')}.

## 1. La forme d'une entrée

L'enveloppe commune (\`id\`, \`label\`, \`desc\`, \`source\`, \`variants\`…) est posée par la fabrique de
document — cf. \`docs/ajouter-une-donnee.md\`. Les champs PROPRES d'un sort, avec le libellé sous
lequel le Codex les édite :

${table(
  CHAMPS,
  ['Champ', 'Libellé au Codex', 'Rôle'],
  (c) =>
    `| \`${c.nom}${c.optionnel ? '?' : ''}${c.nullable ? ' \\| null' : ''}\` | ${plat(META.get(c.nom).label)} | ${plat(c.role ?? META.get(c.nom).hint ?? '—')} |`,
)}

**\`desc\`** est un **copié/collé VERBATIM** de la source (Markdown conservé, jamais reformulé ni
résumé — règle 5 de \`CLAUDE.md\`) : le texte affiché doit pouvoir être recollé tel quel dans
\`Source/\`. Rendu en jeu par l'unique primitive \`<Prose>\`.

## 2. Portée / Cible / Durée — des unions STRUCTURÉES

Plus aucune prose n'est re-parsée au runtime : les trois champs sont des unions discriminées par
\`kind\`. La colonne de droite est la population RÉELLE de chaque forme dans \`${JSON_SORTS}\` — une
forme à 0 est déclarée mais jamais exercée par la donnée.

### \`range\` — d'où le sort part (\`${RANGE}\`)

${tableFormes(PORTEE, PAR_PORTEE)}
${SANS_PORTEE ? `\n${SANS_PORTEE} entrées portent \`range: null\` (portée non applicable ou non renseignée).\n` : ''}
### \`target\` — qui/quoi il affecte (\`${RANGE}\`)

${tableFormes(CIBLE, PAR_CIBLE)}

### \`duration\` — combien de temps (\`${DURATION}\`)

${tableFormes(DUREE, PAR_DUREE)}

\`value\`/\`n\`/\`meters\` sont des \`Formula\` (\`src/engine/ops.ts\`) : littéral \`number\`,
\`{charOf}\` (« (Force Mentale) ») ou \`{bonusOf}\` (« (Bonus de FM) »). Les \`parseSpellRange\`/
\`parseSpellTarget\`/\`parseSpellDuration\` ne servent qu'à la MIGRATION prose → structure
(authoring), jamais au runtime ni à l'affichage — l'affichage est dérivé par
\`src/engine/spellRangeFormat.ts\`. Pour un sort neuf : écrire directement la forme structurée.

## 3. Effets mécaniques — \`effects\`

\`effects\` est le **Flow ÉDITABLE** (do / if / test) dont les feuilles sont des \`EffectOp\`
(\`{ type: 'ops', on, ops: GameOp[] }\`) — SOURCE UNIQUE des effets appliqués à l'incantation. Rien
d'autre ne porte d'effet mécanique : le vocabulaire complet des ops disponibles est catalogué dans
\`docs/vocabulaire-mecanique.md\`, à consulter **avant** de conclure qu'une op manque.

Au Codex, ce champ a un éditeur dédié qui réutilise le \`FlowEditor\` de l'éditeur de scène ; chaque
feuille pose sa cible et sa liste de \`GameOp\` via \`GameOpEditor\` — la même primitive que
traits/mutations/talents/consommables. **Ne jamais réinventer un widget de liste d'ops** (\`docs/primitives.md\`).

Cas particuliers, mesurés sur la donnée :

- **Projectile magique** — pas un \`GameOp\` : champs dédiés \`missile\`, \`damage\`, \`ignorePA\`,
  \`ignoreBE\`, lus par \`missileDamage\`/\`isMagicMissile\` (\`src/engine/magic.ts\`) et résolus comme
  une attaque. ${MISSILES} entrées aujourd'hui.
- **Souffle** — \`breathAttack\`, délégué à l'attaque de zone du Trait Souffle, pas un \`GameOp\`.
  ${SOUFFLES} entrées.
- **Opposition** — \`opposed\` : ${OPPOSES.length ? OPPOSES.map(([k, n]) => `\`${k}\` ${n}`).join(' · ') : 'aucune entrée'}.
- ⚠ **Deux vocabulaires de mitigation à ne pas confondre** : l'op \`wounds\` porte \`ignoreTB\`/
  \`ignoreAP\`, tandis que les champs de Projectile de l'entrée portent \`ignorePA\`/\`ignoreBE\`.
- Toute référence vers un autre dataset (invocation, sort de créature, liste d'un culte) se fait par
  **id stable**, jamais par libellé.

## 4. Rituels (\`VDM\`) — les rubriques en plus

Une entrée taguée \`isRitual\` imprime, en plus des champs d'un sort, les rubriques d'anatomie d'un
Rituel (\`ritual\`) — ${RITUELS} entrées aujourd'hui :

${table(RUBRIQUES, ['Rubrique', 'Rôle'], (r) => `| \`${r.nom}\` | ${plat(r.role ?? '—')} |`)}

## 5. Classification mécanique — \`spellSupport\`

\`spellSupport(ops, spell, missile)\` (\`${SPEC}:${LIGNE_SPEC}\`) rend l'une des
${CLASSES.length} issues ${CLASSES.map((c) => `\`${c}\``).join(' / ')}. Elle alimente le tableau de bord et le
badge affiché en jeu. \`ops\` est l'union des feuilles du Flow pour la cible ET pour le lanceur : un
effet de lanceur (téléportation, poussée, chaîne, invocation, zone, vol de vie) compte autant qu'un
effet de cible.

## 6. Curer un sort narratif → mécanique

1. Repérer le sort dans \`docs/sorts-implementation.md\` (📜 ou 🟡, colonne « Curé » = repli).
2. Ouvrir le Codex en jeu → catégorie « Sorts » → l'entrée.
3. Relire la \`desc\` VERBATIM (ne pas la réécrire) et identifier l'effet mécanisable ; l'exprimer en
   \`GameOp\` du catalogue existant plutôt qu'en champ ad hoc.
4. Compléter \`range\`/\`target\`/\`duration\` structurés s'ils sont absents (§2).
5. Éditer \`effects\` au \`FlowEditor\` ; ce qui reste irréductible (arbitrage laissé au MJ par la
   source) reste une feuille \`narrative\` — jamais inventé, jamais supprimé en silence.
6. Poser \`curated: true\` quand la spec est jugée complète — ce marqueur n'a de sens que pour une
   entrée de la base officielle.
7. Enregistrer, puis régénérer le tableau de bord (\`npm run docs:sorts\`) et lancer les gardes.

## Gardes

${table(GARDES_MESUREES, ['Garde', 'Ce qu’elle verrouille (son propre `describe`)'], (g) => `| \`${g.p}\` | ${g.quoi} |`)}

\`npm run typecheck\` en plus : les unions de portée/cible/durée et \`Formula\` sont strictement
typées — une valeur mal formée casse la compilation avant le runtime.
`

emitOrCheck({
  out,
  path: 'docs/ajouter-un-sort.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:sort — docs/ajouter-un-sort.md est PÉRIMÉ (diverge de src/data/schemas/defs/spells.ts, de src/data/spells.json, de src/engine/spellspec.ts, des gardes, ou du script).',
  rerunMsg: '  → relancer `npm run docs:sort` et committer le résultat.',
  okMsg: 'docs:sort — OK (docs/ajouter-un-sort.md à jour)',
  writeMsg: `docs/ajouter-un-sort.md — ${SORTS.length} sorts (${CURES} curés, ${RITUELS} rituels), ${CHAMPS.length} champs, ${GARDES_MESUREES.length} gardes.`,
})
