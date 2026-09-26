import type { PartArt } from '../types';
import type { PaletteDeclaree } from '../../palette';

/** Slots couverts par une armure. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur).
 *  `pied`/`main`/`cou` : armure de ces zones d'extrémité (solerets, gantelets, gorgerin) — pilote la
 *  part par-dessus le repli de chair d'espèce (extremites.ts), au même titre que tete/torse/jambes. */
export type ArmourSet = Partial<Record<'tete' | 'torse' | 'bras' | 'jambes' | 'pied' | 'main' | 'cou', PartArt>>;

/**
 * Une armure = un fichier `defs/<Nom>.ts`. `id` = la CLÉ de lookup : le MATÉRIAU en minuscules
 * ('rembourre' | 'cuir' | 'maille' | 'plaque') — `armourPart` (equipment.ts) résout le matériau
 * inféré du nom de l'objet vers cet `id`.
 *
 * `palette` : couleurs par défaut des `@tokens` de l'art (PaletteDeclaree = hex exact) → rendu sans
 * perte + recoloriage cohérent par le skin d'objet, EXACTEMENT comme les tenues.
 */
export interface ArmourDef { id: string; set: ArmourSet; palette?: PaletteDeclaree }
