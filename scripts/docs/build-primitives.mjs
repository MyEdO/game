// Table des PRIMITIVES PARTAGÉES — GÉNÉRÉE depuis `src/data/primitives.manifest.json` (la SOURCE,
// éditoriale et committée) vers `docs/primitives.md`. Même manifeste que la matrice d'adoption de
// `scripts/docs/build-systemes.mjs` : une primitive se déclare à UN endroit, les deux docs en
// dérivent.
// Re-run : node scripts/docs/build-primitives.mjs (npm run docs:primitives).
// Le lanceur des dérivés applique le mode `--check` en CLI et depuis `build-all.mjs`.
import { readFileSync, existsSync } from 'node:fs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'
import { lancerDepuisCLI } from './lib/ecriture-derives.mjs'

/** Le corps rendu et les messages du lanceur, sans rien écrire. */
function rendu() {
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
  out += `DANS la primitive partagée.\n\n`
  out += `Colonnes : **Besoin** = le motif · **Primitive** = le ou les symboles exportés · **Fichier** = la\n`
  out += `source unique · **Périmètre** = où elle est composée · **Verrou** = la garde ou la clause qui\n`
  out += `la tient (\`—\` : la revue seule).\n\n`

  out += `**Périmètre mesuré / angles morts** — ce doc RENDS le manifeste \`${SOURCE}\`, il ne mesure pas le\n`
  out += `code : une primitive existe ici parce qu'un humain l'y a DÉCLARÉE. Ce qui est vérifié à la\n`
  out += `génération : chaque entrée porte un \`type\` \`primitives.manifest\`, un \`id\` unique, des champs non\n`
  out += `vides, et un \`fichier\` qui EXISTE sur disque (sinon exit 1, entrée nommée) ; \`check-doc-refs\` résout\n`
  out += `en plus chaque symbole du \`label\` contre un export réel. Ce qui ne l'est PAS : les colonnes\n`
  out += `**Périmètre** et **Verrou** sont ÉDITORIALES — aucune garde ne vérifie qu'elles décrivent l'usage\n`
  out += `réel, ni qu'un \`—\` de Verrou dise vrai. La revue repère les primitives absentes du manifeste.\n\n`

  out += `${lignes.length} primitives.\n\n`
  out += `| Besoin | Primitive | Fichier | Périmètre | Verrou |\n|---|---|---|---|---|\n`
  for (const p of lignes) {
    out += `| ${cell(p.concept)} | \`${cell(p.label)}\` | \`${cell(p.fichier)}\` | ${cell(p.perimetre)} | ${cell(p.verrou)} |\n`
  }
  return {
    out,
    path: CIBLE,
    staleMsg: `docs:primitives — ${CIBLE} est PÉRIMÉ (diverge de ${SOURCE}).`,
    rerunMsg: '  → relancer `npm run docs:primitives` (dérivé jamais commité, #2203).',
    okMsg: `docs:primitives — OK (${CIBLE} à jour)`,
    writeMsg: `${CIBLE} — ${lignes.length} primitives.`,
  }
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : cible → texte, sans écrire. */
export function rendre() {
  const { path, out } = rendu()
  return new Map([[path, out]])
}

export function* produire() {
  yield rendu()
}

if (import.meta.main) await lancerDepuisCLI(import.meta, produire)
