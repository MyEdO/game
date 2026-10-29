import { ARMOUR_DEFS } from './_registry.generated';
import type { ArmourSet } from './types';
import type { PaletteDeclaree } from '../../palette';

export type { ArmourSet, ArmourDef } from './types';

/**
 * Table des armures DÉRIVÉE des fichiers `defs/`.
 * Ajouter/éditer une armure = déposer un fichier dans `defs/` (puis `npm run gen` hors dev).
 * Clé = `id` du def, atteint par la matière d'une pièce (`art` de son Groupe, `weaponGroups.json` ; `artDeMatiere`, `equipment.ts`).
 */
export const ARMOUR: Record<string, ArmourSet> = Object.fromEntries(
  ARMOUR_DEFS.map((d) => [d.id, d.set]),
);

/** Palette par DÉFAUT de chaque matériau (couleurs exactes des `@tokens` de son art) → rendu sans
 *  perte + recoloriage cohérent par la teinte d'objet. Clé = `id` du def. */
export const ARMOUR_PALETTES: Record<string, PaletteDeclaree> = Object.fromEntries(
  ARMOUR_DEFS.filter((d) => d.palette).map((d) => [d.id, d.palette!]),
);
