/**
 * L'HISTORIQUE D'ÉDITION d'un document (#3508) : annuler et rétablir, chaque cran un instantané du document `D`, au plus
 * `CRANS_MAX`. PUR et immuable, sans hôte : l'éditeur web y tient sa scène, l'éditeur Godot son projet (#3606). Un
 * geste glissé ouvre un seul cran à son premier pas et prolonge le document sans cran aux suivants (`poser`).
 */

/** Les crans au-delà desquels le plus ancien s'oublie. */
export const CRANS_MAX = 200;

export interface Historique<D> {
  passe: readonly D[];
  present: D;
  futur: readonly D[];
}

/** Un historique neuf sur `doc`, sans cran. */
export function historiqueDe<D>(doc: D): Historique<D> {
  return { passe: [], present: doc, futur: [] };
}

/** Le document `doc` posé : sur un cran neuf (`cran`), qui efface le futur, ou à la place du présent. */
export function poser<D>(h: Historique<D>, doc: D, cran: boolean): Historique<D> {
  if (!cran) return { ...h, present: doc };
  return { passe: [...h.passe, h.present].slice(-CRANS_MAX), present: doc, futur: [] };
}

/** Le cran précédent ; l'historique tel quel sans lui. */
export function annuler<D>(h: Historique<D>): Historique<D> {
  if (!h.passe.length) return h;
  return { passe: h.passe.slice(0, -1), present: h.passe[h.passe.length - 1], futur: [...h.futur, h.present] };
}

/** Le cran suivant ; l'historique tel quel sans lui. */
export function retablir<D>(h: Historique<D>): Historique<D> {
  if (!h.futur.length) return h;
  return { passe: [...h.passe, h.present], present: h.futur[h.futur.length - 1], futur: h.futur.slice(0, -1) };
}

/** Chaque cran passé et futur réécrit par `f`, le présent intact : un renommage propagé reste vrai dans chaque état
 *  qu'annuler ou rétablir ramène. */
export function reecrire<D>(h: Historique<D>, f: (d: D) => D): Historique<D> {
  return { passe: h.passe.map(f), present: h.present, futur: h.futur.map(f) };
}
