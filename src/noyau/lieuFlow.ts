/**
 * LE LIEU OÙ SE TIENT LE GROUPE (#3534) : l'arrivée d'un trajet, qui pose le lieu et ouvre son écran sans entrer dans
 * sa scène ; « Explorer », la sortie de l'écran, qui entre dans la scène du lieu ; le geste qui rouvre l'écran ; et
 * l'entrée à un point d'intérêt du plan du lieu, qui mène à sa scène (#3611, `fenetreChoisir('ecranDuLieu', 'entrer', …)`).
 */
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import { lieuDuGroupe, type MapPlace, type PlacePoi } from './worldMap';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { fenetreDuJeu } from './combatAuto';
import type { CorpsDesChoix } from './choixDesFenetres';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';

/** Le groupe arrive au lieu `to` au bout d'un trajet : il s'y tient, son écran tient la main. */
export function arriverAuLieu(set: Set, to: MapPlace): void {
  set({ lieu: to.id, lieuOuvert: true });
}

/** Le groupe quitte son lieu pour la route. */
export const quitterLeLieu = { lieu: null, lieuOuvert: false } as const;

/** Un point d'intérêt du plan du lieu qui mène à une scène. */
export type EntreeDuLieu = PlacePoi & { sceneId: { id: string } };

/** Les points d'intérêt du plan du lieu où se tient le groupe qui mènent à une scène (`PlacePoi.sceneId`). */
export function entreesDuLieu(s: Pick<Jeu, 'lieu' | 'worldMap'>): EntreeDuLieu[] {
  return (lieuDuGroupe(s)?.poi ?? []).filter((p): p is EntreeDuLieu => !!p.sceneId);
}

/** Refus d'entrer au point d'intérêt `poi` du lieu : la raison, ou `null`. Hors de l'écran du lieu, ou vers une scène
 *  absente du registre. */
export function refusDEntrerAuPoint(s: Jeu, poi: EntreeDuLieu): string | null {
  if (fenetreDuJeu(s)?.cle !== 'ecranDuLieu') return t('lieu.horsDeLEcran');
  if (!sceneDuRegistre(poi.sceneId.id)) return t('lieu.pointSansScene', { poi: poi.label });
  return null;
}

/** Rouvre l'écran du lieu où se tient le groupe, hors trajet. */
export function creerActionsDuLieu(get: Get, set: Set) {
  return {
    ouvrirLeLieu: () => { if (lieuDuGroupe(get()) && !get().travelPlan) set({ lieuOuvert: true }); },
  } satisfies Partial<ActionsDuNoyau>;
}

/** Entre au point d'intérêt du lieu : l'écran se ferme sur la scène où il mène. */
export function choixDuLieu(get: Get, set: Set) {
  return {
    ecranDuLieu: {
      entrer: (poi) => {
        const p = garanti(entreesDuLieu(get()).find((x) => x.id === poi), poi, 'entrée du lieu');
        set({ lieuOuvert: false });
        get().quitterLaScene(p.sceneId.id);
      },
    },
  } satisfies Partial<CorpsDesChoix>;
}

/** « Explorer » : l'écran se ferme sur la scène du lieu, où le groupe entre s'il n'y est pas. */
export function sortiesDuLieu(get: Get, set: Set) {
  return {
    ecranDuLieu: () => {
      const ici = lieuDuGroupe(get());
      set({ lieuOuvert: false });
      if (ici && get().scene?.id !== ici.scene.id) get().quitterLaScene(ici.scene.id, ici.entry);
    },
  } satisfies Partial<SortiesDeFenetre>;
}
