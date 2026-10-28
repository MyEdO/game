/**
 * GARDE DES PISTES QUI DÉFONT LE GABARIT (#2972, G13) : une piste `.scale` dont une valeur s'écarte de 1 de plus de
 * `TOLERANCE_ECHELLE`, et toute piste `.position` sur un os autre que la racine et les os à position animée du manifeste
 * de base (`ManifesteDeBase.osAPositionAnimee`).
 */
import { PropertyBinding, type AnimationClip } from 'three';
import type { Ecart } from '../ecart.ts';

export const TOLERANCE_ECHELLE = 1e-4;

const GARDE = 'pistesDEchelle';

/** L'amplitude d'une piste vectorielle à 3 composantes : la plus grande distance d'une clé à la première. */
function amplitude(valeurs: ArrayLike<number>): number {
  let max = 0;
  for (let i = 3; i < valeurs.length; i += 3) max = Math.max(max, Math.hypot(valeurs[i] - valeurs[0], valeurs[i + 1] - valeurs[1], valeurs[i + 2] - valeurs[2]));
  return max;
}

/** Le plus grand écart à 1 d'une valeur de `valeurs`. */
function ecartALUnite(valeurs: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < valeurs.length; i++) max = Math.max(max, Math.abs(valeurs[i] - 1));
  return max;
}

export function gardePistesDEchelle(clips: readonly AnimationClip[], racine: string, osAPositionAnimee: readonly string[]): Ecart[] {
  const libres = new Set([racine, ...osAPositionAnimee]);
  return clips.flatMap((clip) => clip.tracks.flatMap((piste): Ecart[] => {
    const { nodeName, propertyName } = PropertyBinding.parseTrackName(piste.name);
    if (propertyName === 'scale') {
      const ecart = ecartALUnite(piste.values);
      return ecart > TOLERANCE_ECHELLE ? [{ garde: GARDE, code: 'echelle-animee', clip: clip.name, valeur: ecart, seuil: TOLERANCE_ECHELLE, detail: `${nodeName}.scale s’écarte de 1` }] : [];
    }
    if (propertyName === 'position' && !libres.has(nodeName)) {
      return [{ garde: GARDE, code: 'position-animee', clip: clip.name, valeur: amplitude(piste.values), seuil: 0, detail: `${nodeName}.position animée ; valeur : son amplitude en m` }];
    }
    return [];
  }));
}
