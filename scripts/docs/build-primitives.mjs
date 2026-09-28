// Table des PRIMITIVES PARTAGÉES — GÉNÉRÉE depuis `src/data/primitives.manifest.json` (la SOURCE,
// éditoriale et committée) vers `docs/primitives.md`. Même manifeste que la matrice d'adoption de
// `scripts/docs/build-systemes.mjs` : une primitive se déclare à UN endroit, les deux docs en
// dérivent.
// Re-run : node scripts/docs/build-primitives.mjs (npm run docs:primitives).
// Mode `--check` : `ecrireOuVerifier` (scripts/docs/lib/empreinte-sources.mjs), rejoué par `build-all.mjs`.
import { readFileSync, existsSync } from 'node:fs'
import { FEUILLES_PARTAGEES, RACINE_DES_MODULES, moduleHorsCouche } from '../guards/lib/cssCouches.mjs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'
import { ecrireOuVerifier } from './lib/empreinte-sources.mjs'

const SOURCE = 'src/data/primitives.manifest.json'
const CIBLE = 'docs/primitives.md'

const PRIMITIVES = JSON.parse(readFileSync(SOURCE, 'utf8'))

/** Les feuilles PARTAGÉES qu'aucune primitive ne possède viennent de
 *  leur source UNIQUE (`scripts/guards/lib/cssCouches.mjs`). */
const CSS_PARTAGES = FEUILLES_PARTAGEES

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
  // Champ `css` (#1800) : le module que la primitive POSSÈDE (`moduleHorsCouche`). C'est LUI qui
  // trace la frontière module de PRIMITIVE / module d'ÉCRAN pour le cliquet (xxi) — un chemin qui
  // ment, qui sort de la couche, ou qui réclame une feuille PARTAGÉE déclasserait des modules
  // d'écran entiers en silence.
  if (p?.css != null) {
    if (!existsSync(p.css)) erreurs.push(`primitive « ${p.label} » (${p.id}) : css absent ${p.css}`)
    if (moduleHorsCouche(p.fichier, p.css)) erreurs.push(`primitive « ${p.label} » (${p.id}) : css hors couche (${p.css}) — attendu sous ${RACINE_DES_MODULES}, ou dans la zone de son fichier hors de src/ui`)
    if (CSS_PARTAGES.includes(p.css)) erreurs.push(`primitive « ${p.label} » (${p.id}) : css ${p.css} est une feuille PARTAGÉE, aucune primitive ne la possède`)
  }
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
out += `source unique · **CSS possédé** = le module de \`src/ui/styles/\` dont la primitive porte la\n`
out += `matière (\`—\` : elle n'en possède aucun) · **Périmètre** = où elle est composée · **Verrou** = la\n`
out += `garde ou la clause qui la tient (\`—\` : aucune garde mécanique, la revue seule).\n\n`
out += `**Périmètre mesuré / angles morts** — ce doc RENDS le manifeste \`${SOURCE}\`, il ne mesure pas le\n`
out += `code : une primitive existe ici parce qu'un humain l'y a DÉCLARÉE. Ce qui est vérifié à la\n`
out += `génération : chaque entrée porte un \`type\` \`primitives.manifest\`, un \`id\` unique, des champs non\n`
out += `vides, et un \`fichier\` qui EXISTE sur disque (sinon exit 1, entrée nommée) ; \`check-doc-refs\` résout\n`
out += `en plus chaque symbole du \`label\` contre un export réel. Ce qui ne l'est PAS : les colonnes\n`
out += `**Périmètre** et **Verrou** sont ÉDITORIALES — aucune garde ne vérifie qu'elles décrivent l'usage\n`
out += `réel, ni qu'un \`—\` de Verrou dise vrai. Angle mort principal : une primitive du code ABSENTE du\n`
out += `manifeste est invisible ici, et rien ne la révèle sauf le hook \`new-src-file-guard.mjs\`, qui ne\n`
out += `mord qu'à la CRÉATION d'un \`.tsx\` de \`src/ui\`/\`src/gameIso\` — un module \`.ts\`, un fichier antérieur\n`
out += `au hook, ou une primitive née ailleurs n'y passent jamais.\n\n`
out += `${lignes.length} primitives.\n\n`
out += `| Besoin | Primitive | Fichier | CSS possédé | Périmètre | Verrou |\n|---|---|---|---|---|---|\n`
for (const p of lignes) {
  const css = p.css ? `\`${cell(p.css)}\`` : '—'
  out += `| ${cell(p.concept)} | \`${cell(p.label)}\` | \`${cell(p.fichier)}\` | ${css} | ${cell(p.perimetre)} | ${cell(p.verrou)} |\n`
}

ecrireOuVerifier({
  out,
  path: CIBLE,
  check: process.argv.includes('--check'),
  staleMsg: `docs:primitives — ${CIBLE} est PÉRIMÉ (diverge de ${SOURCE}).`,
  rerunMsg: '  → relancer `npm run docs:primitives` et committer le résultat.',
  okMsg: `docs:primitives — OK (${CIBLE} à jour)`,
  writeMsg: `${CIBLE} — ${lignes.length} primitives.`,
})
