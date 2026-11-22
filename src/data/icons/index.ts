import { ICON_FAMILIES } from './_registry.generated';
import type { IconDef, IconId } from './types';

export type { IconDef, IconId } from './types';

/** Le cadre du dessin d'une icône (`IconDef.svg`). */
export const CADRE_DES_ICONES = { largeur: 24, hauteur: 24 };

/** Registre à plat des dessins par id, dont `icons.test.ts` vérifie l’unicité. */
export const ICON_DEFS: Record<string, IconDef> = Object.fromEntries(
  ICON_FAMILIES.flat().map((d) => [d.id, d]),
);

/** Le libellé de chaque icône du registre, par id : les valeurs du nœud `idDIconeSchema` (`schemas/grammaire/valeurs.ts`). */
export const LIBELLES_DES_ICONES = Object.fromEntries(ICON_FAMILIES.flat().map((d) => [d.id, d.label])) as Readonly<Record<IconId, string>>;
