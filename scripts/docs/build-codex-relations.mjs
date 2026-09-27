/**
 * Génère docs/codex-relations.md — la couche RELATIONNELLE du Codex (références inverses, index,
 * auto-liage) et l'origine DÉCLARÉE de ses entrées.
 * La part FACTUELLE est DÉRIVÉE : arêtes inverses lues aux appels `addReverse(...)` de
 * `src/ui/compendium/relations.ts`, API publique du module (AST + JSDoc, via
 * `scripts/docs/lib/engineExports.mjs`), catégories/groupes/sous-groupes lus au littéral
 * `CODEX_SPECS` de `src/ui/compendium/registry.ts`, et exposition DÉCLARÉE aux defs, dumpée par
 * `scripts/docs/lib/dump-exposition.mts` (`npx tsx` — un générateur Node nu ne peut pas importer
 * `src/data/schemas/_registry.generated.ts`). La part ÉDITORIALE (les deux principes, comment
 * étendre) vit ICI, en dur.
 *
 * Patron retenu : « éditorial EN DUR dans le générateur » (scripts/docs/build-sources-vf.mjs),
 * avec la passerelle TS de `scripts/docs/build-donnees.mjs` pour l'exposition.
 *
 * Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
 * exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
 *
 *   node scripts/docs/build-codex-relations.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { sortieOutilLocal } from '../lancer-local.mjs'
import ts from 'typescript'
import { emitOrCheck, loadSource, jsdocBody } from './lib/jsdocUnion.mjs'
import { fileExports } from './lib/engineExports.mjs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'

const OUTIL = 'build-codex-relations'
const RELATIONS = 'src/ui/compendium/relations.ts'
const REGISTRY = 'src/ui/compendium/registry.ts'
const DESCRIBE = 'src/ui/compendium/describe.ts'
const HUMANIZE = 'src/ui/compendium/humanize.ts'
const CONTRATS = 'src/data/schemas/exposition-contrats.test.ts'

function abandon(msg) {
  console.error(`${OUTIL} — ${msg}`)
  process.exit(1)
}

function lire(p) {
  if (!existsSync(p)) abandon(`fichier « ${p} » introuvable (déplacé/supprimé ?)`)
  return readFileSync(p, 'utf8')
}

// ── Exposition DÉCLARÉE aux defs (#1472) ─────────────────────────────────────────────────────────

const EXPOSITION = JSON.parse(
  sortieOutilLocal(process.cwd(), 'tsx', 'tsx', ['scripts/docs/lib/dump-exposition.mts']),
)

/** Route d'édition d'un def, dans le vocabulaire de `document()` — jamais un libellé inventé. */
function routeEdition(edit) {
  if (!edit) return '—'
  if ('none' in edit) return 'aucune'
  if (edit.dataset) return `dataset \`${edit.dataset}\``
  if (edit.object) return `objet \`${edit.object}\``
  if (edit.niche) return `niché (${Object.keys(edit.niche.categories).length} catégorie(s))`
  abandon(`route d'édition inconnue : ${JSON.stringify(edit)}`)
}

const PAR_CATEGORIE = new Map()
const EXEMPTIONS = new Map()
for (const [fichier, expo] of Object.entries(EXPOSITION)) {
  if (expo.codex?.exempt) {
    const kind = expo.codex.exempt.kind
    if (!EXEMPTIONS.has(kind)) EXEMPTIONS.set(kind, [])
    EXEMPTIONS.get(kind).push(fichier)
    continue
  }
  for (const cle of expo.codex?.keys ?? []) {
    if (PAR_CATEGORIE.has(cle)) {
      PAR_CATEGORIE.get(cle).fichiers.push(fichier)
    } else {
      PAR_CATEGORIE.set(cle, { fichiers: [fichier], route: routeEdition(expo.edit) })
    }
  }
}
if (!PAR_CATEGORIE.size) abandon("aucune clé de catégorie Codex déclarée par les defs — l'exposition est illisible")

const NB_DEFS = Object.keys(EXPOSITION).length
const NB_EXEMPTS = [...EXEMPTIONS.values()].reduce((n, l) => n + l.length, 0)

// ── Catégories, groupes et sous-groupes : le littéral CODEX_SPECS ────────────────────────────────

const REGISTRY_SRC = lire(REGISTRY)
const DEBUT_SPECS = REGISTRY_SRC.indexOf('const CODEX_SPECS')
const FIN_SPECS = REGISTRY_SRC.indexOf('export const CODEX:')
if (DEBUT_SPECS === -1 || FIN_SPECS === -1 || FIN_SPECS < DEBUT_SPECS) {
  abandon(`le littéral \`CODEX_SPECS\` et sa projection \`CODEX\` sont introuvables dans ${REGISTRY}`)
}
const SPECS_SRC = REGISTRY_SRC.slice(DEBUT_SPECS, FIN_SPECS)

const SPECS = [...SPECS_SRC.matchAll(/\bkey: '([A-Za-z0-9_]+)'/g)].map((m, i, tous) => {
  const fin = i + 1 < tous.length ? tous[i + 1].index : SPECS_SRC.length
  const fenetre = SPECS_SRC.slice(m.index, fin)
  return {
    key: m[1],
    label: (fenetre.match(/label: '([^']*)'/) ?? [])[1] ?? m[1],
    group: (fenetre.match(/group: '([^']*)'/) ?? [])[1] ?? null,
    cluster: (fenetre.match(/cluster: '([^']*)'/) ?? [])[1] ?? null,
  }
})
if (!SPECS.length) abandon(`aucune catégorie lue dans \`CODEX_SPECS\` (${REGISTRY}) — le motif a dérivé`)

const GROUPES = (() => {
  const m = REGISTRY_SRC.match(/export const CODEX_GROUPS: CodexGroup\[\] = \[([^\]]+)\]/)
  if (!m) abandon(`\`CODEX_GROUPS\` introuvable dans ${REGISTRY}`)
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
})()

const CLUSTERS = GROUPES.map((g) => {
  const dedans = SPECS.filter((s) => s.group === g)
  const parCluster = new Map()
  for (const s of dedans.filter((x) => x.cluster)) {
    if (!parCluster.has(s.cluster)) parCluster.set(s.cluster, [])
    parCluster.get(s.cluster).push(s)
  }
  return { groupe: g, total: dedans.length, plat: dedans.filter((x) => !x.cluster).length, parCluster }
})

// ── Arêtes inverses : les appels `addReverse` du module ──────────────────────────────────────────

const RELATIONS_SRC = lire(RELATIONS)
const LIGNES = RELATIONS_SRC.split('\n')

/** Catégorie du référant en portée à la ligne `i` : le dernier `const by: Referrer = { category: … }`. */
function referantAvant(i) {
  for (let j = i; j >= 0; j -= 1) {
    const m = LIGNES[j].match(/const by(?:: Referrer)? = \{ category: '([^']+)'/)
    if (m) return m[1]
  }
  return null
}

const ARETES = []
for (let i = 0; i < LIGNES.length; i += 1) {
  const appel = LIGNES[i].match(/addReverse\('([^']+)',\s*([^,]+),\s*([\s\S]*)$/)
  if (!appel) continue
  const cible = appel[1]
  const reste = appel[3]
  const inline = reste.match(/\{\s*(?:\.\.\.by,\s*)?category: '([^']+)'/)
  const source = inline ? inline[1] : referantAvant(i)
  if (!source) abandon(`appel addReverse ligne ${i + 1} de ${RELATIONS} : catégorie du référant indéterminable`)
  const litteraux = [...reste.matchAll(/'([^']*)'/g)].map((m) => m[1])
  const titre = litteraux.length && !inline ? litteraux[litteraux.length - 1] : litteraux.slice(1).pop() ?? null
  const declencheur = appel[2].trim()
  ARETES.push({ source, cible, titre: titre && titre !== source ? titre : null, ligne: i + 1, declencheur })
}
if (!ARETES.length) abandon(`aucun appel \`addReverse\` lu dans ${RELATIONS} — le motif a dérivé`)

const PAR_SOURCE = new Map()
for (const a of ARETES) {
  const cle = `${a.source}→${a.cible}`
  if (!PAR_SOURCE.has(cle)) PAR_SOURCE.set(cle, { ...a, lignes: [] })
  PAR_SOURCE.get(cle).lignes.push(a.ligne)
  if (!PAR_SOURCE.get(cle).titre && a.titre) PAR_SOURCE.get(cle).titre = a.titre
}
const ARETES_FUSIONNEES = [...PAR_SOURCE.values()].sort(
  (a, b) => parUnitesDeCode(a.source, b.source) || parUnitesDeCode(a.cible, b.cible),
)

const LABEL_CAT = new Map(SPECS.map((s) => [s.key, s.label]))
const nomCat = (k) => (LABEL_CAT.has(k) ? `${LABEL_CAT.get(k)} (\`${k}\`)` : `\`${k}\``)

// ── API publique du module ───────────────────────────────────────────────────────────────────────

const API = fileExports(RELATIONS).filter((e) => e.kind === 'function' || e.kind === 'interface' || e.kind === 'type')
if (!API.length) abandon(`aucun export public lu dans ${RELATIONS}`)

/** JSDoc COMPLET (pas la 1re phrase) des exports d'un module, par nom. Le contrat d'une couture
 *  relationnelle tient dans ses RESTRICTIONS (« hors liens vers soi », « hors noms propres »,
 *  « texte brut seulement », « match par id de livre ») : les couper à la 1re phrase perdait
 *  précisément ce qui décide d'un usage. */
function docsComplets(chemin) {
  const { text, sf } = loadSource(chemin)
  const par = new Map()
  const poser = (nom, node) => {
    const corps = jsdocBody(text.slice(node.getFullStart(), node.getStart(sf)))
    if (corps) par.set(nom, corps.replace(/\s+/g, ' ').trim())
  }
  for (const n of sf.statements) {
    if (n.name && ts.isIdentifier(n.name)) poser(n.name.text, n)
    else if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) poser(d.name.text, n)
    }
  }
  return par
}
const DOCS_API = docsComplets(RELATIONS)

/** Site du SEUL câblage de `bookContents` dans le registre — le fait « projeté DANS le build » ne
 *  s'écrit pas de mémoire : il se cite. */
const LIGNE_BOOKCONTENTS = REGISTRY_SRC.split('\n').findIndex((l) => /\bbookContents\(/.test(l)) + 1
if (!LIGNE_BOOKCONTENTS) abandon(`aucun appel \`bookContents(...)\` dans ${REGISTRY} — le câblage de la fiche Livre a bougé`)

/** Helpers de section / de phrase JOUEUR : les NOMS viennent des exports, jamais d'une liste tenue
 *  à la main qui se périme au premier renommage. */
const helpersDe = (chemin) => {
  const noms = fileExports(chemin).filter((e) => e.kind === 'function').map((e) => e.name)
  if (!noms.length) abandon(`aucune fonction exportée dans ${chemin} (déplacé/renommé ?)`)
  return noms
}
const HELPERS_DESCRIBE = helpersDe(DESCRIBE)
const HELPERS_HUMANIZE = helpersDe(HUMANIZE)

/** Contrats VÉRIFIÉS par la garde d'exposition : ses cas, tels qu'elle les NOMME. */
const CONTRATS_CAS = (() => {
  const src = lire(CONTRATS)
  const blocs = [...src.matchAll(/describe\('([^']+)'/g)]
  if (!blocs.length) abandon(`aucun \`describe\` lu dans ${CONTRATS} — le motif a dérivé`)
  return blocs.map((b, i) => {
    const fin = i + 1 < blocs.length ? blocs[i + 1].index : src.length
    const cas = [...src.slice(b.index, fin).matchAll(/\bit\('([^']+)'/g)].map((m) => m[1])
    if (!cas.length) abandon(`\`describe('${b[1]}')\` de ${CONTRATS} ne porte aucun cas`)
    return { titre: b[1], cas }
  })
})()

/** Exergues de Carrière : compte et périmètre de SOURCE, dumpés par le code lui-même (le plugin
 *  `exergues` de `<Prose>` monté sur les `careers` réelles) — jamais une re-implémentation ici. */
const EPIGRAPHES = JSON.parse(
  sortieOutilLocal(process.cwd(), 'tsx', 'tsx', ['scripts/docs/lib/dump-epigraphes.mts']),
)
if (!EPIGRAPHES.total) abandon('dump-epigraphes : aucune carrière lue — la façade `src/data` a bougé')

// ── Tests du dossier ─────────────────────────────────────────────────────────────────────────────

// Gardes NOMMÉES (fail-fast si l'une disparaît) — pas un balayage du dossier : un fichier de test
// en cours d'écriture dans un arbre partagé ferait diverger le .md sans qu'aucune règle ne bouge.
const TESTS = [
  'src/ui/compendium/relations.test.ts',
  'src/ui/compendium/registry.test.ts',
  'src/ui/compendium/humanize.test.ts',
  'src/data/schemas/exposition-contrats.test.ts',
  'src/data/serialize.test.ts',
].map((t) => {
  if (!existsSync(t)) abandon(`garde « ${t} » introuvable (renommée/supprimée ?)`)
  return t
})

// ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

const lignesAretes = ARETES_FUSIONNEES.map(
  (a) =>
    `| ${nomCat(a.source)} | ${nomCat(a.cible)} | ${a.titre ? `« ${a.titre} »` : '— (titre de repli)'} | ${a.lignes
      .map((l) => `\`${RELATIONS}:${l}\``)
      .join(' ')} |`,
).join('\n')

const lignesApi = API.map(
  (e) =>
    `| \`${e.name}\` | ${e.kind} | \`${RELATIONS}:${e.line}\` | ${(DOCS_API.get(e.name) ?? e.role ?? '—').replaceAll('|', '\\|')} |`,
).join('\n')

const lignesContrats = CONTRATS_CAS.map(
  (b) => `- **${b.titre}**\n${b.cas.map((c) => `  - ${c.replaceAll('*', '\\*')}`).join('\n')}`,
).join('\n')

const lignesCategories = [...PAR_CATEGORIE.entries()]
  .sort((a, b) => parUnitesDeCode(a[0], b[0]))
  .map(
    ([cle, v]) =>
      `| \`${cle}\` | ${LABEL_CAT.get(cle) ?? '⚠️ absente de CODEX_SPECS'} | ${v.fichiers
        .map((f) => `\`src/data/${f}\``)
        .join(', ')} | ${v.route} |`,
  )
  .join('\n')

const lignesClusters = CLUSTERS.map((c) => {
  const sousGroupes = [...c.parCluster.entries()]
    .map(([nom, cats]) => `*${nom}* (${cats.length})`)
    .join(', ')
  return `| ${c.groupe} | ${c.total} | ${c.plat} | ${sousGroupes || '—'} |`
}).join('\n')

const lignesExemptions = [...EXEMPTIONS.entries()]
  .sort((a, b) => parUnitesDeCode(a[0], b[0]))
  .map(([kind, fichiers]) => `- \`${kind}\` — ${fichiers.length} fichier(s)`)
  .join('\n')

const out = `# Codex — couche relationnelle (références inverses, index, auto-liage)

> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-codex-relations.mjs\` (\`npm run docs:codex-relations\`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUS aux fichiers réels : les ${ARETES.length} appels
\`addReverse(...)\` de \`${RELATIONS}\` (catégorie référante, catégorie cible, titre FR de section,
\`fichier:ligne\`), l'API publique du même module (AST + 1re phrase de JSDoc), le littéral
\`CODEX_SPECS\` de \`${REGISTRY}\` (${SPECS.length} catégories, leurs groupes et sous-groupes
\`cluster\`), et l'\`exposition\` DÉCLARÉE par les ${NB_DEFS} defs de \`src/data/schemas/defs/\`
(dumpée par \`scripts/docs/lib/dump-exposition.mts\`), les cas NOMMÉS par \`${CONTRATS}\`, les fonctions
exportées de \`${DESCRIBE}\` et \`${HUMANIZE}\`, et le compte d'épigraphes de Carrière dumpé par
\`scripts/docs/lib/dump-epigraphes.mts\` (le plugin \`exergues\` de \`<Prose>\` monté sur les \`careers\`
réelles — aucune re-implémentation de la détection ici). **Angles morts** : la catégorie RÉFÉRANTE
est lue au \`const by\` en portée ou au littéral inline — une arête posée autrement (helper, boucle
sur une variable calculée) casserait le script plutôt que de mentir, mais aucune n'existe
aujourd'hui ; le CONTENU réel de chaque relation (combien de créatures portent tel trait) dépend de
la donnée à l'exécution et n'est pas compté ici ; l'auto-liage de prose (\`tokenizeLinks\`) est
LOCALE-SCOPED et son index se construit au runtime — seules ses portes sont documentées ; les deux
principes et le mode d'emploi « Étendre » sont de l'ÉDITORIAL fixé dans le script.

Le Codex (\`src/ui/compendium/\`) dérive TOUT du JSON \`src/data\` (aucune scène/règle en dur).
Au-delà des faits-clés et des références AVANT (déjà projetées par \`${REGISTRY}\`), la richesse
vient d'une **couche relationnelle** : \`${RELATIONS}\`.

## Deux principes (non négociables)

1. **Data-driven** — la sémantique vit dans le JSON ; \`relations.ts\` ne fait qu'**inverser** des
   références DÉJÀ structurées. Aucune regex, aucune table en dur.
2. **Multilingue (possibilité)** — toute relation est **id-based** (clé STABLE), jamais un libellé.
   Les \`label\` portés par les \`Referrer\` ne servent qu'à l'affichage (= \`CodexItem.label\`, résolu
   par \`codexLookup\`). Seule brique langue-dépendante : l'**auto-liage** de prose, *locale-scoped*
   (matcher dérivé des libellés de la locale active), jamais une chaîne FR en dur.

## D'où viennent les entrées — l'exposition est DÉCLARÉE au def

Un document ne « rentre » pas au Codex par une table tenue à part : son **exposition** est un
argument de la fabrique \`document()\` (\`src/data/schemas/grammaire/document.ts\`, cf.
\`docs/donnees.md\`), au même titre que ses champs :

- \`codex\` — soit \`{ keys: [...] }\`, les clés de catégorie sous lesquelles le joueur trouve le
  document, soit \`{ exempt: { kind, raison, ticket? } }\` : une exemption MOTIVÉE. La fabrique
  refuse un \`codex\` sans clés ni exemption motivée.
- \`edit\` — ce que l'ÉDITEUR édite : \`{ dataset }\`, \`{ object: 'single' | 'record' }\`,
  \`{ niche: { categories } }\` (chaque clé Codex du document routée comme dataset, vers la suite
  nichée de la collection qu'elle édite — le fichier parent est réécrit au save), ou \`{ none: raison }\`. La fabrique
  refuse les quatre absents.

Les ROUTES D'ÉDITION du Codex sont DÉRIVÉES de ces déclarations (#1472) :
\`src/data/schemas/exposition-derivee.ts\` construit \`CATEGORY_DATASET_DERIVE\` et
\`OBJECT_CATEGORY_DERIVE\` depuis \`SCHEMA_DEFS\`, et \`src/ui/compendium/CodexEdit.tsx\` les consomme
telles quelles — plus aucune table à la main. La source lue à l'EXÉCUTION pour l'INDEX du Codex
reste \`CODEX_SPECS\` (\`${REGISTRY}\`, dont \`CODEX\` est la projection). Les deux sont tenus égaux
par \`${CONTRATS}\`, dont voici les cas, tels que la garde les nomme :

${lignesContrats}

Un document neuf se pose donc en DEUX endroits du MÊME commit : son \`exposition\` au def, sa
catégorie dans \`CODEX_SPECS\`.

Sur ${NB_DEFS} defs, ${NB_EXEMPTS} sont EXEMPTS d'exposition Codex :

${lignesExemptions}

### Index INVERSE — catégorie Codex → document qui la déclare

${PAR_CATEGORIE.size} clés de catégorie sont déclarées par les defs. La colonne « Route d'édition »
est celle du document porteur, telle que \`document()\` la déclare.

| Clé de catégorie | Libellé (\`CODEX_SPECS\`) | Déclarée par | Route d'édition |
|---|---|---|---|
${lignesCategories}

## \`relations.ts\` — les arêtes inverses

Construites UNE fois par version du Codex, en inversant les références de \`src/data\`. Chaque
ligne = une arête \`addReverse(cible, id, référant, titre?)\` réellement présente dans le module.

| Référant (source de la ref AVANT) | Cible (fiche qui reçoit la section inverse) | Titre de section | Site |
|---|---|---|---|
${lignesAretes}

## \`relations.ts\` — API publique

Le JSDoc est rapporté en ENTIER : le contrat d'une couture relationnelle tient dans ses restrictions
(hors liens vers soi, hors noms propres, texte brut seulement, match par id de livre).

| Export | Nature | Site | Contrat (JSDoc) |
|---|---|---|---|
${lignesApi}

\`bookContents\` est projeté DANS le \`build\` (paresseux) de la catégorie Livres
(\`${REGISTRY}:${LIGNE_BOOKCONTENTS}\`) : il ne lit que l'identité STATIQUE des catégories, jamais leurs
items — aucun cycle de projection.

## Barre de catégories — sous-groupes repliables (\`cluster\`)

Les familles touffues affichaient une *avalanche* de pastilles à plat. Chaque \`CodexCategory\` porte
un champ optionnel \`cluster\` (libellé FR du sous-groupe) : \`clustersIn(group)\` éclate les
catégories en pastilles **à plat** (sans \`cluster\`) + **sous-groupes repliables** (\`CodexCluster\`,
un par \`cluster\`, ordre de déclaration préservé). \`src/ui/compendium/CompendiumScreen.tsx\` rend
chaque cluster comme un \`<details>\` de la primitive \`.fold\`, **fermé par défaut**, ouvert
automatiquement si la catégorie active y vit. Les pastilles restent des \`<button>\`.

| Groupe | Catégories | À plat | Sous-groupes |
|---|---|---|---|
${lignesClusters}

Regrouper une catégorie = poser \`cluster: '…'\` sur son littéral dans \`CODEX_SPECS\`, rien d'autre.

## Étendre

- **Nouvelle relation inverse** : ajouter l'arête dans \`${RELATIONS}\` (\`addReverse(targetCat, id, by)\`),
  un titre dans \`REVERSE_TITLE\` si besoin, et \`...reverseSections(cat, id)\` dans la catégorie du registre.
- **Nouveau champ de fiche** : enrichir l'\`item\` dans \`${REGISTRY}\` (méta \`fact(...)\` ou section via les
  helpers de \`${DESCRIBE}\` : ${HELPERS_DESCRIBE.map((n) => `\`${n}\``).join(', ')}).
- **Exergue de fiche** : PRÉSENTATION, jamais un champ. La \`desc\` reste ENTIÈRE et UNE ; c'est le plugin
  \`exergues\` de \`<Prose>\` (\`src/ui/Prose.tsx\`), activé par la DONNÉE de catégorie
  (\`CodexCategory.exergues\`, \`careers\`), qui rend en \`.prose-exergue\` (matière \`ParchmentCard\`)
  TOUT couple citation \`« … »\` + attribution (tiret), À SA PLACE dans le corps — convention
  typographique OBSERVÉE dans les sources : ${EPIGRAPHES.avecEpigraphe} des ${EPIGRAPHES.total} carrières
  curées en portent au moins un (${EPIGRAPHES.couples} couples au total ; folios ${EPIGRAPHES.folios[0]}–${EPIGRAPHES.folios[1]} de ${EPIGRAPHES.livres.length} livres :
  ${EPIGRAPHES.livres.map((b) => `\`${b}\``).join(', ')}). Une catégorie SANS la donnée (\`species\` et ses
  « Points de vue ») garde ses citations en paragraphes : aucun \`if (category === …)\` au rendu.
- **Riders / effets / formules de sort en clair** : les sections rendent d'abord la phrase JOUEUR
  (\`${HUMANIZE}\` — switchs EXHAUSTIFS, zéro id brut : ${HELPERS_HUMANIZE.map((n) => `\`${n}\``).join(', ')}),
  la forme technique d'atelier restant dépliée dans un bloc « Détail technique » (primitive \`.fold\`).
- **Édition** : tout reste éditable au Compendium (DEV) ; les VIEWS ne sont pas éditables
  (\`isEditableCategory=false\`) — éditer la source.

## Gardes

${TESTS.map((t) => `- \`npx vitest run ${t}\``).join('\n')}
`

emitOrCheck({
  out,
  path: 'docs/codex-relations.md',
  check: process.argv.includes('--check'),
  staleMsg:
    'docs:codex-relations — docs/codex-relations.md est PÉRIMÉ (diverge de relations.ts, registry.ts, de l’exposition déclarée aux defs, ou du script).',
  rerunMsg: '  → relancer `npm run docs:codex-relations` et committer le résultat.',
  okMsg: 'docs:codex-relations — OK (docs/codex-relations.md à jour)',
  writeMsg: `docs/codex-relations.md — ${ARETES_FUSIONNEES.length} arêtes inverses, ${SPECS.length} catégories, ${PAR_CATEGORIE.size} clés déclarées.`,
})
