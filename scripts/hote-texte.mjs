#!/usr/bin/env node
// LANCEUR DE L'HÔTE TEXTE (#2898, plan v3 Décision 5) : `npm run hote-texte -- --partie <f.jsonl> <commande> …`.
// Le module runner de Vite charge, dans UN graphe de modules, le gel du catalogue (`src/data/overrides.ts`) puis
// l'entrée de l'hôte (`src/hoteTexte/cli.ts`), avec le greffon `proseSource()` : la même porte que la suite du noyau
// (`vitest.noyau.config.ts`), et `import.meta.env.DEV` vrai. Le lanceur prête le disque à l'entrée, écrit sa sortie et
// rend son code. Coût mesuré d'un appel : `docs/hote-texte.md`.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import { proseSource } from './source/prose-source-plugin.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const ENTREE = '\0virtual:hote-texte'

/** Le module d'entrée : le gel du catalogue, PUIS l'hôte (ordre d'évaluation des imports). */
const MODULES_VIRTUELS = new Map([[ENTREE, "import '/src/data/overrides.ts';\nexport { executer } from '/src/hoteTexte/cli.ts';\n"]])
const entree = { name: 'hote-texte-entree', load: (id) => MODULES_VIRTUELS.get(id) ?? null }

const { module } = await runnerImport(ENTREE, {
  root: RACINE,
  configFile: false,
  logLevel: 'silent',
  plugins: [proseSource(), entree],
  server: { fs: { strict: false } },
})

const ici = (chemin) => resolve(process.cwd(), chemin)
const disque = {
  lire: (chemin) => (existsSync(ici(chemin)) ? readFileSync(ici(chemin), 'utf8') : null),
  ecrire: (chemin, texte) => writeFileSync(ici(chemin), texte),
  ajouter: (chemin, texte) => appendFileSync(ici(chemin), texte),
}

const { texte, code } = module.executer(process.argv.slice(2), disque)
process.stdout.write(texte, () => process.exit(code))
