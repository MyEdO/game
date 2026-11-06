/**
 * L'HISTORIQUE D'ÉDITION d'une scène (#3508) : annuler et rétablir, chaque cran un instantané de la scène, au plus
 * `CRANS_MAX`. PUR et immuable, sans hôte : l'éditeur web et l'éditeur Godot le tiennent tous deux. Un geste glissé
 * ouvre un seul cran à son premier pas et prolonge la scène sans cran aux suivants (`poser`).
 */
import type { Scene } from '../monde/scene';

/** Les crans au-delà desquels le plus ancien s'oublie. */
export const CRANS_MAX = 200;

export interface Historique {
  passe: readonly Scene[];
  present: Scene;
  futur: readonly Scene[];
}

/** Un historique neuf sur `scene`, sans cran. */
export function historiqueDe(scene: Scene): Historique {
  return { passe: [], present: scene, futur: [] };
}

/** La scène `scene` posée : sur un cran neuf (`cran`), qui efface le futur, ou à la place du présent. */
export function poser(h: Historique, scene: Scene, cran: boolean): Historique {
  if (!cran) return { ...h, present: scene };
  return { passe: [...h.passe, h.present].slice(-CRANS_MAX), present: scene, futur: [] };
}

/** Le cran précédent ; l'historique tel quel sans lui. */
export function annuler(h: Historique): Historique {
  if (!h.passe.length) return h;
  return { passe: h.passe.slice(0, -1), present: h.passe[h.passe.length - 1], futur: [...h.futur, h.present] };
}

/** Le cran suivant ; l'historique tel quel sans lui. */
export function retablir(h: Historique): Historique {
  if (!h.futur.length) return h;
  return { passe: [...h.passe, h.present], present: h.futur[h.futur.length - 1], futur: h.futur.slice(0, -1) };
}

/** Chaque cran passé et futur réécrit par `f`, le présent intact : un renommage propagé reste vrai dans chaque état
 *  qu'annuler ou rétablir ramène. */
export function reecrire(h: Historique, f: (s: Scene) => Scene): Historique {
  return { passe: h.passe.map(f), present: h.present, futur: h.futur.map(f) };
}
