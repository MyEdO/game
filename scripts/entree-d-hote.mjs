// L'ENTRÉE D'UN HÔTE DU NOYAU (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md` B-c) : un module virtuel qui
// charge le gel du catalogue (`src/data/overrides.ts`) PUIS les exports de l'hôte (ordre d'évaluation des imports), et
// les greffons de Vite qui le servent, `proseSource()` compris : la même porte que la suite du noyau (`vitest.noyau.config.ts`).
// Le lanceur de l'hôte texte (`scripts/hote-texte.mjs`) la charge par le module runner de Vite.
import { proseSource } from './source/prose-source-plugin.mjs'

/** L'entrée de l'hôte `nom` : l'id de son module virtuel, et les greffons de Vite qui le chargent après le gel du
 *  catalogue, ses `exports` (lignes `export … from '/src/…'`) dans l'ordre. */
export function entreeDHote(nom, exports) {
  const id = `\0virtual:${nom}`
  const code = ["import '/src/data/overrides.ts';", ...exports].join('\n')
  return { id, greffons: [proseSource(), { name: `${nom}-entree`, load: (cible) => (cible === id ? code : null) }] }
}
