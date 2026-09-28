/**
 * Génère docs/ajouter-une-donnee.md — le DÉROULÉ d'ajout/curation d'une entrée de `src/data/*.json`
 * (la CARTE de où-vit-quoi reste `docs/donnees.md`, généré à part : ce doc y RENVOIE, il ne la
 * duplique pas).
 *
 * Part FACTUELLE, mesurée à chaque génération :
 *  - le ROUTAGE vers un skill de domaine : les skills existent sur disque et leur `description`
 *    est lue au frontmatter de leur `SKILL.md` (jamais recopiée) ;
 *  - l'ENVELOPPE commune de tout document (clés + libellés FR) : lue par AST dans
 *    `src/data/schemas/grammaire/document.ts` (`CLES_ENVELOPPE`, `LIBELLES_ENVELOPPE`,
 *    `FamilleDocument`) — le manuscrit n'en parlait pas du tout ;
 *  - le nom RÉEL du champ d'abréviation de `src/data/books.json` (mesuré sur la donnée) ;
 *  - les GARDES : chemin ancré + intitulé de leur `describe(...)`, lu au fichier.
 * La part ÉDITORIALE (check-first, zéro invention, ordre des étapes) vit ICI, en dur — patron
 * « éditorial EN DUR dans le générateur » de `scripts/docs/build-sources-vf.mjs`.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-ajouter-donnee.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import ts from 'typescript'
import { loadSource } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

const OUTIL = 'build-ajouter-donnee'
const DOC = 'src/data/schemas/grammaire/document.ts'
const DATA = 'src/data'
const SKILLS = '.claude/skills'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}

const ancre = (p, quoi) => {
  if (!existsSync(p)) abandon(`${quoi} : \`${p}\` introuvable (renommé/supprimé ?) — corriger la table plutôt que la laisser mentir`)
  return p
}

// ── Datasets et livres : mesure directe ──────────────────────────────────────────────────────────

const DATASETS = listerDossier(DATA).filter((f) => f.endsWith('.json'))
if (!DATASETS.length) abandon(`aucun \`${DATA}/*.json\` — la racine de la donnée app-owned a bougé`)

const BOOKS = JSON.parse(readFileSync(`${DATA}/books.json`, 'utf8'))
if (!Array.isArray(BOOKS) || !BOOKS.length) abandon(`${DATA}/books.json n'est plus une liste non vide`)

/** Nom RÉEL du champ d'abréviation de livre — MESURÉ, jamais supposé : le manuscrit citait `abr`
 *  quand la donnée porte `abbr`, et un agent qui recopiait la doc écrivait une clé morte. */
const CLE_ABBR = ['abbr', 'abr', 'abrev'].find((k) => BOOKS.every((b) => typeof b[k] === 'string' && b[k].length))
if (!CLE_ABBR) abandon(`aucune clé d'abréviation présente sur les ${BOOKS.length} entrées de books.json (abbr/abr/abrev)`)
const ABBRS = BOOKS.map((b) => b[CLE_ABBR])
const ABBR_VF = BOOKS.filter((b) => b.language === 'VF').map((b) => b[CLE_ABBR])

// ── L'ENVELOPPE de tout document : lue par AST à la fabrique ─────────────────────────────────────

const { text: DOC_SRC, sf: DOC_SF } = loadSource(ancre(DOC, 'fabrique de document'))

/** Membres d'un `as const` de littéraux de chaîne (`CLES_ENVELOPPE`). */
function listeConst(nom) {
  let out
  DOC_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== nom) continue
      let init = d.initializer
      if (init && ts.isAsExpression(init)) init = init.expression
      if (init && ts.isArrayLiteralExpression(init)) out = init.elements.filter(ts.isStringLiteral).map((e) => e.text)
    }
  })
  if (!out?.length) abandon(`\`${nom}\` illisible dans ${DOC} (renommé, ou n'est plus une liste de littéraux)`)
  return out
}

/** Paires `cle: 'valeur'` d'un `Record` constant (`LIBELLES_ENVELOPPE`). */
function recordConst(nom) {
  let out
  DOC_SF.forEachChild((n) => {
    if (!ts.isVariableStatement(n)) return
    for (const d of n.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.name.text !== nom) continue
      const init = d.initializer
      if (init && ts.isObjectLiteralExpression(init)) {
        out = new Map(
          init.properties
            .filter((p) => ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer))
            .map((p) => [p.name.getText(DOC_SF).replace(/^['"]|['"]$/g, ''), p.initializer.text]),
        )
      }
    }
  })
  if (!out?.size) abandon(`\`${nom}\` illisible dans ${DOC} (renommé, ou n'est plus un objet de littéraux)`)
  return out
}

/** Membres d'une union d'alias de type (`FamilleDocument`), avec le JSDoc de l'alias. */
function unionAlias(nom) {
  let alias
  DOC_SF.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === nom) alias = n
  })
  if (!alias || !ts.isUnionTypeNode(alias.type)) abandon(`\`${nom}\` n'est plus une union nommée dans ${DOC}`)
  return alias.type.types
    .filter((t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal))
    .map((t) => t.literal.text)
}

const CLES_ENVELOPPE = listeConst('CLES_ENVELOPPE')
const LIBELLES = recordConst('LIBELLES_ENVELOPPE')
const FAMILLES = unionAlias('FamilleDocument')
const manquants = CLES_ENVELOPPE.filter((k) => !LIBELLES.has(k))
if (manquants.length) abandon(`clés d'enveloppe sans libellé FR dans ${DOC} : ${manquants.join(', ')}`)

/** Clés que la fabrique pose OPTIONNELLES et qu'un document peut EXIGER (`options.exiges`). */
const NON_EXIGIBLES = (() => {
  const m = DOC_SRC.match(/const NON_EXIGIBLES = \[([^\]]*)\]/)
  if (!m) abandon(`\`NON_EXIGIBLES\` illisible dans ${DOC}`)
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
})()
const EXIGIBLES = CLES_ENVELOPPE.filter((k) => !NON_EXIGIBLES.includes(k))

/** La PROVENANCE est un invariant de la fabrique (`source` ∨ `maison`) : sa présence est MESURÉE
 *  dans le corps de `document()` plutôt qu'affirmée — si le refine disparaît, la phrase tombe. */
if (!/entrée sans .{1,2}source.{1,2} — un document sans folio porte .{1,2}maison.{1,2}/.test(DOC_SRC)) {
  abandon(`le refine de PROVENANCE (\`source\` ∨ \`maison\`) n'est plus lisible dans ${DOC} — la règle a bougé`)
}

// ── Routage vers un skill de domaine : ANCRÉ + description LUE au frontmatter ─────────────────────

/** `description:` du frontmatter YAML d'un `SKILL.md` (1re phrase, le reste vit au skill). */
function descriptionSkill(nom) {
  const p = ancre(`${SKILLS}/${nom}/SKILL.md`, `skill « ${nom} »`)
  const tete = readFileSync(p, 'utf8').split('\n').slice(0, 12).join('\n')
  const m = tete.match(/^description:\s*(.+)$/m)
  if (!m) abandon(`le \`SKILL.md\` de « ${nom} » n'expose plus de \`description:\` en frontmatter`)
  const phrase = m[1].trim()
  const point = phrase.search(/\.(\s|$)/)
  return (point > 0 ? phrase.slice(0, point + 1) : phrase).replace(/\|/g, '\\|')
}

/** Domaines qui SORTENT de ce déroulé générique — le CONCEPT est éditorial, le skill et le dataset
 *  sont ANCRÉS (un renommage casse ici, jamais dans le `.md`). */
const ROUTAGE = [
  { quoi: 'un **sort**, une Prière, une Bénédiction, un Miracle', skill: 'ajouter-un-sort', data: ['src/data/spells.json'] },
  { quoi: 'une **créature**, un PNJ, une race/tenue', skill: 'creer-une-creature', data: ['src/data/creatures.json', 'src/data/species.json'] },
  { quoi: "l'**effet mécanique** d'un trait/talent/qualité/mutation/maladie/atout", skill: 'ajouter-une-mecanique', data: ['src/data/traits.json', 'src/data/talents.json', 'src/data/qualities.json'] },
  { quoi: 'une **icône** d’affordance', skill: 'ajouter-une-icone', data: ['src/ui/icons/_registry.generated.ts'] },
  { quoi: 'un **livre source** entier', skill: 'ajouter-un-livre-source', data: ['src/data/books.json'] },
]
for (const r of ROUTAGE) for (const d of r.data) ancre(d, `routage « ${r.skill} »`)
const ROUTAGE_MESURE = ROUTAGE.map((r) => ({ ...r, desc: descriptionSkill(r.skill) }))

// ── Gardes : chemin ancré + intitulé RÉEL de leur `describe(...)` ─────────────────────────────────

/** 1er intitulé de `describe(...)` d'un fichier de test — ce que la garde DIT d'elle-même. */
function intituleGarde(p) {
  const m = readFileSync(ancre(p, 'garde'), 'utf8').match(/describe\(\s*(['"`])([\s\S]*?)\1/)
  if (!m) abandon(`\`${p}\` n'expose plus de \`describe('…')\` en tête — l'intitulé de la garde est illisible`)
  return m[2].replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|')
}

const GARDES = [
  'src/data/serialize.test.ts',
  'src/data/no-html-in-prose.test.ts',
  'src/data/id-collisions.test.ts',
  'src/data/data-atlas-complete.test.ts',
  'src/data/maison-sans-source.test.ts',
  'src/data/data-wellformed.test.ts',
].map((p) => ancre(p, 'garde citée par le doc — corriger la liste plutôt que la laisser mentir'))
const GARDES_MESUREES = GARDES.map((p) => ({ p, quoi: intituleGarde(p) }))

const HOOK = ancre('scripts/hooks/data-edit-guard.mjs', 'hook de check-first')
const SERIALIZE = ancre('src/data/serialize.ts', 'canonicalisation')
if (!/export function serializeDataset/.test(readFileSync(SERIALIZE, 'utf8'))) {
  abandon(`\`serializeDataset\` n'est plus exportée par ${SERIALIZE}`)
}

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const table = (rows, entete, ligne) => `| ${entete.join(' | ')} |\n|${entete.map(() => '---').join('|')}|\n${rows.map(ligne).join('\n')}`

const out = `# Ajouter / curer une donnée dans \`src/data/*.json\`

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-ajouter-donnee.mjs\` (\`npm run docs:ajouter-donnee\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont MESURÉS à chaque génération : les ${DATASETS.length} fichiers
de \`${DATA}/*.json\`, les ${BOOKS.length} entrées de \`src/data/books.json\` (dont ${ABBR_VF.length} en VF) et le nom
RÉEL de leur clé d'abréviation (\`${CLE_ABBR}\`), les ${CLES_ENVELOPPE.length} clés d'ENVELOPPE et leurs libellés FR
lus par AST dans \`${DOC}\`, les ${FAMILLES.length} familles de document, les ${ROUTAGE_MESURE.length} skills de domaine (existence
sur disque + \`description\` lue au frontmatter de leur \`SKILL.md\`) et les ${GARDES_MESUREES.length} gardes (chemin
ancré + intitulé de leur \`describe(...)\`, lu au fichier). **Angles morts** : ce doc est le DÉROULÉ,
pas la CARTE — quel concept vit dans quel fichier, les conventions de champ et les pièges d'homonymes
restent dans \`docs/donnees.md\` (généré à part), et la FORME de chaque graphie dans
\`docs/structures-donnees.md\` ; l'ordre des étapes, le check-first et la doctrine « zéro invention »
sont de l'ÉDITORIAL fixé dans le script ; la description d'un skill est tronquée à sa 1re phrase (le
reste vit au skill) ; aucun contrôle ici que la donnée ajoutée est FIDÈLE à sa source — c'est le rôle
du Source et de la revue, pas d'un générateur.

Guide de la donnée app-owned « générique » (trapping, qualité, carrière, structure, machine de guerre,
trait naval, activité, critique, lieu…). La **carte** de où-vit-quoi et les conventions de champs vivent
dans \`docs/donnees.md\` ; ce guide est le **déroulé**. Motivé par l'incident #148 (doublon + mauvaise
lecture de source par un agent).

## 0. D'abord : router vers le skill de domaine

Si ton ajout tombe dans une de ces familles, **STOP** — le skill dédié couvre le rig / les canaux
d'effet / la résolution que ce guide générique ne connaît pas.

${table(ROUTAGE_MESURE, ['Tu ajoutes…', 'Skill', 'Donnée', 'Ce que le skill dit de lui-même'], (r) => `| ${r.quoi} | \`${r.skill}\` | ${r.data.map((d) => `\`${d}\``).join(', ')} | ${r.desc} |`)}

Sinon (le RESTE de \`${DATA}\`, soit ${DATASETS.length} fichiers), suis le déroulé ci-dessous.

## 1. CHECK-FIRST (anti-doublon) — non négociable

\`\`\`
grep -rniE '<id-candidat>|<label>|<concept>' ${DATA}/*.json
\`\`\`

Le concept vit peut-être **déjà** dans un autre sous-système (#148 : le Bélier était dans 6 fichiers).
S'il existe → **ne duplique pas** : étends-le là où il vit, ou re-scope la tâche. Carte et pièges
d'homonymes : \`docs/donnees.md\`. Le hook \`${HOOK}\` rappelle ce check à chaque
écriture d'un \`${DATA}/*.json\` (il atteint aussi les sous-agents, où les skills ne se déclenchent pas).

## 2. Choisir le fichier — et sa FAMILLE

Via la carte \`docs/donnees.md\`. **Règle d'or** : une « machine de guerre / véhicule / navire » n'est
PAS un \`trappings\`. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats — leur forme
fait foi, et elle est déclarée : chaque document appartient à l'une des ${FAMILLES.length} familles de
\`${DOC}\` (${FAMILLES.map((f) => `\`${f}\``).join(' · ')}), qui décide de l'emballage du
FICHIER (liste d'entrées, entrée seule, ou enveloppe + \`entries\`).

## 3. Vérifier la source RAW

Ouvrir le \`Source/…\` (FR, plus le Core Rulebook 5e — \`CLAUDE.md\` § *Sources VF*), lire le
**tableau ET son en-tête** (l'erreur #148 = la colonne « Équipe » lue comme « Encombrement »).
Citer \`<LIVRE> <chap> l.<ligne>\` dans le message de commit / l'issue. ⚠ Le n° de ligne a dérivé
(ré-extraction Marker) ET les ancres \`<span id="page-N">\` sont **non fiables** : n'en déduis jamais une \`source.page\`.

Le champ \`book\` d'une entrée porte l'**\`${CLE_ABBR}\`** de \`src/data/books.json\` — ${BOOKS.length} livres
enregistrés, dont ${ABBR_VF.length} en VF : ${ABBR_VF.map((a) => `\`${a}\``).join(', ')}.
${ABBRS.length > ABBR_VF.length ? `Les ${ABBRS.length - ABBR_VF.length} autres entrées sont en VO : seul le livre VO nommé au \`CLAUDE.md\` § *Sources VF* est citable.\n` : ''}
## 4. L'ENVELOPPE est posée par la fabrique — ne la redéclare jamais

Tout document passe par \`document(...)\` (\`${DOC}\`), qui pose SEULE les
${CLES_ENVELOPPE.length} clés d'enveloppe ci-dessous : les redéclarer dans les champs du def est une erreur de
compilation ET d'exécution. Leur libellé FR appartient donc lui aussi à la fabrique.

${table(
  CLES_ENVELOPPE.map((k) => ({ k, l: LIBELLES.get(k), ex: EXIGIBLES.includes(k) })),
  ['Clé', 'Libellé FR', 'Un document peut-il l’EXIGER ?'],
  (r) => `| \`${r.k}\` | ${r.l} | ${r.ex ? 'oui (`options.exiges`)' : '—'} |`,
)}

**LIBELLÉS** : le nom FR d'un CHAMP vit dans la \`meta\` du def ; le nom FR d'une **valeur d'enum
affichée se pose par \`enumNomme\`** (\`src/data/schemas/grammaire/valeurs.ts\`), qui porte la table
\`{ option: 'Libellé FR' }\` SUR LE NŒUD — jamais un Record de libellés côté UI (ce serait une seconde
vérité, et l'atelier ne saurait pas la lire en profondeur).

**PROVENANCE** : une entrée porte \`source\` **ou** \`maison\` (la raison de l'arbitrage en clair),
jamais ni l'un ni l'autre — le refus est posé par la fabrique elle-même, pas par une garde
secondaire. Une entrée sans folio n'est pas interdite : elle doit DIRE pourquoi.

## 5. Chaque champ = Source ⊕ convention voisine

Conventions complètes : \`docs/donnees.md\` ; formes observées champ par champ :
\`docs/structures-donnees.md\`. En bref : \`desc\` = **verbatim** Markdown (règle 5 de \`CLAUDE.md\`,
garde \`no-html-in-prose\`) ; les formes de champ se copient des voisins ; la logique est keyée par
**id stable**, \`label\` = affichage.

## 6. Zéro invention, zéro inflexion RAW

Un champ introuvable au Source → omission assumée (pas une valeur inventée). Une **mécanique RAW que le
moteur ne modélise pas** → ce n'est pas « hors scope » : c'est une dette → **issue** (ou une valeur
\`maison\` taguée si le RAW laissait le choix au MJ — house-rule ≠ lacune, règle 7 de \`CLAUDE.md\`).
JAMAIS un choix d'agent silencieux enterré. Avant de conclure « le moteur ne sait pas faire X » :
\`docs/vocabulaire-mecanique.md\` (les ops et Conditions qui EXISTENT) et \`docs/index-moteur.md\`
(les coutures qui existent).

## 7. Canonicaliser + gardes

- Canonicaliser via \`serializeDataset\` (\`${SERIALIZE}\`) — jamais un reformatage manuel ni un
  \`JSON.stringify\` maison (le round-trip est byte-exact).
- \`npm test\` + \`npm run typecheck\` verts.
- Si l'élément est visible au Codex/éditeur → **recette navigateur** (\`docs/recette-navigateur.md\`).

${table(GARDES_MESUREES, ['Garde', 'Ce qu’elle verrouille (son propre `describe`)'], (g) => `| \`${g.p}\` | ${g.quoi} |`)}
`

ecrireOuVerifier({
  out,
  path: 'docs/ajouter-une-donnee.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:ajouter-donnee — docs/ajouter-une-donnee.md est PÉRIMÉ (diverge de src/data/, de la fabrique de document, des skills, des gardes, ou du script).',
  rerunMsg: '  → relancer `npm run docs:ajouter-donnee` et committer le résultat.',
  okMsg: 'docs:ajouter-donnee — OK (docs/ajouter-une-donnee.md à jour)',
  writeMsg: `docs/ajouter-une-donnee.md — ${DATASETS.length} datasets, ${BOOKS.length} livres (clé « ${CLE_ABBR} »), ${CLES_ENVELOPPE.length} clés d'enveloppe, ${GARDES_MESUREES.length} gardes.`,
})
