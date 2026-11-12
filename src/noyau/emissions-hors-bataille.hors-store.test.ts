/**
 * Les émissions du coup encaissé hors bataille (#3984) : le flux EXISTANT `applyAttackResult`, `battle` nul, émet sur le
 * bus (`emitCombatEvent`) ; les triggers de DONNÉES des entités y jouent. `.claude/rules/moteur-et-flux.md:13`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { heroDuDuel } from './combatDeTest.testkit';
import { frapper, horsBataille } from './coupHorsBataille.testkit';
import { testScene } from '../scenes/test-fixture';
import { armeDeTest } from '../engine/objetsDeTest.testkit';
import { addCondition, hasCondition } from '../engine/conditions';
import { resetRule, setRule } from '../engine/policy';
import { markFixedDie } from './fixedDieMark';
import { t as tr } from '../i18n';

afterEach(() => {
  vi.restoreAllMocks();
  resetRule('combat-cible-inconsciente');
});

describe('émissions du coup encaissé hors bataille (#3984)', () => {
  it('arme Immobilisante (Fouet) : la touche pose Empêtré (`onHit`) : LDB 62 l.258', () => {
    const { banc, H, E } = horsBataille(testScene());
    const res = frapper(banc, E, H, [23, 95], armeDeTest('fouet'));
    expect(res.hit).toBe(true);
    expect(banc.getState().battle).toBeNull();
    expect(hasCondition(H, 'empetre')).toBe(true);
  });

  it('Venin : la touche qui blesse pose Empoisonné (`onHit`) : LDB 85 l.425', () => {
    const { banc, H, E } = horsBataille(testScene());
    E.traits = [...(E.traits ?? []), { id: 'venin' }];
    const res = frapper(banc, E, H, [23, 95]);
    expect(res.hit && !!res.woundsLost).toBe(true);
    expect(hasCondition(H, 'empoisonne')).toBe(true);
  });

  it('Démoniaque mis hors de combat : banni (`onSlain`) : LDB 85 l.98 ; LDB 16 l.113', () => {
    const { banc, H } = horsBataille(testScene());
    setRule('combat-cible-inconsciente', 'mort-auto');
    const demon = heroDuDuel();
    demon.id = 'demon';
    demon.label = 'Démon';
    demon.fate = 0;
    demon.traits = [...(demon.traits ?? []), { id: 'demoniaque', value: 8 }];
    addCondition(demon, 'inconscient');
    banc.setState({ party: [H, demon] });
    frapper(banc, H, demon, [23]);
    const etape = banc.getState().pendingCascade!.participants.find((x) => x.kind === 'sauvegarde')!;
    banc.getState().jetImposerLeResultat('cascadeTirage', 1, etape.id);
    banc.getState().jetValider('cascade');
    const s = banc.getState();
    expect(s.battle).toBeNull();
    expect(s.party.find((c) => c.id === demon.id)!.dead).toBe(true);
    expect(s.journal).toContain(markFixedDie(tr('op.bannissement', { name: demon.label })));
  });
});
