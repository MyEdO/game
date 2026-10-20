/**
 * LE BILLET d'un passage payant — EDO 01 l.142 (billet d'auteur : forfait par place, payé une fois,
 * d'avance, marchandable) et LDB 51 l.178 (billet IMPLICITE d'une route sans billet d'auteur : classe × km).
 *
 * UNE offre par départ (`offreDePassage`), lue par l'écran de départ (`WorldMapView`) ET par le débit
 * (`travelFlow.startTravel`) : l'estimation et le paiement appellent la même fonction de prix
 * (`engine/travel.transportCost`). Le billet payé vit dans `billetEnMain` jusqu'à son dernier tronçon ;
 * l'issue de son Marchandage dans `marchandagesDeBillet` (un Test par billet).
 */
import type { Get, Set } from './flowTypes';
import { cleDeBillet, otherEnd, placeOfScene, type MapRoute, type RouteBillet, type WorldMap } from './worldMap';
import { billetImplicite, type TarifDePassage, type TravelMode } from '../engine/travel';
import type { BargainOutcome } from '../engine/bargain';
import { t } from '../i18n';
import { skillBaseValue } from '../engine/skills';
import { pnjAuPreset } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { ouvrirMarchandage } from './merchantFlow';

/** Le billet payé que le groupe tient en main : ses routes restantes, dans l'ordre du trajet. */
export interface BilletEnMain {
  routeId: string;
  vehicule: string;
  classeId: string;
  routesRestantes: string[];
}

/** Le passage offert au départ d'une route : déjà COUVERT par le billet en main, ou à ACHETER. */
export type OffreDePassage =
  | { couvert: true; arriveeId: string; /** Classe payée. */ classeId: string }
  | {
      couvert: false;
      tarif: TarifDePassage;
      /** Lieu d'arrivée de la dernière route couverte, et la distance cumulée. */
      arriveeId: string;
      km: number;
      /** Routes couvertes APRÈS celle du départ. */
      suite: string[];
      /** Lieu de départ du billet. */
      depuis: string;
      cle: string;
      /** PNJ vendeur d'un billet marchandable. */
      vendeurPresetId?: string;
      /** Issue du Marchandage d'un billet d'AUTEUR (EDO 01 l.142). */
      issue?: BargainOutcome;
    };

/** Le billet d'auteur de `route` en `vehicule`, s'il part de `departId`. */
export function billetDAuteur(route: MapRoute, vehicule: string, departId: string): RouteBillet | undefined {
  const b = route.billets?.[vehicule];
  return b && (route.from ?? b.depuis) === departId ? b : undefined;
}

/** Lieu d'arrivée et distance du parcours de `routeIds` depuis `departId`. */
function parcours(map: WorldMap, departId: string, routeIds: readonly string[]): { arriveeId: string; km: number } {
  let ici = departId;
  let km = 0;
  for (const id of routeIds) {
    const r = map.routes.find((x) => x.id === id);
    if (!r) break;
    km += r.km;
    ici = otherEnd(r, ici);
  }
  return { arriveeId: ici, km };
}

/** Le billet en main couvre-t-il ce départ ? */
function couvre(billet: BilletEnMain | null, routeId: string, mode: TravelMode): boolean {
  return !!billet && billet.vehicule === mode && billet.routesRestantes[0] === routeId;
}

/** Le billet en main APRÈS un départ sur `routeId` en `mode` : consommé d'un tronçon s'il le couvre
 *  (effacé au dernier), abandonné sinon. */
export function billetApresDepart(billet: BilletEnMain | null, routeId: string, mode: TravelMode): BilletEnMain | null {
  if (!billet || !couvre(billet, routeId, mode)) return null;
  const routesRestantes = billet.routesRestantes.slice(1);
  return routesRestantes.length ? { ...billet, routesRestantes } : null;
}

/** L'offre de passage payant au départ de `route` depuis `departId` en `mode` ; `null` si `mode` n'est
 *  pas un passage payant. */
export function offreDePassage(
  map: WorldMap,
  route: MapRoute,
  mode: TravelMode,
  departId: string,
  billet: BilletEnMain | null,
  marchandages: Readonly<Record<string, BargainOutcome>>,
): OffreDePassage | null {
  if (couvre(billet, route.id, mode)) return { couvert: true, arriveeId: parcours(map, departId, billet!.routesRestantes).arriveeId, classeId: billet!.classeId };
  const auteur = billetDAuteur(route, mode, departId);
  const tarif: TarifDePassage | null = auteur ? { prix: auteur.prix, paliers: auteur.marchandage?.paliers } : billetImplicite(route.km, mode);
  if (!tarif) return null;
  const suite = [...(auteur?.suite ?? [])]; // copie : le billet en main ne partage rien avec la carte (#2097)
  const cle = cleDeBillet(route.id, mode, departId);
  return {
    couvert: false,
    tarif,
    ...parcours(map, departId, [route.id, ...suite]),
    suite,
    depuis: departId,
    cle,
    ...(auteur?.marchandage ? { vendeurPresetId: auteur.marchandage.presetId } : {}),
    ...(auteur && marchandages[cle] ? { issue: marchandages[cle] } : {}),
  };
}

/** L'offre de passage du lieu courant, sur `routeId` en `vehicule`, lue dans l'état. */
function offreIci(get: Get, routeId: string, vehicule: string): OffreDePassage | null {
  const { worldMap, scene, billetEnMain, marchandagesDeBillet } = get();
  const ici = placeOfScene(worldMap, scene?.id);
  const route = worldMap?.routes.find((r) => r.id === routeId);
  return worldMap && ici && route ? offreDePassage(worldMap, route, vehicule, ici.id, billetEnMain, marchandagesDeBillet) : null;
}

/** « Marchander » le billet (EDO 01 l.142) : Test opposé contre le vendeur du preset, UN par billet. */
export function startBilletBargain(get: Get, set: Set, routeId: string, vehicule: string): void {
  if (get().battle || get().pendingBargain) return;
  const offre = offreIci(get, routeId, vehicule);
  if (!offre || offre.couvert || !offre.vendeurPresetId || offre.issue) return;
  const vendeur = pnjAuPreset(offre.vendeurPresetId, `vendeur-${offre.cle}`, presetDuNarratif(get().campaignNarratif));
  if (!vendeur) return;
  ouvrirMarchandage(get, set, { kind: 'billet', routeId, vehicule, depuis: offre.depuis, titre: t('out.bargainTitreBillet') }, { label: vendeur.label, valeur: skillBaseValue(vendeur, 'marchandage'), portrait: vendeur });
}
