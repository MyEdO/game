// USAGES du système de jet — GÉNÉRÉ depuis le code des consommateurs (`scripts/docs/lib/rollShellUsage.mjs`,
// scan AST). Sortie : docs/usages-jets.md. Re-run : node scripts/docs/build-usages-jets.mjs
// (npm run docs:usages-jets).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
//
// Pourquoi ce fichier (#1078) : `docs/registre-jets.md` répond à « par où PART ce jet ? » (les
// producteurs). Il manquait le pendant CÔTÉ AFFICHAGE : « comment chacun UTILISE la coquille de
// jet ? » — quelles zones du contrat d'affichage chaque consommateur remplit, et quelles
// particularités MÉCANIQUES (multi, table, étendu, opposé) ses zones trahissent. Les zones sont
// lues à la source (props de `RollShell`, membres de `RollRowProps`) et les consommateurs sont
// DÉCOUVERTS par le scan : aucune liste de fichiers ni de colonnes n'est écrite à la main.
import { readFileSync } from 'node:fs'
import { parUnitesDeCode, listerArbre } from '../guards/lib/lister.mjs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import { shellZones, rowZones, scanRollShellUsage } from './lib/rollShellUsage.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const OUT = join(ROOT, 'docs/usages-jets.md')
const TOOL = 'build-usages-jets'
const SHELL_FILE = 'src/ui/RollShell.tsx'
const ROW_FILE = 'src/ui/RollRow.tsx'
const check = process.argv.includes('--check')

/** Fichiers de PRODUCTION (hors tests) de `src/`, en chemin relatif POSIX, en ORDRE TOTAL. */
function prodFiles(dir) {
  return listerArbre(join(ROOT, dir), { filtre: (rel) => /\.tsx?$/.test(rel) && !estFichierVitest(rel) })
    .map((rel) => ({ rel: `${dir}/${rel}`, text: readFileSync(join(ROOT, dir, rel), 'utf8') }))
}

// --- zones du contrat, lues à la SOURCE ---------------------------------------------------------
const shell = shellZones(readFileSync(join(ROOT, SHELL_FILE), 'utf8'), TOOL)
const rows = rowZones(readFileSync(join(ROOT, ROW_FILE), 'utf8'), TOOL)
const rowNames = new Set(rows.map((z) => z.name))

// --- population des consommateurs, DÉCOUVERTE ---------------------------------------------------
const consumers = []
for (const { rel, text } of prodFiles('src')) {
  if (rel === SHELL_FILE) continue // la coquille n'est pas son propre consommateur
  if (!/RollShell/.test(text)) continue
  const { sites, rowKeys } = scanRollShellUsage(rel, text, rowNames)
  if (!sites.length) continue
  const props = new Map() // nom de zone -> formes vues
  const spreads = new Set()
  const companions = new Set()
  for (const s of sites) {
    for (const p of s.props) props.set(p.name, (props.get(p.name) ?? new Set()).add(p.shape))
    for (const sp of s.spreads) spreads.add(sp)
    for (const c of s.companions) companions.add(c)
  }
  consumers.push({ rel, sites, props, spreads, rowKeys, companions })
}
consumers.sort((a, b) => parUnitesDeCode(a.rel, b.rel))

if (!consumers.length) {
  console.error(`${TOOL} — AUCUN consommateur mesuré : le scan ne voit plus ni site JSX \`<RollShell\` ni producteur de \`ComponentProps<typeof RollShell>\`.`)
  process.exit(1)
}

// Zones INCONNUES passées par un site (une prop qui n'existe pas dans le type = le scan lit mal,
// ou la primitive a changé) — fail-fast : la matrice ne doit jamais inventer de colonne.
const shellNames = new Set(shell.map((z) => z.name))
const inconnues = []
for (const c of consumers)
  for (const name of c.props.keys())
    if (!shellNames.has(name)) inconnues.push(`${c.rel} — zone « ${name} » absente des props de \`RollShell\``)
if (inconnues.length) {
  console.error(`${TOOL} — zone(s) hors contrat mesurée(s) :`)
  for (const l of inconnues) console.error(`  ${l}`)
  process.exit(1)
}

// --- particularités MÉCANIQUES, déduites des zones remplies -------------------------------------
/** Chaque particularité est la conjonction de zones OBSERVÉES — jamais un nom de fichier. */
const PARTICULARITES = [
  ['opposé', (c) => c.props.has('winnerIndex') || c.props.has('netSL') || c.rowKeys.includes('winner')],
  ['multi (N contributeurs)', (c) => c.props.has('summary') || c.sites.some((s) => s.rows && s.rows.n != null && s.rows.n > 2)],
  ['table d100', (c) => c.companions.has('TableRollLine')],
  ['Test étendu', (c) => c.rowKeys.includes('extendedDr')],
  ['déclaration', (c) => c.rowKeys.includes('declare')],
  ['dé fixé / forcé', (c) => c.rowKeys.includes('forcedRoll') || c.rowKeys.includes('fixedMark') || c.props.has('forcedExtra')],
  ['refus gaté', (c) => c.rowKeys.includes('rollBlocked') || c.companions.has('GatedAction')],
]

// --- rendu ---------------------------------------------------------------------------------------
const head = (z) => (z.zone ? `**${z.zone}**` : `\`${z.name}\``)
const esc = (s) => s.split('|').join('\\|')
/** Sites ancrés sur leur SYMBOLE englobant (jamais sur un numéro de ligne : il churnerait la doc à
 *  chaque édition au-dessus du site). `×n` = n sites dans ce symbole ; `J`/`H` = nature du site. */
const sitesParSymbole = (c) => {
  const par = new Map()
  for (const s of c.sites) {
    const key = `${s.symbol} ${s.kind}`
    par.set(key, (par.get(key) ?? 0) + 1)
  }
  return [...par].sort((a, b) => parUnitesDeCode(a[0], b[0]))
    .map(([k, n]) => {
      const [sym, kind] = k.split(' ')
      return `\`${sym}\` (${kind})${n > 1 ? ` ×${n}` : ''}`
    }).join(', ')
}
const cardinalite = (c) => {
  const parts = c.sites.map((s) => {
    if (s.kind === 'H') return 'hook'
    if (!s.rows) return '—'
    return s.rows.n != null ? `${s.rows.n}${s.rows.kind === 'littéral+spread' ? '+' : ''}` : s.rows.kind
  })
  return [...new Set(parts)].join(' / ')
}

const nJ = consumers.reduce((n, c) => n + c.sites.filter((s) => s.kind === 'J').length, 0)
const nH = consumers.reduce((n, c) => n + c.sites.filter((s) => s.kind === 'H').length, 0)

let out = `# Usages du système de jet, par CONSOMMATEUR — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-usages-jets.mjs\` (\`npm run docs:usages-jets\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : le scan AST \`scripts/docs/lib/rollShellUsage.mjs\` sur les fichiers de production de \`src/\`.\n`
out += `> Les COLONNES sont les props de \`${SHELL_FILE}\` et les membres de \`RollRowProps\` (\`${ROW_FILE}\`) — lues à la\n`
out += `> source ; les LIGNES sont les consommateurs découverts par le scan. Aucune liste manuscrite.\n\n`

out += `## À quoi ça sert\n\n`
out += `\`docs/registre-jets.md\` répond à « **par où PART ce jet ?** » (les producteurs). Ce document-ci est son\n`
out += `pendant côté AFFICHAGE : « **comment chacun UTILISE le système de jet ?** » — quelles zones du contrat\n`
out += `d'affichage chaque consommateur remplit, et quelles particularités MÉCANIQUES ses zones trahissent.\n`
out += `Le contrat lui-même (ce que chaque zone doit porter, et où) est DÉFINI par \`docs/charte-ui.md\` : ce\n`
out += `document ne le redéfinit pas, il MESURE qui en consomme quoi.\n\n`
out += `**Population mesurée : ${consumers.length} consommateurs** — ${nJ} sites JSX \`<RollShell …>\` (J) et ${nH} producteurs de\n`
out += `props \`ComponentProps<typeof RollShell>\` (H, les hooks qui paramètrent la coquille sans la rendre).\n\n`

// --- légende des colonnes ---
out += `## Zones de COQUILLE (légende des colonnes)\n\n`
out += `| Colonne | Prop de \`RollShell\` | Id de zone | Facultative |\n|---|---|---|---|\n`
for (const z of shell) out += `| ${head(z)} | \`${z.name}\` | ${z.zone ?? '—'} | ${z.optional ? 'oui' : '**non**'} |\n`
out += `\n_${shell.length} zones de coquille. L'**id de zone** (\`Zn\`) est celui que le JSDoc de la prop DÉCLARE ;\n`
out += `sa définition vit à la charte. Une prop non encore taguée affiche « — » et sa colonne porte son nom._\n\n`

// --- matrice coquille ---
out += `## Matrice — consommateur × zones de COQUILLE\n\n`
out += `| Consommateur | Sites | Rangées | ${shell.map(head).join(' | ')} |\n`
out += `|---|---|---|${shell.map(() => '---').join('|')}|\n`
for (const c of consumers) {
  const cells = shell.map((z) => (c.props.has(z.name) ? '✓' : '·'))
  out += `| \`${c.rel}\` | ${sitesParSymbole(c)} | ${cardinalite(c)} | ${cells.join(' | ')} |\n`
}
out += `\n_\`✓\` = la zone est remplie par au moins un site du fichier ; \`·\` = jamais. **Sites** : le SYMBOLE englobant\n`
out += `(fonction/composant qui contient le site) — \`(J)\` = site JSX, \`(H)\` = producteur de props, \`×n\` = n sites\n`
out += `dans ce symbole. Aucun numéro de ligne : une ancre de ligne périmerait la doc à chaque édition au-dessus\n`
out += `d'un site. **Rangées** : nombre d'éléments quand \`rows\` est un tableau LITTÉRAL\n`
out += `(\`+\` = plus un spread), sinon la forme lisible au site (\`variable\`/\`appel\`) ou \`hook\`._\n\n`

// --- spreads ---
const avecSpread = consumers.filter((c) => c.spreads.size)
out += `### Sites qui SPREADENT leur paramétrage\n\n`
out += `Un site \`<RollShell {...props} />\` ne déclare aucune zone en propre : ses zones sont celles du producteur\n`
out += `qu'il étale. La matrice ci-dessus le montre par une ligne quasi vide — c'est une MESURE, pas un manque.\n\n`
out += `| Consommateur | Spreads mesurés |\n|---|---|\n`
for (const c of avecSpread) out += `| \`${c.rel}\` | ${[...c.spreads].sort().map((s) => `\`${esc(s)}\``).join(', ')} |\n`
out += `\n_${avecSpread.length} consommateurs sur ${consumers.length}._\n\n`

// --- matrice rangée ---
const rowUsed = rows.filter((z) => consumers.some((c) => c.rowKeys.includes(z.name)))
out += `## Matrice — consommateur × zones de RANGÉE\n\n`
out += `Les zones de la RANGÉE (\`RollRowProps\`) : ce que chaque consommateur pose SUR la ligne de jet.\n`
out += `Colonnes restreintes aux ${rowUsed.length} zones effectivement consommées (sur ${rows.length} déclarées) — les autres\n`
out += `seraient une colonne vide de bout en bout.\n\n`
out += `| Consommateur | ${rowUsed.map(head).join(' | ')} |\n`
out += `|---|${rowUsed.map(() => '---').join('|')}|\n`
for (const c of consumers)
  out += `| \`${c.rel}\` | ${rowUsed.map((z) => (c.rowKeys.includes(z.name) ? '✓' : '·')).join(' | ')} |\n`
out += `\n_Zones de rangée jamais consommées : ${rows.filter((z) => !rowUsed.includes(z)).map((z) => `\`${z.name}\``).join(', ') || '—'}._\n\n`

// --- particularités mécaniques ---
out += `## Particularités MÉCANIQUES déduites des zones\n\n`
out += `Aucune n'est déclarée par un nom de fichier : chacune est la conjonction de zones OBSERVÉES\n`
out += `(cf. légende sous la table). Une spécificité mécanique ÉTEND le contrat, elle ne le contredit pas.\n\n`
out += `| Consommateur | ${PARTICULARITES.map(([l]) => l).join(' | ')} | Composants hébergés dans les slots |\n`
out += `|---|${PARTICULARITES.map(() => '---').join('|')}|---|\n`
for (const c of consumers) {
  const cells = PARTICULARITES.map(([, f]) => (f(c) ? '✓' : '·'))
  out += `| \`${c.rel}\` | ${cells.join(' | ')} | ${[...c.companions].sort().map((x) => `\`${x}\``).join(', ') || '—'} |\n`
}
out += `\n**Critères mesurés** :\n`
out += `- **opposé** — \`winnerIndex\` \\| \`netSL\` (coquille) ou \`winner\` (rangée) ;\n`
out += `- **multi** — \`summary\` (l'agrégat n'a de sens qu'à N) ou plus de 2 rangées littérales ;\n`
out += `- **table d100** — \`TableRollLine\` rendu dans un slot ;\n`
out += `- **Test étendu** — \`extendedDr\` sur une rangée ;\n`
out += `- **déclaration** — \`declare\` sur une rangée ;\n`
out += `- **dé fixé / forcé** — \`forcedRoll\` \\| \`fixedMark\` sur une rangée, ou \`forcedExtra\` sur la coquille ;\n`
out += `- **refus gaté** — \`rollBlocked\` sur une rangée, ou \`GatedAction\` dans un slot.\n\n`
out += `**Comptes** : ${PARTICULARITES.map(([l, f]) => `${l} ${consumers.filter(f).length}`).join(' · ')}.\n\n`

// --- angles morts ---
out += `## Périmètre mesuré et angles morts (à dire pour ne pas se lire comme exhaustif)\n\n`
out += `PÉRIMÈTRE MESURÉ : les fichiers de PRODUCTION de \`src/\` (\`.ts\`/\`.tsx\`, tests exclus), scannés à l'AST\n`
out += `pour les sites \`<RollShell …>\` et les producteurs de \`ComponentProps<typeof RollShell>\`. Tout le reste\n`
out += `est un angle mort, et les voici :\n\n`
out += `- Le scan voit **quelles zones sont remplies**, jamais **ce qu'on y met** : un \`subtitle\` conforme et un\n`
out += `  \`subtitle\` qui redit la Difficulté cochent la même case. La CONFORMITÉ sémantique au contrat relève des\n`
out += `  gardes de contrat (\`src/ui/*.test.tsx\`), pas de cette doc.\n`
out += `- Une zone remplie **conditionnellement** (\`outcome={x ? … : undefined}\`) coche comme une zone toujours\n`
out += `  remplie : l'AST voit l'attribut, pas l'exécution. Idem pour une prop passée avec \`undefined\`.\n`
out += `- Les zones de **RANGÉE** sont relevées PAR NOM au niveau du FICHIER (clés de littéraux d'objet et props\n`
out += `  de \`RollRow\`), pas dans le sous-arbre du \`RollShell\` : un fichier qui construit des rangées pour deux\n`
out += `  usages les agrège sur une seule ligne, et une clé HOMONYME d'un autre objet (\`actor\`, \`rolled\`,\n`
out += `  \`flowKey\`… d'un pending, d'une spec) coche la même case. Une rangée assemblée par un helper partagé\n`
out += `  (\`src/ui/buildParticipantRows.tsx\`) est comptée chez le HELPER, pas chez ses appelants — mais le\n`
out += `  BUNDLE que l'appelant lui passe porte les mêmes clés, ce qui explique la densité de cette matrice.\n`
out += `  Une rangée MINTÉE par la porte (\`src/ui/rollRowBuild.ts\` : \`buildRollRow\`/\`tableRow\`/\`witnessRow\`…)\n`
out += `  n'est comptée NULLE PART : les zones que le constructeur pose pour le site (\`rolled\`, \`interactive\`)\n`
out += `  quittent la ligne de l'appelant, et la porte elle-même n'a aucun site \`RollShell\` qui la ferait\n`
out += `  entrer dans la population. Une case \`·\` peut donc signifier « posé par la porte », pas « absent ».\n`
out += `- La **cardinalité** n'est lisible que sur un tableau littéral ; \`rows={variable}\` ou \`rows={appel(…)}\`\n`
out += `  ne se compte pas — la valeur affichée est alors la FORME, jamais un nombre supposé.\n`
out += `- Les **spreads** (\`<RollShell {...props} />\`) ne déclarent aucune zone : le consommateur réel est le\n`
out += `  producteur de props (population H). Le scan ne suit pas la liaison entre les deux.\n`
out += `- La population est découverte par le **nom** \`RollShell\` : un import renommé\n`
out += `  (\`import { RollShell as X }\`) ou une coquille rendue par une indirection échappe. Même angle mort que\n`
out += `  les gardes de seam (\`docs/registre-jets.md\`).\n`
out += `- L'ancrage est le **symbole englobant**, jamais la ligne : deux sites d'un même symbole ne se distinguent\n`
out += `  pas (ils se comptent, \`×n\`), et un site posé au niveau MODULE s'affiche \`(module)\`. C'est le prix de la\n`
out += `  stabilité — une ancre de ligne périme la doc à chaque édition au-dessus d'un site.\n`
out += `- Les **fichiers de test** sont hors périmètre : ils montent la coquille pour l'éprouver, pas pour servir\n`
out += `  un jet du jeu.\n`
out += `- Les **ids de zone** (\`Zn\`) affichés sont ceux que le JSDoc des props DÉCLARE. Une zone du contrat non\n`
out += `  encore taguée à la primitive n'a pas d'id ici — ce document RELÈVE les ids, il ne les attribue pas.\n\n`

ecrireOuVerifier({
  out,
  path: OUT,
  check,
  staleMsg: `${TOOL} — docs/usages-jets.md est PÉRIMÉ (les zones du contrat ou les usages ont bougé).`,
  rerunMsg: 'Régénérer : npm run docs:usages-jets',
  okMsg: `${TOOL} — docs/usages-jets.md à jour`,
  writeMsg: `${TOOL} — docs/usages-jets.md écrit (${consumers.length} consommateurs, ${nJ} sites JSX, ${nH} producteurs de props, ${shell.length} zones de coquille, ${rowUsed.length}/${rows.length} zones de rangée consommées)`,
})
