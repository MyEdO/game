/**
 * BILLET d'un passage payant (#2534) — EDO 01 l.142 ; billet implicite : LDB 51 l.178.
 *
 * Un passage se paie par BILLET : celui d'auteur, posé sur la première route d'un trajet
 * (`MapRoute.billets`), sinon le billet implicite de la route au km (`billetImplicite`). Il se paie
 * d'avance, une fois, par `payFromGroup` ; un billet d'auteur couvre ensuite les routes de sa `suite`
 * (`billetEnMain`), qu'aucun départ ne redébite. Son Marchandage est UN Test opposé par billet, contre
 * le vendeur du billet (`vendeurDuBillet`, ouvert par `merchantFlow.startBargain`, contrepartie `billet`).
 *
 * `devisDuPassage` est la SOURCE UNIQUE du prix : l'écran de départ (`WorldMapView`) l'affiche, le flux
 * (`travelFlow.startTravel`, via `payerLePassage`) le débite.
 */
import type { Get, Set } from './flowTypes';
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import type { Money } from '../engine/money';
import { formatMoney, fromBrass } from '../engine/money';
import {
  type TravelMode, type TarifDeBillet, type IssueDeMarchandage,
  billetImplicite, classesDuBillet, prixDuBillet, parcoursDuBillet, travelModeLabels, vehicleTravel,
} from '../engine/travel';
import { skillBaseValue } from '../engine/skills';
import { SL_ASTOUNDING } from '../engine/tests';
import { paliersDeGain, prixGagnesEnClair, type OuvertureDeMarchandage, type PrixDuMarchandage, type TermesDeMarchandage } from './pendings';
import { otherEnd, placeById, placeOfScene, routesFrom, type MapRoute, type WorldMap } from './worldMap';
import { condCtx, payFromGroup } from './bourseFlow';
import { pnjDePreset } from './sceneNpc';
import { flowStakeRef, libelleOuAbsence } from '../data';
import { t } from '../i18n';

/** Billet d'auteur PAYÉ : il couvre encore `routesRestantes`, dans l'ordre, en `mode`. */
export interface BilletEnMain {
  routeId: string;
  mode: TravelMode;
  classeId: string;
  routesRestantes: string[];
}

/** Clé d'un billet d'auteur : sa route porteuse et son mode, clé de `MapRoute.billets` (`marchandagesDeBillet`). */
export function cleDeBillet(routeId: string, mode: TravelMode): string {
  return `${routeId}:${mode}`;
}

/** Les passagers d'un passage : le groupe vivant et présent (LDB 51 l.178 « par passager »). */
export function passagers(party: Combatant[]): number {
  return party.filter((h) => !h.dead && !h.outOfRencontre).length;
}

/** Lieu d'arrivée et distance du trajet couvert par le billet d'auteur `routeId`/`mode`. */
export function trajetDuBillet(map: WorldMap, routeId: string, mode: TravelMode): { arrivee: string; km: number; routes: string[] } | undefined {
  const route = map.routes.find((r) => r.id === routeId);
  const billet = route?.billets?.[mode];
  if (!route || !billet) return undefined;
  const p = parcoursDuBillet(map.routes, route, route.from ?? billet.depuis, billet.suite ?? [], mode);
  return p.ok ? { arrivee: p.arrivee, km: p.km, routes: p.routes.map((r) => r.id) } : undefined;
}

/** Les routes couvertes par le billet d'une AUTRE route : route couverte → route porteuse (éditeur). */
export function routesCouvertes(map: WorldMap): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of map.routes) {
    for (const [mode, billet] of Object.entries(r.billets ?? {})) {
      if (billet) for (const id of trajetDuBillet(map, r.id, mode as TravelMode)?.routes.slice(1) ?? []) out.set(id, r.id);
    }
  }
  return out;
}

/** Le mode du billet en main quand il couvre `routeId` (sa prochaine route) : le mode présélectionné du
 *  départ. `undefined` : aucun billet en main ne couvre cette route. */
export function modeDuBilletEnMain(enMain: BilletEnMain | null, routeId: string | null | undefined): TravelMode | undefined {
  return enMain && routeId && enMain.routesRestantes[0] === routeId ? enMain.mode : undefined;
}

/** Le passage d'une route au départ de `departId` en `mode` : COUVERT par le billet en main, ou PAYANT
 *  par le billet d'auteur qui part d'ici, sinon par le billet implicite. `null` : mode sans passage. */
export type PassageAuDepart =
  | { couvert: true; arrivee: string; /** Libellé de la classe PAYÉE. */ classe: string }
  | {
      couvert: false;
      tarif: TarifDeBillet;
      arrivee: string;
      km: number;
      /** Billet d'auteur : sa clé, son vendeur, les routes qu'il couvre après celle-ci. */
      auteur?: { cle: string; presetId?: string; suite: string[] };
      issue?: IssueDeMarchandage;
    };

type EtatDuPassage = Pick<GameState, 'worldMap' | 'billetEnMain' | 'marchandagesDeBillet'>;

export function passageAuDepart(s: EtatDuPassage, route: MapRoute, departId: string, mode: TravelMode): PassageAuDepart | null {
  const map = s.worldMap;
  if (!map) return null;
  const enMain = s.billetEnMain;
  if (enMain && modeDuBilletEnMain(enMain, route.id) === mode) {
    const trajet = trajetDuBillet(map, enMain.routeId, enMain.mode);
    const classe = vehicleTravel(mode)?.classes.find((c) => c.id === enMain.classeId)?.label ?? enMain.classeId;
    if (trajet) return { couvert: true, arrivee: trajet.arrivee, classe };
  }
  const billet = route.billets?.[mode];
  if (billet && (route.from ?? billet.depuis) === departId) {
    const p = parcoursDuBillet(map.routes, route, departId, billet.suite ?? [], mode);
    if (p.ok) {
      const cle = cleDeBillet(route.id, mode);
      return {
        couvert: false, tarif: billet, arrivee: p.arrivee, km: p.km,
        auteur: { cle, presetId: billet.presetId, suite: billet.suite ?? [] },
        issue: s.marchandagesDeBillet[cle],
      };
    }
  }
  const implicite = billetImplicite(route.km, mode);
  return implicite ? { couvert: false, tarif: implicite, arrivee: otherEnd(route, departId), km: route.km } : null;
}

/** DEVIS d'un passage — source unique du prix (écran et débit) : classes offertes à leur prix par
 *  place, classe retenue (la demandée, sinon la MOINS CHÈRE) et total pour `nbPassagers`. */
export interface DevisDuPassage {
  passage: PassageAuDepart;
  classes: { id: string; label: string; prix: number }[];
  classeId?: string;
  total?: Money;
}

export function devisDuPassage(
  s: EtatDuPassage, route: MapRoute, departId: string, mode: TravelMode, classeId: string | undefined, nbPassagers: number,
): DevisDuPassage | null {
  const passage = passageAuDepart(s, route, departId, mode);
  if (!passage) return null;
  if (passage.couvert) return { passage, classes: [] };
  const classes = classesDuBillet(passage.tarif, mode, passage.issue);
  const classe = classes.find((c) => c.id === classeId)
    ?? classes.reduce<(typeof classes)[number] | undefined>((min, c) => (!min || c.prix < min.prix ? c : min), undefined);
  if (!classe) return { passage, classes };
  const total = prixDuBillet(passage.tarif, classe.id, nbPassagers, passage.issue) ?? undefined;
  return { passage, classes, classeId: classe.id, total };
}

/** Paie (ou consomme) le passage d'un départ et tient `billetEnMain` : consommé sur une route couverte,
 *  posé au paiement d'un billet d'auteur à suite, effacé sinon (billet implicite ou autre trajet).
 *  Rend la ligne de journal, et `false` si la bourse refuse. */
export function payerLePassage(
  get: Get, set: Set, route: MapRoute, departId: string, mode: TravelMode, classeId: string | undefined,
): { ok: boolean; ligne?: string } {
  const s = get();
  const label = travelModeLabels()[mode]?.toLowerCase() ?? mode;
  const devis = devisDuPassage(s, route, departId, mode, classeId, passagers(s.party));
  if (!devis) return { ok: false };
  if (devis.passage.couvert) {
    const reste = s.billetEnMain!.routesRestantes.slice(1);
    set({ billetEnMain: reste.length ? { ...s.billetEnMain!, routesRestantes: reste } : null });
    const to = libelleOuAbsence(s.worldMap ? placeById(s.worldMap, devis.passage.arrivee) : undefined, 'lieu', devis.passage.arrivee);
    return { ok: true, ligne: t('tf.passageCovered', { mode: label, to }) };
  }
  if (!devis.total || !devis.classeId) return { ok: false };
  if (!payFromGroup(get, set, devis.total, { purpose: 'passage' })) {
    return { ok: false, ligne: t('tf.passageTooDear', { mode: label, cost: formatMoney(devis.total) }) };
  }
  const suite = devis.passage.auteur?.suite ?? [];
  set({ billetEnMain: suite.length ? { routeId: route.id, mode, classeId: devis.classeId, routesRestantes: [...suite] } : null });
  return { ok: true, ligne: t('tf.passagePaid', { cost: formatMoney(devis.total), mode: label }) };
}

/** TERMES du Marchandage d'un billet (EDO 01 l.142) : prix de la place par classe, demandé puis
 *  obtenu à chaque palier de DR (sans paliers : aux seuils du rabais, `bargainBuyFactor`). Le vendeur
 *  ne se méfie pas : un Test perdu laisse le prix demandé. */
export function termesDuBillet(tarif: TarifDeBillet, mode: TravelMode, negotiator: boolean): TermesDeMarchandage {
  const place = (issue?: IssueDeMarchandage) => t('out.bargainPrixPlace', {
    prix: classesDuBillet(tarif, mode, issue)
      .map((c) => t('out.bargainStakeClasse', { classe: c.label, prix: formatMoney(fromBrass(c.prix)) })).join(', '),
  });
  const seuils = tarif.paliers?.length ? tarif.paliers.map((p) => p.drMin) : [SL_ASTOUNDING];
  const prix: PrixDuMarchandage = {
    gagne: paliersDeGain(seuils, (drNet) => place({ won: true, drNet, negotiator })),
    perdu: t('out.bargainPrixDemande', { prix: place() }),
    mefiance: false,
  };
  return { enjeu: flowStakeRef('bargain-billet', { values: { actuel: place(), gagne: prixGagnesEnClair(prix) } }), prix };
}

/** Ouverture du Marchandage du billet d'auteur `routeId`/`mode` au départ du lieu courant (EDO 01
 *  l.142) : le vendeur tiré de son preset (`pnjDePreset`), sa valeur de Marchandage NUE
 *  (`skillBaseValue`), et l'enjeu. `null` : billet sans vendeur, couvert, hors d'ici, ou déjà
 *  marchandé (UN Test par billet). */
export function ouvertureDuBillet(get: Get, routeId: string, mode: TravelMode): OuvertureDeMarchandage | null {
  const s = get();
  const here = placeOfScene(s.worldMap, s.scene?.id);
  const route = here && s.worldMap && routesFrom(s.worldMap, here.id, condCtx(get)).find((r) => r.id === routeId);
  if (!here || !route) return null;
  const passage = passageAuDepart(s, route, here.id, mode);
  if (!passage || passage.couvert || !passage.auteur?.presetId || passage.issue) return null;
  const vendeur = pnjDePreset(passage.auteur.presetId);
  if (!vendeur) return null;
  return {
    opposant: { label: vendeur.label, valeur: skillBaseValue(vendeur, 'marchandage'), portrait: vendeur },
    termes: (negotiator) => termesDuBillet(passage.tarif, mode, negotiator),
  };
}
