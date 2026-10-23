import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast } from '../noyau/combatFlow';
import { pregen, pregenParty, PREGEN } from '../data/pregens';
import { findSpell } from '../data';
import { applyOps } from '../engine/ops';
import type { CastResult, MissileResult } from '../engine/magic';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * Champs de SpellSpec B4 : `lifeSteal` (Projectile drainant — le lanceur récupère une fraction des
 * Blessures infligées), `casterOps` (effets sur le LANCEUR — Vol de vie retire son Exténué) et la
 * zone de soin récurrente (`op:'heal'` appliqué par `applyOps` — Sang de la Terre).
 */
const ok = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: '' });

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null });
  useGame.getState().seedRng(7);
});

describe('Vol de vie — lifeSteal + casterOps', () => {
  it('le lanceur draine ⌈dégâts/2⌉ Blessures et perd son propre État Exténué', () => {
    const [w, cible] = pregenParty(idNeufDeBanc, PREGEN.sorcier, PREGEN.soldat);
    w.wounds.current = w.wounds.max - 6;
    w.conditions = [{ id: 'extenue', value: 1 }];
    useGame.setState({ party: [w, cible] as Combatant[] });
    const res: CastResult & Partial<MissileResult> = { ...ok(2), hit: true, location: 'corps', damage: 7, woundsLost: 5, defenderDefeated: false };
    const before = w.wounds.current;
    applyCast(useGame.getState, useGame.setState, w, cible, findSpell('Vol de vie')!, res, true, false);
    const wAfter = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(wAfter.wounds.current).toBe(before + Math.ceil(5 / 2)); // vol de vie : +3
    expect(wAfter.conditions.find((c) => c.id === 'extenue')).toBeUndefined(); // casterOps a purgé l'Exténué du lanceur
  });
});

describe('Caresse de Laniph — lifeSteal ⌊dégâts/2⌋', () => {
  it('le lanceur récupère la moitié (arrondie au plancher) des Blessures infligées', () => {
    const [w, cible] = pregenParty(idNeufDeBanc, PREGEN.sorcier, PREGEN.soldat);
    w.wounds.current = w.wounds.max - 4;
    useGame.setState({ party: [w, cible] as Combatant[] });
    const res: CastResult & Partial<MissileResult> = { ...ok(1), hit: true, location: 'corps', damage: 6, woundsLost: 5, defenderDefeated: false };
    const before = w.wounds.current;
    applyCast(useGame.getState, useGame.setState, w, cible, findSpell('Caresse de Laniph')!, res, true, false);
    expect(useGame.getState().party.find((h) => h.id === w.id)!.wounds.current).toBe(before + Math.floor(5 / 2)); // +2
  });
});

describe('zone de soin (op:heal) — Sang de la Terre', () => {
  it('rend (BFM) Blessures à qui stationne dans la zone, sans dépasser le max', () => {
    const caster = pregen(idNeufDeBanc, PREGEN.sorcier); // BFM connu via ses caracs
    const victim = { ...caster, id: 'v', label: 'V', wounds: { current: 5, max: 30 } } as Combatant;
    const bfm = Math.floor(caster.characteristics['force-mentale'] / 10);
    const log = applyOps(victim, [{ op: 'heal', amount: { bonusOf: 'force-mentale' } }], { idNeuf: idNeufDeBanc, rng: desDuTest, caster, label: 'Sang de la Terre' });
    expect(victim.wounds.current).toBe(5 + bfm);
    expect(log.join(' ')).toContain('regagne');
  });
});
