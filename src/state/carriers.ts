/**
 * COUTURE D'ÉTAT du PORTEUR DE CHARGE (#327) — expose les porteurs RÉELS du groupe comme des
 * `CargoCarrier` (tronc PUR `engine/cargo.ts`). Ce module RÉSOUT la capacité depuis les objets réels
 * (héros → `maxEncumbrance` ; bête de bât → `MountProfile.encPortee` ; véhicule terrestre →
 * `VehicleData.chargement` ; navire de campagne → `ship.capacity`) que le tronc, pur, ne connaît pas.
 *
 * SOURCE UNIQUE PAR PORTEUR (verrou 1 de la conception) : le carrier LIT le stock réel, il ne le double
 * pas — la cale du navire reste `CampaignVessel.cargo`, la cargaison en bât/véhicule reste
 * `ItemInstance.cargo`. Aucun 2ᵉ silo (le convoi abstrait `caravanCargo` a été matérialisé, lot C). Les
 * mutations passent par le tronc (`loadCargo`/`unloadCargo`/`transferCargo`) puis sont RE-PERSISTÉES sur
 * ces mêmes champs par `persistCarriersCargo` (patron `shipDamage.ts`).
 */
import type { Combatant } from '../engine/types';
import type { Possession } from '../engine/possession';
import { possessionLabel } from '../engine/possession';
import { maxEncumbrance, totalEncumbrance } from '../engine/items';
import { mountProfileForCreature } from '../engine/mountTravel';
import { findVehicleById, libelleOuAbsence } from '../data';
import { placeOfScene } from './worldMap';
import { type CargoCarrier, type CargoLot, cargoTotalEnc, carrierFreeEnc, spoilCargoByPct, cargoRaidLossPct, type CargoRaidOutcome } from '../engine/cargo';
import { rule } from '../engine/policy';
import type { GameState } from './store';

/** Tranche d'état lue pour dresser les porteurs — évite de dépendre du store entier (testable à plat). */
export type CarrierStateSlice = Pick<GameState, 'party' | 'vessel' | 'worldMap' | 'scene' | 'possessions'>;

/** id STABLE du porteur « navire de campagne » (un seul en jeu). */
export const CAMPAIGN_VESSEL_CARRIER_ID = 'vessel';

/** Lieu courant du groupe (co-localisation par défaut de tous ses porteurs à terre). */
function currentPlaceId(s: CarrierStateSlice): string | undefined {
  return placeOfScene(s.worldMap, s.scene?.id ?? undefined)?.id;
}

const heroInParty = (h: Combatant): boolean => !h.dead && !h.outOfRencontre;

/** Capacité de bât d'une Possession terrestre (véhicule `chargement` EDOC, ou bête `encPortee`) —
 *  undefined si elle n'est pas un porteur. */
function possessionCarrierCapacity(p: Possession): number | undefined {
  if (p.destroyed) return undefined;
  if (p.nature === 'vehicule') return findVehicleById(p.vehicleId)?.chargement;
  if (p.nature === 'bete') return 'creatureId' in p.ref ? mountProfileForCreature(p.ref.creatureId)?.encPortee : undefined;
  return undefined;
}

/** Construit le porteur `CargoCarrier` d'une Possession de bât/véhicule (capacité déjà résolue). */
function possessionCarrier(p: Possession, capacity: number, placeId: string | undefined): CargoCarrier {
  return {
    id: p.uid, label: possessionLabel(p), hull: 'jambes', capacity, discreteEnc: 0, cargo: p.cargo ?? [], placeId,
    aboard: p.location.kind === 'embarquee' ? p.location.hostUid : undefined,
  };
}

/** Possessions terrestres AVEC-LE-GROUPE d'un propriétaire du groupe, filtrées par nature. */
function partyLandPossessions(s: CarrierStateSlice): Possession[] {
  const ownerIds = new Set(s.party.filter(heroInParty).map((h) => h.id));
  return s.possessions.filter((p) => !p.destroyed && ownerIds.has(p.ownerId) && p.location.kind === 'avec-le-groupe');
}

/** Porteurs de bât/chargement possédés par le groupe, SÉPARÉS véhicules/bêtes (pour la priorité d'achat). */
function landCarriers(s: CarrierStateSlice, placeId: string | undefined): { vehicles: CargoCarrier[]; beasts: CargoCarrier[] } {
  const vehicles: CargoCarrier[] = [];
  const beasts: CargoCarrier[] = [];
  for (const p of partyLandPossessions(s)) {
    const cap = possessionCarrierCapacity(p);
    if (cap == null) continue;
    (p.nature === 'vehicule' ? vehicles : beasts).push(possessionCarrier(p, cap, placeId));
  }
  return { vehicles, beasts };
}

/** Le nom du navire de campagne : celui de l'instance (#230), sinon celui de sa fiche de véhicule — SOURCE UNIQUE (#1906). */
export function nomDuNavire(vessel: { label?: string; vehicleId: string }): string {
  return vessel.label ?? libelleOuAbsence(findVehicleById(vessel.vehicleId), 'navire', vessel.vehicleId);
}

/** Porteur « navire de campagne » : la cale (`vessel.cargo`) EST la source unique (verrou 1). */
function vesselCarrier(s: CarrierStateSlice, placeId: string | undefined): CargoCarrier | undefined {
  const vessel = s.vessel;
  if (!vessel) return undefined;
  const capacity = findVehicleById(vessel.vehicleId)?.ship?.capacity ?? 0;
  return { id: CAMPAIGN_VESSEL_CARRIER_ID, label: nomDuNavire(vessel), hull: 'coque', capacity, discreteEnc: 0, cargo: vessel.cargo ?? [], placeId };
}

/** TOUS les porteurs de charge réels du groupe (héros → bêtes/véhicules → navire). Chaque carrier LIT sa
 *  source unique (aucune copie persistée). */
export function partyCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const placeId = currentPlaceId(s);
  const out: CargoCarrier[] = [];
  for (const h of s.party) {
    if (!heroInParty(h)) continue;
    // Le héros lui-même : contenu = objets DISCRETS (transfert d'objet = giveTrapping, hors canal vrac).
    out.push({ id: h.id, label: h.label, hull: 'jambes', capacity: maxEncumbrance(h), discreteEnc: totalEncumbrance(h), cargo: [], placeId });
  }
  const { vehicles, beasts } = landCarriers(s, placeId);
  out.push(...vehicles, ...beasts);
  const v = vesselCarrier(s, placeId);
  if (v) out.push(v);
  return out;
}

/** Porteurs qui HÉBERGENT du vrac (`CargoLot`) : bêtes de bât, véhicules terrestres, navire — hors héros
 *  (canal discret). Cible du commerce de cargaison et du transfert. */
export function bulkCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const placeId = currentPlaceId(s);
  const { vehicles, beasts } = landCarriers(s, placeId);
  const out = [...vehicles, ...beasts];
  const v = vesselCarrier(s, placeId);
  if (v) out.push(v);
  return out;
}

const mostFree = (list: CargoCarrier[]): CargoCarrier | undefined =>
  list.reduce<CargoCarrier | undefined>((best, c) => (!best || carrierFreeEnc(c) > carrierFreeEnc(best) ? c : best), undefined);

/** Porteur DE DÉFAUT d'un achat de cargaison (verrou 4 / décision 7) : navire de campagne s'il existe,
 *  sinon le véhicule terrestre le plus libre, sinon la bête de bât la plus libre. `undefined` = le groupe
 *  n'a AUCUN porteur → le commerce de cargaison refuse (Contenance = plafond réel). */
export function primaryCargoCarrier(s: CarrierStateSlice): CargoCarrier | undefined {
  const placeId = currentPlaceId(s);
  const v = vesselCarrier(s, placeId);
  if (v) return v;
  const { vehicles, beasts } = landCarriers(s, placeId);
  return mostFree(vehicles) ?? mostFree(beasts);
}

/** Une référence à un lot de vrac (porteur + index) — pour lister/vendre/brader à travers tous les porteurs. */
export interface CargoRef { carrierId: string; carrierLabel: string; index: number; lot: CargoLot; }

/** Tous les lots de vrac du groupe, à plat (avec leur porteur) — surface de vente/bradage du marché. */
export function bulkCargoRefs(s: CarrierStateSlice): CargoRef[] {
  const out: CargoRef[] = [];
  for (const c of bulkCarriers(s)) c.cargo.forEach((lot, index) => out.push({ carrierId: c.id, carrierLabel: c.label, index, lot }));
  return out;
}

/** Enc TOTAL de vrac transporté par le groupe (tous porteurs de vrac) — malus de renflouage (l.99), tuile Cale. */
export function partyCargoTotalEnc(s: CarrierStateSlice): number {
  return bulkCarriers(s).reduce((sum, c) => sum + cargoTotalEnc(c.cargo), 0);
}

/** Possessions terrestres AVEC-LE-GROUPE d'un propriétaire vivant du groupe — variante PURE (sans lieu). */
function landPossessions(party: Combatant[], possessions: Possession[]): Possession[] {
  const ownerIds = new Set(party.filter(heroInParty).map((h) => h.id));
  return possessions.filter((p) => !p.destroyed && ownerIds.has(p.ownerId) && p.location.kind === 'avec-le-groupe');
}

/** Enc de vrac porté par les BÊTES/VÉHICULES du groupe (hors navire) — tuile Chargement terre/fleuve. PUR. */
export function partyItemsCargoEnc(party: Combatant[], possessions: Possession[]): number {
  return landPossessions(party, possessions)
    .reduce((s, p) => s + (possessionCarrierCapacity(p) != null ? cargoTotalEnc(p.cargo ?? []) : 0), 0);
}

/** Contenance CUMULÉE des bêtes/véhicules du groupe (hors navire) — dénominateur de la tuile Chargement. PUR. */
export function partyLandCapacity(party: Combatant[], possessions: Possession[]): number {
  return landPossessions(party, possessions)
    .reduce((s, p) => s + (possessionCarrierCapacity(p) ?? 0), 0);
}

/** Retrouve un porteur du groupe par son id STABLE. */
export function carrierById(s: CarrierStateSlice, id: string): CargoCarrier | undefined {
  return partyCarriers(s).find((c) => c.id === id);
}

/** Porteurs de VRAC TERRESTRES du convoi (bêtes/véhicules — hors navire) : cible du vol terrestre. */
export function landBulkCarriers(s: CarrierStateSlice): CargoCarrier[] {
  const { vehicles, beasts } = landCarriers(s, currentPlaceId(s));
  return [...vehicles, ...beasts];
}

/** VOL TERRESTRE GRADUÉ (#327 A5.1, arbitrage 2026-07-11) : quand une péripétie dangereuse terrestre se
 *  solde par un combat, la cargaison des porteurs du convoi subit un % d'Enc SELON L'ISSUE — combat gagné
 *  = rien ; fuite = `landRobberyFleePct` ; défaite = `landRobberyLossPct` (params maison). Retire des lots
 *  RÉELS (tronc `spoilCargoByPct`) et renvoie le patch d'état (`persistCarriersCargo`) + l'Enc perdu par
 *  porteur — le call-site (store) journalise en Consequence structurée. */
export function applyLandCargoRaid(
  s: CarrierStateSlice, outcome: CargoRaidOutcome,
): { patch: Partial<GameState>; pct: number; losses: { label: string; removed: number }[] } {
  const pct = cargoRaidLossPct(outcome, Number(rule('landRobberyFleePct')), Number(rule('landRobberyLossPct')));
  const losses: { label: string; removed: number }[] = [];
  const updates: { carrierId: string; cargo: CargoLot[] }[] = [];
  if (pct > 0) for (const c of landBulkCarriers(s)) {
    if (!c.cargo.length) continue;
    const r = spoilCargoByPct(c.cargo, pct);
    if (r.removed) { updates.push({ carrierId: c.id, cargo: r.lots }); losses.push({ label: c.label, removed: r.removed }); }
  }
  return { patch: updates.length ? persistCarriersCargo(s, updates) : {}, pct, losses };
}

/** RE-PERSISTE la cargaison de N porteurs sur leur source unique (verrou 1) : cale du navire
 *  (`vessel.cargo`) ou `Possession.cargo` de la bête/véhicule possédé (registre `possessions`, SOCLE
 *  POSSESSIONS #617/#618). Renvoie le patch d'état (`vessel`/`possessions`) à passer au `set` — jamais un
 *  2ᵉ compteur. */
export function persistCarriersCargo(s: CarrierStateSlice, updates: { carrierId: string; cargo: CargoLot[] }[]): Partial<GameState> {
  const map = new Map(updates.map((u) => [u.carrierId, u.cargo]));
  const patch: Partial<GameState> = {};
  if (s.vessel && map.has(CAMPAIGN_VESSEL_CARRIER_ID)) {
    patch.vessel = { ...s.vessel, cargo: map.get(CAMPAIGN_VESSEL_CARRIER_ID)! };
  }
  let touched = false;
  const possessions = s.possessions.map((p) => {
    if (!map.has(p.uid)) return p;
    touched = true;
    return { ...p, cargo: map.get(p.uid)! };
  });
  if (touched) patch.possessions = possessions;
  return patch;
}
