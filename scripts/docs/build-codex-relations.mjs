/**
 * Génère docs/codex-relations.md — la couche RELATIONNELLE du Codex (références inverses, index,
 * auto-liage) et l'origine DÉCLARÉE de ses entrées.
 * La part FACTUELLE vient du registre vivant (familles, catégories, sous-groupes) et des groupes
 * de renvois rendus par `reverseGroups` sur ses fiches (`scripts/docs/lib/dump-codex.mts`), de l'API
 * publique du module (AST + JSDoc) et de l'exposition déclarée aux defs (`dump-exposition.mts`).
 * La part ÉDITORIALE (principes, mode d'emploi) vit ici.
 *
 * Patron retenu : « éditorial EN DUR dans le générateur » (scripts/docs/build-sources-vf.mjs),
 * avec la passerelle TS de `scripts/docs/build-donnees.mjs` pour l'exposition.
 *
 * Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/ecriture-derives.mjs), rejoué par `build-all.mjs`.
 *
 *   node scripts/docs/build-codex-relations.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { sortieOutilLocal } from '../lancer-local.mjs'
import * as ts from 'typescript/unstable/ast'
import { loadSource, jsdocBody } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/ecriture-derives.mjs'
import { fileExports } from './lib/engineExports.mjs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'

/** Le corps rendu et les messages de `ecrireOuVerifier`, sans rien écrire. */
function rendu() {
  const OUTIL = 'build-codex-relations'
  const RELATIONS = 'src/noyau/codex/relations.ts'
  const REGISTRY = 'src/noyau/codex/registry.ts'
  const DESCRIBE = 'src/noyau/codex/describe.ts'
  const HUMANIZE = 'src/noyau/codex/humanize.ts'
  const CONTRATS = ['src/data/schemas/exposition-contrats.test.ts', 'src/noyau/codex/codex-exposition-contrats.test.ts']
  const CONTRATS_CITES = CONTRATS.map((c) => `\`${c}\``).join(' et ')

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

  // ── Catégories, familles et sous-groupes : le registre VIVANT (`CODEX`) ─────────────────────────

  const REGISTRY_SRC = lire(REGISTRY)
  const { familles: FAMILLES, categories: SPECS, relations } = JSON.parse(
    sortieOutilLocal(process.cwd(), 'tsx', 'tsx', ['scripts/docs/lib/dump-codex.mts']),
  )
  if (!SPECS.length) abandon(`aucune catégorie au registre \`CODEX\` (${REGISTRY})`)

  const CLUSTERS = FAMILLES.map((g) => {
    const dedans = SPECS.filter((s) => s.group === g.id)
    const parCluster = new Map()
    for (const s of dedans.filter((x) => x.cluster)) {
      if (!parCluster.has(s.cluster)) parCluster.set(s.cluster, [])
      parCluster.get(s.cluster).push(s)
    }
    return { groupe: g.label, total: dedans.length, plat: dedans.filter((x) => !x.cluster).length, parCluster }
  })

  const RELATIONS_OBSERVEES = relations.sort(
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

  /** Contrats VÉRIFIÉS par les gardes d'exposition : leurs cas, tels qu'elles les NOMMENT, un même
   *  `describe` des deux gardes réuni sous son titre. */
  const CONTRATS_CAS = (() => {
    const parTitre = new Map()
    for (const chemin of CONTRATS) {
      const src = lire(chemin)
      const blocs = [...src.matchAll(/describe\('([^']+)'/g)]
      if (!blocs.length) abandon(`aucun \`describe\` lu dans ${chemin} — le motif a dérivé`)
      blocs.forEach((b, i) => {
        const fin = i + 1 < blocs.length ? blocs[i + 1].index : src.length
        const cas = [...src.slice(b.index, fin).matchAll(/\bit\('([^']+)'/g)].map((m) => m[1])
        if (!cas.length) abandon(`\`describe('${b[1]}')\` de ${chemin} ne porte aucun cas`)
        parTitre.set(b[1], [...(parTitre.get(b[1]) ?? []), ...cas])
      })
    }
    return [...parTitre].map(([titre, cas]) => ({ titre, cas }))
  })()

  // ── Tests du dossier ─────────────────────────────────────────────────────────────────────────────

  // Gardes NOMMÉES (fail-fast si l'une disparaît) — pas un balayage du dossier : un fichier de test
  // en cours d'écriture dans un arbre partagé ferait diverger le .md sans qu'aucune règle ne bouge.
  const TESTS = [
    'src/noyau/codex/relations.test.ts',
    'src/noyau/codex/projectionInverse.test.ts',
    'hotes/godot/pont/compendium.hors-store.test.ts',
    'src/noyau/codex/registry.test.ts',
    'src/noyau/codex/humanize.test.ts',
    ...CONTRATS,
    'src/data/serialize.test.ts',
  ].map((t) => {
    if (!existsSync(t)) abandon(`garde « ${t} » introuvable (renommée/supprimée ?)`)
    return t
  })

  // ── Rendu ────────────────────────────────────────────────────────────────────────────────────────

  const lignesRelations = RELATIONS_OBSERVEES.map(
    (r) => `| ${nomCat(r.source)} | ${nomCat(r.cible)} | ${r.titre.replaceAll('|', '\\|')} | ${r.renvois} |`,
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
        `| \`${cle}\` | ${LABEL_CAT.get(cle)} | ${v.fichiers
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

Le relevé parcourt les fiches du registre vivant \`CODEX\` de \`${REGISTRY}\` et lit les renvois
que \`reverseGroups\` produit avec les données livrées et les règles optionnelles par défaut.
La passerelle \`scripts/docs/lib/dump-codex.mts\` rapporte aussi les ${SPECS.length} catégories,
familles et sous-groupes. L'API publique vient de l'AST et du JSDoc. Les ${NB_DEFS} defs de
\`src/data/schemas/defs/\` fournissent leur exposition déclarée par
\`scripts/docs/lib/dump-exposition.mts\`. Les cas de contrat viennent de ${CONTRATS_CITES}
et la liste des fonctions d'affichage des exports de \`${DESCRIBE}\` et \`${HUMANIZE}\`.
L'index d'auto-liage de prose dépend de la locale à l'exécution. La documentation en rapporte
l'API. Les principes et le mode d'emploi « Étendre » sont écrits dans le générateur.

Le Compendium Godot lit la projection de \`src/hote/compendium.ts\`. Les fiches du Codex dérivent de \`src/data\`.
Au-delà des faits-clés et des références AVANT (déjà projetées par \`${REGISTRY}\`), la richesse
vient d'une **couche relationnelle** : \`${RELATIONS}\`.

## Deux principes (non négociables)

1. **Relations structurées**. Les données fournissent les références. Les defs en déclarent la
   portée inverse et les projections calculées relisent les données actives.
2. **Multilingue (possibilité)** — toute relation est **id-based** (clé STABLE), jamais un libellé.
   Les \`label\` portés par les \`Referrer\` ne servent qu'à l'affichage (= \`CodexItem.label\`) ; une
   fiche se résout par id (\`codexLookupById\`). Seule brique langue-dépendante : l'**auto-liage** de prose, *locale-scoped*
   (matcher dérivé des libellés de la locale active), jamais une chaîne FR en dur.

## D'où viennent les entrées — l'exposition est DÉCLARÉE au def

Un document ne « rentre » pas au Codex par une table tenue à part : son **exposition** est un
argument de la fabrique \`document()\` (\`src/data/schemas/grammaire/document.ts\`, cf.
\`docs/donnees.md\`), au même titre que ses champs :

- \`codex\` — soit \`{ keys: [...] }\`, les clés de catégorie sous lesquelles le joueur trouve le
  document, soit \`{ exempt: { kind, raison, ticket? } }\` : une exemption MOTIVÉE. La fabrique
  refuse un \`codex\` sans clés ni exemption motivée.
- \`edit\` — ce que l'ÉDITEUR édite : \`{ dataset }\`, \`{ object: 'unique' }\`,
  \`{ niche: { categories } }\` (chaque clé Codex du document routée comme dataset, vers la suite
  nichée de la collection qu'elle édite — le fichier parent est réécrit au save), ou \`{ none: raison }\`. La fabrique
  refuse les quatre absents.

Les ROUTES D'ÉDITION du Codex sont DÉRIVÉES de ces déclarations (#1472) :
\`src/data/schemas/exposition-derivee.ts\` construit \`CATEGORY_DATASET_DERIVE\` et
\`OBJECT_CATEGORY_DERIVE\` depuis \`SCHEMA_DEFS\`, et \`src/data/atelierDuCodex.ts\` les consomme
telles quelles — plus aucune table à la main. Les CLÉS de l'INDEX du Codex en dérivent par
CONSTRUCTION : \`npm run gen\` (\`scripts/gen-espaces.mts\`) émet leur union, \`CLES_CODEX\`
(\`src/data/schemas/_cles-de-dataset.generated.ts\`), et \`CODEX_SPECS\` (\`${REGISTRY}\`, dont
\`CODEX\` est la projection) est un \`satisfies Record<CleCodex, …>\` : une clé déclarée sans
catégorie, ou une catégorie qu'aucun def ne déclare, ne compile pas. Restent les contrats de
${CONTRATS_CITES}, dont voici les cas, tels que les gardes les nomment :

${lignesContrats}

Une catégorie neuve se pose donc dans le MÊME commit à son def (\`exposition\`), puis, après
\`npm run gen\`, dans \`CODEX_SPECS\` sous sa clé — le typecheck exige les deux.

Sur ${NB_DEFS} defs, ${NB_EXEMPTS} sont EXEMPTS d'exposition Codex :

${lignesExemptions}

### Index INVERSE — catégorie Codex → document qui la déclare

${PAR_CATEGORIE.size} clés de catégorie sont déclarées par les defs. La colonne « Route d'édition »
est celle du document porteur, telle que \`document()\` la déclare.

| Clé de catégorie | Libellé (\`CODEX\`) | Déclarée par | Route d'édition |
|---|---|---|---|
${lignesCategories}

## \`relations.ts\` — les arêtes inverses

La méta \`inverseCodex\` ouvre la portée d'un champ de def à l'index inverse. Le parse de cette
portée retient les repères des branches qui correspondent à l'entrée vivante. La déclaration
peut préciser un type, une portée directe (par exemple pour les possessions), ou le type
d'identifiant porté directement par le payload d'une opération. Un champ de caractéristique peut publier sa clé de
vocabulaire fermé. Les références globales se résolvent par espace d'identifiants. Les slots
locaux restent liés à leur ouvreur.

Le graphe combine ces références avec les calculs du Codex, dont les carrières accessibles à une
espèce, les qualités effectives des objets et les états infligés par les effets actifs. Un
niveau de carrière désigne sa carrière et porte son rang en détail. L'index suit la version
des données et se reconstruit à la première lecture qui suit une édition ou un changement de
règle optionnelle.

Le tableau compte, pour chaque couple de catégories observé, les renvois retournés par
\`reverseGroups\`, une fois par fiche cible et identifiant de référant. Un couple apparaît quand
les données produisent au moins un renvoi vers une fiche. Le catalogue de correspondances défini
par les champs et les calculs peut donc couvrir d'autres couples.

| Catégorie du référant | Catégorie de la fiche cible | Titre de section | Renvois |
|---|---|---|---:|
${lignesRelations}

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
un par \`cluster\`, ordre de déclaration préservé). \`src/hote/compendium.ts\` transmet cette
structure au Compendium Godot.

| Groupe | Catégories | À plat | Sous-groupes |
|---|---|---|---|
${lignesClusters}

Regrouper une catégorie = poser \`cluster\` (clé de catalogue) sur son entrée de \`CODEX_SPECS\`, rien d'autre.

## Étendre

- **Nouvelle relation inverse**. Poser \`inverseCodex\` sur le champ de la collection dans
  son def et préciser la portée si nécessaire. Le titre d'affichage du couple peut se déclarer
  dans \`TITRES_INVERSES\` de \`${RELATIONS}\`. Les groupes sont disponibles dans les renvois de
  la fiche du Compendium.
- **Nouveau champ de fiche** : enrichir l'\`item\` dans \`${REGISTRY}\` (méta \`fact(...)\` ou section via les
  helpers de \`${DESCRIBE}\` : ${HELPERS_DESCRIBE.map((n) => `\`${n}\``).join(', ')}).
- **Riders / effets / formules de sort en clair** : les sections rendent d'abord la phrase JOUEUR
  (\`${HUMANIZE}\` — switchs EXHAUSTIFS, zéro id brut : ${HELPERS_HUMANIZE.map((n) => `\`${n}\``).join(', ')}),
  La forme technique reste disponible à l’éditeur du Compendium.
- **Édition** : tout reste éditable au Compendium (DEV) ; les VIEWS ne sont pas éditables
  (\`isEditableCategory=false\`) — éditer la source.

## Gardes

${TESTS.map((t) => `- \`npm test -- ${t}\``).join('\n')}
`
  return {
    out,
    path: 'docs/codex-relations.md',
    staleMsg:
      'docs:codex-relations — docs/codex-relations.md est PÉRIMÉ (diverge du relevé des renvois, du registre, de l’exposition déclarée aux defs ou du script).',
    rerunMsg: '  → relancer `npm run docs:codex-relations` (dérivé jamais commité, #2203).',
    okMsg: 'docs:codex-relations — OK (docs/codex-relations.md à jour)',
    writeMsg: `docs/codex-relations.md — ${RELATIONS_OBSERVEES.length} couples de catégories avec des renvois inverses, ${SPECS.length} catégories, ${PAR_CATEGORIE.size} clés déclarées.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

if (import.meta.main) ecrireOuVerifier({ ...rendu(), check: process.argv.includes('--check') })
