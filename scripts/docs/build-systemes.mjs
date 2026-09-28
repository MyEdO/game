// Manifeste des systèmes = DONNÉE (#298) : la partie éditoriale (nom/périmètre/état/ticket) vit
// dans src/data/systemes.manifest.json et src/data/primitives.manifest.json ; la matrice
// d'adoption primitive×système est GÉNÉRÉE du graphe d'imports réel (closure transitive des
// modules porteurs déclarés par système). Sortie : docs/systemes.md.
// Re-run : node scripts/docs/build-systemes.mjs (npm run docs:systemes).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
import { readFileSync, existsSync, statSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { resolve } from 'node:path'
import { closureOf } from '../guards/lib/importGraph.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

const PRIMITIVES = JSON.parse(readFileSync('src/data/primitives.manifest.json', 'utf8'))
const SYSTEMES = JSON.parse(readFileSync('src/data/systemes.manifest.json', 'utf8'))

const errors = []

// --- intégrité des manifestes : tout fichier déclaré doit exister ---
for (const p of PRIMITIVES) {
  if (!existsSync(p.fichier)) errors.push(`primitive « ${p.label} » (${p.id}) : fichier absent ${p.fichier}`)
}
for (const s of SYSTEMES) {
  for (const m of s.modules) {
    if (!existsSync(m)) errors.push(`système « ${s.label} » (${s.id}) : module absent ${m}`)
  }
}

const closures = new Map(SYSTEMES.map((s) => [s.id, closureOf(s.modules)]))

// --- matrice primitive × système (U = présente dans la closure du système) ---
const usedByAny = new Map(PRIMITIVES.map((p) => [p.id, false]))
const matrix = PRIMITIVES.map((p) => {
  const row = { primitive: p, cells: {} }
  for (const s of SYSTEMES) {
    const rel = resolve(p.fichier).split('\\').join('/').slice(resolve('.').split('\\').join('/').length + 1)
    const used = closures.get(s.id).has(rel)
    row.cells[s.id] = used
    if (used) usedByAny.set(p.id, true)
  }
  return row
})

const orphanPrimitives = PRIMITIVES.filter((p) => !usedByAny.get(p.id))

// --- modules non rattachés à un système (scope : src/state + src/engine, top-level, hors tests) ---
function topLevelSourceFiles(dir) {
  return listerDossier(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => `${dir}/${f}`)
    .filter((f) => statSync(f).isFile())
}
const ALL_UNIONS = new Set()
for (const c of closures.values()) for (const f of c) ALL_UNIONS.add(f)
const INVENTORY = [...topLevelSourceFiles('src/state'), ...topLevelSourceFiles('src/engine')]
const uncovered = INVENTORY.filter((f) => !ALL_UNIONS.has(f)).sort()

// --- rendu docs/systemes.md ---
const COLS = SYSTEMES.map((s) => s.id)
let out = `# Systèmes implémentés — généré (#298)\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-systemes.mjs\` (\`npm run docs:systemes\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source éditoriale (nom/périmètre/état/ticket) : \`src/data/systemes.manifest.json\`. Source des primitives :\n`
out += `> \`src/data/primitives.manifest.json\`. La matrice ci-dessous est CALCULÉE du graphe d'imports réel (closure\n`
out += `> transitive des modules racines déclarés par système) — jamais périmée : re-générer après tout ajout.\n\n`
out += `**Périmètre mesuré / angles morts** — la closure d'import est calculée par \`closureOf\` (\`scripts/guards/lib/importGraph.mjs\`) :\n`
out += `parcours RÉGEX des specifiers \`from '…'\`/\`import('…')\`, RÉSOLUS SEULEMENT s'ils sont RELATIFS (\`./\`, \`../\`) — un\n`
out += `import via alias tsconfig ou paquet npm n'est jamais suivi (\`resolveImport\` renvoie \`null\`), donc invisible ici sans\n`
out += `que la primitive soit hors d'usage. L'inventaire « modules non rattachés » est lui-même borné : SURFACE de\n`
out += `\`src/state\`/\`src/engine\` uniquement (\`listerDossier\` non récursif, \`*.test.ts\` exclus) — un fichier niché dans un\n`
out += `sous-dossier, ou situé ailleurs (\`src/ui\`, \`src/gameIso\`, \`src/data\`…), n'y apparaît jamais, rattaché ou non.\n\n`

out += `## Sommaire des systèmes\n\n`
out += `| Système | État | Modules racines | Ticket |\n|---|---|---|---|\n`
for (const s of SYSTEMES) {
  out += `| ${s.label} | ${s.etat} | ${s.modules.map((m) => `\`${m}\``).join(', ')} | ${s.ticket ?? '—'} |\n`
}
out += `\n`
for (const s of SYSTEMES) {
  if (s.notes && s.notes !== '—') out += `- **${s.label}** (\`${s.id}\`) : ${s.notes}\n`
}

out += `\n## Matrice primitives × systèmes (générée)\n\n`
out += `Colonnes : ${SYSTEMES.map((s) => `\`${s.id}\`=${s.label}`).join(' · ')}.\n`
out += `Cellule = **U** (la primitive est dans la closure d'import du système) ou vide (non détectée directement —\n`
out += `n'exclut pas un usage indirect hors des modules racines déclarés).\n\n`
out += `| Primitive | ${COLS.join(' | ')} |\n|---|${COLS.map(() => '---').join('|')}|\n`
for (const row of matrix) {
  out += `| \`${row.primitive.label}\` | ${COLS.map((c) => (row.cells[c] ? 'U' : '')).join(' | ')} |\n`
}

out += `\n## Primitives jamais adoptées par un système déclaré\n\n`
out += orphanPrimitives.length
  ? orphanPrimitives.map((p) => `- \`${p.label}\` (${p.fichier}) — signalé, pas forcément un défaut (ex. mécanisme/éditeur transverse).\n`).join('')
  : '- (aucune)\n'

out += `\n## Modules \`src/state\`/\`src/engine\` non rattachés à un système déclaré\n\n`
out += `Portée : fichiers top-level (hors \`*.test.ts\`) non atteints par la closure d'import d'AUCUN système du\n`
out += `manifeste. Informatif — inclut les infra partagées (store, types, helpers transverses) qu'aucun système\n`
out += `unique ne « possède » légitimement ; à trier au fil de l'eau, pas un échec bloquant de ce script.\n\n`
out += `${uncovered.length} fichier(s) :\n\n`
out += uncovered.map((f) => `- \`${f}\`\n`).join('')

if (errors.length) {
  console.error(`build-systemes — ${errors.length} erreur(s) d'intégrité manifeste :`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}

ecrireOuVerifier({
  out,
  path: 'docs/systemes.md',
  check: process.argv.includes('--check'),
  staleMsg: "docs:systemes — docs/systemes.md est PÉRIMÉ (diverge du graphe d'imports réel).",
  rerunMsg: '  → relancer `npm run docs:systemes` et committer le résultat.',
  okMsg: 'docs:systemes — OK (docs/systemes.md à jour)',
  writeMsg: `docs/systemes.md — ${SYSTEMES.length} systèmes, ${PRIMITIVES.length} primitives, ${orphanPrimitives.length} primitive(s) orpheline(s), ${uncovered.length} module(s) non rattaché(s).`,
})
