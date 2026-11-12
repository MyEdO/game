import { ICON_FAMILIES } from './_registry.generated';
import type { IconDef, IconId } from './types';

export type { IconDef, IconId } from './types';

/** Le cadre du dessin d'une icône (`IconDef.svg`). */
export const CADRE_DES_ICONES = { largeur: 24, hauteur: 24 };

/** Registre à plat : id → def (unicité des ids garantie par icons.test.ts). Keyé `string` pour
 *  qu'une saisie s'y juge (`estIdDIcone`). */
export const ICON_DEFS: Record<string, IconDef> = Object.fromEntries(
  ICON_FAMILIES.flat().map((d) => [d.id, d]),
);

/** Le libellé de chaque icône du registre, par id : les valeurs du nœud `idDIconeSchema` (`schemas/grammaire/valeurs.ts`). */
export const LIBELLES_DES_ICONES = Object.fromEntries(ICON_FAMILIES.flat().map((d) => [d.id, d.label])) as Readonly<Record<IconId, string>>;

/** `id` est-il au registre ? La porte d'un id d'icône lu d'une saisie ou d'un paquet. */
export const estIdDIcone = (id: string): id is IconId => Object.prototype.hasOwnProperty.call(ICON_DEFS, id);
