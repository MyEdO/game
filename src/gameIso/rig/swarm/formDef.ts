import type { PaletteDeclaree } from '../palette';

/**
 * Une FORME de nuée = un fichier `defs/<id>.ts` : silhouette d'UN constituant de l'amas (dessin
 * LOCAL centré, +x = avant/tête) + palette par défaut. `critter(cx,cy,s,flip,view)` est DÉRIVÉ
 * (enveloppe translate+scale) dans `forms.ts`. `aerial` = flock en hauteur (oiseaux). Ajouter une
 * nuée = déposer un fichier ; « l'utiliser » = `appearance.species = '<id>'` d'un record Nuée.
 */
export type SwarmFormDef = { id: string; draw: string; palette: PaletteDeclaree; aerial?: boolean };
