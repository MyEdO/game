/** Emplacements de base d'une palette (ordre stable) — source UNIQUE, lue par le schéma de donnée
 *  (`surchargePaletteSchema`, `raceAppearance.tirageIndividuel`) et par l'hôte 3D (`hotes/godot/asset/element.ts`). */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'] as const;
export type Slot = (typeof SLOTS)[number];
/** Clés de sorte PORTEUR (#1903). */
const PORTEUR = ['peau', 'cheveux', 'yeux'] as const satisfies readonly Slot[];
/** Suffixes des rôles d'une gamme hors de sa base : ombre `O`, lumière `H` (#1903). */
const SUFFIXES_DE_ROLE = ['O', 'H'] as const;
/** Gammes des clés `PORTEUR` (base, puis chaque rôle) : les seules clés d'une palette d'ESPÈCE
 *  (`raceAppearance.palette`/`paletteF`). */
export const GAMMES_PORTEUR = PORTEUR.flatMap((k) => [k, ...SUFFIXES_DE_ROLE.map((s) => `${k}${s}` as const)]);
