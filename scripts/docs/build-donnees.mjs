// Atlas des données `src/data/*.json` = DONNÉE (#903) : la partie éditoriale (rangement par
// rubrique, description d'une ligne, règle d'or, pièges d'homonymes) vit dans
// src/data/donnees.manifest.json ; tout ce que l'arbre permet de DÉRIVER (liste des fichiers réels,
// nombre d'entrées, présence d'un schéma zod, complétude du manifeste) est CALCULÉ ici. Sortie :
// docs/donnees.md. Re-run : node scripts/docs/build-donnees.mjs (npm run docs:donnees). Mode --check
// (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé, exit 1 avec
// message actionnable si diff — jamais d'écriture en mode --check. Mécanique d'émission partagée :
// emitOrCheck (scripts/docs/lib/jsdocUnion.mjs), patron `scripts/docs/build-systemes.mjs`.
import { readFileSync, existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { sortieOutilLocal } from '../lancer-local.mjs'
import { emitOrCheck } from './lib/jsdocUnion.mjs'
import { FOLIO_RATCHET } from '../guards/lib/folioRatchetStock.mjs'

const DATA_DIR = 'src/data'
const DEFS_DIR = 'src/data/schemas/defs'

const MANIFEST = JSON.parse(readFileSync('src/data/donnees.manifest.json', 'utf8'))

/**
 * Taille du stock CLIQUET des folios réfutés — le seul nombre de folio que ce doc écrit : il vient
 * d'un MODULE (gratuit, stable, déjà dans le graphe des sources lues).
 *
 * Les deux autres cardinaux (entrées scannées, irrésolues) ne s'écrivent PAS ici : les MESURER
 * ferait entrer les ~300 chapitres du `Source/` dans l'empreinte de ce doc dérivé (mesuré :
 * `docs/.sources-lues.json` 358 → 651 fichiers, +4 s par génération), si bien que toute réparation
 * de chapitre périmerait `donnees.md` — un doc dérivé ne porte pas un cardinal vivant qui dépend
 * d'un autre corpus. Le doc renvoie à la commande qui les rend, `node scripts/data/audit-folios.mjs`.
 */
const FOLIO = { cliquetees: FOLIO_RATCHET.size }

const errors = []

/**
 * `fichier:ligne` d'une ANCRE de texte, MESURE a la generation : une citation ecrite a la main
 * dans un generateur perime au premier commit voisin, et la garde `docs-vs-commit` la lit.
 * L'ancre doit matcher EXACTEMENT une ligne — zero ou plusieurs, c'est une erreur nommee.
 */
function citeLigne(chemin, ancre) {
  const lignes = existsSync(chemin) ? readFileSync(chemin, 'utf8').split(String.fromCharCode(10)) : []
  const trouvees = lignes.flatMap((l, i) => (l.includes(ancre) ? [i + 1] : []))
  if (trouvees.length !== 1) {
    errors.push(`citeLigne : « ${ancre} » a ${trouvees.length} porteur(s) dans ${chemin} — recaler l'ancre (une seule ligne attendue).`)
    return chemin
  }
  return `${chemin}:${trouvees[0]}`
}

// --- inventaire réel ---
const filesOnDisk = listerDossier(DATA_DIR).filter((f) => f.endsWith('.json'))
const defBasenames = new Set(listerDossier(DEFS_DIR).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')))

/** Def de schéma d'un `xxx.json` : même basename, points remplacés par des tirets
 *  (`primitives.manifest.json` → `primitives-manifest.ts`, cf. convention _registry.generated.ts). */
const schemaDefOf = (jsonFile) => jsonFile.replace(/\.json$/, '').replace(/\./g, '-')
const hasSchema = (jsonFile) => defBasenames.has(schemaDefOf(jsonFile))

// --- complétude du manifeste : bijection avec les fichiers réels ---
const manifestFiles = new Set()
for (const r of MANIFEST.rubriques) for (const e of r.entrees) for (const f of e.files) manifestFiles.add(f)

for (const f of filesOnDisk) {
  if (!manifestFiles.has(f)) errors.push(`${f} existe sur disque mais n'est cartographié dans aucune rubrique de donnees.manifest.json`)
}
for (const f of manifestFiles) {
  if (!existsSync(`${DATA_DIR}/${f}`)) errors.push(`donnees.manifest.json cartographie ${f} — absent de ${DATA_DIR}/`)
}

// --- nombre d'entrées par fichier (tableau plat) ou nature « objet à sous-catalogues » ---
function shapeOf(jsonFile) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(`${DATA_DIR}/${jsonFile}`, 'utf8'))
  } catch {
    return 'illisible'
  }
  if (Array.isArray(parsed)) return `${parsed.length} entrée(s)`
  return 'objet à sous-catalogues'
}

// --- vérification des cas d'homonymes du manifeste : chaque fichier cité existe réellement ---
for (const cas of MANIFEST.homonymes.cas) {
  for (const e of cas.entrees) {
    if (!existsSync(`${DATA_DIR}/${e.file}`)) errors.push(`homonyme « ${cas.mot} » : ${e.file} cité mais absent de ${DATA_DIR}/`)
  }
}

const schemaCoverage = filesOnDisk.filter(hasSchema).length

// --- EXPOSITION Codex/éditeur (#1472) : DÉRIVÉE des defs, jamais une table écrite ici. Le dumper
// `scripts/docs/lib/dump-exposition.mts` (tsx) rend `fichier → { codex, edit }` tel que `document()`
// le déclare ; un def sans `exposition` fait échouer la génération, comme au runtime.
const EXPOSITION = JSON.parse(sortieOutilLocal(process.cwd(), 'tsx', 'tsx', ['scripts/docs/lib/dump-exposition.mts']))

/** Colonne « Exposition » d'un `xxx.json` : clés Codex exposées, route d'édition, ou exemption. */
function expositionOf(jsonFile) {
  const expo = EXPOSITION[jsonFile]
  if (!expo) return '—'
  const codex = 'exempt' in expo.codex
    ? `exempt (${expo.codex.exempt.kind}${expo.codex.exempt.ticket ? `, ${expo.codex.exempt.ticket}` : ''})`
    : expo.codex.keys.map((k) => `\`${k}\``).join(' · ')
  const edit = 'dataset' in expo.edit ? `dataset \`${expo.edit.dataset}\``
    : 'object' in expo.edit ? `objet ${expo.edit.object}`
    : 'niche' in expo.edit ? `niché (${expo.edit.niche.categories.map((c) => `\`${c}\``).join(' · ')})`
    : `aucune (${expo.edit.none})`
  return `${codex} — ${edit}`
}

const exemptions = Object.entries(EXPOSITION).filter(([, e]) => 'exempt' in e.codex)

// --- rendu docs/donnees.md ---
let out = `# Atlas des données — \`src/data/*.json\` (base app-owned)\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-donnees.mjs\` (\`npm run docs:donnees\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source éditoriale (rangement par rubrique, description, règle d'or, pièges d'homonymes) :\n`
out += `> \`src/data/donnees.manifest.json\`. La liste des fichiers, leur nombre d'entrées et la présence d'un\n`
out += `> schéma sont CALCULÉS de l'arbre réel — jamais périmés : re-générer après tout ajout/retrait de\n`
out += `> \`src/data/*.json\`.\n\n`
out += `> Réf VIVANTE. \`src/data/*.json\` est la **SOURCE app-owned** (commitée, éditable au Compendium). Cet\n`
out += `> atlas répond à trois questions AVANT d'ajouter/curer une donnée : **où vit chaque concept**, **quelles\n`
out += `> conventions de champs**, **qu'est-ce qui existe déjà**. Procédure pas-à-pas : \`docs/ajouter-une-donnee.md\`\n`
out += `> (skill \`ajouter-une-donnee\`). Complétude verrouillée par \`src/data/data-atlas-complete.test.ts\` (tout\n`
out += `> fichier doit être cartographié ici) ; chemins vérifiés par \`npm run docs:check\`.\n\n`

out += `**Périmètre mesuré et angles morts** — la carte §A vient du manifeste ÉDITORIAL\n`
out += `\`src/data/donnees.manifest.json\` (rangement par rubrique, description, homonymes) : rien de tout cela\n`
out += `ne se devine de l'arbre, un jugement humain reste nécessaire. Ce que ce générateur CALCULE et\n`
out += `réfute au besoin : (1) bijection stricte manifeste ⇄ \`${filesOnDisk.length}\` fichiers réels de\n`
out += `\`src/data/*.json\` (un \`.json\` neuf non cartographié, ou une entrée de manifeste pointant sur un\n`
out += `fichier disparu, casse la génération) ; (2) nombre d'entrées par fichier (comptage \`Array.isArray\`,\n`
out += `\`objet à sous-catalogues\` sinon — angle mort assumé : cette étiquette ne dit RIEN du contenu réel\n`
out += `d'un objet à sous-catalogues, juste qu'il n'est pas un tableau plat) ; (3) couverture du contrat de\n`
out += `schéma zod (\`${schemaCoverage}/${filesOnDisk.length}\`, cf. §E-bis) ; (4) présence effective sur disque de\n`
out += `chaque fichier cité par un cas d'homonyme de §D. Angle mort déclaré : les DESCRIPTIONS de rubrique,\n`
out += `de fichier et d'homonyme restent du texte manuscrit du manifeste — ce générateur ne les vérifie PAS\n`
out += `contre le contenu réel des \`.json\` (une description qui ment sur ce que porte un fichier ne casse\n`
out += `pas la génération) ; seule la complétude de la CARTE (quel fichier existe, où il est rangé) est\n`
out += `garantie, pas la justesse de sa glose.\n\n`

out += `La colonne **Exposition** de §A est DÉRIVÉE des \`exposition\` déclarées par les defs\n`
out += `(\`document(type, famille, champs, meta, exposition)\` → \`src/data/schemas/exposition-derivee.ts\`,\n`
out += `dumpée par \`scripts/docs/lib/dump-exposition.mts\`) : clés de catégorie Codex exposées, route\n`
out += `d'édition (\`dataset\` / \`objet single|record\` / \`niché\` / aucune), ou EXEMPTION motivée\n`
out += `(\`${exemptions.length}\` fichier(s) exempt(s) sur \`${filesOnDisk.length}\`). Aucune de ces valeurs n'est écrite ici :\n`
out += `un def qui change d'exposition change cette colonne au prochain \`npm run docs:donnees\`.\n\n`

out += `## §A — Carte : où va chaque donnée\n\n`
out += `**Règle d'or** : ${MANIFEST.reglesOr}\n\n`
for (const r of MANIFEST.rubriques) {
  out += `### ${r.label}\n`
  out += `| Fichier | Contient | Exposition (Codex — édition) |\n|---|---|---|\n`
  for (const e of r.entrees) {
    const label = e.files.map((f) => `\`${f}\``).join(' · ')
    const shapes = e.files.map(shapeOf).join(' · ')
    const expo = e.files.map(expositionOf).join(' ; ')
    out += `| ${label} | ${e.desc} (${shapes}) | ${expo} |\n`
  }
  out += `\n`
  if (r.note) out += `${r.note}\n\n`
}

out += `## §B — Conventions de champs (à respecter à l'ajout)\n\n`
out += [
  "- **`type`** = le **nom de base du dataset** (`peripeties.json` → `\"type\": \"peripeties\"`), en **2ᵉ clé",
  "  de chaque entrée**, juste après `id`. Ce n'est pas de la décoration : c'est le littéral que la",
  "  fabrique `document()` pose et VÉRIFIE au parse (§E-bis) — une entrée dont le `type` ment est",
  "  REFUSÉE. Il ne se recopie pas d'un dataset voisin : il se lit sur le nom du fichier.",
  "",
].join("\n")
out += `- **\`source.book\`** = l'\`id\` STABLE d'un livre de \`src/data/books.json\` (slug neutre, ex.\n`
out += `  \`livre-de-base\`, \`archives-de-l-empire-2\`, \`mer-des-griffes\`) — **jamais** l'abréviation d'affichage ni\n`
out += `  le libellé. Relation **id-pure** (i18n-safe) : \`books.json\` est la source de vérité, **enforced** par\n`
out += `  \`src/data/book-source-integrity.test.ts\` (tout \`source.book\` ∈ ids de livres). L'affichage résout\n`
out += `  id→\`abr\` via \`bookAbr\` (choke-point \`registry.ts\` \`src()\`). Pour un ajout : copier l'\`id\` d'une entrée\n`
out += `  voisine du même livre (\`grep '"book"' <fichier>\`), ou le lire dans \`books.json\`. Contenu fan\n`
out += `  communautaire = livre \`frenchy-bzh\`.\n`
out += `- **\`source.page\`** = la **page IMPRIMÉE du livre** (le folio), comme la donnée existante (ex. LDB « À\n`
out += `  Enroulement » = folio 297, AA « Cimeterre » = folio 90 — sa \`desc\`, règle 5 ; la ligne de stats\n`
out += `  du Cimeterre, folio 91, va en \`alsoIn\`, cf. plus bas). Pour l'obtenir : trouve ton contenu dans le\n`
out += `  \`.md\` du livre (\`docs/sources-vf.md\` → dossier \`Source/\`), puis lis le **\`data-folio="N"\`** de l'ancre\n`
out += `  \`<span id="page-… data-folio="N">\` la plus proche AU-DESSUS de ton contenu — **\`N\` = la valeur de\n`
out += `  \`source.page\`**. ⚠ Le NUMÉRO du span-id seul (\`page-89\`) est l'**index PDF**, PAS le folio (c'est le\n`
out += `  piège de #148) — toujours lire \`data-folio\`. **Tous les livres de règles autorisés** ont \`data-folio\`\n`
out += `  baké et les ancres nues (sans folio) retirées — étiquetés (LDB, ADE I/II, EDOC, Middenheim, NADJ, ACE,\n`
out += `  PDT) comme scans (AA, ZI, MDG, EDO, MSR, MSRC) ; le \`00 - Index.md\` de chaque livre liste ses chapitres\n`
out += `  avec leur folio de début.\n`
out += `  **Enforced** (#536) par \`src/data/book-source-integrity.test.ts\`, volet « intégrité du folio », par DEUX\n`
out += `  voies : (A) **hors-livre** — le folio dépasse le dernier folio ATTESTÉ du livre (\`bookMaxFolio\` : dernier\n`
out += `  marqueur \`data-folio\` et dernière page citée par \`00 - Index.md\`), réfutation qui se passe de la \`desc\`\n`
out += `  ; (B) **encadrement** — la prose de l'entrée étant verbatim (règle 5), elle LOCALISE l'entrée dans le \`Source/\`\n`
out += `  du livre déclaré, et l'encadrement \`data-folio\` de l'occurrence réfute le folio qui ment. La garde consomme la\n`
out += `  prose sous SES DEUX porteurs (#1389) : la \`desc\` inline, ou le texte que \`materialiser\` (\`scripts/source/resoudre.mjs\`)\n`
out += `  résout d'une \`descRef\` — une famille qui ADRESSE sa prose reste donc mesurée. Défauts fondateurs :\n`
out += `  \`redoutable\` (ZI) déclarait \`page: 11\` pour un texte en folio 134 ; \`activities.json:duel\` déclarait\n`
out += `  \`page: 223\` dans un ADE II qui compte 98 pages. Mécanique : \`scripts/guards/lib/folioIntegrity.mjs\` ;\n`
out += `  rapport de solde (donne le folio RÉEL) : \`node scripts/data/audit-folios.mjs\`.\n`
out += `  ⚠ **Ce que la garde NE voit PAS** — elle ne réfute que ce qu'elle PROUVE et se tait sur le reste : une part des\n`
out += `  entrées citées échappe à TOUT verdict, de la desc comme du titre (prose reformulée donc introuvable, prose trop\n`
out += `  courte pour localiser, chapitre sans marqueur, livre sans extraction FR) — les deux cardinaux se LISENT au run\n`
out += `  (\`node scripts/data/audit-folios.mjs\`, lignes « Entrées citées scannées » et « irrésolues ») et ne sont pas écrits\n`
out += `  ici : ils dépendent du \`Source/\`, qu'un doc dérivé de la DONNÉE n'a pas à prendre dans son empreinte. Une entrée\n`
out += `  neuve à desc NON verbatim et à folio faux mais PLAUSIBLE passe encore : seule la règle 5 la rattrape. Le\n`
out += `  stock n'est donc pas « les défauts du dépôt », c'est « les défauts que ces deux voies prouvent ».\n`
out += `  Si une desc se retrouve sur PLUSIEURS folios (définition ET récapitulatif d'annexe), cite la **DÉFINITION** ;\n`
out += `  le rapport les signale (rubrique « À ARBITRER ») car la garde ne les départage pas.\n`
out += `  **Mode CLIQUET** : le stock des ${FOLIO.cliquetees} entrées déjà fausses est gelé dans \`scripts/guards/lib/folioRatchetStock.mjs\`\n`
out += `  et ne peut que DÉCROÎTRE — toute entrée NEUVE au folio réfuté échoue la CI, toute clé soldée qui y traîne\n`
out += `  aussi, et sa TAILLE est plafonnée par la garde (\`FOLIO_RATCHET_MAX\`) pour qu'« ajouter une ligne au stock »\n`
out += `  ne soit jamais le chemin le plus court. \`node scripts/data/audit-folios.mjs --stock\` re-rend le stock et\n`
out += `  REFUSE de l'agrandir : l'outil ne sait que solder.\n`
out += `- **\`alsoIn?: SecondaryRef[]\`** (#563, doctrine user 2026-07-17 : « jamais 2 talents différents ») —\n`
out += `  un même Talent/Trait/Qualité/objet **réimprimé** dans un AUTRE livre (ou un autre folio du même\n`
out += `  livre) reste **UNE entrée** : l'ANCRE (\`source\`, scalaire, porte la \`desc\`, règle 5, STRUCTURELLE —\n`
out += `  jamais un tableau positionnel) + \`alsoIn\` porte les emplacements SECONDAIRES, chacun une paire\n`
out += `  \`(book, page)\` pleine + un \`quote?\` authoré (auto-attestation verbatim, pour le cas où le \`label\`\n`
out += `  n'apparaît pas tel quel au folio déclaré — ex. une TABLE imprime un nom différent). Accessors SOURCE\n`
out += `  UNIQUE : \`allLocations(entry)\`/\`sourceBooks(entry)\` (\`src/data/sourceRefs.ts\`) — aucun futur lecteur\n`
out += `  n'inline \`alsoIn\`. **Enforced** par \`src/data/secondary-ref-integrity.test.ts\` : chaque \`alsoIn[i]\`\n`
out += `  doit être **auto-attesté** (le \`label\` du porteur OU son \`quote\` retrouvé dans le SPAN du folio\n`
out += `  déclaré — charge de la preuve sur l'auteur, jamais une réfutation par absence). Champ posé sur\n`
out += `  \`traits.json\`/\`qualities.json\`/\`trappings.json\`/\`spells.json\`/\`naval-traits.json\`\n`
out += `  (\`traits.ts\`/\`qualities.ts\`/\`trappings.ts\`/\`spells.ts\`/\`naval-traits.ts\`). Exemple réel — le\n`
out += `  Cimeterre (AA) a sa \`desc\` en prose folio 90 et sa ligne de stats (tableau des armes) folio 91,\n`
out += `  où le \`label\` seul ne suffirait pas à distinguer la ligne dans le span sans un \`quote\` :\n`
out += '  ```json\n'
out += `  {\n`
out += `    "id": "cimeterre",\n`
out += `    "label": "Cimeterre",\n`
out += `    "source": { "book": "aux-armes", "page": 90 },\n`
out += `    "alsoIn": [{ "book": "aux-armes", "page": 91, "quote": "Cimeterre" }]\n`
out += `  }\n`
out += '  ```\n'
out += `  (Lot 2, #563 : 15 entrées migrées — republications identiques et scissions prose/ligne-de-stats.)\n`
out += `- **\`variants?: Variant[]\`** (#563/#564) — variante RÉGLÉE d'une entrée sous une **règle optionnelle**\n`
out += `  du registre \`OPTIONAL_RULES\` (\`src/engine/policy.ts:88\`, lue par \`rule(id)\`) : \`when.rule\` DOIT être\n`
out += `  un id du registre (jamais un label, gate fantôme sinon — **enforced** par\n`
out += `  \`src/data/variants-integrity.test.ts\`), \`when.equals\` défaut \`true\` ; \`desc\`/\`source\` PROPRES\n`
out += `  portent la règle 5 **par variante** (le walk \`citedEntriesOf\` de \`folioIntegrity.mjs\` la découvre\n`
out += `  déjà, structurellement identique à une entrée) ; \`combat\` réutilise \`CombatFeature\` tel quel.\n`
out += `  Résolution : \`effectiveEntry(entry)\` (\`src/engine/variants.ts\`) — PRIMITIVE UNIQUE, applique la\n`
out += `  première variante active (\`activeVariant\`) en REPLACE par champ DÉCLARÉ au premier niveau, sinon\n`
out += `  rend la forme LDB de base. Une variante ne peut republier QUE les champs que son dataset **résout**\n`
out += `  effectivement (liste blanche \`VARIANT_RESOLVED_FIELDS\` de la def, passée à \`variantOf\` — schéma\n`
out += `  \`strictObject\`, donc tout autre champ est rejeté au parse ; **enforced** aussi côté donnée par\n`
out += `  \`src/data/variants-integrity.test.ts\`) — \`talents.json\` résout quatre champs, UNE CITATION PAR LIGNE,
`
out += `  chacune à côté du SYMBOLE qu'elle porte (lignes MESURÉES à la génération, \`citeLigne\`) :
`
out += `
`
out += `  - \`desc\`/\`source\` — Codex, \`effectiveEntry\`, \`${citeLigne('src/ui/compendium/registry.ts', 'const e = effectiveEntry(t);')}\`
`
out += `  - \`test\` — \`talentTestSLBonus\`, \`${citeLigne('src/engine/magic.ts', 'export function talentTestSLBonus(')}\`
`
out += `  - \`max\` — \`talentMaxById\`, \`${citeLigne('src/engine/careerSlots.ts', 'export function talentMaxById(')}\`
`
out += `  - \`combat\` — \`featuresOf\`, \`${citeLigne('src/engine/combatFeatures/dispatch.ts', 'export function featuresOf(')}\`
`
out += `  - \`combat\` — \`castingKindOf\`, \`${citeLigne('src/engine/combatFeatures/dispatch.ts', 'export function castingKindOf(')}\`
`
out += `
`
out += `  \`traits.json\` ne résout, lui, que deux champs :
`
out += `
`
out += `  - \`desc\`/\`source\` — Codex, \`effectiveEntry\`, \`${citeLigne('src/ui/compendium/registry.ts', 'const t = effectiveEntry(t0);')}\`
`
out += `
`
out += `  \`passive\` et \`effects\` en sont EXCLUS — le moteur les lit sur
`
out += `  l'entrée brute (\`src/engine/talentEffects.ts\`, \`src/engine/traits/dispatch.ts\`) ; un champ n'entre\n`
out += `  dans la liste qu'une fois son consommateur routé par \`effectiveEntry\`. \`careers\`/\`skills\`/\`spells\`\n`
out += `  n'admettent aucune variante (aucun consommateur \`effectiveEntry\`). Champ posé sur \`talents.json\` —\n`
out += `  11 talents d'Aux Armes Annexe III.\n`
out += `- **\`desc\`** et tout champ de prose (effet, règles) = **copié/collé VERBATIM** de la source, en **Markdown**\n`
out += `  (\`**gras**\`, \`*ital*\`, listes \`-\`), jamais en HTML, jamais reformulé (règle stricte 5 ; garde\n`
out += `  \`src/data/no-html-in-prose.test.ts\`).\n`
out += `- **Formes de champ** = copiées des entrées voisines (\`damage:{plusBF,flat}\`, \`qualities:[{id}]\`,\n`
out += `  \`passive: GameOp[]\`…). Toute logique est keyée par **id stable** ; le \`label\` est de l'affichage.\n`
out += `- **Forme du fichier** : la plupart sont des tableaux plats d'entrées \`{id,label,…}\`, mais certains sont des\n`
out += `  **objets à sous-catalogues** (\`mass-battle.json\`, \`sea-*.json\`, \`criticals.json\`…) ou des **tables d100\n`
out += `  par fourchette** — lire la structure existante avant d'ajouter (cf. §A).\n`
out += `- **Canonicalisation** : après édition manuelle, le fichier doit être **byte-identique** au round-trip de\n`
out += `  \`serializeDataset\` (\`src/data/serialize.ts\`), verrouillé par \`src/data/serialize.test.ts\` (2 espaces,\n`
out += `  **aucun** newline final). L'éditeur Codex l'applique à la sauvegarde ; en édition manuelle, ne **jamais**\n`
out += `  reformater à la main ni via un \`JSON.stringify\` maison — passer par \`serializeDataset\`.\n\n`

out += `## §C — CHECK-FIRST (avant tout ajout — anti-doublon)\n\n`
out += `Le concept existe peut-être **déjà**, dans un AUTRE sous-système (incident #148 : le Bélier vit dans 6\n`
out += `fichiers). Avant d'ajouter :\n\n`
out += '```\n'
out += `grep -rniE '<id-candidat>|<label>|<concept>' src/data/*.json\n`
out += '```\n\n'
out += `Si l'élément (ou un synonyme) existe → NE PAS dupliquer : l'étendre là où il vit, ou re-scoper la tâche.\n`
out += `Puis choisir le fichier via §A. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats.\n\n`

out += `## §D — Pièges d'homonymes (un mot ≠ un concept)\n\n`
out += `${MANIFEST.homonymes.intro}\n\n`
out += `| Fichier | Ce que « ${MANIFEST.homonymes.cas[0].mot} » y est |\n|---|---|\n`
for (const cas of MANIFEST.homonymes.cas) {
  for (const e of cas.entrees) {
    out += `| \`${e.file}\` | ${e.desc} |\n`
  }
}
out += `\n${MANIFEST.homonymes.cas[0].lecon}\n\n`

// §E-bis — la fabrique `document()` est LE chemin (#1467 L1b). Lignes émises telles quelles :
// des chaînes à guillemets doubles (les backticks Markdown y sont littéraux), jointes par \n.
out += [
  "## §E-bis — Contrat de schéma (`src/data/schemas/`)",
  "",
  "Chaque document authoré valide contre un schéma zod **STRICT**, sur les **DEUX racines** de",
  "documents : `src/data` (catalogues de jeu, **" + schemaCoverage + "/" + filesOnDisk.length + "** datasets sous contrat, décompte",
  "CALCULÉ des defs présentes dans `src/data/schemas/defs/`) et `src/scenes` (projets de campagne",
  "`*-projet.json`, defs dans `src/data/schemas/defs-scenes/`).",
  "",
  "**La fabrique `document()` est LE chemin** (`src/data/schemas/grammaire/document.ts`) : un def ne",
  "compose plus son schéma à la main, il DÉCLARE son document et reçoit un **handle FERMÉ** (le schéma",
  "sort scellé — `.extend`/`.shape` n'existent ni au type ni au runtime ; la composition se fait dans la",
  "fabrique, une fois, ou pas du tout).",
  "",
  "```ts",
  "// src/data/schemas/defs/peripeties.ts — la forme réelle d'un def simple",
  "export const file = 'peripeties.json';",
  "export const famille = 'entite';",
  "",
  "const doc = document(",
  "  'peripeties',                                 // type = 2ᵉ clé de chaque entrée (§B)",
  "  famille,",
  "  {                                             // champs — la charge utile PROPRE au type",
  "    roll: z.number(),",
  "    kind: z.enum(['reposant', 'narratif', 'ereintant', 'attaque']),",
  "  },",
  "  {                                             // meta — libellé FR par champ, exigé pour CHAQUE clé",
  "    roll: { label: 'Face du dé', hint: 'Valeur du d10 qui déclenche cette Péripétie' },",
  "    kind: { label: 'Nature de la Péripétie', hint: 'Ce que le moteur sait jouer sans rien inventer' },",
  "  },",
  "  {                                             // exposition — Codex + éditeur",
  "    codex: { keys: ['peripeties'] },",
  "    edit: { dataset: 'peripeties' },",
  "  },",
  "  { exiges: ['desc'] },                         // options",
  ");",
  "",
  "export const schema = doc.schema;",
  "export const meta = doc.meta;",
  "```",
  "",
  "**Signature** : `document(type, famille, champs, meta, exposition, options?)`.",
  "",
  "**Les 3 familles** — l'emballage du FICHIER est posé par la fabrique, un def n'écrit plus jamais son",
  "`z.array` :",
  "",
  "- `entite` — le dataset est un **TABLEAU d'entrées** (le cas courant : catalogues de jeu, et les",
  "  fichiers qui portent plusieurs documents-tables).",
  "- `config` — l'**ENTRÉE seule** : le document forme à lui seul le fichier.",
  "- `record` — **enveloppe + `entries`** (`options.valeurRecord`, clé par `options.cleRecord`) ; en",
  "  famille `record` l'ENTRÉE *est* le document.",
  "",
  "**L'enveloppe** est posée par la fabrique, jamais redéclarée par un def — une clé d'enveloppe présente",
  "dans `champs` est une erreur de TYPE *et* d'exécution, qui la nomme. `id`, `type` et `label` sont",
  "requis ; `labelF`, `desc`, `descRef`, `icon`, `alsoIn` et `variants` optionnels ; la **provenance** est",
  "`source` ∨ `maison`. Leurs libellés FR appartiennent à la fabrique (`LIBELLES_ENVELOPPE`), pas aux defs.",
  "",
  "**Provenance** — un raffinement PRÉ-sceau refuse l'entrée qui n'a NI `source` NI `maison` (`maison` =",
  "la RAISON en clair d'un arbitrage, une CHAÎNE, jamais un drapeau). Les types dont la provenance n'est",
  "pas exigible (vocabulaires d'app, documents dont la source vit en profondeur) sont listés dans",
  "`SANS_PROVENANCE_EXIGEE` (`src/data/schemas/grammaire/sans-livre.ts`, union de `SANS_LIVRE` et",
  "`SOURCE_EN_PROFONDEUR`), seule table consultée par `exigeSource`.",
  "",
  "**`options`** :",
  "",
  "- `exiges` — clés d'ENVELOPPE que CE document rend requises ET non vides. `id`/`type`/`label` ne le sont",
  "  pas (la fabrique les pose déjà requises), `variants` non plus (la fabrique le compose depuis",
  "  `options.variantes`), ni `descRef` : l'exigence de PROSE se dit `exiges: ['desc']` et se satisfait par",
  "  l'un OU l'autre porteur (`desc` inline, `descRef` adressée) — jamais sur un porteur.",
  "- `idDocument` — schéma de l'id quand le catalogue est FERMÉ (patron `characteristics`) ; un schéma qui",
  "  admettrait la chaîne vide est refusé à la déclaration.",
  "- `variantes` — champs qu'une variante réglée republie (`variantOf`) ; un document sans `variantes`",
  "  n'admet aucun `variants`.",
  "- `affinerEntree` / `affinerDataset` — raffinements PRÉ-sceau, sur l'entrée ou sur le dataset emballé.",
  "- `cleRecord` / `valeurRecord` — clé et valeur de `entries` en famille `record` (EXIGÉES par elle,",
  "  REFUSÉES hors d'elle, en nommant le document).",
  "- `rangee` — schéma d'une RANGÉE : la fabrique pose alors `entries` sur l'entrée, avec sa méta FR",
  "  (`META_CHARGE`). Admissible dans toute famille — la charge est orthogonale à l'emballage.",
  "- `deDeTirage` — le document porte un DÉ de tirage : la fabrique pose `die` (requis, méta FR comprise).",
  "  Exige `rangee` ; un def à rangées ne redéclare NI `entries` NI `die` dans ses `champs`.",
  "",
  "**Les 4 exports plats du contrat `gen`** : tout def qui appelle `document(` exporte `file`, `schema`,",
  "`famille` et `meta` **À PLAT**. Le générateur de registre est TEXTUEL (lecture par regex, jamais un",
  "import) — la sanction diffère donc PAR EXPORT, et une seule est silencieuse :",
  "",
  "- `file` non conforme au filtre `scripts/gen-registry.mjs:370` (`^export const file = '`, guillemet",
  "  SIMPLE littéral) : le def est **ÉCARTÉ du registre, en silence** — double quote, `: string` annoté,",
  "  littéral gabarit et `= doc.file` compilent tous et sortent pourtant du registre. Seul cet export",
  "  décide de l'appartenance au registre.",
  "- `meta` non plat : le def **RESTE au registre** et perd son entrée `meta` (invisible de `presents()`,",
  "  `scripts/gen-registry.mjs:382`) — l'atelier retombe sur la clé technique, sans qu'aucun gate rougisse.",
  "- `schema`/`famille` destructurés (`export const { schema } = doc`) **COMPILERAIENT** : la",
  "  destructuration crée un vrai nom importable. La garde n'y protège pas la compilation mais la",
  "  CONVENTION — forme plate unique, lisible par un codemod.",
  "",
  "Garde : `defsSansExportsPlats`, dans `src/ui/compendium/libelles-de-champs.test.tsx` (« convention",
  "d'export lue par le générateur de registre »), dont le bras `file` rend le verdict DU GEN forme par forme.",
  "",
  "**Méta d'édition** — chaque clé de `champs` exige sa `MetaChamp` (`{ label }` au minimum), et toute",
  "méta sans champ correspondant est refusée. C'est le canal registre → atelier (`metaPourFichier`,",
  "`src/data/schemas/validate.ts`) : les gardes de libellés et le CLIQUET de couverture vivent dans",
  "`src/ui/compendium/libelles-de-champs.test.tsx` — les CHIFFRES y sont, jamais recopiés ici.",
  "",
  "**Registres GÉNÉRÉS** — `_registry.generated.ts`, `_registry-scenes.generated.ts` et",
  "`_ids.generated.ts`, par `node scripts/gen-registry.mjs` (`npm run gen`). Ne JAMAIS éditer à la main.",
  "`DEFS_DE_DOCUMENT` (`src/data/schemas/validate.ts`) est l'union des deux registres.",
  "",
  "Un def de `src/data/schemas/defs-scenes/` suit la même fabrique ; son `file` est le **chemin RELATIF à",
  "`src/scenes`** (`arene/arene-projet.json`), jamais un basename, et les defs de projet partagent",
  "le même `projetSchema` (`src/data/schemas/defs-scenes/projet.ts`), composé des formes de scène",
  "(`scene.ts`), de carte du monde (`worldmap.ts`) et du bloc narratif (`narratif.ts`).",
  "",
  "**Deux portes, une vérité** (`src/data/schemas/validate.ts`) :",
  "",
  "- `validateDataset(file, value)` — porte par **FICHIER**, pour qui connaît le nom du document. Un",
  "  fichier NON registré est une **erreur nommée**, jamais un laissez-passer.",
  "- `validateDocument(schema, value)` — porte par **SCHÉMA**, pour un seam SANS nom de fichier :",
  "  `parseProject` (`src/state/worldMap.ts`) sert du JSON committé, du localStorage ET de l'import",
  "  utilisateur. C'est là que le projet est validé — forme ET sémantiques (FK `activeAxes`, invariants",
  "  du bloc narratif, FK intra-document `entity.presetId`, forme de `meta`).",
  "",
  "**Portes qui font respecter le contrat :**",
  "",
  "- `src/data/schemas/grammaire/grammaire.test.ts` — le contrat de la FABRIQUE : enveloppe, emballage",
  "  par famille, sceau, variantes, verrous paramétrés, et le mesureur des contrats d'enveloppe requis",
  "  qui justifie `exiges`. Les comptes vivent LÀ, à la mesure — jamais recopiés dans une doc.",
  "- `src/data/schema-contract.test.ts` (CI/`npm test`) : (a) chaque document des deux racines valide",
  "  son JSON réel, (b) EXHAUSTIVITÉ (tout document est registré ou dans `PENDING`), (c) CLIQUET",
  "  (`PENDING` ne peut pas contenir un fichier déjà schématisé). `PENDING` est **vide** : tout nouveau",
  "  document naît AVEC son def, jamais en PENDING transitoire.",
  "- `scripts/guards/validate-data.mts` (pre-commit, `scripts/git-hooks/pre-commit.mjs`) : sur les",
  "  `.json` STAGÉS, reparse et revalide contre `DEFS_DE_DOCUMENT` — les DEUX registres, `src/data`",
  "  et `src/scenes` (Node/tsx, hors Vitest). **STRICT** : un document authoré des deux racines SANS",
  "  schéma au registre est une ERREUR nommée ; un chemin hors des deux racines n'est pas de sa",
  "  juridiction (compté à part, jamais jugé).",
  "",
  "**Formes RÉELLES par dataset** (comparer une référence, une valeur, une enveloppe d'un document à",
  "l'autre) : `docs/structures-donnees.md`, GÉNÉRÉ (`npm run docs:structures`).",
  "",
  "**Geste « ajouter un document »** : créer le `.json` **et** son def (`schemas/defs/<nom>.ts` pour",
  "`src/data`, `schemas/defs-scenes/<nom>.ts` pour `src/scenes`) — appel à `document()` plus les 4",
  "exports plats — dans le même commit, puis `npm run gen` : sinon la garde EXHAUSTIVITÉ échoue",
  "(orphelin ni registré ni PENDING).",
  "",
  "",
].join("\n")
out += `## §E-ter — Les deux espaces de clés « race » (species ⇄ rig)\n\n`
out += `Deux conventions de nommage de race coexistent, **par dessein**, DÉCOUPLÉES :\n\n`
out += `- **espace « données de personnage »** (\`species.refChar\`/\`species.refCareer\`, ex. \`Haut Elfe\`, \`Elfe\n`
out += `  Sylvain\`) — clé de \`names.json\`, \`careers.json\`, \`eyes.json\`, \`hairs.json\`, \`details.json\`.\n`
out += `- **espace « rig »** (id d'apparence, sûr pour nom de fichier, ex. \`Haut-Elfe\`, \`Elfe sylvain\`) — id\n`
out += `  de \`raceAppearance.json\` et des defs de \`src/gameIso/rig/\`.\n\n`
out += `\`speciesRace.json\` (consommé via \`baseSpeciesOf\`) est le **pont UNIQUE** species→rig — 5 des 7 races\n`
out += `jouables sont identiques d'un espace à l'autre, seuls les elfes divergent par tiret/casse ; ce\n`
out += `découplage est **intentionnel** (unifier les deux espaces casserait l'un des deux clans, chacun avec\n`
out += `ses dizaines de fichiers). Garde : \`src/data/names-species-keyspaces.test.ts\` — échoue si \`names.json\`\n`
out += `dérive hors de l'espace \`refChar\`, si le pont species→rig cesse d'être 1:1, ou si une clé d'un espace\n`
out += `se met à ressembler à une clé de l'autre sans être le couple ponté sanctionné.\n\n`

out += `## §F — À COLLER DANS UN BRIEF D'AGENT « DONNÉE »\n\n`
out += `> Tu vas ajouter/curer une entrée dans \`src/data/*.json\`. Discipline OBLIGATOIRE :\n`
out += `> 1. **CHECK-FIRST** : \`grep -rniE '<id>|<label>|<concept>' src/data/*.json\`. Le concept vit peut-être\n`
out += `>    déjà dans un autre sous-système (ex. #148 : le Bélier est dans 6 fichiers). S'il existe → ne duplique\n`
out += `>    pas, étends-le ou re-scope.\n`
out += `> 2. **Bon fichier** via \`docs/donnees.md\` §A. Une « machine de guerre / véhicule / navire » n'est pas un\n`
out += `>    \`trappings\`. Si c'est un **sort / une créature / un effet mécanique / une icône / un livre** → utilise\n`
out += `>    le skill de domaine dédié (\`ajouter-un-sort\`/\`creer-une-creature\`/\`ajouter-une-mecanique\`/…).\n`
out += `> 3. **Chaque champ = Source RAW ⊕ voisins** : lis le **tableau ET son en-tête** au \`Source/\` (FR only ;\n`
out += `>    ne confonds pas une colonne « Équipe » avec « Encombrement »). \`book\` = \`abr\` de \`books.json\` ;\n`
out += `>    \`page\` = vraie page ; \`desc\` = verbatim Markdown ; formes copiées des voisins.\n`
out += `> 4. **Zéro invention, zéro inflexion RAW silencieuse** : un champ introuvable → omission assumée ; une\n`
out += `>    mécanique RAW non modélisable → **issue au gabarit #101+** ou valeur \`maison\` taguée, JAMAIS « hors\n`
out += `>    scope ».\n`
out += `> 5. **Vérifie** : canonicaliser via \`serializeDataset\`, puis \`npm test\` + \`npm run typecheck\` verts ;\n`
out += `>    recette navigateur si l'élément est visible au Codex/éditeur.\n`

if (errors.length) {
  console.error(`build-donnees — ${errors.length} erreur(s) d'intégrité manifeste :`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

const CHECK = process.argv.includes('--check')
emitOrCheck({
  out,
  path: 'docs/donnees.md',
  check: CHECK,
  staleMsg: "docs:donnees — docs/donnees.md est PÉRIMÉ (diverge de src/data/donnees.manifest.json ou de l'arbre src/data/*.json).",
  rerunMsg: '  → relancer `npm run docs:donnees` et committer le résultat.',
  okMsg: 'docs:donnees — OK (docs/donnees.md à jour)',
  writeMsg: `docs/donnees.md — ${filesOnDisk.length} fichiers cartographiés, ${schemaCoverage}/${filesOnDisk.length} sous contrat de schéma.`,
})
