/**
 * Objets consommables — drogues (LDB 71), herbes et potions (LDB 72), outils (LDB 67). L'effet est un
 * **Flow** (`TrappingData.consumable`, résolu par `consommableDe`) : MÊME structure
 * authorée que les sorts/triggers — feuilles `effet` d'EffectOp, branches `si`, et nœuds `test` pour les
 * Tests « au boire » (Brise-cœur « Combattu avec un Test de Résistance Complexe (-10) », Belladone…),
 * résolus CADENCE-AWARE par le runner state (`noyau/consumableFlow.runConsumable`) — jamais un jet
 * silencieux de héros. Ce module ne porte que le PUR : prédicat, durée, bake.
 */
import { Combatant, ItemInstance } from './types';
import { type Flow, type EffectOp, walkFlow } from './flowCore';
import { resolveFormula, type Formula, type GameOp } from './ops';
import { RNG } from './dice';
import { ficheDObjetPorte, type TrappingResolver } from './items';

/** Durée d'HORLOGE des effets durables d'un consommable (LDB 71/72 « Durée : … ») — UNE durée par objet
 *  (une drogue a UNE durée, pas une par op). Résolue AU BOIRE (`consumableUntilTime`), avec dés
 *  (« 2d10 minutes », « 1d10+5 heures ») ou facteur (« 1d10 × 10 minutes » via Formula `times`). */
export interface ConsumableDuration {
  minutes?: Formula;
  hours?: Formula;
  days?: Formula;
}

/** Période d'une Dose (`TrappingData.dose`). LDB 72 l.22-30 ; #4839 */
export type PeriodeDeDose = 'rencontre' | 'jour' | 'blessureCritique';

type PorteurDeDoses = Pick<Combatant, 'dosesDeRencontre' | 'marquesDeDose' | 'critEntriesSuffered'>;

/** Marque de la période en cours d'une Dose datée : le jour de jeu, ou le compte des Blessures Critiques subies. */
function marqueDeDose(periode: Exclude<PeriodeDeDose, 'rencontre'>, c: PorteurDeDoses, jour: number): number {
  return periode === 'jour' ? jour : (c.critEntriesSuffered ?? []).length;
}

/** `c` a-t-il déjà pris sa dose de l'objet `trappingId` dans la période en cours ? LDB 72 l.22-30 */
export function doseDejaPrise(c: PorteurDeDoses, trappingId: string, periode: PeriodeDeDose, jour: number): boolean {
  return periode === 'rencontre'
    ? (c.dosesDeRencontre ?? []).includes(trappingId)
    : c.marquesDeDose?.[trappingId] === marqueDeDose(periode, c, jour);
}

/** Consigne sur `c` la dose de l'objet `trappingId` prise dans la période en cours. LDB 72 l.22-30 */
export function prendreLaDose(c: PorteurDeDoses, trappingId: string, periode: PeriodeDeDose, jour: number): void {
  if (periode === 'rencontre') c.dosesDeRencontre = [...(c.dosesDeRencontre ?? []), trappingId];
  else c.marquesDeDose = { ...c.marquesDeDose, [trappingId]: marqueDeDose(periode, c, jour) };
}

/** Flow de consommation jouable, issu de la fiche courante de l'objet. #2967 */
export function consommableDe(item: Pick<ItemInstance, 'trappingId'>, resolveTrapping: TrappingResolver): Flow | undefined {
  const flow = ficheDObjetPorte(item, resolveTrapping)?.consumable;
  return flow?.kind === 'sequence' && flow.etapes.length === 0 ? undefined : flow;
}

/** L'objet offre-t-il un usage de consommable ? */
export function isConsumable(item: Pick<ItemInstance, 'trappingId'>, resolveTrapping: TrappingResolver): boolean {
  return consommableDe(item, resolveTrapping) !== undefined;
}

/** Échéance d'horloge des effets durables du consommable : `now + durée résolue` (minutes/heures/jours,
 *  dés tirés MAINTENANT — le RAW donne UNE durée par prise). Sans `consumableDuration` → undefined
 *  (les ops durables suivent le contexte appelant — permanent pour un retrait d'État instantané). */
export function consumableUntilTime(item: ItemInstance, now: number, target: Combatant, rng: RNG): number | undefined {
  const d = item.consumableDuration;
  if (!d) return undefined;
  const min = resolveFormula(d.minutes ?? 0, target, rng)
    + resolveFormula(d.hours ?? 0, target, rng) * 60
    + resolveFormula(d.days ?? 0, target, rng) * 24 * 60;
  return min > 0 ? now + min : undefined;
}

/** BAKE le Flow d'un consommable pour UN buveur : chaque feuille EffectOp est ciblée sur LUI
 *  (`on:'hero'`, `heroId`) et porte l'échéance/le libellé résolus (`untilTime`/`label`) — ainsi une
 *  branche de `test` SUSPENDUE (sérialisée dans un pending/meta) garde sa durée et sa source quel que
 *  soit l'exécuteur qui la reprend (`leafOpsCtx`). PUR — rend un NOUVEAU Flow, la donnée n'est pas mutée. */
export function bakeConsumableFlow(flow: Flow, heroId: string, untilTime: number | undefined, label: string): Flow {
  const bake = (f: Flow): Flow => {
    switch (f.kind) {
      case 'effet': {
        const e: EffectOp = { ...f.effet, on: 'heros', heroId, label, ...(untilTime != null ? { untilTime } : {}) };
        return { kind: 'effet', effet: e };
      }
      case 'sequence': return { kind: 'sequence', etapes: f.etapes.map(bake) };
      case 'si': return { kind: 'si', condition: f.condition, alors: bake(f.alors), ...(f.sinon ? { sinon: bake(f.sinon) } : {}) };
      case 'test': return { kind: 'test', test: structuredClone(f.test), reussite: bake(f.reussite), echec: bake(f.echec) };
      case 'choix': return { kind: 'choix', invite: f.invite, ...(f.coutEnAvantage != null ? { coutEnAvantage: f.coutEnAvantage } : {}), ...(f.icon ? { icon: f.icon } : {}), oui: bake(f.oui), ...(f.non ? { non: bake(f.non) } : {}) };
    }
  };
  return bake(flow);
}

/** Toutes les `GameOp` des feuilles d'un Flow de consommable (branches comprises) — pour les tests de
 *  données et les filtres (« cet objet enduit-il une arme ? » → cherche `augmentWeapon`). */
export function consumableOps(flow: Flow | undefined): GameOp[] {
  if (!flow) return [];
  const out: GameOp[] = [];
  walkFlow(flow, (n) => { if (n.kind === 'effet') out.push(...n.effet.ops); });
  return out;
}
