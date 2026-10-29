import type { ViewSet } from '../types';
import type { Sexe } from '../../../../data/schemas/grammaire/valeurs';
import type { TeteId } from '../../../../data/schemas/defs/garde-robe';

/**
 * Une TÊTE = un fichier `defs/<tete>-<Sexe>.ts` : l'art d'une ligne `tete` de `garde-robe.json` pour un
 * sexe. `tete` = id de la ligne, égal à la race de rendu (`baseSpeciesOf`). `visage` = variantes de face
 * (≥1) en jetons @peau/@cheveux, choisies par seed/override (bouton « Variante » du créateur). `crane`
 * surcharge le crâne de dos générique (`cosmetic.ts`). La chevelure d'espèce est une coiffure
 * (`hairstyles/defs/chevelure-<tete>-<Sexe>.ts`, champ `tete`).
 */
export type HeadDef = { tete: TeteId; sex: Sexe; visage?: string[]; crane?: ViewSet };
