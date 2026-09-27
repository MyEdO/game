// Index du MOTEUR — GÉNÉRÉ depuis les exports publics de `src/engine` (AST TypeScript, jamais une
// recopie à la main). Sortie : docs/index-moteur.md. Re-run : node scripts/docs/build-index-moteur.mjs
// (npm run docs:index-moteur).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
//
// Incident fondateur (#903bis) : `rollCareer` (src/engine/creation.ts:73) porte depuis 2026-06-18 un
// JSDoc en français qui explique que plusieurs Carrières peuvent partager une borne de tirage — deux
// agents de grounding successifs ont conclu à tort que ce mécanisme n'existait pas, faute de surface
// de recherche par SENS entre une question en français et un symbole en anglais. Cet index EST cette
// surface : une ligne par export, indexée par concept français.
//
// Socle PARTAGÉ : scripts/docs/lib/empreinte-sources.mjs (`ecrireOuVerifier`) et
// scripts/docs/lib/engineExports.mjs (`allEngineExports` — MÊME mesure que le cliquet
// src/data/index-moteur-ratchet.test.ts, jamais deux comptages qui pourraient diverger).
// Lexique : scripts/docs/lib/engineConcepts.mjs (`FILE_CONCEPTS` + `CROSS_CONCEPTS`).
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'
import { allEngineExports, fichiersMoteur, ENGINE_ROOT } from './lib/engineExports.mjs'
import { FILE_CONCEPTS, CROSS_CONCEPTS } from './lib/engineConcepts.mjs'
import { parLibelle } from '../guards/lib/lister.mjs'

const OUT = 'docs/index-moteur.md'
const TOOL = 'build-index-moteur'

// ---------------------------------------------------------------------------
// GARDE 1 — tout fichier de production de src/engine porte un concept de module. Un fichier neuf
// sans entrée fait échouer la génération : le lexique est forcé de croître avec le moteur.
// ---------------------------------------------------------------------------
const files = fichiersMoteur(ENGINE_ROOT)
const missingFileConcepts = files.filter((f) => !FILE_CONCEPTS.has(f))
if (missingFileConcepts.length) {
  console.error(`${TOOL} — ${missingFileConcepts.length} fichier(s) de src/engine sans concept de module (FILE_CONCEPTS de scripts/docs/lib/engineConcepts.mjs) :`)
  for (const f of missingFileConcepts) console.error(`  ${f}`)
  process.exit(1)
}
const staleFileConcepts = [...FILE_CONCEPTS.keys()].filter((f) => !files.includes(f))
if (staleFileConcepts.length) {
  console.error(`${TOOL} — ${staleFileConcepts.length} entrée(s) de FILE_CONCEPTS pointent un fichier disparu (à retirer) :`)
  for (const f of staleFileConcepts) console.error(`  ${f}`)
  process.exit(1)
}

const rows = allEngineExports(ENGINE_ROOT)

// ---------------------------------------------------------------------------
// GARDE 2 — aucun motif CROSS_CONCEPTS mort (0 correspondance sur l'ensemble des exports).
// ---------------------------------------------------------------------------
const conceptsOf = new Map()
const rowsOfConcept = new Map()
for (const [label] of CROSS_CONCEPTS) rowsOfConcept.set(label, [])

for (const r of rows) {
  const key = `${r.file}:${r.line}:${r.name}`
  const cs = [FILE_CONCEPTS.get(r.file)]
  const hay = `${r.name} ${r.role ?? ''}`
  for (const [label, rx] of CROSS_CONCEPTS) {
    if (rx.test(hay)) { cs.push(label); rowsOfConcept.get(label).push(r) }
  }
  conceptsOf.set(key, cs)
}

const deadPatterns = [...rowsOfConcept].filter(([, list]) => !list.length).map(([label]) => label)
if (deadPatterns.length) {
  console.error(`${TOOL} — ${deadPatterns.length} concept(s) CROSS_CONCEPTS sans AUCUNE correspondance (motif mort, à retirer ou corriger) :`)
  for (const l of deadPatterns) console.error(`  ${l}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
const documented = rows.filter((r) => r.role)
const undocumented = rows.length - documented.length
const rel = (f) => f.replace(/^src\/engine\//, '')
const esc = (s) => (s ?? '—').split('|').join('\\|')

let out = `# Index du moteur — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-index-moteur.mjs\` (\`npm run docs:index-moteur\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : les exports publics de \`src/engine\` (AST TypeScript — \`export function/const/class/interface/type/enum\`\n`
out += `> au niveau racine d'un fichier). Une ligne par export : symbole, \`fichier:ligne\`, 1re phrase de son JSDoc (\`—\` si absent),\n`
out += `> concepts (index par SENS, en français — les symboles du code sont en anglais).\n\n`

out += `## Pourquoi ce fichier\n\n`
out += `Un agent de grounding arrive avec une question en français et doit trouver le bon symbole dans un moteur écrit en\n`
out += `anglais. \`rollCareer\` (\`creation.ts:73\`) porte depuis 2026-06-18 un JSDoc qui explique que plusieurs Carrières\n`
out += `peuvent partager une borne de tirage — deux agents ont conclu à tort que ce mécanisme n'existait pas, faute de\n`
out += `surface de recherche. Cet index est cette surface : chercher « carrière aléatoire » doit faire remonter \`rollCareer\`\n`
out += `sous le concept « ${esc(FILE_CONCEPTS.get('src/engine/creation.ts'))} ».\n\n`

out += `## Périmètre mesuré et angles morts (non couverts, à dire pour ne pas se lire comme exhaustif)\n\n`
out += `- **\`src/state\`** est HORS périmètre de ce lot — le store/les flux ont leurs propres coutures, non indexées ici.\n`
out += `- **Ré-exports** (\`export { x } from '…'\`, \`export * from '…'\`) et **exports par défaut anonymes** : pas de\n`
out += `  déclaration nommée directe à ce niveau, donc pas de ligne/JSDoc à rapporter honnêtement — absents de la table.\n`
out += `- **Déstructuration exportée** (\`export const { a, b } = …\`) : hors périmètre, même raison.\n`
out += `- Le **rôle** affiché est la 1re phrase du JSDoc — le corps peut en dire davantage ; ouvrir le fichier pour le détail.\n`
out += `- Un export **sans JSDoc** (\`—\`) n'a que son concept de FICHIER (\`FILE_CONCEPTS\`) : il n'est pas cherchable par le\n`
out += `  contenu de sa description, seulement par le sujet de son module. \`${undocumented}\` exports sont dans ce cas — cliquet\n`
out += `  décroissant : \`src/data/index-moteur-ratchet.test.ts\`.\n`
out += `- Le lexique \`CROSS_CONCEPTS\` (recherche transversale) est un filet de sens, pas une taxonomie exhaustive du domaine :\n`
out += `  une notion absente du lexique reste findable via le concept de fichier, jamais introuvable.\n\n`

out += `_${rows.length} exports publics mesurés (${files.length} fichiers de \`src/engine\`, hors tests) — ${documented.length} documentés (JSDoc exploitable), ${undocumented} sans JSDoc._\n\n`

// --- index par concept ---
out += `## Index par concept (français)\n\n`
const allConcepts = new Map()
for (const [, cs] of conceptsOf) for (const c of cs) if (!allConcepts.has(c)) allConcepts.set(c, [])
for (const r of rows) {
  const cs = conceptsOf.get(`${r.file}:${r.line}:${r.name}`)
  for (const c of cs) allConcepts.get(c).push(r)
}
out += `| Concept | Exports |\n|---|---|\n`
for (const [label, list] of [...allConcepts].sort((a, b) => parLibelle(a[0], b[0]))) {
  const sorted = [...list].sort((a, b) => parLibelle(a.name, b.name))
  out += `| ${esc(label)} | ${sorted.map((r) => `\`${r.name}\` (${rel(r.file)}:${r.line})`).join(', ')} |\n`
}

// --- tous les exports, groupés par fichier ---
out += `\n## Tous les exports, par fichier\n\n`
const byFile = new Map()
for (const r of rows) {
  if (!byFile.has(r.file)) byFile.set(r.file, [])
  byFile.get(r.file).push(r)
}
for (const file of [...byFile.keys()].sort()) {
  const list = byFile.get(file).sort((a, b) => a.line - b.line)
  out += `### \`${rel(file)}\` — ${esc(FILE_CONCEPTS.get(file))}\n\n`
  out += `| Export | Ligne | Genre | Rôle | Concepts |\n|---|---|---|---|---|\n`
  for (const r of list) {
    const key = `${r.file}:${r.line}:${r.name}`
    const cs = conceptsOf.get(key)
    out += `| \`${r.name}\` | ${r.line} | ${r.kind} | ${esc(r.role)} | ${cs.map((c) => esc(c)).join(', ')} |\n`
  }
  out += '\n'
}

ecrireOuVerifier({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:index-moteur — ${OUT} est PÉRIMÉ (diverge des exports de ${ENGINE_ROOT}).`,
  rerunMsg: '  → relancer `npm run docs:index-moteur` et committer le résultat.',
  okMsg: `docs:index-moteur — OK (${OUT} à jour, ${rows.length} exports)`,
  writeMsg: `${OUT} — ${rows.length} exports (${documented.length} documentés / ${undocumented} sans JSDoc).`,
})
