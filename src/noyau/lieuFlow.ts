/**
 * LE LIEU OÙ SE TIENT LE GROUPE (#3534) : l'arrivée d'un trajet, qui pose le lieu et ouvre son écran sans entrer dans
 * sa scène ; « Explorer », la sortie de l'écran, qui entre dans la scène du lieu ; le geste qui rouvre l'écran ; et
 * l'entrée à un point d'intérêt du plan du lieu, qui mène à sa scène (#3611, `fenetreChoisir('ecranDuLieu', 'entrer', …)`).
 */
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import { lieuDuGroupe, placeServices, refusDAcces, type MapPlace, type PlacePoi, type ResolvedPlaceService, type ServiceDHebergement } from './worldMap';
import { sceneDuRegistre } from './monde/registreDesScenes';
import { condCtx } from './bourseFlow';
import { refuserGeste } from './refusVisible';
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

/** Les services du lieu où se tient le groupe (`placeServices`, à l'offre de repos de la scène du lieu) ; aucun hors de
 *  tout lieu. */
export function servicesDuLieu(s: Pick<Jeu, 'lieu' | 'worldMap'>): ResolvedPlaceService[] {
  const ici = lieuDuGroupe(s);
  return ici ? placeServices(ici, sceneDuRegistre(ici.scene.id)) : [];
}

/** La raison de la fermeture du service `svc` du lieu (son accès réservé, `refusDAcces`), ou `null` : il est ouvert. */
export function refusDuService(s: Jeu, svc: ResolvedPlaceService): string | null {
  return svc.acces ? refusDAcces(svc.acces, condCtx(() => s)) : null;
}

/** La raison de la fermeture du service `id` du lieu (`refusDuService`), ou `null`. Un id qu'aucun service du lieu ne
 *  porte est laissé au geste, qui le refuse à sa façon. PUR. */
export function refusDuServiceFerme(s: Jeu, id: string | undefined): string | null {
  const svc = servicesDuLieu(s).find((x) => x.id === id);
  return svc ? refusDuService(s, svc) : null;
}

/** Refuse le geste qui ouvre le service `id` du lieu tant que son accès réservé le ferme (`refusDuServiceFerme`) ;
 *  `true` : le refus est prononcé. */
export function refuserLeServiceFerme(get: Get, set: Set, id: string | undefined): boolean {
  const refus = refusDuServiceFerme(get(), id);
  return refus !== null && refuserGeste(get, set, refus);
}

/** Un service à échoppe : il porte l'archétype de son marchand (`merchantArchetype`). */
export type Echoppe = ResolvedPlaceService & { merchantArchetype: string };

/** Les échoppes du lieu où se tient le groupe : ce qu'ouvre `ouvrirLaBoutique`. */
export function echoppesDuLieu(s: Pick<Jeu, 'lieu' | 'worldMap'>): Echoppe[] {
  return servicesDuLieu(s).filter((svc): svc is Echoppe => svc.merchantArchetype !== undefined);
}

/** Les établissements d'hébergement du lieu où se tient le groupe : où `ouvrirLeRepos` et `recueillirLesRumeurs` se
 *  jouent. */
export function hebergementsDuLieu(s: Pick<Jeu, 'lieu' | 'worldMap'>): ServiceDHebergement[] {
  return servicesDuLieu(s).filter((svc): svc is ServiceDHebergement => svc.category === 'auberge');
}

/** Un point d'intérêt du plan du lieu qui mène à une scène. */
export type EntreeDuLieu = Extract<PlacePoi, { sceneId: { id: string } }>;

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
