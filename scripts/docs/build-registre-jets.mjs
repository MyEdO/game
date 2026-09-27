// REGISTRE des chemins de jet — GÉNÉRÉ depuis le module de gardes `scripts/guards/lib/rollSeam*.mjs`
// (jamais une recopie à la main). Sortie : docs/registre-jets.md. Re-run :
// node scripts/docs/build-registre-jets.mjs (npm run docs:registre-jets).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
//
// SOURCE UNIQUE : les listes (familles canoniques, stocks + justifications) vivent dans
// `rollSeamWhitelist.mjs` et sont VÉRIFIÉES par `src/state/roll-seam-exclusivity-guard.test.ts` ;
// les comptes affichés ici sont RE-MESURÉS par les mêmes scanners (`rollSeamExclusivity.mjs`) — un
// compte de la doc ne peut pas diverger du compte du garde, il n'y a qu'un seul comptage.
//
// Pourquoi ce fichier (#1066) : l'inventaire du 2026-08-04 a mesuré des Tests résolus HORS de tout
// registre — un pending de jet monté à la main au call-site, et un helper de `src/engine` qui roule
// pour le compte d'un flux (`resolveClash` → `rollMightTest` → `rollTest`). Ce registre FIGE la
// population avant que les lots de re-routage la fassent bouger.
import { readFileSync } from 'node:fs'
import { listerArbre } from '../guards/lib/lister.mjs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import {
  scanPendingJetFabrication, engineRollerExports, scanEngineDelegatedRoll,
  engineDiceRollers, scanDesHorsPorte,
} from '../guards/lib/rollSeamExclusivity.mjs'
import { scanFlowTestEngineRoll } from '../guards/lib/flowTestEngineRoll.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'
import {
  ROLL_SEAM_CORE, ROLL_SEAM_PHASE2_STOCK,
  PENDING_JET_FABRICATION_STOCK, ENGINE_DELEGATED_ROLL_STOCK, DES_HORS_PORTE_STOCK, SEAM_CALLERS,
} from '../guards/lib/rollSeamWhitelist.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const OUT = join(ROOT, 'docs/registre-jets.md')
const TOOL = 'build-registre-jets'
const check = process.argv.includes('--check')

/** Fichiers de PRODUCTION (hors tests) d'un jeu de dossiers, en chemin relatif POSIX, en ORDRE TOTAL. */
function prodFiles(...dirs) {
  return dirs.flatMap((d) =>
    listerArbre(join(ROOT, d), { filtre: (rel) => /\.tsx?$/.test(rel) && !estFichierVitest(rel) })
      .map((rel) => ({ rel: `${d}/${rel}`, text: readFileSync(join(ROOT, d, rel), 'utf8') })),
  )
}

// --- (F) fabrication d'un pending de jet -----------------------------------------------------
const fabrication = new Map()
for (const { rel, text } of prodFiles('src')) {
  if (ROLL_SEAM_CORE.has(rel)) continue
  const sites = scanPendingJetFabrication(rel, text)
  if (sites.length) fabrication.set(rel, sites)
}

// --- (D) roulage délégué à un export de src/engine -------------------------------------------
const rollers = engineRollerExports(prodFiles('src/engine'))
const rollerNames = new Set(rollers.keys())
const delegue = new Map()
for (const { rel, text } of prodFiles('src/state', 'src/ui')) {
  if (ROLL_SEAM_CORE.has(rel)) continue
  const sites = scanEngineDelegatedRoll(rel, text, rollerNames)
  if (sites.length) delegue.set(rel, sites)
}

// --- (X) TOUT DÉ TIRÉ HORS PORTE (#1508) ------------------------------------------------------
// Population de la garde SŒUR : le SITE OÙ LE DÉ TOMBE, hors moteur et hors noyau du seam. Périmètre
// plus large que (D) — `src/data` et `src/scenes` en font partie (une donnée authorée qui tire son
// `rng.int` tire un dé comme un flux).
const desRollers = engineDiceRollers(prodFiles('src/engine'))
const desHorsPorte = new Map()
for (const { rel, text } of prodFiles('src')) {
  if (rel.startsWith('src/engine/') || ROLL_SEAM_CORE.has(rel)) continue
  const sites = scanDesHorsPorte(rel, text, desRollers)
  if (sites.length) desHorsPorte.set(rel, sites)
}

// --- population AUTHORÉE (donnée, pas code) ---------------------------------------------------
// Nœuds `test` des Flows authorés des DEUX racines de donnée (`src/data`, `src/scenes`) : le nœud
// `{ kind: 'test', test, success, fail }` de `Flow` (engine/flowCore.ts:496), la forme UNIQUE du jet
// en donnée. Ils ne sont PAS un stock : c'est de la donnée, dont les chemins de résolution sont
// dénombrés ci-dessous.
//
// Le critère est `kind === 'test'`, pas « l'objet porte une propriété `test` » : cette dernière
// forme compte AUSSI l'enveloppe qui épingle le nœud (une rangée de Critique porte `test` ET le
// nœud porte son `FlowTest`), soit 78 objets pour 39 nœuds dans `criticals.json` — et elle rate le
// point : ce qu'un registre de jets dénombre, ce sont les JETS.

/** Fichiers `.json` d'un jeu de dossiers, en chemin relatif POSIX. Chaque dossier est rendu en ordre
 *  total par `listerArbre` ; le tri final ordonne la CONCATÉNATION des dossiers. */
function jsonFiles(...dirs) {
  return dirs
    .flatMap((d) => listerArbre(join(ROOT, d), { filtre: (rel) => rel.endsWith('.json') }).map((rel) => `${d}/${rel}`))
    .sort()
}

/** Nœuds `kind:'test'` d'un document, à toute profondeur. */
function countNoeudsTest(o) {
  if (!o || typeof o !== 'object') return 0
  let n = Array.isArray(o) ? 0 : (o.kind === 'test' && o.test !== undefined ? 1 : 0)
  for (const k of Object.keys(o)) n += countNoeudsTest(o[k])
  return n
}

const authoredByFile = []
for (const rel of jsonFiles('src/data', 'src/scenes')) {
  let doc
  try { doc = JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) } catch { continue }
  const n = countNoeudsTest(doc)
  if (n) authoredByFile.push([rel, n])
}
const authoredTests = authoredByFile.reduce((n, [, c]) => n + c, 0)

// --- nœuds authorés NON ROUTÉS par la porte -----------------------------------------------------
// Un nœud `test` n'atteint les routeurs canoniques que si personne ne l'a résolu AVANT. Le garde
// `flowTestEngineRoll` (#1657 B3) mesure les fonctions de `src/engine/**` qui LISENT un nœud et le
// ROULENT ; là où l'une d'elles est le résolveur d'un document, les nœuds de ce document n'ont
// AUCUNE fenêtre — ni enjeu affiché, ni Chance, ni Pacte, ni Résilience, et la valeur testée n'est
// pas celle de la porte (#1685).
// Le RATTACHEMENT document → site moteur est DÉCLARÉ : aucun scan ne relie un `.json` à la fonction
// qui le lit. Ses DEUX bouts sont vérifiés à chaque génération — le document porte des nœuds, et le
// site figure dans le stock mesuré du garde. Une entrée dont le site a quitté le stock est PÉRIMÉE
// et fait échouer le générateur : c'est le cliquet qui vide cette section en B3-1/B3-2.
const NON_ROUTES = []
// Le stock du garde indexe le SITE DU DÉ ; il porte AUSSI le nom du résolveur et sa ligne de
// DÉCLARATION. Les deux servent, et pas au même endroit : le cliquet mord sur le site du dé (ce que
// le garde mesure), tandis que le doc CITE la déclaration — la garde de commit `docs-vs-commit`
// (`scripts/docs/check-docs-vs-head.mjs`) exige que le symbole backtiqué d'une phrase se lise à ±2
// lignes du `fichier:ligne` qu'elle cite, et le nom d'une fonction ne se lit qu'à sa déclaration.
const stockGarde = new Map(
  scanFlowTestEngineRoll(prodFiles('src/engine')).map((x) => [`${x.file}:${x.line}`, x]))
const nonRoutes = []
const desyncNonRoutes = []
for (const [rel, site, lot, pourquoi] of NON_ROUTES) {
  const n = authoredByFile.find(([f]) => f === rel)?.[1]
  if (!n) {
    desyncNonRoutes.push(`${rel} : déclaré NON ROUTÉ, mais le document ne porte aucun nœud \`test\``)
    continue
  }
  const mesure = stockGarde.get(site)
  if (!mesure) {
    desyncNonRoutes.push(`${rel} : site ${site} ABSENT du stock mesuré de \`flowTestEngineRoll\` — entrée PÉRIMÉE (le nœud passe-t-il par la porte ? retirer l'entrée)`)
    continue
  }
  nonRoutes.push([rel, n, site, lot, pourquoi, mesure.fn, `${mesure.file}:${mesure.fnLine}`, mesure.name])
}
if (desyncNonRoutes.length) {
  console.error(`${TOOL} — section « nœuds NON ROUTÉS » désynchronisée :`)
  for (const l of desyncNonRoutes) console.error(`  ${l}`)
  process.exit(1)
}
const nonRoutesTotal = nonRoutes.reduce((n, [, c]) => n + c, 0)

// Les TROIS routeurs qui résolvent un nœud `test` de Flow — mesurés, pas supposés.
const ROUTEURS_AUTHORES = [
  ['resolveFlowTest', 'src/state/combat/triggeredTest.ts', 'voie CADENCE-AWARE : ouvre `openSkillTest` (modale influençable) quand l\'acteur est piloté.'],
  ['resolveInlineFlowTest', 'src/state/triggeredEffects.ts', 'jumeau store-free de la branche NON-interactive du précédent (jet résolu inline, journalisé).'],
  ['bandeTriggeredTest', 'src/state/combat/triggeredTest.ts', 'MÊME porte, N TESTEURS (#1657 B3-2) : une BANDE de N rangées pour les porteurs surfacés, la voie inline pour les autres.'],
]
const routeursManquants = ROUTEURS_AUTHORES.filter(([name, file]) =>
  !new RegExp(`function\\s+${name}\\b`).test(readFileSync(join(ROOT, file), 'utf8')))
if (routeursManquants.length) {
  console.error(`${TOOL} — routeur de nœud \`test\` authoré introuvable (la thèse « tout nœud test passe par ces routeurs » n'est plus mesurable) :`)
  for (const [n, f] of routeursManquants) console.error(`  ${n} (${f})`)
  process.exit(1)
}

// --- ASSERTION INVERSE (#1657 B3-3) : « … et AUCUN AUTRE chemin » ---------------------------------
// Vérifier que les routeurs EXISTENT dit qu'un chemin canonique est disponible ; ça ne dit pas qu'il
// est le SEUL. Le second bout se mesure sur le moteur : un `src/engine/**` qui LIT un nœud `test` et le
// ROULE court-circuite la porte, quel que soit le nombre de routeurs en place. Le scan est celui du
// garde (`flowTestEngineRoll`), déjà chargé ci-dessus pour la section des non-routés : la population
// attendue est VIDE, et le générateur refuse de publier « tous routés » tant qu'elle ne l'est pas.
if (stockGarde.size) {
  console.error(`${TOOL} — assertion INVERSE en échec : ${stockGarde.size} site(s) de \`src/engine/**\` résolvent un nœud \`test\` HORS de la porte :`)
  for (const [site, x] of stockGarde) console.error(`  ${site} [${x.famille} ${x.fn} → ${x.name}]`)
  console.error('  → le moteur REND le nœud (patron `miscast.mkTest`) ou le DIFFÈRE (`UpkeepDeferTest`) ; il ne le roule pas.')
  process.exit(1)
}

// --- garde de génération : les stocks déclarés doivent COUVRIR la mesure --------------------------
const couverture = []
for (const [label, stock, mesure] of [
  ['(F) fabrication', PENDING_JET_FABRICATION_STOCK, fabrication],
  ['(D) délégué moteur', ENGINE_DELEGATED_ROLL_STOCK, delegue],
  ['(X) dés hors porte', DES_HORS_PORTE_STOCK, desHorsPorte],
]) {
  for (const [rel, sites] of mesure) {
    const dec = stock.get(rel)
    if (!dec) couverture.push(`${label} — ${rel} : ${sites.length} site(s) HORS registre`)
    else if (dec.n !== sites.length) couverture.push(`${label} — ${rel} : ${sites.length} mesuré(s), ${dec.n} déclaré(s)`)
  }
  for (const [rel, dec] of stock) {
    if (!mesure.has(rel)) couverture.push(`${label} — ${rel} : entrée PÉRIMÉE (0 site mesuré, ${dec.n} déclaré)`)
    if (!dec.why?.trim()) couverture.push(`${label} — ${rel} : entrée SANS justification`)
    if (!['dette', 'canonique', 'mixte'].includes(dec.kind)) couverture.push(`${label} — ${rel} : kind « ${dec.kind} » inconnu`)
  }
}
if (couverture.length) {
  console.error(`${TOOL} — registre désynchronisé (scripts/guards/lib/rollSeamWhitelist.mjs) :`)
  for (const l of couverture) console.error(`  ${l}`)
  process.exit(1)
}

// --- rendu -------------------------------------------------------------------------------------
const esc = (s) => (s ?? '—').split('|').join('\\|')
const total = (m) => [...m.values()].reduce((n, v) => n + v.length, 0)

/** Répartition des SITES par nature d'entrée — c'est elle qui dit ce qui doit tomber à zéro. */
function parNature(stock) {
  const par = new Map()
  for (const [, dec] of stock) par.set(dec.kind, (par.get(dec.kind) ?? 0) + dec.n)
  return [...par].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join(', ')
}

let out = `# Registre des chemins de jet — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-registre-jets.mjs\` (\`npm run docs:registre-jets\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : le module de gardes \`scripts/guards/lib/rollSeamWhitelist.mjs\` (listes + justifications) et\n`
out += `> \`scripts/guards/lib/rollSeamExclusivity.mjs\` (scanners AST). Les comptes ci-dessous sont ceux du garde\n`
out += `> \`src/state/roll-seam-exclusivity-guard.test.ts\` — un seul comptage, jamais deux.\n\n`

out += `## À quoi ça sert\n\n`
out += `Répondre à « **par où passe ce jet ?** » sans relire les flux. Trois populations coexistent :\n`
out += `les familles CANONIQUES d'ouverture (un jet décrit à une porte), et deux populations de DETTE que\n`
out += `les gardes d'exclusivité laissaient passer par construction — un pending de jet monté à la main au\n`
out += `call-site, et un roulage délégué à un export de \`src/engine\`. Ce registre les FIGE : un site de plus,\n`
out += `une entrée devenue vide ou une entrée sans justification échouent la garde.\n\n`

out += `## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)\n\n`
out += `- **(F)** ne voit qu'un **littéral d'objet** : un pending assemblé par spread depuis un helper, ou monté champ\n`
out += `  par champ, échappe. La conjonction \`skillValue\` + (\`target\` \\| \`roll: null\`) est un resserrement DÉLIBÉRÉ —\n`
out += `  \`skillValue:\` seul remonte 200+ faux positifs (types, paramètres de résolveur, patches de champ).\n`
out += `- **(D)** résout par **nom appelé**, sans suivi de liaison : un import renommé (\`import { resolveClash as x }\`)\n`
out += `  ou un appel indirect (référence passée en callback) échappe. Même angle mort que le garde d'exclusivité.\n`
out += `- **(D)** indexe les fonctions de \`src/engine\` par nom **à plat** : deux homonymes dans deux modules se\n`
out += `  confondent, et un homonyme local d'un rouleur peut faire entrer un export au titre de la transitivité.\n`
out += `- **(D)** ne scanne que \`src/state\` et \`src/ui\` (les consommateurs de flux) ; **(F)** scanne tout \`src\`.\n`
out += `- **Un tirage qui n'appelle ni \`rollTest\` ni \`d100\` n'est vu par AUCUN des trois scanners** — ex. le \`d10\` de\n`
out += `  \`massBattleFlow.ts:834\` (\`massBattleSetHazard\`, facteur environnemental du Round, \`ADE II 8 l.309\`) : un jet du\n`
out += `  RAW résolu en silence, hors de tout registre. Le surfaçage vit sur #1067, qui le nomme déjà.\n`
out += `- Les formes **(S)** « position de spec » et **(M)** « dé de monde » restent des exclusions par FORME du garde\n`
out += `  d'exclusivité (critères et angles morts : en-tête de \`scripts/guards/lib/rollSeamExclusivity.mjs\`).\n`
out += `- La population authorée couvre les DEUX racines de donnée (\`src/data\`, \`src/scenes\`) et ne compte que le\n`
out += `  NŒUD canonique (\`kind:'test'\`). Une conséquence de jet exprimée dans une forme PROPRIÉTAIRE (hors nœud)\n`
out += `  n'y figure donc pas : c'est la population que #1657 fait converger, et son cardinal se lit ici.\n`
if (nonRoutesTotal) {
  out += `- **Porter le nœud canonique n'est pas passer par la porte** : ${nonRoutesTotal} nœuds authorés sont résolus DANS le moteur,\n`
  out += `  avant tout routeur. Le rattachement document → résolveur est DÉCLARÉ dans le générateur (aucun scan ne relie un\n`
  out += `  \`.json\` à la fonction qui le lit) et vérifié contre le stock mesuré du garde \`flowTestEngineRoll\`.\n`
}
out += `- Les **justifications** sont écrites à la main : ce sont des engagements, pas des mesures. Le registre garantit\n`
out += `  qu'elles EXISTENT et que les comptes sont exacts, pas qu'elles disent vrai.\n\n`

// --- familles canoniques ---
out += `## Familles CANONIQUES d'ouverture de jet\n\n`
out += `| Famille | Site | Exportée | Rôle |\n|---|---|---|---|\n`
for (const c of SEAM_CALLERS) {
  out += `| \`${c.name}\` | \`${c.file}\` | ${c.exported ? 'oui' : '**non** (module-locale)'} | ${esc(c.role)} |\n`
}
out += `\n_${SEAM_CALLERS.length} familles énumérées — chacune VÉRIFIÉE (le symbole existe, à ce fichier, avec ce statut d'export)._\n\n`

// --- (F) ---
out += `## (F) Fabrication d'un pending de jet au call-site\n\n`
out += `Signature AST discriminante : un littéral d'objet portant \`skillValue:\` **et** (\`target:\` **ou** \`roll: null\`)\n`
out += `— l'objet décrit DÉJÀ la cible du jet ou son emplacement de dé vide, donc un jet décrit hors de la porte.\n`
out += `Le roulage, lui, arrive plus tard et passe par le seam : rien ne le signalait. Les fichiers du noyau du\n`
out += `seam (\`ROLL_SEAM_CORE\`) sont hors périmètre — leur pending EST le foyer.\n\n`
out += `| Fichier | Sites | Nature | Lignes | Justification |\n|---|---|---|---|---|\n`
for (const [rel, dec] of PENDING_JET_FABRICATION_STOCK) {
  // Ancrage par NUMÉROS DE LIGNE dans le contenu comparé : churn à chaque édition au-dessus d'un site
  // -> #1110 (patron correctif : `enclosingSymbol` de scripts/docs/lib/rollShellUsage.mjs).
  out += `| \`${rel}\` | ${dec.n} | ${dec.kind} | ${fabrication.get(rel).map((s) => s.line).join(', ')} | ${esc(dec.why)} |\n`
}
out += `\n_${total(fabrication)} sites mesurés dans ${fabrication.size} fichiers — par nature : ${parNature(PENDING_JET_FABRICATION_STOCK)}._\n\n`

// --- (D) ---
out += `## (D) Roulage délégué à un export de \`src/engine\`\n\n`
out += `\`rollSeamExcluded\` exempte \`src/engine/**\` de principe (le moteur reçoit un rng, il ne décide pas du\n`
out += `surfaçage) — ce qui suppose que l'APPELANT passe par le seam. Un export d'engine qui roule, appelé par un\n`
out += `flux, rend donc le call-site invisible aux deux gardes. **Cette supposition est désormais TENUE des deux\n`
out += `côtés** (#1657 B3-3) : \`battleRngEngineLeak\` ferme la moitié APPELANT (un flux qui remet un rng vivant à un\n`
out += `résolveur moteur), \`flowTestEngineRoll\` ferme la moitié DONNÉE et n'admet plus aucun site (garde BLOQUANTE,\n`
out += `population attendue VIDE) : un moteur qui LIT un nœud \`test\` le REND ou le DIFFÈRE. La table ci-dessous\n`
out += `inventorie ce qui reste : des résolveurs qui roulent LEURS PROPRES dés, sans lire de nœud authoré.\n`
out += `La liste des rouleurs est **dérivée** (corps appelant\n`
out += `\`rollTest\`/\`d100\`, puis clôture TRANSITIVE — sans elle, \`resolveClash\` (qui ne roule qu'à travers\n`
out += `\`rollMightTest\`) reste invisible), \`rollTest\`/\`d100\` eux-mêmes exclus (population du garde d'exclusivité).\n`
out += `La forme (S) « position de spec » garde son exclusion structurelle.\n\n`
out += `| Fichier | Sites | Nature | Rouleurs appelés | Justification |\n|---|---|---|---|---|\n`
for (const [rel, dec] of ENGINE_DELEGATED_ROLL_STOCK) {
  // Idem (F) : les justifications de cette section citent des `:ligne` -> #1110.
  const noms = [...new Set(delegue.get(rel).map((s) => s.name))].sort()
  out += `| \`${rel}\` | ${dec.n} | ${dec.kind} | ${noms.map((n) => `\`${n}\``).join(', ')} | ${esc(dec.why)} |\n`
}
out += `\n_${total(delegue)} call-sites mesurés dans ${delegue.size} fichiers, pour ${rollers.size} exports rouleurs dérivés de \`src/engine\` — par nature : ${parNature(ENGINE_DELEGATED_ROLL_STOCK)}._\n\n`
out += `> **Nature** (\`kind\`) : \`dette\` = tous les sites doivent disparaître · \`canonique\` = aucun site ne bouge ·\n`
out += `> \`mixte\` = l'entrée porte les deux natures. Sans ce discriminant, « cette liste décroît » ne veut rien dire.\n`
out += `> Le tri de population est SOLDÉ (#1070) : \`tri\` n'est plus une valeur acceptée — chaque entrée est qualifiée site par site.\n\n`

// --- (X) dés hors porte ---
out += `## (X) Tout dé tiré HORS PORTE\n\n`
out += `Les trois familles ci-dessus ne voient que le **forgeage d'un Test** (\`rollTest\`/\`d100\`/\`TestOutcome.seal\`).\n`
out += `Une magnitude (\`rollDice\`), une dispersion (\`d10\`), une expression authorée (\`rollExpr\`), le d100\n`
out += `d'environnement (\`deMonde\`) et une désignation (\`rng.int\`) leur sont invisibles PAR CONSTRUCTION.\n`
out += `La doctrine utilisateur du 2026-09-04 ne laisse aucune classe de dé dehors — « Vu que tous les jets passé\n`
out += `par le même point d'entrée, il est inutile de se demander si le jeu est configuré pour » : ce qui suit est\n`
out += `donc une **dette à cible zéro** (#1508), pas un registre d'équilibre.\n\n`
out += `Un SITE = un appel **où le dé tombe** : une primitive de \`engine/dice\` IMPORTÉE dans ce fichier, un\n`
out += `\`.int(\` de RNG, ou un export de \`src/engine\` derrière lequel le dé tombe **sans franchir d'autre\n`
out += `frontière exportée** (\`engineDiceRollers\` : corps de l'export, ou helper module-local qu'il appelle —\n`
out += `\`rollStock\` → \`fullStock\` → \`rollDice\`, \`rollAge\` → \`rollDetailFormula\` → \`roll\`). La clôture\n`
out += `transitive COMPLÈTE, elle, remonterait jusqu'aux helpers génériques (\`createHero\`, \`contractDisease\`,\n`
out += `\`spellRangeTiles\`, \`zdeRadiusTiles\`, \`durationClockMinutes\`…) : 423 sites « où un dé pourrait tomber »\n`
out += `au lieu de ceux où il tombe, et un stock qui ne peut plus descendre à zéro.\n`
out += `Périmètre : hors \`src/engine/**\` et hors \`ROLL_SEAM_CORE\`.\n\n`
out += `| Fichier | Sites | Nature | Primitives / rouleurs appelés | Justification |\n|---|---|---|---|---|\n`
for (const [rel, dec] of DES_HORS_PORTE_STOCK) {
  const noms = [...new Set(desHorsPorte.get(rel).map((s) => s.name))].sort()
  out += `| \`${rel}\` | ${dec.n} | ${dec.kind} | ${noms.map((n) => `\`${n}\``).join(', ')} | ${esc(dec.why)} |\n`
}
out += `\n_${total(desHorsPorte)} dés mesurés dans ${desHorsPorte.size} fichiers, pour ${desRollers.size} exports de \`src/engine\` derrière lesquels un dé tombe sans franchir d'autre frontière exportée — par nature : ${parNature(DES_HORS_PORTE_STOCK)}._\n\n`

// --- population authorée ---
out += `## Population AUTHORÉE (donnée, pas code)\n\n`
out += `**${authoredTests}** nœuds \`test\` (\`{ kind: 'test', test: FlowTest, success, fail }\`) dans **${authoredByFile.length}** documents\n`
out += nonRoutesTotal
  ? `de \`src/data\` et \`src/scenes\` : **${authoredTests - nonRoutesTotal} ROUTÉS** par la porte, **${nonRoutesTotal} NON ROUTÉS** (résolus DANS le\nmoteur — mesure ci-dessous). Ce n'est pas un stock : la donnée n'a pas de call-site à router.\n\n`
  : `de \`src/data\` et \`src/scenes\`, **tous ROUTÉS** par la porte. Ce n'est pas un stock : la donnée n'a pas de\ncall-site à router.\n\n`
out += `### Les ${authoredTests - nonRoutesTotal} routés — ${ROUTEURS_AUTHORES.length} routeurs mesurés\n\n`
for (const [name, file, role] of ROUTEURS_AUTHORES) out += `- \`${name}\` (\`${file}\`) — ${role}\n`
out += `\nLe premier ouvre \`openSkillTest\` (famille canonique), le deuxième est sa branche non-interactive, le\n`
out += `troisième la même porte pour N testeurs à la fois. **Pour eux**,\n`
out += `un nœud \`test\` enfoui sans routeur cadence-aware lève (\`resolveInlineFlowTest\` : « un test enfoui exige un\n`
out += `routeur cadence-aware ») — c'est le fail-closed de la donnée.\n\n`
out += `ASSERTION INVERSE (« … et aucun AUTRE chemin ») : la génération ÉCHOUE si un seul site de \`src/engine/**\`\n`
out += `lit un nœud \`test\` et le roule (même scan que le garde \`flowTestEngineRoll\`). Exister ne suffit pas à une\n`
out += `porte : elle doit être la SEULE.\n\n`
// La section « NON routés » ne se rend QUE s'il y en a : un doc dérivé décrit ce qui EST, jamais un mal
// éteint. À zéro, il ne reste qu'une LIGNE DE MESURE — le cardinal, vérifié à chaque génération.
if (!nonRoutesTotal) {
  out += `**0 nœud authoré hors porte** (cardinal vérifié à chaque génération contre le stock du garde\n`
  out += `\`flowTestEngineRoll\`, \`scripts/guards/lib/\`) : aucun nœud \`test\` de la donnée n'est consommé avant\n`
  out += `d'atteindre un routeur.\n`
} else {
  out += `### Les ${nonRoutesTotal} NON routés — résolus dans le moteur, aucune fenêtre\n\n`
  out += `Le fail-closed ci-dessus **ne les protège pas** : leur nœud est consommé avant d'atteindre un routeur, donc rien\n`
  out += `ne lève. Conséquence pour le joueur : ni enjeu affiché, ni Chance, ni Pacte, ni Résilience, et la valeur testée\n`
  out += `n'est pas celle de la porte (#1685). Le résolveur de chacun est mesuré NOMINATIVEMENT par le garde\n`
  out += `\`flowTestEngineRoll\` (\`scripts/guards/lib/\`) : les sites ci-dessous sont vérifiés contre son stock à chaque\n`
  out += `génération, et une entrée dont le site a disparu fait ÉCHOUER le générateur.\n\n`
  for (const [rel, n, site, lot, pourquoi, fn, decl, motif] of nonRoutes) {
    out += `- \`${rel}\` — **${n}** nœud${n > 1 ? 's' : ''}, joué${n > 1 ? 's' : ''} par \`${fn}\` (\`${decl}\`) ; meurt en ${lot}.\n`
    out += `  \`${fn}\` ${pourquoi}\n`
    out += `  Dé mesuré par le garde : \`${motif}\` à \`${site}\`.\n`
  }
}
out += `\n### Par document\n\n`
if (nonRoutesTotal) {
  out += `| Document | Nœuds \`test\` | dont NON ROUTÉS | Résolveur moteur | Site du dé | Meurt en |\n|---|---|---|---|---|---|\n`
  for (const [rel, n] of authoredByFile) {
    const nr = nonRoutes.find(([f]) => f === rel)
    out += `| \`${rel}\` | ${n} | ${nr ? `**${nr[1]}**` : '—'} | ${nr ? `\`${nr[5]}\` (\`${nr[6]}\`)` : '—'} | ${nr ? `\`${nr[7]}\` \`${nr[2]}\`` : '—'} | ${nr ? nr[3] : '—'} |\n`
  }
  out += `\n_${nonRoutesTotal} nœuds NON ROUTÉS dans ${nonRoutes.length} documents sur ${authoredByFile.length}._\n\n`
} else {
  out += `| Document | Nœuds \`test\` |\n|---|---|\n`
  for (const [rel, n] of authoredByFile) out += `| \`${rel}\` | ${n} |\n`
  out += `\n_${authoredTests} nœuds authorés dans ${authoredByFile.length} documents, tous routés._\n\n`
}

// --- rappel du stock historique ---
out += `## Rappel — stock du garde d'exclusivité (\`rollTest\`/\`d100\`/\`TestOutcome.seal\` bruts)\n\n`
out += `Population historique (#918 phase 2), listée ici pour que le registre soit la vue COMPLÈTE ; sa source\n`
out += `reste \`ROLL_SEAM_PHASE2_STOCK\`. ${[...ROLL_SEAM_PHASE2_STOCK.values()].reduce((a, b) => a + b, 0)} sites dans ${ROLL_SEAM_PHASE2_STOCK.size} fichiers.\n\n`
out += `| Fichier | Sites |\n|---|---|\n`
for (const [rel, n] of ROLL_SEAM_PHASE2_STOCK) out += `| \`${rel}\` | ${n} |\n`
out += `\n`

ecrireOuVerifier({
  out,
  path: OUT,
  check,
  staleMsg: `${TOOL} — docs/registre-jets.md est PÉRIMÉ (le registre ou la population ont bougé).`,
  rerunMsg: 'Régénérer : npm run docs:registre-jets',
  okMsg: `${TOOL} — docs/registre-jets.md à jour`,
  writeMsg: `${TOOL} — docs/registre-jets.md écrit (${total(fabrication)} sites (F), ${total(delegue)} call-sites (D), ${SEAM_CALLERS.length} familles, ${authoredTests} nœuds authorés dont ${nonRoutesTotal} NON routés)`,
})
