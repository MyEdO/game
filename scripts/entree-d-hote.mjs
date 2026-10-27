// L'ENTRÉE D'UN HÔTE DU NOYAU (#2928) : un module virtuel qui
// charge le gel du catalogue (`src/data/overrides.ts`) PUIS les modules de l'hôte (ordre d'évaluation des imports), et
// les greffons de Vite qui le servent, `proseSource()` compris : la même porte que la suite du noyau (`vitest.noyau.config.ts`).
// Le lanceur de l'hôte texte (`scripts/hote-texte.mjs`) la charge par le module runner de Vite, le bundle du pont de
// Godot (`hotes/godot/construire.mjs`) la bâtit par `vite build`, qui la nomme par `entree`.
import { proseSource } from './source/prose-source-plugin.mjs'

/** L'entrée de l'hôte `nom` : le nom de son module virtuel (`entree`), son id résolu (`id`), et les greffons de Vite qui
 *  le chargent après le gel du catalogue, ses `lignes` (`export … from '/src/…'`, ou `import '/hotes/…'`) dans l'ordre. */
export function entreeDHote(nom, lignes) {
  const entree = `virtual:${nom}`
  const id = `\0${entree}`
  const code = ["import '/src/data/overrides.ts';", ...lignes].join('\n')
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
