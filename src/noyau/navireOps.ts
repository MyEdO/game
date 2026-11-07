/**
 * La cible `navire` d'un EffectOp (#1652) : la COQUE du navire de campagne — sa coque de trajet quand un
 * voyage la porte, sinon sa coque bâtie depuis `vessel` (l'escale). Les ops de NAVIRE (`OPS_DU_NAVIRE`,
 * `engine/ops.ts`) s'y résolvent ici, les autres passent par `applyLeafOps` sur cette coque, puis ses
 * Blessures sont persistées sur `vessel.wounds`. MDG 15 l.83-125, l.132-263
 */
import { t } from '../i18n';
import { garanti } from '../lib/garanti';
import { tirerSigne } from '../engine/dice';
import { estOpDuNavire, resolveFormula, type GameOp, type OpDuNavire, type OpsCtx } from '../engine/ops';
import type { EffectOp } from '../engine/flowCore';
import type { Combatant } from '../engine/types';
import { addManann, applyManannFactor } from '../engine/seaVoyage';
import { rollShipCritical } from '../engine/shipCritical';
import { applyShipMoraleDelta } from './shipCrew';
import { applyVesselCritical, coqueDuNavireDeCampagne, localisationAleatoire, noteSeaLine, persistHullWounds, setVesselHull, vesselManann, voyageShip } from './seaVoyageFlow';
import { applyLeafOps, OPS_DIFFEREES } from './combatEffects';
import type { Get, Set } from './flowTypes';

/** La coque visée par `navire`, et l'écriture qui la persiste ; `null` sans navire de campagne à coque. */
function coqueVisee(get: Get, set: Set): { coque: Combatant; persister: () => void } | null {
  const plan = get().travelPlan;
  const enVoyage = coqueDuNavireDeCampagne(plan, get().vessel);
  if (plan && enVoyage) {
    return { coque: enVoyage, persister: () => { const p = get().travelPlan; if (p) set({ travelPlan: { ...p } }); persistHullWounds(get, set); } };
  }
  const bati = voyageShip(get);
  if (!bati) return null;
  return { coque: bati.hull, persister: () => setVesselHull(get, set, bati.hull.wounds.current, bati.hull.wounds.max) };
}

/** Résout UNE op de navire sur `coque` ; rend ses lignes. */
function appliquerOpDuNavire(get: Get, set: Set, coque: Combatant, o: OpDuNavire, ctx: OpsCtx): string[] {
  switch (o.op) {
    case 'shipMorale':
      return applyShipMoraleDelta(get, set, coque, tirerSigne(o.delta, ctx.rng));
    case 'manann': {
      const vessel = garanti(get().vessel, o.op, 'navire de campagne de la coque visée');
      const mood = vesselManann(vessel);
      if (o.factorId !== undefined) {
        const deja = mood.applied.includes(o.factorId);
        const { mood: next, delta, label } = applyManannFactor(mood, o.factorId, ctx.rng);
        if (deja) return [t('eff.manannAlready', { factor: label ?? o.factorId })];
        set({ vessel: { ...vessel, manann: next } });
        return [t('eff.manannFactor', { delta: `${delta >= 0 ? '+' : ''}${delta}`, factor: label ?? o.factorId })];
      }
      const delta = tirerSigne(o.delta, ctx.rng);
      set({ vessel: { ...vessel, manann: addManann(mood, delta) } });
      return [t('sv.manannMood', { delta: `${delta >= 0 ? '+' : ''}${delta}`, score: vesselManann(get().vessel).score })];
    }
    case 'shipCritical': {
      const n = Math.max(0, Math.round(resolveFormula(o.count, coque, ctx.rng)));
      for (let i = 0; i < n; i++) {
        applyVesselCritical(get, set, rollShipCritical(o.location === 'aleatoire' ? localisationAleatoire(ctx.rng) : o.location, ctx.rng));
      }
      return [];
    }
  }
}

/** Applique la feuille `e` (`on: 'navire'`) au navire de campagne, ops dans l'ordre authoré ; rend les
 *  lignes du journal (aussi posées au recap du jour en mer). */
export function appliquerAuNavire(get: Get, set: Set, e: EffectOp, base: OpsCtx): string[] {
  const visee = coqueVisee(get, set);
  if (!visee) return [t('eff.navireAbsent')];
  const { coque, persister } = visee;
  const ctx: OpsCtx = { ...base, hull: coque };
  const lignes: string[] = [];
  let pures: GameOp[] = [];
  const viderLesPures = (): void => {
    if (!pures.length) return;
    const issue = applyLeafOps(get, set, coque, { ...e, ops: pures }, ctx);
    if (issue === OPS_DIFFEREES) throw new Error(`#1652 — une op à dé ouvert à la porte vise le navire (${pures.map((o) => o.op).join(', ')}) : son applier ne retrouverait pas la coque.`);
    lignes.push(...issue);
    pures = [];
    persister();
  };
  for (const o of e.ops) {
    if (!estOpDuNavire(o)) { pures.push(o); continue; }
    viderLesPures();
    lignes.push(...appliquerOpDuNavire(get, set, coque, o, ctx));
  }
  viderLesPures();
  noteSeaLine(get, set, lignes);
  return lignes;
}
