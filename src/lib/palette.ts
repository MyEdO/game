/** Emplacements de base d'une palette (ordre stable), lus par les palettes de matières, la palette d'une composition et
 *  les surfaces des modèles 3D ; leur libellé vit sur `slotSchema` (`src/data/schemas/grammaire/valeurs.ts`). */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent', 'bois', 'corne', 'fourrure', 'plume', 'vegetal'] as const;
export type Slot = (typeof SLOTS)[number];
