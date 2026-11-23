/**
 * LA TENUE D'UN PRESET DE PERSONNAGE (#4338) : ce que le jeu monte d'un preset (`src/data/presets-de-personnage.json`)
 * sur sa base, par la chaîne du pont : sa composition (`cataloguesDeComposition`, `compositionDuPreset`), sa portée
 * (`porteeDeComposition`), puis ses éléments sur la base (`modelesDeLAtelier`, `composerSurLaBase`).
 */
import { cataloguesDeComposition, porteeDeComposition, type PorteeDeComposition } from '../../../src/noyau/index';
import { modelesDeLAtelier } from '../pont/atelier';
import { composerSurLaBase } from '../pont/composition';

/** La portée du preset de personnage `preset` (`porteeDeComposition`) ; lève si `preset` n'en est aucun. */
export function porteeDuPreset(preset: string): PorteeDeComposition {
  const trouve = cataloguesDeComposition().presets.find((p) => p.id === preset);
  if (!trouve) throw new Error(`preset de personnage : « ${preset} » n’en est aucun`);
  return porteeDeComposition(trouve.composition);
}

/** Les ids des éléments que le preset `preset` monte sur la base de modèle `base`, parmi les modèles
 *  `manifestes` (id → manifeste) aux os de leurs meshes rigides `osDesRigides` (`listage`, `hotes/godot/listage.mjs`),
 *  dans l'ordre de ses `montes` (`composerSurLaBase`), un élément monté sur plusieurs lignes autant de fois. Lève sur un
 *  refus de l'index ou une base absente. */
export function tenueDuPreset(preset: string, base: string, manifestes: Record<string, unknown>, osDesRigides: Readonly<Record<string, readonly string[]>>): string[] {
  const modeles = modelesDeLAtelier(manifestes, osDesRigides);
  if (modeles.refus.length) throw new Error(`tenue du preset ${preset} : ${modeles.refus.join(' ; ')}`);
  const surLaBase = modeles.bases.find((b) => b.id === base);
  if (!surLaBase) throw new Error(`tenue du preset ${preset} : base « ${base} » absente des modèles`);
  return composerSurLaBase(surLaBase, manifestes, porteeDuPreset(preset)).montes.flatMap((m) => (m.element === null ? [] : [m.element]));
}
