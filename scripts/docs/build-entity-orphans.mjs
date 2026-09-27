// Rapport des ENTITÉS DE DONNÉES sans consommateur — GÉNÉRÉ. Sortie : docs/orphelines-donnees.md.
// Re-run : node scripts/docs/build-entity-orphans.mjs (npm run docs:orphelines). Mode --check
// (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé, exit 1 si diff —
// jamais d'écriture en mode --check. Corpus/détection PARTAGÉS avec la garde cliquet
// `src/data/entity-orphans.test.ts` : scripts/guards/lib/entityConsumers.mjs.
//
// Objet : la mesure INVERSE des gardes RAW du dépôt (`check-doc-refs.mjs`, `check-refs.mjs`…), qui
// vérifient que ce qui est CITÉ existe. Ici : ce qui EXISTE est-il cité ? « La mécanique est juste,
// le chemin qui y mène est absent » — douze Carrières livrées et inatteignables, un chapitre curé
// sans porte d'accès, une table jamais tirée (#734) sont la MÊME classe de défaut : une entité
// correcte, sans AUCUN consommateur mesuré.
//
// PÉRIMÈTRE MESURÉ — 8 des 10 catalogues `src/data/*.json` adressés par `id` que `id-collisions.test.ts`
// traite comme une famille homogène (`traits`, `talents`, `qualities`, `maneuvers`, `skills`, `props`,
// `vehicles`, `creatures`, cf. `entityConsumers.mjs#CATEGORY_FILES`). 2 catalogues MESURÉS puis
// ÉCARTÉS (`spells`, `trappings` — `entityConsumers.mjs#EXCLUDED_CATEGORY_FILES` ; leurs comptes
// sont DÉRIVÉS à chaque génération, JAMAIS écrits en dur dans la sortie). Leur taux d'orphelines
// brutes (id seul) vaut plusieurs fois celui des catalogues retenus, non parce que ces entités
// seraient mortes, mais parce que le chemin d'accès y échappe à la détection par id — pour une
// raison DIFFÉRENTE dans chacun des deux :
//   `spells` — un Sort ne se cite pas par id en code de prod par construction : il s'obtient par
//   Domaine / Talent de lanceur / `learnSpell` de scène. L'instrument juste est donc
//   `src/data/obtainability-guard.test.ts` (OBTENABILITÉ, baseline `spells: 0`), pas la citation.
//   `trappings` — le stock marchand est bâti par PRÉDICAT sur des catégories déclarées EN DONNÉE
//   (`state/merchantFlow.ts:194-201` filtre `trappings` par `arch.category` de `merchants.json`),
//   chaîne hors grammaire MODE 2 (son `.map` rend un objet, pas `t.id`) — #1631.
//   Le canal LABEL (`findSpell`, src/data/index.ts) n'est PAS cette raison : un détecteur
//   id-OU-label ne réconcilierait pas ces catalogues.
//   Les ~99 autres `src/data/*.json` (hors ces 10 catalogues) sont HORS PÉRIMÈTRE de ce générateur.
//
// `creatures` EST AU PÉRIMÈTRE depuis #1553 L3 (2026-09), et le passage a tranché ce qui la retenait :
// son chemin d'accès EST une citation par id (scène, `montures.json`, `groups.json`, `careerLevels.json`
// …) ou une sélection MODE 2 réelle (`creatures.filter((c) => c.purchase).map((c) => c.id)`,
// `state/merchantFlow.ts:132`, bétail du Maquignon). Ce qui n'en est PAS un : la palette d'ATELIER de
// l'éditeur de scène — cf. la SÉMANTIQUE DE « ORPHELINE » en en-tête de `entityConsumers.mjs`, qui
// écrit cette exclusion pour qu'une extension future de MODE 2 ne la « corrige » pas en consommateur.
// Le stock cliqueté (`entityOrphanStock.mjs#ENTITY_ORPHAN_RATCHET`) est NOMINATIF entrée par entrée
// sur TOUT le périmètre, dans la forme `{ fichier, ref, occurrence }` : c'est LUI qui rougit sur une
// orpheline neuve comme sur une SUBSTITUTION à compte constant, et c'est son entrée nommée que la
// porte de plage voit à l'append. Ce rapport en est la LECTURE, pas la garde : un `.md` généré ne
// rougit pas.
//
// DÉFINITION D'UN CONSOMMATEUR — DEUX modes indépendants, un id compte comme consommé s'il satisfait
// L'UN OU L'AUTRE (détail complet, grammaire, angles morts : en-tête de `entityConsumers.mjs`) :
//
// MODE 1 (id-collisions.test.ts) — l'id de l'entité apparaît comme jeton de chaîne CITÉ complet
// (`"<id>"`/`'<id>'`) dans un AUTRE `src/data/*.json`, dans `src/**/*.ts(x)` de PRODUCTION (hors
// tests, commentaires retirés), ou dans un document de PROJET DE SCÈNE `src/scenes/*/*-projet.json`.
// L'angle mort « corpus des scènes » est FERMÉ depuis 2026-09 (#1553 L2) : le contenu JOUÉ cite des
// entités par id (`entities[].ref`, `statblock.traits[].id`, `flow.test.skill.id`,
// `effect.trappingId`…) et n'était pas scanné — seuls les `.ts(x)` de `src/scenes` l'étaient. Les
// documents sont découverts par STRUCTURE (jamais une liste de chemins), le match se fait sur les
// VALEURS de chaîne APRÈS `JSON.parse` (jamais sur les clés du schéma), et les identités PROPRES du
// document (l'`id` de la racine, d'une scène, d'une entité posée, d'un bloc d'architecture…) sont
// retirées — symétrique du `{ ...e, id: undefined }` des catalogues, cf. `entityConsumers.mjs`.
// Mesure du geste : ZÉRO mouvement sur les 7 catalogues retenus (les 15 lignes du stock tiennent),
// 15 gains sur les 3 écartés (spells 280→278, trappings 215→211, creatures 362→353).
// ANGLES MORTS DÉCLARÉS (repris/étendus de `tableConsumerStock.mjs`) :
// (1) un consommateur MORT (code jamais appelé) compte comme réel ; (2) une chaîne de donnée qui vaut
// EXACTEMENT l'id sans être une op de résolution réelle compte à tort comme consommatrice — mesuré au
// corpus des scènes (2026-09) : `encounters[].threat.tier: 'dangereuse'` (échelon de menace, homonyme
// de `qualities:dangereuse`), `appearance.tenue: 'artiste'` (id de TENUE, homonyme de
// `talents:artiste`), `merchant.archetype: 'medecin'` (archétype marchand, homonyme de
// `creatures:medecin`) ; aucun de ces trois ne change un verdict (les trois entités ont par ailleurs
// un consommateur réel), et ils ne se filtrent PAS par allowlist de chemins — une liste à tenir
// dérive fail-open ;
// (3) un id construit par SLUG D'UN AUTRE CHAMP au runtime (patron mesuré dans le dépôt : `findTalent(name)?.id
// ?? slugId(name)` — engine/character.ts, careerSlots.ts, scenes/test-scenarios/*.ts ;
// `traits/dispatch.ts#mutationsAtSpawn` en a le cas connu pour les mutations) échapperait à la
// détection si SEUL le libellé apparaissait ailleurs — vérifié à la main pour les 20 entrées du stock
// initial (ni id NI label cités ailleurs que leur propre déclaration).
//
// MODE 2 (`computeFieldPredicateConsumers`) — sélection dynamique par PRÉDICAT DE CHAMP : du code de
// production filtre le catalogue (`<catalogue>.filter((param) => param.champ === 'valeur'…)`, ex.
// `ui/InterludeScreen.tsx` bâtissant le pool de l'Artisanat) sans jamais citer l'id, et l'entité
// satisfait ce prédicat. Restreint fail-closed à une grammaire d'égalité littérale simple sur
// `Array.prototype.filter` (jamais `.find`/`.some`, jamais négation/optionnel/parenthèses de
// groupement), ET à un résultat EXPLOITÉ PAR ID : la chaîne doit se terminer par
// `.map((param) => param.id)` (jamais `.label` — un filtre qui SÉLECTIONNE sans MENER à l'entité par id
// n'est pas un consommateur, cf. `entityConsumers.mjs` pour le cas mesuré `falseQualities()` REJETÉ).
// Tout filtre hors grammaire est IGNORÉ (l'entrée reste orpheline). Trouvaille mesurée (2026-07) :
// `qualities:laid` est sélectionnée par ses champs `type`/`subType` ET exploitée par id
// (`ui/InterludeScreen.tsx:52-53`) sans jamais être citée littéralement — la définition MODE 1 seule
// la classait à tort en dette.
//
// ENTITÉS MÉTA (`META_CATALOG_ENTRIES`) — une ligne de TABLE RAW transcrite en entrée de catalogue
// pour son vocabulaire de tirage (ex. `talents:talent-aleatoire`, LDB 10 p.132), jamais une entité
// POSSÉDABLE : ni consommateur MODE 1 ni MODE 2 n'a de sens pour elle — traitée comme systématiquement
// consommée, MÊME source que `src/data/obtainability-guard.test.ts` (l'autre garde qui connaît ce
// même fait structurel) : aucune des deux ne re-déclare le fait chez elle.
//
// CE QUE CE RAPPORT NE RÉPOND PAS — il mesure des consommateurs d'ENTITÉ (« qui cite/sélectionne cet
// id »), PAS des consommateurs de CHAMP GÉNÉRIQUE (« qui LIT ce champ sur les entités qui le portent »
// — ex. « qui lit `spec` sur une `TrappingRef` »). Ce sont deux instruments distincts : celui-ci ne
// peut pas remplacer une recherche `ctx_search`/AST ciblée sur un champ précis.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import {
  CATEGORY_FILES, EXCLUDED_CATEGORY_FILES, loadCategoryIds, buildConsumerCorpus, isConsumed,
  predicatDeConsommation,
} from '../guards/lib/entityConsumers.mjs'

const DATA_DIR = 'src/data'
const SRC_DIR = 'src'
const OUT = 'docs/orphelines-donnees.md'

function labelOf(dataDir, file, id) {
  const arr = JSON.parse(readFileSync(join(dataDir, file), 'utf8'))
  return arr.find((e) => e.id === id)?.label ?? null
}

const ids = loadCategoryIds(DATA_DIR)
// LE prédicat de consommation vient de `entityConsumers.mjs` (`predicatDeConsommation`), celui-là
// même dont vit `orphelinesMesurees` (garde + stock) : ce rapport en est la LECTURE, il ne
// reclassifie pas.
const isEntityConsumed = predicatDeConsommation(DATA_DIR, SRC_DIR)

let out = `# Orphelines de données — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-entity-orphans.mjs\` (\`npm run docs:orphelines\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Pour chaque catalogue \`src/data/*.json\` retenu, les entités qu'AUCUN autre \`src/data/*.json\`,\n`
out += `> AUCUN code de prod TypeScript (\`.ts\`/\`.tsx\`, hors tests) et AUCUN document de projet de scène\n`
// Graphie de FAMILLE imposée par `check-doc-refs.mjs` : il n'accepte un glob que dans le DERNIER
// segment (le dossier parent doit exister), donc `src/scenes/*/*-projet.json` y est un chemin MORT.
// Convention déjà en usage (`docs/donnees.md`, `docs/structures-donnees.md`) : le dossier RÉEL
// backtiqué à part, le motif de nom de fichier sans préfixe `src/`.
out += `> (\`*-projet.json\` de \`src/scenes\` — le contenu JOUÉ) ne cite l'id en toutes lettres NI ne\n`
out += `> sélectionne par prédicat de champ (\`catalogue.filter(...)\`). Périmètre\n`
out += `> mesuré, angles morts déclarés, définition d'un consommateur : voir l'en-tête de\n`
out += `> \`scripts/docs/build-entity-orphans.mjs\`. Cliquet décroissant : \`src/data/entity-orphans.test.ts\`\n`
out += `> + \`scripts/guards/lib/entityOrphanStock.mjs\`.\n\n`
out += `## Catalogues ÉCARTÉS (angle mort structurel mesuré, pas couverts)\n\n`
out += `| Catalogue | Entités | Orphelines BRUTES (id seul) | Taux |\n|---|---|---|---|\n`
// Comptes DÉRIVÉS du même scan MODE 1 (jamais un chiffre en dur : un nombre figé dans une sortie
// générée dérive en silence), sur un corpus où les écartés sont à leur tour privés de leur PROPRE
// déclaration d'id. Aucune ligne nominative n'est publiée : ces catalogues restent hors périmètre.
const excludedIds = loadCategoryIds(DATA_DIR, EXCLUDED_CATEGORY_FILES)
const excludedCorpus = buildConsumerCorpus(DATA_DIR, SRC_DIR, EXCLUDED_CATEGORY_FILES)
for (const [cat, allIds] of Object.entries(excludedIds)) {
  const brutes = allIds.filter((id) => !isConsumed(excludedCorpus, id)).length
  const pct = allIds.length ? Math.round((brutes / allIds.length) * 100) : 0
  out += `| \`${cat}\` | ${allIds.length} | ${brutes} | ${pct} % |\n`
}
out += `\n`
out += `Chacun échappe à la détection par id pour une raison PROPRE : un Sort ne se cite pas par id en\n`
out += `prod (il s'obtient par Domaine / Talent de lanceur / \`learnSpell\` de scène — l'instrument juste\n`
out += `est \`src/data/obtainability-guard.test.ts\`) ; le stock marchand des \`trappings\` est bâti par\n`
out += `PRÉDICAT sur des catégories déclarées en donnée (\`state/merchantFlow.ts\`, hors grammaire MODE 2\n`
out += `— #1631). \`creatures\` a quitté cette table pour les catalogues MESURÉS (#1553 L3). Détail et\n`
out += `mesure du canal label (qui n'est PAS la cause) : en-tête de \`scripts/docs/build-entity-orphans.mjs\`.\n\n`
out += `## Catalogues MESURÉS\n\n`
out += `> Le stock cliqueté (\`ENTITY_ORPHAN_RATCHET\`) porte les MÊMES entrées, sous la forme\n`
out += `> \`{ fichier, ref, occurrence }\` ; ce rapport en est la LECTURE, jamais la garde — un \`.md\`\n`
out += `> généré ne rougit pas.\n\n`
out += `| Catalogue | Entités | Orphelines | Taux |\n|---|---|---|---|\n`

let totalEntities = 0
let totalOrphans = 0
const orphansByCategory = {}
for (const [cat, allIds] of Object.entries(ids)) {
  const orphans = allIds.filter((id) => !isEntityConsumed(cat, id))
  orphansByCategory[cat] = orphans
  totalEntities += allIds.length
  totalOrphans += orphans.length
  const pct = allIds.length ? Math.round((orphans.length / allIds.length) * 100) : 0
  out += `| \`${cat}\` | ${allIds.length} | ${orphans.length} | ${pct} % |\n`
}
out += `| **Total** | **${totalEntities}** | **${totalOrphans}** | — |\n\n`

for (const [cat, orphans] of Object.entries(orphansByCategory)) {
  if (!orphans.length) continue
  out += `### \`${cat}\`\n\n`
  for (const id of orphans) {
    const label = labelOf(DATA_DIR, CATEGORY_FILES[cat], id)
    out += `- \`${id}\`${label ? ` — ${label}` : ''}\n`
  }
  out += `\n`
}

emitOrCheck({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:orphelines — ${OUT} est PÉRIMÉ (les catalogues source ont changé).`,
  rerunMsg: '  → relancer `npm run docs:orphelines` et committer le résultat.',
  okMsg: `docs:orphelines — OK (${OUT} à jour, ${totalOrphans}/${totalEntities} orphelines mesurées)`,
  writeMsg: `${OUT} — ${totalOrphans}/${totalEntities} orphelines mesurées sur ${Object.keys(ids).length} catalogues.`,
})
