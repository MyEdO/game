/**
 * PIÈCES DE BANC — fixture PARTAGÉE des bancs d'arête. Un banc qui mesure une PORTE pose les pièces et
 * les murs d'une scène ; les accès offerts sont ceux que `aretesUtilisables` dérive de son contrôleur
 * (`portalsForParty`), jamais une liste recopiée à côté de la scène.
 */
import type { SceneEffectZone, WallSeg } from './scene';

/** Pièce intérieure (`isRoomZone`) rectangulaire, à l'étage `z`. */
export const piece = (id: string, x: number, y: number, w = 1, h = 1, z = 0): SceneEffectZone => ({
  id,
  label: id,
  presentation: 'interior',
  area: { kind: 'rect', x, y, w, h },
  ...(z ? { z } : {}),
});

/** Côté d'une case, dans le repère de la grille (`O` = ouest). */
export type Cote = 'N' | 'S' | 'E' | 'O';

/** Murs PLEINS sur les côtés nommés de la case (x, y) : ils ferment les accès que le banc ne mesure
 *  pas, dans la forme canonique d'arête (`N`/`E`, `edgeOf`). */
export const cloisons = (x: number, y: number, cotes: readonly Cote[]): WallSeg[] => cotes.map((cote): WallSeg => {
  switch (cote) {
    case 'N': return { x, y, side: 'N' };
    case 'S': return { x, y: y + 1, side: 'N' };
    case 'E': return { x, y, side: 'E' };
    case 'O': return { x: x - 1, y, side: 'E' };
  }
});
