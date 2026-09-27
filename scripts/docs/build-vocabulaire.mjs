// Carte du VOCABULAIRE MÉCANIQUE — GÉNÉRÉE depuis les unions discriminées du moteur pur :
//   `GameOp`                                            → src/engine/ops.ts
//   `Condition` / `Flow` / `EffectTrigger` / `EffectTargeting` → src/engine/flowCore.ts
// Sortie : docs/vocabulaire-mecanique.md. Re-run : node scripts/docs/build-vocabulaire.mjs
// (npm run docs:vocabulaire).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
// Même socle AST/JSDoc que build-effects.mjs : scripts/docs/lib/jsdocUnion.mjs.
//
// Trois colonnes MESURÉES (jamais recopiées à la main) :
//  1. « Résolution » — l'op a-t-elle un `case` dans le switch d'`applyOps` (AST) ? Sinon elle est
//     laissée telle quelle par le moteur pur et résolue AILLEURS ; la colonne « Résolveurs » liste
//     les modules de src/engine + src/state qui la nomment.
//  2. « Usage en donnée » — occurrences `op` dans src/data (JSON parcouru en profondeur, l'`id` de
//     l'entrée porteuse la plus proche est remonté ; .ts manuscrits sourcés par motif `op: '…'`).
//  3. « Concepts » — index inversé FR, du LEXIQUE ci-dessous appliqué au nom + au JSDoc de l'op.
//
// GARDE D'EXHAUSTIVITÉ (exit 1) : toute entrée d'union sans JSDoc exploitable, et toute op qui ne
// tombe dans AUCUN concept, font échouer la génération — donc la CI (docs:check). Le lexique est
// forcé de croître avec le vocabulaire.
import ts from 'typescript'
import { readFileSync } from 'node:fs'
import { parLibelle, listerArbre } from '../guards/lib/lister.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'
import { basename } from 'node:path'
import { loadSource, findAlias, aliasDoc, readUnionMembers, renderFields } from './lib/jsdocUnion.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import { mesurerCanaux } from './lib/canauxMecaniques.mjs'

const OPS_SRC = 'src/engine/ops.ts'
const FLOW_SRC = 'src/engine/flowCore.ts'
const OUT = 'docs/vocabulaire-mecanique.md'
const TOOL = 'build-vocabulaire'

// Périmètre MESURÉ des colonnes « Résolveurs » et « Usage en donnée » (déclaré dans le .md).
const RESOLVER_ROOTS = ['src/engine', 'src/state']
const DATA_ROOT = 'src/data'

// ---------------------------------------------------------------------------
// Lexique de CONCEPTS (français) — l'entrée par le SENS, puisque les noms d'ops sont en anglais.
// Chaque motif est appliqué au NOM de l'op + à la 1re phrase de son JSDoc (jamais au corps entier :
// un JSDoc de 15 lignes cite tous les voisins du moteur et l'index vire au bruit). Un concept n'est
// pas une règle : c'est un chemin de recherche. Une op sans aucun concept = génération ROUGE.
// Stems BORNÉS (`\bration` et non `ration` — « altération » contient « ration »).
// ---------------------------------------------------------------------------
const CONCEPTS = [
  ['Armure, Points d\'Armure, protection', /\bPA\b|armure|bouclier|d[ôo]me|prot[ée]ction|prot[ée]g/i],
  ['Armes : enchanter, altérer, invoquer, désarmer', /\barmes?\b|d'arme|lame|d[ée]sarm|\bl[âa]che l'objet|atout\/d[ée]faut|passif d'arme/i],
  ['Attaquer : touche, attaque gratuite, mot-clé d\'attaque', /attaqu|\btouche\b|frapp|riposte|\bcharge\b|assaut|mot-cl[ée]/i],
  ['Avantage', /avantage/i],
  ['Blessures, dégâts, Coups Critiques', /blessur|d[ée]g[âa]ts?\b|critiques?\b|h[ée]morrag|\bPB\b/i],
  ['Caractéristiques et attributs (max de Blessures, Chance…)', /caract[ée]ristique|attribut secondaire|bonus de force/i],
  ['Compétences, Talents, Carrières : octroyer, modifier', /comp[ée]tence|talent|carri[èe]re/i],
  ['Composition : séquence d\'ops, palier, tableau, récurrence', /tableau|\btable\b|paliers?\b|jet [àa] paliers|r[ée]current|tirage sur/i],
  ['Corruption, Chaos, mutation, Péché', /corruption|chaos|\bmutations?\b|p[ée]ch[ée]|damnation|d[ée]moniaque/i],
  ['Durée, horloge, effet différé, expiration', /dur[ée]e|temporis|diff[ée]r[ée]e?s?\b|[ée]ch[ée]ance|horloge|expiration|multi-rounds/i],
  ['Empoignade, entrave, immobilisation', /empoign|emp[êe]tr|entrav|immobilis|grapple|escapeStrength|entangle/i],
  ['États (LDB 16) : poser, retirer, ignorer une pénalité d\'État', /[ÉéEe]tats?\b|condition/i],
  ['Faim, provisions, alcool, ivresse', /\bfaim\b|manger|\bboire\b|provision|\brations?\b|alcool|ivresse|boisson/i],
  ['Lumière, vision, brouillard de guerre', /lumi[èe]re|\bvision\b|brouillard/i],
  ['Magie, incantation, prière, miracle, contrecoup', /incantation|magi|\bsorts?\b|pri[èe]re|focalisation|imparfaite|mirac|b[ée]n[ée]diction|aethyr|sorci[èe]re/i],
  ['Maladies : exposer, contracter, guérir, symptômes', /maladies?\b|sympt[ôo]me|infect/i],
  ['Mort, retrait du jeu, bannissement', /\bmort\b|mourr|banni|retrait du jeu|[àa] la mort/i],
  ['Monnaie, bourse, argent', /monnaie|bourse|sous? de cuivre|pistole|couronne d'or/i],
  ['Mouvement, allonge, terrain', /mouvement|\bterrain\b/i],
  ['Narratif, arbitrage non modélisé', /narrati|arbitrage mj|non mod[ée]lis/i],
  ['Navire, coque, équipage, poste d\'artillerie', /navire|coque|[ée]quipage|pi[èe]ce d'artillerie|commandant d'[ée]quipe|\bposte\b/i],
  ['Objets, possessions, inventaire', /\bobjets?\b|possession|inventaire|cr[ée]e un objet/i],
  ['Position, zone, poussée, téléportation, rebond', /\bzone\b|pouss[ée]e|t[ée]l[ée]portation|attaques en cha[îi]ne|positionnel|sur la grille/i],
  ['Psychologie : Peur, Terreur, Frénésie, Animosité, Obsession', /psycholog|fr[ée]n[ée]s|\bpeur\b|terreur|animosit|pr[ée]jug|obsession|psy\b/i],
  ['Ressources : Chance, Destin, Résilience, Détermination', /points? de chance|\bdestin\b|r[ée]silience|d[ée]termination|relancer le prochain/i],
  ['Sens et organes : vue, ouïe, cécité, surdité', /organe|\bvue\b|ou[ïi]e|c[ée]cit|surdit|sensoriel/i],
  ['Soin, guérison, régénération, aide médicale', /\bsoins?\b|soign|gu[ée]ri|convalescence|blessures rendues|aide m[ée]dicale/i],
  ['Statut social, Réputation, Standing', /standing|r[ée]putation|statut/i],
  ['Suffocation, respiration, exposition météo', /suffocation|suffoqu|respirer|m[ée]t[ée]o|exposition m[ée]t[ée]o/i],
  ['Tests : modificateur, DR, relance, inversion, gate', /modificateur de test|modificateur au test|\bDR\b|relanc|inversion de test|\bgate\b|tests? (?:du|de la|d'|li[ée]s)/i],
  ['Traits de créature : octroyer, retirer', /\btraits?\b/i],
  ['Transformation, métamorphose, forme alternative', /m[ée]tamorphose|transformation|forme bestiale|forme alternative/i],
  ['Tour de jeu : perdre son Action / son Mouvement', /perd sa prochaine|gate d'action|perte de tour/i],
  ['Invocation, créatures, bestiaire, reconstitution', /invocation|invoque|cr[ée]atures?\b|bestiaire|reconstitution|ré-invocation/i],
]

// ---------------------------------------------------------------------------
// Mesure 1 — l'op est-elle traitée par le switch d'`applyOps` (moteur PUR) ?
// ---------------------------------------------------------------------------
function applyOpsCases(sf, path) {
  let fn
  const findFn = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'applyOps') fn = n
    else ts.forEachChild(n, findFn)
  }
  ts.forEachChild(sf, findFn)
  if (!fn) {
    console.error(`${TOOL} — fonction « applyOps » introuvable dans ${path} (la mesure de pureté ne peut pas être dérivée).`)
    process.exit(1)
  }
  let sw
  const findSwitch = (n) => {
    if (sw) return
    if (ts.isSwitchStatement(n)) { sw = n; return }
    ts.forEachChild(n, findSwitch)
  }
  ts.forEachChild(fn, findSwitch)
  if (!sw) {
    console.error(`${TOOL} — aucun switch dans « applyOps » (${path}).`)
    process.exit(1)
  }
  // Une clause SANS statements tombe (fall-through) sur la clause suivante qui en porte : c'est le
  // groupe qui décide. Un groupe dont le corps se réduit à `break;` NE FAIT RIEN — l'op est déclarée
  // au moteur pur mais y reste INERTE (résolue ailleurs). C'est LA distinction que cette carte doit
  // rendre évidente : « inerte dans applyOps » ≠ « inutilisable ».
  const verdict = new Map()
  let pending = []
  for (const clause of sw.caseBlock.clauses) {
    if (!ts.isCaseClause(clause) || !ts.isStringLiteral(clause.expression)) { pending = []; continue }
    pending.push(clause.expression.text)
    if (!clause.statements.length) continue
    const stmts = clause.statements
    const inert = stmts.length === 1 && ts.isBreakStatement(stmts[0])
    for (const n of pending) verdict.set(n, inert ? 'inerte au switch' : 'exécutée')
    pending = []
  }
  return verdict
}

// ---------------------------------------------------------------------------
// Mesure 2 — modules qui NOMMENT l'op (là où une op hors-`applyOps` est réellement résolue).
// ---------------------------------------------------------------------------
/** Fichiers de PRODUCTION de `dir` portant une des extensions, en ORDRE TOTAL (hors `node_modules`). */
function fichiersSources(dir, exts) {
  return listerArbre(dir, {
    descendre: (rel) => !rel.split('/').includes('node_modules'),
    filtre: (rel) => exts.some((x) => rel.endsWith(x)) && !estFichierVitest(rel),
  }).map((rel) => `${dir}/${rel}`)
}

function measureResolvers(opNames) {
  const byOp = new Map(opNames.map((n) => [n, new Set()]))
  const files = RESOLVER_ROOTS.flatMap((r) => fichiersSources(r, ['.ts', '.tsx'])).filter((f) => f !== OPS_SRC)
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    // Restreint aux modules du vocabulaire (ils importent/manipulent `GameOp`) : évite qu'un
    // `case 'push'` d'un mode de ciblage soit compté comme résolveur de l'op `push`.
    if (!text.includes('GameOp')) continue
    for (const name of opNames) {
      // Formes RÉELLES d'une référence à une op dans le code : discrimination (`.op === 'x'`,
      // `.op !== 'x'`), construction (`op: 'x'`), aiguillage (`case 'x'`), argument d'un collecteur
      // (`pmods(c, 'x')`) et liste d'ids d'ops (`[… , 'x', …]`).
      const rx = new RegExp(`\\.op\\s*[!=]==\\s*'${name}'|\\bop:\\s*'${name}'|\\bcase\\s+'${name}'|[(,]\\s*'${name}'\\s*[,)\\]]`)
      if (rx.test(text)) byOp.get(name).add(f)
    }
  }
  return byOp
}

// ---------------------------------------------------------------------------
// Mesure 3 — usages en DONNÉE (src/data).
// ---------------------------------------------------------------------------
function measureDataUsage(opNames) {
  const known = new Set(opNames)
  const byOp = new Map(opNames.map((n) => [n, []]))
  const push = (op, file, id) => { if (known.has(op)) byOp.get(op).push({ file: basename(file), id }) }

  // `id` REMONTÉ = celui de l'entrée porteuse la plus proche. La clé ne fait office d'id qu'à la
  // RACINE d'une base indexée (`{ "<id>": { … } }`) — sinon un champ interne nommé `effect`/`passive`
  // se ferait passer pour l'entrée (l'id affiché mentirait).
  const walkJson = (node, nearestId, file, depth) => {
    if (Array.isArray(node)) { for (const v of node) walkJson(v, nearestId, file, depth + 1); return }
    if (!node || typeof node !== 'object') return
    const id = typeof node.id === 'string' ? node.id : nearestId
    if (typeof node.op === 'string') push(node.op, file, id)
    for (const k of Object.keys(node)) {
      const v = node[k]
      const rootKeyed = depth === 0 && id == null && v && typeof v === 'object' && !Array.isArray(v)
      walkJson(v, rootKeyed ? k : id, file, depth + 1)
    }
  }

  for (const f of fichiersSources(DATA_ROOT, ['.json'])) {
    let parsed
    try { parsed = JSON.parse(readFileSync(f, 'utf8')) } catch { continue }
    walkJson(parsed, null, f, 0)
  }
  // Données MANUSCRITES sourcées en .ts (criticals, shipCriticals, defs/…) : pas d'`id` remontable
  // sans typage — le fichier suffit à prouver l'usage.
  for (const f of fichiersSources(DATA_ROOT, ['.ts'])) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(/\bop:\s*'([A-Za-z][\w]*)'/g)) push(m[1], f, null)
  }
  return byOp
}

// ---------------------------------------------------------------------------
// Extraction des unions
// ---------------------------------------------------------------------------
const ops = loadSource(OPS_SRC)
const flow = loadSource(FLOW_SRC)

const gameOpAlias = findAlias(ops.sf, 'GameOp', TOOL, OPS_SRC)
const { rows: opRows, rawCount: opRawCount } = readUnionMembers(ops.sf, ops.text, gameOpAlias, 'op', TOOL)

const VERDICT = applyOpsCases(ops.sf, OPS_SRC) // op → 'exécutée' | 'inerte au switch' | (absente = hors switch)
const OP_NAMES = opRows.map((r) => r.name)
const RESOLVERS = measureResolvers(OP_NAMES)
const DATA_USAGE = measureDataUsage(OP_NAMES)

// --- les TROIS canaux de mécanique en donnée (déclarations de champs, AST) ---
// Périmètre : les racines qui déclarent les entités mécaniques. Pré-filtre textuel pour ne parser
// que les fichiers qui peuvent porter un canal (l'AST sur toute la racine coûterait sans rien rendre).
// ANGLE MORT : ce pré-filtre BORNE la mesure — une déclaration de canal écrite hors de ces motifs
// (champ renommé, canal déclaré par un type intermédiaire) n'est JAMAIS parsée, et le garde ci-dessous
// ne mord que sur le zéro absolu, jamais sur une entité manquante.
const CANAUX_ROOTS = [DATA_ROOT, ...RESOLVER_ROOTS]
const CANAUX = mesurerCanaux(
  CANAUX_ROOTS.flatMap((r) => fichiersSources(r, ['.ts'])).filter((f) => /^\s*(passive|effects|capabilities|combat)\??:|interface\s+\w*(Capabilities|CombatFeature)\b/m.test(readFileSync(f, 'utf8'))),
)
if (!CANAUX.entites.length || !CANAUX.typesDrapeaux.length) {
  console.error(`${TOOL} — aucun canal mesuré sous ${CANAUX_ROOTS.join(', ')} (les champs \`passive\`/\`effects\`/\`capabilities\` ont changé de forme).`)
  process.exit(1)
}
for (const t of CANAUX.typesDrapeaux) {
  if (!t.fichier || !t.champs.length) {
    console.error(`${TOOL} — type de drapeaux « ${t.nom} » référencé mais introuvable (hors périmètre ${CANAUX_ROOTS.join(', ')}) : la carte mentirait par omission.`)
    process.exit(1)
  }
}

// --- index inversé concept → ops, et garde d'exhaustivité ---
const conceptOf = new Map(OP_NAMES.map((n) => [n, []]))
const opsOfConcept = new Map(CONCEPTS.map(([label]) => [label, []]))
for (const r of opRows) {
  // Haystack : nom + NOMS DE CHAMPS + 1re phrase. Les champs sont courts et précis (`grapple`,
  // `escapeStrength`…) : ils portent des concepts que la 1re phrase ne nomme pas, sans le bruit du
  // corps entier du JSDoc.
  const hay = `${r.name} ${r.fieldGroups.flat().join(' ')} ${r.role ?? ''}`
  for (const [label, rx] of CONCEPTS) {
    if (rx.test(hay)) { conceptOf.get(r.name).push(label); opsOfConcept.get(label).push(r.name) }
  }
}

const errors = []
for (const r of opRows) {
  if (!r.role) errors.push(`op \`${r.name}\` : aucun JSDoc exploitable au-dessus de sa variante dans ${OPS_SRC}`)
  if (!conceptOf.get(r.name).length) errors.push(`op \`${r.name}\` : ne tombe dans AUCUN concept du lexique de ${TOOL} — ajouter/élargir un motif CONCEPTS`)
}
for (const [label, list] of opsOfConcept) {
  if (!list.length) errors.push(`concept « ${label} » : 0 op — motif mort, à retirer ou corriger`)
}
if (errors.length) {
  console.error(`${TOOL} — ${errors.length} manque(s) d'exhaustivité :`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
const esc = (s) => (s ?? '—').split('|').join('\\|')
const rel = (f) => f.replace(/^src\//, '')

function usageCell(name) {
  const hits = DATA_USAGE.get(name)
  if (!hits.length) return '**0**'
  const shown = hits.slice(0, 2).map((h) => (h.id ? `${h.file}:${h.id}` : h.file))
  return `${hits.length} — ${shown.map((s) => `\`${s}\``).join(', ')}${hits.length > 2 ? ' …' : ''}`
}
function resolverCell(name) {
  const list = [...RESOLVERS.get(name)].sort()
  if (!list.length) return '—'
  return list.slice(0, 3).map((f) => `\`${rel(f)}\``).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '')
}

let out = `# Vocabulaire mécanique du moteur — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-vocabulaire.mjs\` (\`npm run docs:vocabulaire\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Sources : l'union \`GameOp\` de \`src/engine/ops.ts\` et les unions \`Condition\`/\`Flow\`/\`EffectTrigger\`/\n`
out += `> \`EffectTargeting\` de \`src/engine/flowCore.ts\`. Vocabulaire d'EFFET et de LOGIQUE partagé par les sorts,\n`
out += `> traits, talents, états, maladies, qualités d'arme, consommables et flux de combat.\n`
out += `> Le vocabulaire de SCÈNE (\`Effect\`) vit dans \`docs/campagne-effects.md\`.\n\n`

out += `## Comment lire cette carte\n\n`
out += `**Colonne « Résolution »** — c'est le piège nº 1 de ce fichier, lisez-le avant de conclure qu'une op n'existe pas.\n`
out += `Elle rapporte UN FAIT d'AST, rien d'autre : ce que le switch d'\`applyOps\` (moteur pur) fait de l'op.\n\n`
out += `- **exécutée** — \`case\` PORTEUR de code : le moteur pur mute le \`Combatant\` et rend ses lignes de journal.\n`
out += `- **inerte au switch** — \`case\` dont le corps se réduit à \`break;\`.\n`
out += `- **hors switch** — aucun \`case\` : l'op tombe dans le défaut.\n\n`
out += `**« inerte au switch » et « hors switch » ne veulent PAS dire « inutilisable ».** C'est le patron NORMAL de deux\n`
out += `familles, que cette colonne ne distingue pas (elle ne mesure pas la sémantique) :\n\n`
out += `- les effets **IMPURS** (grille, initiative, file d'horloge — \`summon\`, \`zone\`, \`push\`, \`teleport\`, \`delayed\`…),\n`
out += `  résolus par la couche \`src/state\` ;\n`
out += `- les **PASSIFS** (\`weaponRollMod\`, \`incomingAttackMod\`, \`offTerrainMod\`…), jamais « lancés », LUS au point de\n`
out += `  calcul par un collecteur.\n\n`
out += `Le JSDoc de ces ops dit souvent « INERTE dans \`applyOps\` » : la phrase décrit le moteur pur, pas la capacité.\n`
out += `La colonne « Résolveurs » dit où ça se joue vraiment — c'est elle qui tranche entre les deux familles.\n\n`
out += `**Colonne « Résolveurs »** — modules de \`src/engine\`/\`src/state\` (hors tests, hors \`ops.ts\`) qui nomment l'op.\n`
out += `**Colonne « Donnée »** — occurrences dans \`src/data\` : \`fichier:id-de-l-entrée\`. Un **0** signale une op qu'AUCUNE donnée\n`
out += `n'emploie — candidate au code mort, à instruire (elle peut être employée par du code, cf. « Résolveurs »).\n\n`
out += `**Périmètre mesuré / angles morts** — la table des TROIS CANAUX est dérivée des déclarations de champs ;\n`
out += `« Résolveurs » et « Donnée » sont des mesures TEXTUELLES bornées :\n`
out += `hors périmètre, donc invisibles ici, les ops construites dynamiquement dans \`src/engine\`/\`src/state\` (\`engine/miscast\`,\n`
out += `\`engine/polymorph\`… fabriquent des \`GameOp\` en code), les JSON de campagne hors \`src/data\`, les tests, et \`src/ui\`\n`
out += `(affichage, jamais résolution). Un **0** en « Donnée » n'est donc pas une preuve de mort : c'est une PISTE.\n\n`

out += `## Les trois canaux de mécanique en donnée\n\n`
out += `\`GameOp\` est la langue de l'axe EFFET/MODIFICATEUR — une op s'APPLIQUE à une cible (\`applyOps(target, ops)\`).\n`
out += `Ce n'est pas le seul canal par lequel une entité porte sa mécanique en donnée ; la table ci-dessous est\n`
out += `DÉRIVÉE des DÉCLARATIONS de champs (AST) des sources de \`${CANAUX_ROOTS.join('`, `')}\`, jamais des commentaires :\n\n`
out += `- **\`passive: GameOp[]\`** — modificateurs de VALEUR, exécutés par \`applyOps\` (collecteur \`passiveMods\`) ;\n`
out += `- **\`effects: TriggeredEffect[]\`** — effets DÉCLENCHÉS sur un \`EffectTrigger\`, dispatchés par \`fireTriggers\` ;\n`
out += `- **\`capabilities\` / \`combat\`** — DRAPEAUX sans cible, lus par des dispatchers génériques qui ne nomment\n`
out += `  aucune entité. Un drapeau n'est pas une op inachevée : n'ayant AUCUNE cible, il n'est pas un effet\n`
out += `  appliqué mais une propriété que la règle consulte — le porter en \`GameOp\` fabriquerait une op que seul\n`
out += `  son dispatcher lirait.\n\n`
out += `Un champ ne compte pour un canal que si son TYPE le porte : \`SpellData.effects: Flow\` (flux authored) et\n`
out += `\`WeaponGroupData.combat: 'melee' \\| 'ranged'\` (étiquette) n'y figurent pas.\n\n`
out += `| Entité | Déclarée | \`passive\` | \`effects\` | Drapeaux |\n|---|---|---|---|---|\n`
for (const e of CANAUX.entites) {
  // `import('…').X[]` → `X[]` : le chemin d'import est du bruit de rendu, le TYPE reste mesuré.
  const c = (id) => (e.canaux[id] ? `\`${e.canaux[id].champ}: ${esc(e.canaux[id].type.replace(/import\('[^']+'\)\./g, ''))}\`` : '—')
  const herite = e.heritage.length ? ` (étend ${e.heritage.map((h) => `\`${h}\``).join(', ')})` : ''
  out += `| \`${e.entite}\`${herite} | \`${e.fichier}:${e.ligne}\` | ${c('passive')} | ${c('effects')} | ${c('drapeaux')} |\n`
}
out += `\n_${CANAUX.entites.length} entités déclarant au moins un canal. Une entité qui étend une autre HÉRITE de ses canaux — la\ntable ne montre que les champs DÉCLARÉS (\`EtatData\`/\`PsychologyData\` tiennent les leurs de \`StatusData\`)._\n\n`

out += `### Le vocabulaire des drapeaux (${CANAUX.typesDrapeaux.length} types)\n\n`
out += `| Type | Site | Drapeaux déclarés |\n|---|---|---|\n`
for (const t of CANAUX.typesDrapeaux) {
  out += `| \`${t.nom}\` | \`${t.fichier}:${t.ligne}\` | ${t.champs.length} — ${t.champs.map((n) => `\`${n}\``).join(', ')} |\n`
}
out += `\n`

out += `## GameOp — index par concept (français)\n\n`
out += `Les noms d'ops sont en anglais, le projet et ses sources sont en français : cette table est l'entrée par le SENS.\n`
out += `Elle est DÉRIVÉE (motifs du lexique appliqués au nom + au JSDoc de chaque op) — une op qui ne tombe dans aucun\n`
out += `concept fait ÉCHOUER la génération, donc la CI. Une op apparaît sous plusieurs concepts.\n\n`
out += `| Concept | Ops |\n|---|---|\n`
for (const [label, list] of [...opsOfConcept].sort((a, b) => parLibelle(a[0], b[0]))) {
  out += `| ${esc(label)} | ${list.map((n) => `\`${n}\``).join(', ')} |\n`
}

out += `\n## GameOp — les ${opRows.length} opérations\n\n`
out += `| Op | Champs | Résolution | Résolveurs | Donnée | Rôle |\n|---|---|---|---|---|---|\n`
for (const r of [...opRows].sort((a, b) => parLibelle(a.name, b.name))) {
  const resolution = VERDICT.get(r.name) ?? 'hors switch'
  out += `| \`${r.name}\` | ${renderFields(r.fieldGroups)} | ${resolution === 'exécutée' ? 'exécutée' : `**${resolution}**`} | ${resolverCell(r.name)} | ${usageCell(r.name)} | ${esc(r.role)} |\n`
}
const tally = { 'exécutée': 0, 'inerte au switch': 0, 'hors switch': 0 }
for (const r of opRows) tally[VERDICT.get(r.name) ?? 'hors switch']++
const zero = opRows.filter((r) => !DATA_USAGE.get(r.name).length).map((r) => r.name).sort()
out += `\n_${opRows.length} ops (${opRawCount} membres d'union avant fusion des formes) — ${tally['exécutée']} exécutées par \`applyOps\`, ${tally['inerte au switch']} inertes au switch, ${tally['hors switch']} hors switch (impures ou passives — cf. « Résolveurs »)._\n`

out += `\n### Ops à ZÉRO usage en donnée (${zero.length})\n\n`
out += zero.length
  ? zero.map((n) => `- \`${n}\`\n`).join('')
  : '- (aucune)\n'
out += `\nÀ instruire : soit du vocabulaire posé d'avance (l'op attend sa donnée), soit du code mort. Croiser avec la\ncolonne « Résolveurs » avant de conclure.\n`

// --- vocabulaire de LOGIQUE (flowCore) ---
// Section d'un vocabulaire de flowCore. Le préambule est le JSDoc porté par la DÉCLARATION d'alias
// (verbatim de la source) ; `intro` ne sert qu'aux unions qui n'en portent pas. La colonne « Champs »
// disparaît pour une union de littéraux (aucun membre n'en a).
function section(title, src, aliasName, discriminant, header, intro, opts = {}) {
  const alias = findAlias(src.sf, aliasName, TOOL, FLOW_SRC)
  const { rows } = readUnionMembers(src.sf, src.text, alias, discriminant, TOOL, opts)
  const preamble = aliasDoc(src.text, alias, src.sf)
  const withFields = rows.some((r) => r.fieldGroups.some((g) => g.length))
  let s = `\n## ${title}\n\n`
  if (preamble) s += `${preamble}\n\n`
  if (intro) s += `${intro}\n\n`
  s += withFields ? `| ${header} | Champs | Rôle |\n|---|---|---|\n` : `| ${header} | Rôle |\n|---|---|\n`
  for (const r of rows) {
    s += withFields
      ? `| \`${r.name}\` | ${renderFields(r.fieldGroups)} | ${esc(r.role)} |\n`
      : `| \`${r.name}\` | ${esc(r.role)} |\n`
  }
  s += `\n_${rows.length} entrées — dérivées de \`${FLOW_SRC}\`._\n`
  return s
}

out += section(
  'Condition — l\'algèbre de test PURE des flux',
  flow, 'Condition', 'kind', '`kind`',
  'Prédicat PUR évalué par `evalCondition` : le `cond` d\'un nœud `Flow` `if`, le `lockedUntil` d\'un État, le gate d\'un\neffet déclenché. Composables par `all`/`any`/`not`.',
)
out += section(
  'Flow — les nœuds de flux authorés',
  flow, 'Flow', 'kind', '`kind`',
  null,
)
out += section(
  'EffectTrigger — les déclencheurs d\'effet',
  flow, 'EffectTrigger', 'kind', 'Déclencheur',
  'Valeurs du champ `trigger` d\'un `TriggeredEffect`, dispatchées par `fireTriggers` (`src/state/triggeredEffects.ts`).',
  { allowLiterals: true },
)
out += section(
  'EffectTargeting — la ou les cibles d\'un effet déclenché',
  flow, 'EffectTargeting', 'kind', 'Cible',
  'Valeurs du champ `on` d\'un `TriggeredEffect`.',
  { allowLiterals: true },
)

ecrireOuVerifier({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:vocabulaire — ${OUT} est PÉRIMÉ (diverge de ${OPS_SRC} / ${FLOW_SRC}).`,
  rerunMsg: '  → relancer `npm run docs:vocabulaire` et committer le résultat.',
  okMsg: `docs:vocabulaire — OK (${OUT} à jour, ${opRows.length} GameOp)`,
  writeMsg: `${OUT} — ${opRows.length} GameOp (${tally['exécutée']} exécutées / ${tally['inerte au switch']} inertes au switch / ${tally['hors switch']} hors switch, ${zero.length} sans usage en donnée).`,
})
