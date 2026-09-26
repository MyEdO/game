// Table des PRIMITIVES PARTAGÉES — GÉNÉRÉE depuis `src/data/primitives.manifest.json` (la SOURCE,
// éditoriale et committée) vers `docs/primitives.md`. Même manifeste que la matrice d'adoption de
// `scripts/docs/build-systemes.mjs` : une primitive se déclare à UN endroit, les deux docs en
// dérivent.
// Re-run : node scripts/docs/build-primitives.mjs (npm run docs:primitives).
// Mode --check (chaîné dans npm run docs:check) : régénère en mémoire, compare au .md committé,
// exit 1 avec message actionnable si diff — jamais d'écriture en mode --check.
import { readFileSync, existsSync } from 'node:fs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'
import { emitOrCheck } from './lib/jsdocUnion.mjs'

const SOURCE = 'src/data/primitives.manifest.json'
const CIBLE = 'docs/primitives.md'

const PRIMITIVES = JSON.parse(readFileSync(SOURCE, 'utf8'))

// Intégrité : un manifeste qui cite un fichier absent rendrait une table qui ment, et
// `check-doc-refs` la refuserait plus loin sans nommer la cause.
const erreurs = []
const vus = new Set()
for (const p of PRIMITIVES) {
  for (const champ of ['id', 'label', 'fichier', 'concept', 'perimetre', 'verrou']) {
    if (!String(p?.[champ] ?? '').trim()) erreurs.push(`entrée « ${p?.id ?? '(sans id)'} » : champ ${champ} vide`)
  }
  if (p?.type !== 'primitives.manifest') erreurs.push(`entrée « ${p?.id} » : type attendu "primitives.manifest"`)
  if (vus.has(p?.id)) erreurs.push(`id en doublon : ${p.id}`)
  vus.add(p?.id)
  if (p?.fichier && !existsSync(p.fichier)) erreurs.push(`primitive « ${p.label} » (${p.id}) : fichier absent ${p.fichier}`)
}
if (erreurs.length) {
  console.error(`build-primitives — ${erreurs.length} erreur(s) d'intégrité du manifeste :`)
  for (const e of erreurs) console.error(`  ${e}`)
  process.exit(1)
}

/** Contenu d'une cellule GFM : le `|` d'une union TS s'échappe, sans quoi il coupe une colonne. */
const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim()

const lignes = [...PRIMITIVES].sort((a, b) => parUnitesDeCode(a.id, b.id))

let out = `# Primitives partagées — généré\n\n`
out += `> ⚠️ Fichier GÉNÉRÉ par \`node scripts/docs/build-primitives.mjs\` (\`npm run docs:primitives\`) — NE PAS ÉDITER À LA MAIN.\n`
out += `> Source UNIQUE : \`${SOURCE}\`. Une primitive s'y déclare, ce doc et la matrice d'adoption de\n`
out += `> \`docs/systemes.md\` en dérivent.\n\n`
out += `Source UNIQUE des motifs récurrents. **Avant d'écrire un composant, un module, un mot-clef d'op —\n`
out += `et à chaque \`Write\` sous \`src/\` — chercher ici, puis greper 2-3 variantes du concept.** On\n`
out += `RÉUTILISE ou on ÉTEND la primitive (général + paramétrable) ; chaque option/bouton nouveau se pose\n`
out += `DANS la primitive, jamais dans une Nᵉ copie. Le hook \`scripts/hooks/new-src-file-guard.mjs\` le\n`
out += `rappelle au geste : un \`.tsx\` neuf de \`src/ui\`/\`src/gameIso\` est soit une primitive déclarée ici,\n`
out += `soit un écran inscrit à \`scripts/hooks/ecrans-ui.json\`.\n\n`
out += `Colonnes : **Besoin** = le motif · **Primitive** = le ou les symboles exportés · **Fichier** = la\n`
out += `source unique · **Périmètre** = où elle est composée · **Verrou** = la garde ou la clause qui la\n`
out += `tient (\`—\` : aucune garde mécanique, la revue seule).\n\n`
out += `${lignes.length} primitives.\n\n`
out += `| Besoin | Primitive | Fichier | Périmètre | Verrou |\n|---|---|---|---|---|\n`
for (const p of lignes) {
  out += `| ${cell(p.concept)} | \`${cell(p.label)}\` | \`${cell(p.fichier)}\` | ${cell(p.perimetre)} | ${cell(p.verrou)} |\n`
}

emitOrCheck({
  out,
  path: CIBLE,
  check: process.argv.includes('--check'),
  staleMsg: `docs:primitives — ${CIBLE} est PÉRIMÉ (diverge de ${SOURCE}).`,
  rerunMsg: '  → relancer `npm run docs:primitives` et committer le résultat.',
  okMsg: `docs:primitives — OK (${CIBLE} à jour)`,
  writeMsg: `${CIBLE} — ${lignes.length} primitives.`,
})
