import type { PartArt } from '../types';
import type { PaletteDeCouchePortee } from '../../palette';

/** Slots couverts par une armure. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur).
 *  `pied`/`main`/`cou` : armure de ces zones d'extrémité (solerets, gantelets, gorgerin) — pilote la
 *  part par-dessus le repli de chair d'espèce (extremites.ts), au même titre que tete/torse/jambes. */
export type ArmourSet = Partial<Record<'tete' | 'torse' | 'bras' | 'jambes' | 'pied' | 'main' | 'cou', PartArt>>;

/**
 * Une armure = un fichier `defs/<Nom>.ts`. `id` = la CLÉ de lookup ('cuir' | 'maille' | 'plaque') —
 * `armourPart` (equipment.ts) y résout la matière de la pièce (`matiere`) par `artDeMatiere`.
 *
 * `palette` : couleurs par défaut des `@tokens` de l'art (PaletteDeCouchePortee = hex exact) → rendu sans
 * perte + recoloriage cohérent par la teinte d'objet, EXACTEMENT comme les tenues.
 */
export interface ArmourDef { id: string; set: ArmourSet; palette?: PaletteDeCouchePortee }
