import type { AppearanceElement, ElementOverlay } from '../types';
import { WINGS } from '../../wings';
import { VIEWS, type View } from '../../../facing';

// Ailes emplumées poussant dans le dos (mutation) : RÉUTILISE l'art du registre wings (même
// silhouette que le trait Vol / le sort « Envol »), ancré sur l'os torse, DERRIÈRE le corps de
// face (layer -2) et par-dessus le dos de dos. Pas `dorsalOverlays` : un élément se range par
// `layer` DANS l'os torse, un calque dorsal par `plane` hors du corps, et passer au plan changerait
// le rendu.
const COUCHE_DES_AILES = {
  front: { layer: -2 },
  profile: {},
  back: { layer: 70 },
} as const satisfies Record<View, Pick<ElementOverlay, 'layer'>>;

export const element: AppearanceElement = {
  key: 'ailes', label: 'Ailes', category: 'mutation',
  overlays: VIEWS.map((view): ElementOverlay => ({ bone: 'torse', svg: WINGS.plumes[view], view, ...COUCHE_DES_AILES[view] })),
};
