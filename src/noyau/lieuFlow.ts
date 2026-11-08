/**
 * LE LIEU OÙ SE TIENT LE GROUPE (#3534) : l'arrivée d'un trajet, qui pose le lieu et ouvre son écran sans entrer dans
 * sa scène ; « Explorer », la sortie de l'écran, qui entre dans la scène du lieu ; le geste qui rouvre l'écran ; et
 * l'entrée à un point d'intérêt du plan du lieu, qui mène à sa scène (#3611).
 */
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import { lieuDuGroupe, type MapPlace, type PlacePoi } from './worldMap';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { fenetreDuJeu } from './combatAuto';
import { refuserGeste } from './refusVisible';
import { t } from '../i18n';

/** Le groupe arrive au lieu `to` au bout d'un trajet : il s'y tient, son écran tient la main. */
export function arriverAuLieu(set: Set, to: MapPlace): void {
  set({ lieu: to.id, lieuOuvert: true });
}

/** Le groupe quitte son lieu pour la route. */
export const quitterLeLieu = { lieu: null, lieuOuvert: false } as const;

/** Les points d'intérêt du plan du lieu où se tient le groupe qui mènent à une scène (`PlacePoi.sceneId`). */
export function entreesDuLieu(s: Pick<Jeu, 'lieu' | 'worldMap'>): (PlacePoi & { sceneId: string })[] {
  return (lieuDuGroupe(s)?.poi ?? []).filter((p): p is PlacePoi & { sceneId: string } => !!p.sceneId);
}

/** Refus d'entrer au point d'intérêt `poi` : la raison, ou `null`. Hors de l'écran du lieu, hors des entrées du
 *  lieu (`entreesDuLieu`), ou vers une scène absente du registre. */
export function refusDEntrerAuPoint(s: Jeu, poi: string): string | null {
  if (fenetreDuJeu(s)?.cle !== 'ecranDuLieu') return t('lieu.horsDeLEcran');
  const p = entreesDuLieu(s).find((x) => x.id === poi);
  if (!p) return t('lieu.pointInconnu', { poi });
  if (!sceneDuRegistre(p.sceneId)) return t('lieu.pointSansScene', { poi: p.label });
  return null;
}

/** Rouvre l'écran du lieu où se tient le groupe, hors trajet ; entre au point d'intérêt `poi` du lieu : l'écran se
 *  ferme sur la scène où il mène. */
export function creerActionsDuLieu(get: Get, set: Set) {
  return {
    ouvrirLeLieu: () => { if (lieuDuGroupe(get()) && !get().travelPlan) set({ lieuOuvert: true }); },
    entrerAuPointDInteret: (poi) => {
      const refus = refusDEntrerAuPoint(get(), poi);
      if (refus) { refuserGeste(get, set, refus); return; }
      const p = entreesDuLieu(get()).find((x) => x.id === poi)!;
      set({ lieuOuvert: false });
      get().quitterLaScene(p.sceneId);
    },
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
