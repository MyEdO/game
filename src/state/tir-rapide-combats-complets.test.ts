import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import { initialFields } from './stateFields';
import { createHero } from '../engine/character';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene } from '../noyau/monde/scene';
import { setCadence, resetCadence } from '../engine/cadence';
import { initCombatAuto } from './combatAuto';
import { pickActiveModalKey } from './modalArbiter';
import { avanceEtapeCascade } from './cascadeTestKit';
import type { Combatant, Weapon } from '../engine/types';

/**
 * #997, #1765 — combats COMPLETS avec Tir rapide (`LDB 11 l.97-103`) dans les deux camps, sous trois
 * pilotes : IA contre IA, Auto-combat, et manuel avec Destin. Aucun combat ne se fige : chacun va au bout.
 */
const ARC = (): Weapon => ({ uid: 'arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 6 }, range: 30, qualities: [], loaded: true } as unknown as Weapon);
const g = () => useGame.getState();
const ouverts = () => {
  const s = g() as unknown as Record<string, unknown>;
  return Object.keys(s).filter((k) => /^pending/.test(k) && (Array.isArray(s[k]) ? (s[k] as unknown[]).length > 0 : s[k] != null));
};

function monte(opts: { heroAi: boolean; fate?: number; wounds?: number }) {
  const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant => {
    const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, seed: 3 });
    c.id = id; c.label = id; c.kind = kind; c.pos = pos; c.fortune = 0; c.fate = kind === 'hero' ? (opts.fate ?? 0) : 0;
    c.wounds = { ...c.wounds, current: opts.wounds ?? 6, max: opts.wounds ?? 6 };
    if (kind === 'hero' && opts.heroAi) c.aiControlled = true;
    c.weapons = [ARC()];
    return c;
  };
  const H1 = mk('h1', 'hero', { x: 0, y: 0 }); const H2 = mk('h2', 'hero', { x: 0, y: 4 });
  const E1 = mk('e1', 'enemy', { x: 1, y: 0 }); const E2 = mk('e2', 'enemy', { x: 1, y: 4 });
  E1.talents = [{ talentId: 'tir-rapide', times: 2 }]; E2.talents = [{ talentId: 'tir-rapide', times: 1 }];
  H1.talents = [{ talentId: 'tir-rapide', times: 1 }];
  const battle = { combatants: [H1, H2, E1, E2], order: ['e1', 'h1', 'e2', 'h2'], turn: 3, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState;
  useGame.setState({ ...initialFields(), party: [H1, H2], mode: 'battle', battle, scene: emptyScene(8, 8), net: { ...g().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } });
}

type Issue = { issue: string; fenetresTirRapide: number; [k: string]: unknown };

/** Déroule le combat jusqu'à sa fin. `main` : défense et Destin joués à la main quand la fenêtre est à eux. */
function deroule(main: boolean, pilote = main): Issue {
  g().battleEndTurn();
  let sig = ''; let fige = 0; let fenetresTirRapide = 0;
  for (let i = 0; i < 4000; i++) {
    const s = g();
    if (!s.battle || s.battle.over) return { issue: 'fin', fenetresTirRapide };
    const pd = s.pendingDefense;
    if (pd && !pd.result && pd.suite.mode === 'machine' && pd.suite.coup.enchainement?.mode === 'tirRapide') fenetresTirRapide++;
    if (s.pendingRoundStart) { g().confirmRoundStart(); continue; }
    if (main) {
      const surDef = !s.pendingCascade || s.pendingCascade.participants[s.pendingCascade.cursor]?.jet === 'defense';
      if (surDef && pd && !pd.result) { g().defenseRoll(); continue; }
      if (surDef && pd?.result) { g().defenseConfirm(); continue; }
      if (s.pendingFateSave) { g().fateNegate(); if (g().pendingFateSave) g().fateSurvive(); continue; }
      const c = s.battle.combatants.find((x) => x.id === s.battle!.order[s.battle!.turn]);
      if (c?.kind === 'hero' && !ouverts().length && s.battle.turn >= 0) { g().battleEndTurn(); vi.advanceTimersByTime(100); continue; }
    }
    if (pilote && s.pendingCascade && s.pendingCascade.participants[s.pendingCascade.cursor]?.jet !== 'defense') {
      const c = s.pendingCascade; const cur = c.participants[c.cursor];
      if (cur?.jet === 'fumble') { g().fumbleRoll(); g().fumbleConfirm(); }
      else if (cur?.jet !== 'attack') avanceEtapeCascade(g);
      vi.advanceTimersByTime(50);
      if (g().pendingCascade !== c) continue;
    }
    vi.advanceTimersByTime(3000);
    const now = JSON.stringify([s.battle.round, s.battle.turn, ouverts(), s.pendingCascade?.cursor, s.battle.log.length]);
    if (now === sig) {
      if (++fige > 30) return { issue: 'FIGE', fenetresTirRapide, round: s.battle.round, actif: s.battle.order[s.battle.turn], ouverts: ouverts(), modale: pickActiveModalKey(s) };
    } else { sig = now; fige = 0; }
    if (s.battle.round > 30) return { issue: 'plafond', fenetresTirRapide };
  }
  return { issue: 'boucle', fenetresTirRapide };
}

const trenteCombats = (opts: Parameters<typeof monte>[0], main: boolean, pilote = main) => {
  const out: (Issue & { seed: number })[] = [];
  for (let seed = 1; seed <= 30; seed++) { seedBattleRng(seed); monte(opts); out.push({ seed, ...deroule(main, pilote) }); }
  return out;
};

describe('#997, #1765 — combats complets avec Tir rapide : aucun gel', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  it('IA contre IA (héros `aiControlled`)', () => {
    const out = trenteCombats({ heroAi: true }, false, true);
    expect(out.filter((o) => o.issue !== 'fin')).toEqual([]);
  });

  it('Auto-combat : les fenêtres des héros surfacés pilotées par `combatAuto`', () => {
    initCombatAuto(); setCadence('auto');
    const out = trenteCombats({ heroAi: false }, false);
    expect(out.filter((o) => o.issue !== 'fin')).toEqual([]);
    expect(out.some((o) => o.fenetresTirRapide > 0), 'des tirs d’interruption ouvrent leur fenêtre').toBe(true);
  });

  it('manuel, héros à Destin : défense et Destin joués à la main', () => {
    const out = trenteCombats({ heroAi: false, fate: 2, wounds: 4 }, true);
    expect(out.filter((o) => o.issue !== 'fin')).toEqual([]);
    expect(out.some((o) => o.fenetresTirRapide > 0), 'des tirs d’interruption ouvrent leur fenêtre').toBe(true);
  });
});
