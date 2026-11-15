/**
 * GARDE DE CONTINUITÉ DU POIGNET (#3878) : d'un échantillon joué au suivant du même clip, la rotation de chaque os de
 * prise du manifeste du corps (`ManifesteDeBase.prises`) sur son parent, l'avant-bras, reste sous `VITESSE_DU_POIGNET`.
 * L'os est nommé comme `AnimationMixer` le trouve dans la scène (`chargement.ts`).
 */
import { Quaternion, type Object3D } from 'three';
import type { Ecart } from '../ecart.ts';
import { rotationLocale, type Echantillon } from '../echantillonnage.ts';
import seuils from './seuils.json';

const GARDE = 'poignets';

/** En degrés par seconde, la vitesse de rotation d'une main sur son avant-bras qu'aucun clip ne dépasse. Partagée avec
 *  la construction (`scripts/personnage-3d/seuils.py`) : `gardes/seuils.json`. */
export const VITESSE_DU_POIGNET: number = seuils.VITESSE_DU_POIGNET;

const DEGRES = 180 / Math.PI;

interface Pointe { readonly clip: string; readonly os: string; readonly t: number; readonly vitesse: number; readonly angle: number }

/** Le suivi des poignets `mains` (noms d'os) sur les échantillons : `echantillon` à chaque (clip, t) joué, dans l'ordre
 *  du jeu, `ecarts` à la fin, la pire pointe de vitesse par (clip, os). */
export function suivreLesPoignets(scene: Object3D, mains: readonly string[]) {
  const parents = new Map(mains.map((os) => {
    const noeud = scene.getObjectByName(os);
    if (!noeud) throw new Error(`${GARDE} : os ${os} absent de la scène`);
    return [os, noeud.parent?.name] as const;
  }));
  const precedentes = new Map(mains.map((os) => [os, new Quaternion()]));
  let precedent: { readonly clip: string; readonly t: number } | null = null;
  const pires = new Map<string, Pointe>();
  const lue = new Quaternion();
  const ecart = new Quaternion();
  return {
    echantillon(e: Echantillon): void {
      for (const os of mains) {
        const avant = precedentes.get(os) as Quaternion;
        rotationLocale(e, os, parents.get(os), lue);
        if (precedent?.clip === e.clip) {
          ecart.copy(avant).invert().multiply(lue);
          const angle = 2 * Math.atan2(Math.hypot(ecart.x, ecart.y, ecart.z), Math.abs(ecart.w)) * DEGRES;
          const vitesse = angle / (e.t - precedent.t);
          const cle = `${e.clip}\u0000${os}`;
          if (vitesse > VITESSE_DU_POIGNET && vitesse > (pires.get(cle)?.vitesse ?? 0)) pires.set(cle, { clip: e.clip, os, t: e.t, vitesse, angle });
        }
        avant.copy(lue);
      }
      precedent = { clip: e.clip, t: e.t };
    },
    ecarts(): Ecart[] {
      return [...pires.values()].map((p) => ({
        garde: GARDE, code: 'poignet-trop-rapide', clip: p.clip, t: p.t, valeur: p.vitesse, seuil: VITESSE_DU_POIGNET,
        detail: `${p.os} tourne de ${p.angle.toFixed(1)}° sur son parent depuis l'échantillon précédent, soit ${p.vitesse.toFixed(0)}°/s`,
      }));
    },
  };
}
