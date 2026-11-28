// L'ENTRÉE D'UN HÔTE DU NOYAU (#2928) : un module virtuel qui
// charge le gel du catalogue (`src/data/overrides.ts`) PUIS les modules de l'hôte (ordre d'évaluation des imports), et
// les greffons de Vite qui le servent, `proseSource()` compris : la même porte que la suite du noyau (`vitest.config.ts`).
// Le lanceur de l'hôte texte (`scripts/hote-texte.mjs`) la charge par le module runner de Vite ; le bundle du pont de
// Godot (`hotes/godot/construire.mjs`) et les assets de Godot (`hotes/godot/asset/charger.mjs`) la bâtissent par
// `batirLEntree`, qui la nomme par `entree`.
import { fileURLToPath } from 'node:url'
import { proseSource } from './source/prose-source-plugin.mjs'
import { analyserTexte } from './guards/lib/dialecte.mjs'
import { sitesDeModule } from './guards/lib/importGraph.mjs'
import { cibleLexicale, posix } from './guards/lib/interneLint.mjs'

const FICHIER = fileURLToPath(import.meta.url)
const RACINE = posix(fileURLToPath(new URL('..', import.meta.url))).replace(/\/$/, '')

const specDuDepot = (spec) => spec?.startsWith('/') && !spec.startsWith('/@') && !/[\\%?#:\p{Cc}]/u.test(spec)
  && cibleLexicale(FICHIER, spec, RACINE) === RACINE + spec

function verifierDeclarations(entree, code) {
  const { sourceFile, diagnostics } = analyserTexte({ rel: 'scripts/entree-d-hote.mjs', text: code })
  const sites = sitesDeModule(entree, sourceFile, diagnostics)
  const conformes = sites.length === sourceFile.statements.length && sites.every((site, i) =>
    site.noeud === sourceFile.statements[i] && site.nature === 'statique' && specDuDepot(site.spec)
    && ((site.genre === 'import' && !site.clause) || (site.genre === 'export' && site.liaisons.every((l) => !l.typeSeul))))
  if (!conformes) throw new TypeError(`[${entree}] imports latéraux et réexports statiques du dépôt attendus`)
}

/** L'entrée de l'hôte `nom` : le nom de son module virtuel (`entree`), son id résolu (`id`), et les greffons de Vite qui
 *  le chargent après le gel du catalogue, ses `lignes` (`export … from '/src/…'`, ou `import '/hotes/…'`) dans l'ordre. */
export function entreeDHote(nom, lignes) {
  const entree = `virtual:${nom}`
  const id = `\0${entree}`
  const code = ["import '/src/data/overrides.ts';", ...lignes].join('\n')
  verifierDeclarations(entree, code)
  return {
    entree,
    id,
    greffons: [proseSource(), {
      name: `${nom}-entree`,
      resolveId: (cible) => (cible === entree || cible === id ? id : null),
      load: (cible) => (cible === id ? code : null),
    }],
  }
}

/** Le morceau d'entrée (`code`, `moduleIds`) que bâtit `vite build` de `entree` (un module virtuel d'`entreeDHote`, ou
 *  un chemin) servie par `greffons`, à la racine du dépôt, sans fichier de configuration ni `public/` ; `config` s'y
 *  fusionne (`mergeConfig`). Vite se charge à l'appel. */
export async function batirLEntree({ entree, greffons }, config) {
  const { build, mergeConfig } = await import('vite')
  const resultat = await build(mergeConfig({
    root: RACINE,
    configFile: false,
    publicDir: false,
    plugins: greffons,
    build: { rolldownOptions: { input: entree }, emptyOutDir: false, copyPublicDir: false, reportCompressedSize: false },
  }, config))
  const [sortie] = Array.isArray(resultat) ? resultat : [resultat]
  const morceau = sortie.output.find((o) => o.type === 'chunk' && o.isEntry)
  if (!morceau) throw new Error(`[${entree}] morceau d'entrée absent de la sortie de vite build`)
  return morceau
}
