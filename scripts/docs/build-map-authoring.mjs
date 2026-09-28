/**
 * Génère docs/map-authoring.md — le format déclaratif `MapSpec` et sa compilation en `Scene`.
 * La part FACTUELLE est DÉRIVÉE par AST de `src/state/mapSpec.ts` : champs de `MapSpec`,
 * `WallSpec`, `CellRecipe`, `EncounterSpec` (nom, type, 1re phrase de JSDoc), formes des unions
 * `BindSpec`/`ReliefSpec`, ordre de compilation lu au JSDoc de tête du module ; les gardes du
 * harnais QC viennent des exports de `src/state/mapQC.ts` ; les exemples vivants sont MESURÉS
 * (quel scénario de `src/scenes/` emploie quel champ). La part ÉDITORIALE (procédure image →
 * grille, pièges, doctrine « une primitive plutôt qu'un bricolage ») vit ICI, en dur.
 *
 * Patron retenu : « éditorial EN DUR dans le générateur » (scripts/docs/build-sources-vf.mjs),
 * avec la lecture AST + JSDoc du socle `scripts/docs/lib/jsdocUnion.mjs` (patron build-effects.mjs).
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-map-authoring.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { listerArbre } from '../guards/lib/lister.mjs'
import ts from 'typescript'
import { loadSource, jsdocRole, findAlias, aliasDoc, indexerConstantes } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import { fileExports } from './lib/engineExports.mjs'

const OUTIL = 'build-map-authoring'
const MAPSPEC = 'src/state/mapSpec.ts'
const MAPQC = 'src/state/mapQC.ts'
const SCENES = 'src/scenes'
/** Où vivent les parents d'interface hérités par `mapSpec.ts` (`WallSpec extends WallOverlay`) et le
 *  schéma zod d'où ces parents tirent leurs champs. */
const SCENE = 'src/state/scene.ts'
const SCENE_SCHEMA = 'src/data/schemas/defs-scenes/scene.ts'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}

if (!existsSync(MAPSPEC)) abandon(`${MAPSPEC} introuvable (déplacé/supprimé ?)`)
const { text: SRC, sf: SF } = loadSource(MAPSPEC)
for (const f of [SCENE, SCENE_SCHEMA]) if (!existsSync(f)) abandon(`${f} introuvable (déplacé/supprimé ?) — les champs HÉRITÉS y sont lus`)
const { sf: SF_SCENE } = loadSource(SCENE)

/** Aplati un fragment de type pour une cellule de table Markdown. */
const plat = (s) => s.replace(/\s+/g, ' ').trim().replaceAll('|', '\\|')

/** Déclaration d'interface nommée d'un fichier parsé, ou undefined. */
function interfaceDe(sf, nom) {
  let decl
  sf.forEachChild((n) => {
    if (ts.isInterfaceDeclaration(n) && n.name.text === nom) decl = n
  })
  return decl
}

/** Membres PROPRES d'une interface (héritage exclu) : nom (+ `?`), type aplati, 1re phrase de JSDoc. */
function membresPropres(sf, src, decl) {
  const rows = []
  let prevEnd = decl.members.pos
  for (const m of decl.members) {
    if (!ts.isPropertySignature(m)) continue
    rows.push({
      nom: m.name.getText(sf) + (m.questionToken ? '?' : ''),
      type: m.type ? plat(m.type.getText(sf)) : '—',
      role: jsdocRole(src.slice(prevEnd, m.getStart(sf))),
    })
    prevEnd = m.getEnd()
  }
  return rows
}

/** Alias de type nommé d'un fichier parsé, ou undefined. */
function aliasDe(sf, nom) {
  let decl
  sf.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === nom) decl = n
  })
  return decl
}

/** Littéraux d'un `const NOM = [...] as const` d'un fichier parsé. */
function clesConst(sf, nom) {
  let cles
  sf.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== nom || !d.initializer) continue
      const e = ts.isAsExpression(d.initializer) ? d.initializer.expression : d.initializer
      if (ts.isArrayLiteralExpression(e)) cles = e.elements.filter(ts.isStringLiteral).map((l) => l.text)
    }
  })
  return cles
}

/** Déballe `X.optional()`, `X.superRefine(…)`… jusqu'à l'appel `z.strictObject`/`z.object`. */
function objetZod(node) {
  if (ts.isCallExpression(node)) {
    const cible = node.expression
    if (ts.isPropertyAccessExpression(cible)) {
      if (/^(strictObject|object|looseObject)$/.test(cible.name.text)) return node
      return objetZod(cible.expression)
    }
  }
  return undefined
}

/** Type TS d'un membre zod PRIMITIF (`z.string()` → `string`) — au-delà, on casse bruyamment
 *  plutôt que d'écrire un type faux dans la doc. */
function typeZod(init, cle, schema) {
  const m = init.getText().match(/^z\.(string|number|boolean)\(\)/)
  if (!m) abandon(`clé héritée « ${cle} » de \`${schema}\` : type zod non primitif — étendre \`typeZod\` dans ${OUTIL}`)
  return m[1]
}

/** Champs d'un `Pick<Cible, clés>` : les clés viennent du tableau `as const` cité (ex.
 *  `WALL_OVERLAY_KEYS`), leurs type et JSDoc du schéma zod dont `Cible` est inférée
 *  (`export type Cible = z.infer<typeof cibleSchema>`) — jamais d'énumération recopiée ici. */
function champsPick(sfScene, alias) {
  const t = alias.type
  if (!ts.isTypeReferenceNode(t) || t.typeName.getText(sfScene) !== 'Pick' || t.typeArguments?.length !== 2) {
    abandon(`parent « ${alias.name.text} » de ${SCENE} : seul \`Pick<Cible, clés>\` est résolu (forme changée ?)`)
  }
  const nomCles = (t.typeArguments[1].getText(sfScene).match(/typeof\s+([A-Za-z0-9_$]+)/) ?? [])[1]
  if (!nomCles) abandon(`parent « ${alias.name.text} » : clés du \`Pick\` non dérivées d'un \`typeof <const>\``)
  const cles = clesConst(sfScene, nomCles)
  if (!cles?.length) abandon(`constante \`${nomCles}\` (clés de « ${alias.name.text} ») illisible dans ${SCENE}`)

  const cible = t.typeArguments[0].getText(sfScene)
  const aliasCible = aliasDe(sfScene, cible)
  const nomSchema = aliasCible && (aliasCible.type.getText(sfScene).match(/z\.infer<\s*typeof\s+([A-Za-z0-9_$]+)\s*>/) ?? [])[1]
  if (!nomSchema) abandon(`« ${cible} » (cible du \`Pick\` de « ${alias.name.text} ») n'est plus un \`z.infer<typeof …Schema>\` dans ${SCENE}`)
  const entree = indexerConstantes([SCENE_SCHEMA]).get(nomSchema)
  if (!entree) abandon(`schéma \`${nomSchema}\` introuvable dans ${SCENE_SCHEMA} (déplacé ?)`)
  const objet = objetZod(entree.decl.initializer)
  if (!objet || !ts.isObjectLiteralExpression(objet.arguments[0])) abandon(`\`${nomSchema}\` : forme d'objet zod illisible`)

  const props = new Map()
  let prevEnd = objet.arguments[0].properties.pos
  for (const p of objet.arguments[0].properties) {
    if (ts.isPropertyAssignment(p) && p.name) {
      props.set(p.name.getText(entree.sf).replace(/^['"]|['"]$/g, ''), {
        init: p.initializer,
        role: jsdocRole(entree.text.slice(prevEnd, p.getStart(entree.sf))),
      })
    }
    prevEnd = p.getEnd()
  }
  return cles.map((cle) => {
    const p = props.get(cle)
    if (!p) abandon(`clé « ${cle} » de \`${nomCles}\` absente de \`${nomSchema}\` (${SCENE_SCHEMA})`)
    const optionnel = /\.optional\(\)/.test(p.init.getText())
    return { nom: cle + (optionnel ? '?' : ''), type: typeZod(p.init, cle, nomSchema), role: p.role }
  })
}

/** Champs HÉRITÉS par `extends` : parent déclaré dans le fichier lu (interface → récursion) ou dans
 *  `src/state/scene.ts` (alias `Pick<…>` → `champsPick`). Chaque ligne dit de QUI elle est héritée. */
function champsHerites(decl) {
  const rows = []
  for (const clause of decl.heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue
    for (const t of clause.types) {
      const parent = t.expression.getText(SF)
      const locale = interfaceDe(SF, parent)
      const herites = locale
        ? champsInterface(parent)
        : champsPick(SF_SCENE, aliasDe(SF_SCENE, parent) ?? abandon(`parent « ${parent} » introuvable dans ${MAPSPEC} ni ${SCENE}`))
      for (const c of herites) rows.push({ ...c, role: `Hérité de \`${parent}\` — ${c.role ?? '—'}` })
    }
  }
  return rows
}

/** Champs d'une interface, HÉRITAGE COMPRIS : nom (+ `?`), type aplati, 1re phrase du JSDoc. */
function champsInterface(nom) {
  const decl = interfaceDe(SF, nom)
  if (!decl) abandon(`interface « ${nom} » introuvable dans ${MAPSPEC} (renommée ?)`)
  const rows = [...membresPropres(SF, SRC, decl), ...champsHerites(decl)]
  if (!rows.length) abandon(`interface « ${nom} » sans propriété lisible`)
  return rows
}

/** Formes d'une union de type : source aplatie + 1re phrase du JSDoc qui la précède. */
function formesUnion(nom) {
  const alias = findAlias(SF, nom, OUTIL, MAPSPEC)
  if (!ts.isUnionTypeNode(alias.type)) abandon(`« ${nom} » n'est plus une union dans ${MAPSPEC}`)
  const rows = []
  let prevEnd = alias.type.pos
  for (const m of alias.type.types) {
    rows.push({ forme: plat(m.getText(SF)), role: jsdocRole(SRC.slice(prevEnd, m.getStart(SF))) })
    prevEnd = m.getEnd()
  }
  return { rows, doc: aliasDoc(SRC, alias, SF) }
}

const MAP_FIELDS = champsInterface('MapSpec')
const WALL_FIELDS = champsInterface('WallSpec')
const CELL_FIELDS = champsInterface('CellRecipe')
const ENC_FIELDS = champsInterface('EncounterSpec')
const BIND = formesUnion('BindSpec')
const RELIEF = formesUnion('ReliefSpec')

// ── Ordre de compilation : le JSDoc de tête du module, cité tel quel ─────────────────────────────

const ORDRE = (() => {
  const m = SRC.match(/ORDRE DE COMPILATION[^\n]*\n([\s\S]*?)\n \*\//)
  if (!m) abandon(`le bloc « ORDRE DE COMPILATION » a disparu du JSDoc de tête de ${MAPSPEC}`)
  return m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trimEnd())
    .filter((l) => l.trim() !== '')
    .join('\n')
})()

const ETAPES = ORDRE.split('\n').filter((l) => /^\s*\d+(bis)?\./.test(l)).length
if (!ETAPES) abandon(`aucune étape numérotée lue dans l'ordre de compilation de ${MAPSPEC}`)

// ── Harnais QC : les exports de mapQC.ts ─────────────────────────────────────────────────────────

if (!existsSync(MAPQC)) abandon(`${MAPQC} introuvable — le harnais QC de carte a bougé`)
const QC = fileExports(MAPQC).filter((e) => e.kind === 'function')
if (!QC.length) abandon(`aucune fonction exportée dans ${MAPQC}`)

// ── Exemples VIVANTS : quel scénario emploie quel champ ──────────────────────────────────────────

const SCENES_SRC = listerArbre(SCENES, { filtre: (rel) => rel.endsWith('.ts') && !rel.includes('.test.') })
  .map((rel) => `${SCENES}/${rel}`)
  .map((f) => ({ f, t: readFileSync(f, 'utf8') }))
  .filter(({ t }) => /\bbuildScene\s*\(|\bMapSpec\b/.test(t))
if (!SCENES_SRC.length) abandon(`aucun document de ${SCENES}/ n'emploie plus \`buildScene\`/\`MapSpec\``)

/** Littéraux `MapSpec` d'un document : l'argument objet de `buildScene(...)`, ou un objet ANNOTÉ
 *  `MapSpec` (déclaration typée, `as`/`satisfies`). Mesurer la clé « en tête de ligne » sur le texte
 *  brut sur-comptait les HOMONYMES des littéraux IMBRIQUÉS (`id`/`label` d'une entité, d'une
 *  rencontre, d'un dialogue…) : une clé ne compte que posée au PREMIER niveau du spec. */
function litterauxMapSpec(fichier) {
  const { sf } = loadSource(fichier)
  const objets = []
  const annote = (n) => n.type && /\bMapSpec\b/.test(n.type.getText(sf))
  const visite = (n) => {
    if (ts.isCallExpression(n) && /(^|\.)buildScene$/.test(n.expression.getText(sf))) {
      const a = n.arguments[0]
      if (a && ts.isObjectLiteralExpression(a)) objets.push(a)
    }
    if ((ts.isAsExpression(n) || ts.isSatisfiesExpression?.(n)) && annote(n) && ts.isObjectLiteralExpression(n.expression)) {
      objets.push(n.expression)
    }
    if (ts.isVariableDeclaration(n) && annote(n) && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      objets.push(n.initializer)
    }
    n.forEachChild(visite)
  }
  sf.forEachChild(visite)
  return objets.map((o) => ({
    cles: o.properties
      .filter((p) => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
      .map((p) => p.name.getText(sf).replace(/^['"]|['"]$/g, '')),
    epandage: o.properties.some((p) => ts.isSpreadAssignment(p)),
  }))
}

const DOCS_MESURES = SCENES_SRC.map(({ f }) => ({ f, specs: litterauxMapSpec(f) })).filter((d) => d.specs.length)
if (!DOCS_MESURES.length) abandon(`aucun littéral \`MapSpec\` lisible par AST dans ${SCENES}/ — le motif a dérivé`)
const DOCS_AVEC_EPANDAGE = DOCS_MESURES.filter((d) => d.specs.some((s) => s.epandage)).map((d) => d.f)

/** Documents qui posent ce champ au PREMIER niveau d'un littéral `MapSpec`. */
function usagesDe(champ) {
  const cle = champ.replace(/\?$/, '')
  return DOCS_MESURES.filter((d) => d.specs.some((s) => s.cles.includes(cle))).map((d) => d.f)
}

const USAGES = MAP_FIELDS.map((c) => ({ champ: c.nom, docs: usagesDe(c.nom) }))
const JAMAIS_VU = USAGES.filter((u) => !u.docs.length).map((u) => u.champ)

// ── Repères d'authoring : concept → scénario étalon (ÉDITORIAL, ancré par existsSync) ─────────────

/** « Pour faire X, regarde Y » : le CONCEPT est éditorial, le chemin est ANCRÉ — un scénario renommé
 *  casse ici plutôt que de laisser la table pointer dans le vide. */
const REPERES = [
  { quoi: 'Cas trivial + `encounters`', ou: ['src/scenes/test-scenarios/bestiaire.ts', 'src/scenes/test-scenarios/magie.ts'] },
  { quoi: 'Relief pur (2 couches, rampes, falaise)', ou: ['src/scenes/test-scenarios/pont-vitrine.ts'] },
  { quoi: 'Multi-niveaux + logique (`triggers`/`dialogues` gatés)', ou: ['src/scenes/test-scenarios/opera.ts'] },
  { quoi: 'Box-drawing multi-étages (`walled`) + relief, grande carte', ou: ['src/scenes/opera/floorplan.ts'] },
  { quoi: 'Siège complet : relief + enceinte/porte brèchable + parapet + `bind`', ou: ['src/scenes/test-scenarios/siege-enceinte.ts'] },
  { quoi: 'Naval (coque/postes/équipage via `AuthoredEnemy`)', ou: ['src/scenes/test-scenarios/combat-naval.ts'] },
  { quoi: 'Murs-en-tuiles + `Condition` (herse)', ou: ['src/scenes/test-scenarios/piege-caveau.ts'] },
  { quoi: 'Multi-scènes + `worldMap`', ou: ['src/scenes/test-scenarios/voyage.ts'] },
  { quoi: 'Zones nommées (`zoneMap`) + harnais d’atteignabilité', ou: ['src/scenes/test-scenarios/zones-pieces.ts', MAPQC] },
]
for (const r of REPERES) {
  for (const p of r.ou) {
    if (!existsSync(p)) abandon(`repère d'authoring « ${r.quoi} » : \`${p}\` introuvable (renommé/supprimé ?) — corriger la table plutôt que la laisser mentir`)
  }
}

// ── Vocabulaire d'authoring cité en clair : ANCRÉ aux catalogues app-owned ────────────────────────

/** Ids cités par la procédure (étape mobilier). Chacun doit exister dans son catalogue — un id
 *  renommé casse ici, jamais dans le `.md`. */
function idsAncres(fichierData, ids) {
  const brut = readFileSync(fichierData, 'utf8')
  for (const id of ids) {
    if (!new RegExp(`"id"\\s*:\\s*"${id}"`).test(brut)) {
      abandon(`\`${id}\` cité par la procédure d'authoring est absent de ${fichierData} (renommé/supprimé ?)`)
    }
  }
  return ids
}
const PROPS_AUBERGE = idsAncres('src/data/props.json', [
  'escalier-bois', 'balustrade-bois', 'enclume', 'foyer-de-forge', 'cuve-brasserie', 'stalle-ecurie',
])
const APPARENCES_AUBERGE = idsAncres('src/data/structureAppearance.json', ['mur-a-ossature-en-bois'])

// ── Constantes de verticalité : DÉRIVÉES de leur module, jamais recopiées ─────────────────────────

function constante(fichier, nom) {
  const m = readFileSync(fichier, 'utf8').match(new RegExp(`\\b${nom}\\s*(?::[^=]+)?=\\s*([\\d.]+)`))
  if (!m) abandon(`constante \`${nom}\` illisible dans ${fichier} (renommée/supprimée ?)`)
  return Number(m[1])
}
const STEP_MAX_M = constante('src/state/relief.ts', 'STEP_MAX_M')
const CELL_WALL_HEIGHT_M = constante(MAPSPEC, 'CELL_WALL_HEIGHT_M')

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, ligne) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(ligne).join('\n')}`

const tableChamps = (rows) =>
  table(rows, ['Champ', 'Type', 'Rôle (JSDoc)'], (c) => `| \`${c.nom}\` | \`${c.type}\` | ${c.role ?? '—'} |`)

const tableFormes = ({ rows, doc }) =>
  `${doc ? `${doc}\n\n` : ''}${table(rows, ['Forme', 'Rôle (JSDoc)'], (r) => `| \`${r.forme}\` | ${r.role ?? '—'} |`)}`

const lignesUsages = USAGES.filter((u) => u.docs.length)
  .map(
    (u) =>
      `| \`${u.champ}\` | ${u.docs.length} | ${u.docs
        .slice(0, 4)
        .map((f) => `\`${f}\``)
        .join(', ')}${u.docs.length > 4 ? ' …' : ''} |`,
  )
  .join('\n')

const REQUIS = MAP_FIELDS.filter((c) => !c.nom.endsWith('?')).map((c) => c.nom)

/** Valeurs d'EXEMPLE des champs requis (ÉDITORIAL) — un champ requis neuf casse ici plutôt que de
 *  laisser le bloc de démarrage devenir incompilable en silence. */
const EXEMPLE = { size: '[16, 10]', id: "'test-x'", label: "'Bac à sable'" }
for (const c of REQUIS) {
  if (!(c in EXEMPLE)) abandon(`champ REQUIS « ${c} » de MapSpec sans valeur d'exemple dans ce script — l'ajouter à EXEMPLE`)
}
const DEMARRAGE = REQUIS.map((c) => `${c}: ${EXEMPLE[c]}`).join(', ')

const out = `# Authoring d'une map : le format \`MapSpec\`

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-map-authoring.mjs\` (\`npm run docs:map-authoring\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUS par AST à \`${MAPSPEC}\` : les ${MAP_FIELDS.length}
champs de \`MapSpec\` (nom, type, 1re phrase de JSDoc), ceux de \`WallSpec\` (${WALL_FIELDS.length}, héritage
\`extends\` SUIVI : un parent hors du fichier est résolu à \`${SCENE}\`, et un parent \`Pick<Cible, clés>\`
tire ses clés du tableau \`as const\` cité et leurs type/JSDoc du schéma zod de \`${SCENE_SCHEMA}\`),
\`CellRecipe\` (${CELL_FIELDS.length}) et \`EncounterSpec\` (${ENC_FIELDS.length}), les
${BIND.rows.length} formes de \`BindSpec\` et les ${RELIEF.rows.length} de \`ReliefSpec\`, et les ${ETAPES}
étapes de l'ordre de compilation citées au JSDoc de tête. Le harnais QC liste les fonctions
exportées de \`${MAPQC}\`. Les exemples vivants sont MESURÉS par AST sur les ${DOCS_MESURES.length}
documents de \`${SCENES}/\` qui exposent un littéral \`MapSpec\` (argument de \`buildScene(...)\` ou objet
annoté \`MapSpec\`), sur ${SCENES_SRC.length} qui emploient \`buildScene\`/\`MapSpec\` (hors \`*.test.ts\`).
**Angles morts** : un champ n'est compté « employé » que posé au PREMIER niveau du littéral — un spec
construit ailleurs (variable non annotée, fabrique) n'est pas mesuré, et une clé posée par épandage
(\`...preset\`${DOCS_AVEC_EPANDAGE.length ? ` — ${DOCS_AVEC_EPANDAGE.length} document${DOCS_AVEC_EPANDAGE.length > 1 ? 's' : ''} concerné${DOCS_AVEC_EPANDAGE.length > 1 ? 's' : ''}` : ''}) échappe à la mesure ; le JSDoc rapporté est la
1re PHRASE seulement (le corps complet vit au fichier) ; la sémantique de compilation (ce que fait
vraiment chaque primitive) n'est pas dérivable — elle est verrouillée par
\`src/state/mapSpec.test.ts\` ; la procédure image → grille et les pièges sont de l'ÉDITORIAL fixé
dans le script.

> **Pour l'IA (et l'humain) : c'est LE seul chemin pour construire une carte.**
> Tu décris une map en objet déclaratif \`MapSpec\` ; \`buildScene(spec)\` la compile en \`Scene\`.

- Type + compilateur : \`${MAPSPEC}\`
- **Spec exécutable** (exemples courts, à jour) : \`src/state/mapSpec.test.ts\` — chaque \`describe\`
  verrouille une section.
- **Exemples VIVANTS** : les tableaux « Où voir quoi » en bas — les repères d'authoring (concept →
  scénario étalon) et la mesure par champ sur \`${SCENES}/\`.

\`buildScene\` est **PUR** et **Node-safe** (zéro import \`ui/\`/\`gameIso/\`) : le générateur d'arène
l'exécute via \`tsx\`. Il ne fait que **rejouer les primitives pures de l'éditeur**
(\`src/state/sceneEdit.ts\`) dans un **ordre figé** — donc tout ce que le format exprime est, par
construction, reproductible à la main dans l'éditeur (règle 2 de \`CLAUDE.md\`). Si un besoin ne
s'exprime pas proprement, on **étend une primitive** (avec un golden), on ne bricole jamais le
scénario.

## Démarrage — le cas trivial est une ligne

Champs REQUIS de \`MapSpec\` : ${REQUIS.map((c) => `\`${c}\``).join(', ')}.

\`\`\`ts
import { buildScene } from '../../state/mapSpec';
const scene = buildScene({ ${DEMARRAGE}, heroStart: [2, 5] });
// → plateau plat 16×10 d'herbe + 1 départ héros.
\`\`\`

## Champs de \`MapSpec\` (${MAP_FIELDS.length})

${tableChamps(MAP_FIELDS)}

## \`bind\` — un marqueur ASCII → une pose

${tableFormes(BIND)}

L'enrôlement d'un marqueur dans une rencontre passe par \`member\` (\`BindMember\`) : l'id d'une entité
posée par \`bind\` est GÉNÉRÉ à la pose, c'est donc le SEUL moyen de l'ajouter au roster.

## \`relief\` — hauteurs métriques (repli bas niveau)

${tableFormes(RELIEF)}

## \`walls\` — murs d'ARÊTE (\`WallSpec\`)

${tableChamps(WALL_FIELDS)}

## \`cells\` — recette par LETTRE de case complète (\`CellRecipe\`)

${tableChamps(CELL_FIELDS)}

## \`encounters\` — \`EncounterSpec\`

${tableChamps(ENC_FIELDS)}

## \`seatAssignments\` — attabler, à ids FIXES seulement

- Les places d'un meuble viennent de son TYPE (\`PropData.seatSlots\` dans \`src/data/props.json\`) ;
  la Scène ne déclare que l'OCCUPATION. \`src/state/seating.ts\` est l'unique couture de résolution.
- Un occupant du GROUPE est un **EMPLACEMENT**, pas un personnage : \`{ kind: 'party', rang }\` avec
  \`1 ≤ rang ≤ PARTY_MAX\` (\`src/state/combatants.ts\`). Un document ne peut pas nommer un héros que
  le joueur créera plus tard ; le runtime résout \`party[rang - 1]\`. Un rang hors borne est une
  ERREUR de document ; un rang que le groupe courant n'atteint pas s'élague au chargement.
- \`buildScene\` **refuse** un \`propId\`/\`entityId\` que \`entities\` ne nomme pas littéralement : un id
  posé par \`bind\` est généré et change dès qu'un marqueur bouge. Pour attabler un PNJ, déclare le
  meuble ET le corps dans \`entities\`.
- La \`pos\` d'un PNJ attablé **est** la case d'abord résolue de sa place, et cet abord doit être
  PRATICABLE. Le prédicat est unique (\`seatIsOccupiable\`, \`src/state/seating.ts\`) : ce que le geste
  refuse, \`validateScene\` et \`buildScene\` le refusent aussi.
- À la souris, ce champ s'authore dans l'inspecteur de l'éditeur
  (\`src/ui/editor/SeatAssignmentsField.tsx\`). Toute mutation d'entité traverse le SEAM UNIQUE
  \`normaliseAssises\` (\`src/state/sceneEdit.ts\`). Garde : \`src/ui/editor/seam-assise-guard.test.ts\`.

## Ordre de compilation (${ETAPES} étapes, cité au JSDoc de tête de \`${MAPSPEC}\`)

\`\`\`
${ORDRE}
\`\`\`

## Pièges

- **Deux modèles de mur** : une tuile \`'mur'\` (terrain, via \`legend\`) = bloc PLEIN opaque ; un
  \`WallSeg\` d'**arête** (\`walls\`, \`walled\` + \`wallLegend\`) = cloison fine qui peut porter \`door\`,
  \`structure\` (brèchable) et/ou \`appearance\` (look seul, sans PV). Choisis exprès. Portes &
  structures ⇒ arêtes.
- **Marqueurs** : les chars de \`bind\` sont scannés PUIS nettoyés avant le parse terrain. Sur un
  terrain non-base (chemin de ronde), utilise \`markerFill\` pour ne pas laisser un trou \`'vide'\`.
- **Verticalité** = \`relief\` (mètres). La connexité verticale reste TOUJOURS DÉRIVÉE des hauteurs,
  par \`surfaceLink\` (\`src/state/relief.ts\`) : un dénivelé ≤ ${STEP_MAX_M} m entre voisines est une RAMPE
  franchissable, au-delà c'est une FALAISE. Une lettre \`cells.wall\`/\`cells.gate\` auto-pose sa zone
  rempart en z+1 sur ${CELL_WALL_HEIGHT_M} m par défaut (\`CELL_WALL_HEIGHT_M\`, \`${MAPSPEC}\`) — le z0 devient
  MASSE DE MUR, le rendu falaise + merlons suit tout seul —
  aucun escalier au pathfinding. Un ESCALIER se déclare via \`cells.stair\` ; la volée doit être une
  file LINÉAIRE (jamais ramifiée/cyclique) et ses cages servent d'ANCRES de recalage inter-étages :
  \`buildScene\` échoue si les grilles sont décalées.
- **Diagonales** : un pan oblique (\`WallSpec.side\` en anti-slash ou slash) est un HABILLAGE visuel,
  jamais une séparation — le mouvement, la
  vision et la grimpe restent orthogonaux, et un pan qui n'adosse aucun coin orthogonalement muré
  fait échouer \`buildScene\`.
- **Logique** (\`triggers\`/\`dialogues\`, \`encounters.onVictory\`) : recopie les \`Flow\`/\`Condition\`
  TELS QUELS, ne les réécris pas.

## Procédure image → grille (plan de livre → carte fidèle et jouable)

> **Répétable et vérifiée** : n'importe quel agent, sur n'importe quel plan de livre, produit une
> scène fidèle SANS combat artisanal. Chaque étape est VALIDABLE avant la suivante — le STRUCTUREL
> d'abord, le mobilier en DERNIER.

0. **Intrant source** : le plan illustré (folio du PDF VF). Extraire l'image de travail localement
   (gitignorée) SEULEMENT pour le jugement vision initial ; les attendus de comparaison
   (dimensions, comptes d'ouvertures par façade, murs témoins, zones) se **committent dans les
   tests de la scène** — la QC rejouable ne dépend JAMAIS d'un fichier hors git.
1. **Échelle** : convention par défaut **une porte = 1 case** (dérogable par plan, à documenter).
   \`metresPerTile\` s'en déduit.
2. **Dimensions communes** : tous les étages partagent le \`size\` du \`MapSpec\`.
3. **Enveloppe + cloisons** sans mobilier, en \`walled\` box-drawing. Obliques ORTHOGONALISÉES en
   escalier de cases.
4. **Ouvertures** : portes et fenêtres — comptées depuis le plan (le compte par façade est un
   attendu de test).
5. **Recalage z0↔z1 par ANCRES** : les cages d'escalier (\`cells.stair\`) et l'enveloppe commune. La
   compilation ÉCHOUE si les grilles sont décalées — le recalage est vérifié par construction.
   Un mur se déclare **par COUCHE** : un pas ne voit que l'arête de la couche la plus HAUTE qu'il engage
   (\`Math.max(z, nz)\`, \`src/state/path.ts\`, « un mur n'arrête le pas qu'à la HAUTEUR où on le franchit »).
   Une cloison qui monte jusqu'à l'étage se pose donc dans les DEUX grilles \`walled\` : déclarée au seul
   rez, elle passe sous les pieds et devient franchissable au niveau du plancher supérieur.
6. **Vides & hauteurs** : trémies/balcons ; la validation de trémie d'une volée couvre les surfaces
   fantômes.
7. **Zones nommées** : le calque \`zoneMap\` + \`zoneLegend\` recopie la légende du plan. Un char = une
   pièce. Le calque se **DÉRIVE du bâti** (\`zonesFromSeeds\`, \`src/state/asciiMap.ts\`) : une GRAINE par
   pièce — plusieurs quand une porte interne la coupe —, dont le remplissage 4-connexe s'arrête à toute
   arête murale (mur, porte, fenêtre, structure) et à toute case que le pas ne foule pas ; un calque
   écrit à la main se met à mentir dès qu'on bouge un mur. \`clip\` borne une aire OUVERTE que le plan
   partage entre n pièces sans trait entre elles : c'est un arbitrage MAISON, révisable, à motiver au
   site qui le déclare.
8. **Mobilier par marqueurs** (\`bind\`) — en DERNIER, jamais avant validation structurelle.
   Vocabulaire d'auberge déjà catalogué (\`src/data/props.json\`) : ${PROPS_AUBERGE.map((p) => `\`${p}\``).join(', ')} ;
   murs à colombage via l'apparence ${APPARENCES_AUBERGE.map((a) => `\`${a}\``).join(', ')}
   (\`src/data/structureAppearance.json\`).
9. **Recette** — le harnais ci-dessous.

## Harnais QC de carte (réfute, ne certifie jamais)

Le harnais transforme les critères flous (« chaque pièce accessible », « passage réel z0↔z1 ») en
assertions MÉCANIQUES générales, réutilisables par le test de N'IMPORTE QUELLE scène compilée.
Fonctions de \`${MAPQC}\` (démontrées par \`src/state/mapQC.test.ts\`) :

${table(QC, ['Fonction', 'Site', 'Rôle (JSDoc)'], (e) => `| \`${e.name}\` | \`${MAPQC}:${e.line}\` | ${e.role ?? '—'} |`)}

**Jugement visuel** : capture de jeu (patron \`scripts/qc/capture-jeu.mjs\`) → planche par étage,
4 rotations, plan source en regard ; juges VISION en RÉFUTATION (pièces manquantes ou déformées,
ouvertures déplacées, proportions) — jamais une auto-certification du codeur.

## Où voir quoi — repères d'authoring

Le CONCEPT est éditorial, le chemin est ANCRÉ (un scénario renommé fait échouer la génération) :

${table(REPERES, ['Pour…', 'Regarde'], (r) => `| ${r.quoi} | ${r.ou.map((p) => `\`${p}\``).join(', ')} |`)}

## Où voir quoi — par CHAMP (mesuré)

Sur les ${DOCS_MESURES.length} documents de \`${SCENES}/\` qui exposent un littéral \`MapSpec\` :

| Champ | Documents | Exemples |
|---|---|---|
${lignesUsages}

${
  JAMAIS_VU.length
    ? `Champs sans aucun exemple mesuré dans \`${SCENES}/\` : ${JAMAIS_VU.map((c) => `\`${c}\``).join(', ')} — leur seule démonstration vit dans \`src/state/mapSpec.test.ts\`.`
    : `Tous les champs de \`MapSpec\` ont au moins un exemple vivant dans \`${SCENES}/\`.`
}
`

ecrireOuVerifier({
  out,
  path: 'docs/map-authoring.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:map-authoring — docs/map-authoring.md est PÉRIMÉ (diverge de src/state/mapSpec.ts, src/state/mapQC.ts, des scénarios de src/scenes/, ou du script).',
  rerunMsg: '  → relancer `npm run docs:map-authoring` et committer le résultat.',
  okMsg: 'docs:map-authoring — OK (docs/map-authoring.md à jour)',
  writeMsg: `docs/map-authoring.md — ${MAP_FIELDS.length} champs de MapSpec, ${ETAPES} étapes de compilation, ${DOCS_MESURES.length} documents mesurés.`,
})
