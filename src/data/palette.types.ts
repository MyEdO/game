/** Emplacements de base d'une palette de rig (ordre stable) — source UNIQUE, lue par le schéma de donnée
 *  (`raceAppearance.tirageIndividuel`) et par le rig (`gameIso/rig/palette.ts`). Hors du chargeur pour
 *  rester importable par `src/gameIso`. */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'] as const;
export type Slot = (typeof SLOTS)[number];
/** Clés de sorte PORTEUR (#1903) : résolues par la table du porteur seulement. */
export const PORTEUR = ['peau', 'cheveux', 'yeux'] as const satisfies readonly Slot[];
/** Rôles d'une gamme hors de sa base, rôle → suffixe de la clé (#1903) : SOURCE UNIQUE, dont dérivent
 *  `RoleDeGamme`, `ROLES_DE_GAMME`, `Gamme`, `gammeDe`, `gammes` et `baseDeGamme`. */
export const SUFFIXE_DE_ROLE = { ombre: 'O', lumiere: 'H' } as const;
/** Rôle d'une gamme hors de sa base : une clé de `SUFFIXE_DE_ROLE`. */
export type RoleDeGamme = keyof typeof SUFFIXE_DE_ROLE;
/** Les rôles d'une gamme, dans l'ordre de `SUFFIXE_DE_ROLE`. */
export const ROLES_DE_GAMME = Object.keys(SUFFIXE_DE_ROLE) as readonly RoleDeGamme[];
/** Gamme d'une base de palette : la base et la clé de chacun de ses rôles (`gammeDe`). */
export type Gamme<K extends string> = K | `${K}${(typeof SUFFIXE_DE_ROLE)[RoleDeGamme]}`;
/** Clé du rôle `role` de la base `k` : la base suivie du suffixe du rôle. */
export const gammeDe = <K extends string, R extends RoleDeGamme>(k: K, role: R): `${K}${(typeof SUFFIXE_DE_ROLE)[R]}` =>
  `${k}${SUFFIXE_DE_ROLE[role]}` as `${K}${(typeof SUFFIXE_DE_ROLE)[R]}`;
/** Les gammes de `bases` : chaque base puis la clé de chacun de ses rôles, dans l'ordre des bases. */
export const gammes = <K extends string>(bases: readonly K[]): Gamme<K>[] =>
  bases.flatMap((k): Gamme<K>[] => [k, ...ROLES_DE_GAMME.map((role) => gammeDe(k, role))]);
/** Base d'une clé de gamme : la clé privée du suffixe d'un rôle de `SUFFIXE_DE_ROLE`, s'il y en a un.
 *  Univoque : aucune clé de la table ne finit par un suffixe de rôle (`palette.test.ts`). */
export function baseDeGamme(cle: string): string {
  const suffixe = Object.values(SUFFIXE_DE_ROLE).find((s) => cle.endsWith(s));
  return suffixe ? cle.slice(0, -suffixe.length) : cle;
}
/** Gammes des clés `PORTEUR` : les seules clés d'une palette d'ESPÈCE (`raceAppearance.palette`/`paletteF`). */
export const GAMMES_PORTEUR = gammes(PORTEUR);
/** Palette d'ESPÈCE : un record partiel sur `GAMMES_PORTEUR`. */
export type PaletteDEspece = { [G in Gamme<(typeof PORTEUR)[number]>]?: string };
