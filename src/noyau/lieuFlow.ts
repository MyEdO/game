/**
 * LE LIEU OÙ SE TIENT LE GROUPE (#3534) : l'arrivée d'un trajet, qui pose le lieu et ouvre son écran sans entrer dans
 * sa scène ; « Explorer », la sortie de l'écran, qui entre dans la scène du lieu ; et le geste qui rouvre l'écran.
 */
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import { lieuDuGroupe, type MapPlace } from './worldMap';

/** Le groupe arrive au lieu `to` au bout d'un trajet : il s'y tient, son écran tient la main. */
export function arriverAuLieu(set: Set, to: MapPlace): void {
  set({ lieu: to.id, lieuOuvert: true });
}

/** Le groupe quitte son lieu pour la route. */
export const quitterLeLieu = { lieu: null, lieuOuvert: false } as const;

/** Rouvre l'écran du lieu où se tient le groupe, hors trajet. */
export function creerActionsDuLieu(get: Get, set: Set) {
  return {
    ouvrirLeLieu: () => { if (lieuDuGroupe(get()) && !get().travelPlan) set({ lieuOuvert: true }); },
  } satisfies Partial<ActionsDuNoyau>;
}

/** « Explorer » : l'écran se ferme sur la scène du lieu, où le groupe entre s'il n'y est pas. */
export function sortiesDuLieu(get: Get, set: Set) {
  return {
    ecranDuLieu: () => {
      const ici = lieuDuGroupe(get());
      set({ lieuOuvert: false });
      if (ici && get().scene?.id !== ici.scene) get().quitterLaScene(ici.scene, ici.entry);
    },
  } satisfies Partial<SortiesDeFenetre>;
}
