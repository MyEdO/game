/** Emplacements de base d'une palette de rig (ordre stable) — source UNIQUE, lue par le schéma de donnée
 *  (`raceAppearance.tirageIndividuel`) et par le rig (`gameIso/rig/palette.ts`). Hors du chargeur pour
 *  rester importable par `src/gameIso`. */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'] as const;
export type Slot = (typeof SLOTS)[number];
/** Clés de sorte PORTEUR (#1903) : résolues par la table du porteur seulement. */
export const PORTEUR = ['peau', 'cheveux', 'yeux'] as const satisfies readonly Slot[];
/** Gamme d'une base de palette : la base, son ombre `<base>O`, sa lumière `<base>H`. */
export type Gamme<K extends string> = K | `${K}O` | `${K}H`;
/** Les gammes de `bases`, base, ombre et lumière, dans l'ordre des bases. */
export const gammes = <K extends string>(bases: readonly K[]): Gamme<K>[] => bases.flatMap((k) => [k, `${k}O` as const, `${k}H` as const]);
/** Gammes des clés `PORTEUR` : les seules clés d'une palette d'ESPÈCE (`raceAppearance.palette`/`paletteF`). */
export const GAMMES_PORTEUR = gammes(PORTEUR);
/** Palette d'ESPÈCE : un record partiel sur `GAMMES_PORTEUR`. */
export type PaletteDEspece = { [G in Gamme<(typeof PORTEUR)[number]>]?: string };
