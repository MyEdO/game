/**
 * Mêlée de héros manuels, Deux armes, balayage, Frénésie (#1765) : 25 combats par siège, sans siège MJ et
 * sous siège MJ, pilotés par les portes que la carte et les fenêtres offrent. Aucun combat ne gèle.
 * LDB 10 l.767-773, LDB 85 l.362, LDB 21 l.33.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { initialFields } from '../noyau/stateFields';
import { openAttackCascade } from '../noyau/combatFlow';
import { targetingHolder } from '../noyau/targetingHolder';
import { pickActiveModalKey } from '../noyau/modalArbiter';
import { seedBattleRng } from '../noyau/battleRng';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade } from './cascade.testkit';
import { chebyshev } from '../engine/grid';
import type { Combatant, Weapon } from '../engine/types';

const chars = { 'capacite-de-combat': 60, 'capacite-de-tir': 50, force: 40, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const arme = (uid: string, hand: 'main' | 'off'): Weapon => ({ uid, name: uid, label: uid, type: 'melee', damage: { plusBF: true, flat: 2, bare: true }, qualities: [], hand, hands: 1 } as unknown as Weapon);
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, w: Weapon[]): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [], traumas: [], items: [],
     weapons: w, advantage: 0, size: 'moyenne', pos, wounds: { current: 12, max: 12 }, resilience: 0, fortune: 0, fate: 1,
     species: 'humains-reiklander', bodyShape: 'humanoide',
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);
const g = useGame.getState;
/** Les `pending*` vivants, hors file de journal différée (`pendingLogQueue`, aucune fenêtre). */
const ouverts = (): string[] => {
  const s = g() as unknown as Record<string, unknown>;
  return Object.keys(s).filter((k) => /^pending/.test(k) && k !== 'pendingLogQueue' && (Array.isArray(s[k]) ? (s[k] as unknown[]).length > 0 : s[k] != null));
};
const adj = (a: Combatant, b: Combatant): boolean => chebyshev(a.pos!, b.pos!) <= 1;
const vivant = (x: Combatant): boolean => x.wounds.current > 0 && !(x as { dead?: boolean }).dead;

function monte(gmSeat: number | undefined): void {
  const h1 = mk('h1', 'hero', { x: 1, y: 1 }, [arme('m1', 'main'), arme('o1', 'off')]);
  const h2 = mk('h2', 'hero', { x: 1, y: 2 }, [arme('m2', 'main')]); h2.size = 'grande';
  (h2 as unknown as { psychState: unknown[] }).psychState = [{ type: 'frenesie' }];
  const e1 = mk('e1', 'enemy', { x: 2, y: 1 }, [arme('g1', 'main')]); const e2 = mk('e2', 'enemy', { x: 2, y: 2 }, [arme('g2', 'main')]);
  const e3 = mk('e3', 'enemy', { x: 0, y: 2 }, [arme('g3', 'main'), arme('g3o', 'off')]);
  const order = ['h1', 'e1', 'h2', 'e2', 'e3'];
  const battle = { combatants: [h1, h2, e1, e2, e3], order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState;
  useGame.setState({ ...initialFields(), party: [h1, h2], mode: 'battle', battle, scene: testScene(), net: { ...g().net, mode: 'local', mySeat: 0, gmSeat, ownership: {} } });
}

/** Déroule un combat jusqu'à sa fin ; rend l'état figé si plus rien n'avance pendant 30 pas, et les pas où
 *  la carte offre la cible suivante pendant qu'une fenêtre du coup est élue. */
function deroule(): { issue: string; ouverts?: string[]; doubleMain: string[] } {
  let sig = ''; let fige = 0; const doubleMain: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const s = g();
    if (!s.battle || s.battle.over) return { issue: 'fin', doubleMain };
    if (s.battle.round > 30) return { issue: 'plafond', doubleMain };
    const c = s.pendingCascade; const cur = c?.participants[c.cursor];
    const actif = s.battle.combatants.find((x) => x.id === s.battle!.order[s.battle!.turn]);
    const cible = targetingHolder(s);
    if (cible && pickActiveModalKey(s) === 'cascade') doubleMain.push(`${cible} sur ${cur?.id}`);
    if (s.pendingRoundStart) { g().confirmRoundStart(); continue; }
    if (s.pendingFateSave) { g().fateNegate(); if (g().pendingFateSave) g().fateSurvive(); continue; } if (s.pendingHandGate) { if (s.pendingHandGate.roll == null) g().handGateRoll(); else g().handGateConfirm(); continue; }
    if (cur?.jet === 'defense' && s.pendingDefense && !s.pendingDefense.result) { g().defenseRoll(); continue; }
    if (cur?.jet === 'defense' && s.pendingDefense?.result) { g().defenseConfirm(); continue; }
    if (cible === 'pendingDualStrike' && !s.pendingHandGate) {
      const a = s.battle.combatants.find((x) => x.id === s.pendingDualStrike!.attackerId)!;
      const t = s.battle.combatants.find((x) => x.kind !== a.kind && vivant(x) && adj(a, x));
      if (t) g().dualStrikeAttack(t.id);
      if (g().pendingDualStrike && !g().pendingAttack && !g().pendingHandGate) g().dualStrikeSkip();
      continue;
    }
    if (cible === 'pendingCleave') {
      const a = s.battle.combatants.find((x) => x.id === s.pendingCleave!.attackerId)!;
      const t = s.battle.combatants.find((x) => x.kind !== a.kind && !s.pendingCleave!.hitIds.includes(x.id) && vivant(x) && adj(a, x));
      if (t) g().cleaveAttack(t.id);
      if (!g().pendingAttack) g().cleaveEnd();
      continue;
    }
    if (cur?.jet === 'attack' && s.pendingAttack) { if (!s.pendingAttack.result) g().attackRoll(); else g().attackConfirm(); continue; }
    if (cur?.jet === 'fumble') { g().fumbleRoll(); g().fumbleConfirm(); continue; }
    if (c && !cur?.jet) { avanceEtapeCascade(g); vi.advanceTimersByTime(50); continue; }
    if (actif && (actif.kind === 'hero' || s.net.gmSeat != null) && !ouverts().length && s.battle.turn >= 0) {
      const t = !s.battle.acted && s.battle.combatants.find((x) => x.kind !== actif.kind && vivant(x) && adj(actif, x));
      if (t) {
        openAttackCascade(g, useGame.setState, { attackerId: actif.id, targetId: t.id, location: null, result: null }, 'Attaque', 'action/attack');
        if (actif.id === 'h1' || actif.id === 'e3') g().attackSetDualMode(true);
        continue;
      }
      g().battleEndTurn(); vi.advanceTimersByTime(100); continue;
    }
    vi.advanceTimersByTime(3000);
    const now = JSON.stringify([s.battle.round, s.battle.turn, ouverts(), c?.cursor, s.battle.log.length]);
    if (now === sig) { if (++fige > 30) return { issue: 'gel', ouverts: ouverts(), doubleMain }; } else { sig = now; fige = 0; }
  }
  return { issue: 'boucle', doubleMain };
}

describe('mêlée de héros manuels : Deux armes, balayage, Frénésie (#1765)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
  for (const gmSeat of [undefined, 0]) it(`aucun gel sur 25 combats, gmSeat=${gmSeat}`, () => {
    const geles: unknown[] = [];
    for (let seed = 1; seed <= 25; seed++) {
      seedBattleRng(seed); monte(gmSeat);
      const r = deroule();
      if ((r.issue !== 'fin' && r.issue !== 'plafond') || r.doubleMain.length) geles.push({ seed, ...r });
    }
    expect(geles).toEqual([]);
  });
});
