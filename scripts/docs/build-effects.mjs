// Carte du vocabulaire `Effect` = DONNÉE (#667) : GÉNÉRÉE depuis les SCHÉMAS zod des variantes
// (src/data/schemas/defs-scenes/effets.ts — AST TypeScript, pas de regex sur les accolades) ; c'est
// là que vivent la forme de chaque variante et sa JSDoc, `src/state/scene.ts` en compose seulement
// les noms par `z.infer`. La feuille `type:'ops'` est le schéma de la grammaire, indexé lui aussi.
// Sortie : docs/campagne-effects.md.
// Re-run : node scripts/docs/build-effects.mjs (npm run docs:effects).
// Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
// exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
// Lecture d'union / extraction JSDoc / écriture-vérification : scripts/docs/lib/jsdocUnion.mjs
// (socle PARTAGÉ avec build-vocabulaire.mjs).
import { indexerConstantes, readZodUnionMembers, renderFields, emitOrCheck } from './lib/jsdocUnion.mjs'

const SRC = 'src/data/schemas/defs-scenes/effets.ts'
const SRC_OPS = 'src/data/schemas/grammaire/mecanique.ts'
const OUT = 'docs/campagne-effects.md'
const TOOL = 'build-effects'

const index = indexerConstantes([SRC, SRC_OPS])
const { rows: merged, rawCount } = readZodUnionMembers(index, 'effectSchema', 'type', TOOL, {
  // `...scheduleShape` (la shape étalée) NOMME `ScheduleSpec` (engine/clock) dans la carte.
  nomsDeSpread: { scheduleShape: 'ScheduleSpec' },
})

let out = `# Carte des Effects de scène — GÉNÉRÉ\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-effects.mjs\` (\`npm run docs:effects\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source : les schémas de \`${SRC}\` (l'union \`effectSchema\`). Vocabulaire des actions authorées d'une\n`
out += `> scène/campagne, posées dans un \`Flow\` (\`onVictory\`, choix de dialogue, trigger, \`delayedEffect\`…).\n`
out += `> Voir \`docs/campagne-authoring.md\`.\n\n`
out += `**Périmètre mesuré / angles morts** — cette carte énumère le VOCABULAIRE AUTHORABLE de l'union \`effectSchema\` (AST\n`
out += `TypeScript de \`${SRC}\` : nom, champs, 1re phrase de JSDoc). Elle ne mesure NI où chaque \`Effect\` est réellement\n`
out += `interprété (aucune colonne « Résolveurs », contrairement à \`docs/vocabulaire-mecanique.md\`) NI son usage réel dans\n`
out += `une scène/campagne (aucune colonne « Donnée ») : un \`Effect\` listé ici peut être un type authorable sans handler\n`
out += `câblé côté \`src/state\`, ou n'être jamais posé dans aucun JSON de campagne — cette carte ne le dira pas.\n\n`
out += `| Effect (\`type\`) | Champs | Rôle |\n|---|---|---|\n`
for (const r of merged) {
  out += `| \`${r.name}\` | ${renderFields(r.fieldGroups)} | ${r.role ?? '—'} |\n`
}
out += `\n_${merged.length} Effects — dérivés de \`${SRC}\`._\n`

emitOrCheck({
  out,
  path: OUT,
  check: process.argv.includes('--check'),
  staleMsg: `docs:effects — ${OUT} est PÉRIMÉ (diverge de l'union effectSchema de ${SRC}).`,
  rerunMsg: '  → relancer `npm run docs:effects` et committer le résultat.',
  okMsg: `docs:effects — OK (${OUT} à jour, ${merged.length} Effects)`,
  writeMsg: `${OUT} — ${merged.length} Effects (${rawCount} membres d'union avant fusion).`,
})
