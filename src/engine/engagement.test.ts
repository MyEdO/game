import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { isEngaged, isEngagedWith, engage, disengageFrom, decayEngagement, chargeAdvantage } from './engagement';

const mk = (id: string, wounds = 10): Combatant =>
  ({ id, name: id, kind: 'ennemi', wounds: { current: wounds, max: 10 }, conditions: [] }) as unknown as Combatant;

describe('Engagé — pose / levée (LDB 13 l.169-171)', () => {
  it('engage() pose le lien des DEUX côtés + marque le coup ce Round ; idempotent', () => {
    const a = mk('a');
    const b = mk('b');
    engage(a, b);
    expect(isEngaged(a)).toBe(true);
    expect(isEngaged(b)).toBe(true);
    expect(isEngagedWith(a, 'b')).toBe(true);
    expect(isEngagedWith(b, 'a')).toBe(true);
    engage(a, b); // idempotent
    expect(a.engagedWith).toEqual(['b']);
    expect(a.meleeThisRound).toEqual(['b']);
  });
  it('disengageFrom() retire des deux côtés', () => {
    const a = mk('a');
    const b = mk('b');
    engage(a, b);
    disengageFrom(a, b);
    expect(isEngaged(a)).toBe(false);
    expect(isEngaged(b)).toBe(false);
  });
  it('decayEngagement : un lien rafraîchi ce Round SURVIT, un lien non rafraîchi TOMBE', () => {
    const a = mk('a');
    const b = mk('b');
    const c = mk('c');
    engage(a, b); // rafraîchi (meleeThisRound contient le lien)
    a.engagedWith = ['b', 'c']; // c = lien hérité non rafraîchi
    b.engagedWith = ['a'];
    c.engagedWith = ['a'];
    decayEngagement([a, b, c]);
    expect(a.engagedWith).toEqual(['b']); // b survit, c tombe
    expect(c.engagedWith).toEqual([]); // côté c aussi
    expect(a.meleeThisRound).toEqual([]); // vidé après decay
  });
  it('decayEngagement : symétrie croisée — A a frappé B (mais pas B→A) → la paire SURVIT des deux côtés', () => {
    const a = mk('a');
    const b = mk('b');
    a.engagedWith = ['b'];
    b.engagedWith = ['a'];
    a.meleeThisRound = ['b']; // seul A a frappé
    b.meleeThisRound = [];
    decayEngagement([a, b]);
    expect(a.engagedWith).toEqual(['b']);
    expect(b.engagedWith).toEqual(['a']); // survit grâce au snapshot croisé
  });
  it('decayEngagement : un lien vers un combattant hors d’action (Blessures ≤ 0) tombe', () => {
    const a = mk('a');
    const dead = mk('d', 0);
    a.engagedWith = ['d'];
    a.meleeThisRound = ['d'];
    dead.engagedWith = ['a'];
    decayEngagement([a, dead]);
    expect(a.engagedWith).toEqual([]); // d mort → lien purgé
  });
});

describe('chargeAdvantage — +1 UNIQUEMENT si cible à ≥ M mètres (LDB 15 l.37 ; 1 case = 2 m)', () => {
  it('M=4 : seuil ceil(4/2)=2 cases ; portée Course 2M=8 (arrivée adjacente → cible jusqu’à 9)', () => {
    expect(chargeAdvantage(4, 0)).toBe(0); // déjà au contact, pas de charge
    expect(chargeAdvantage(4, 1)).toBe(0); // contact direct : on n'a pas « foncé » → rien (LDB 15 l.37)
    expect(chargeAdvantage(4, 2)).toBe(1); // ≥ seuil → +1
    expect(chargeAdvantage(4, 8)).toBe(1); // pleine portée de Course → +1
    expect(chargeAdvantage(4, 9)).toBe(1); // 2M+1 : case d'arrivée (à 2M=8) encore atteignable → +1
    expect(chargeAdvantage(4, 10)).toBe(0); // arrivée hors de portée de Course → 0
  });
  it('M impair / autres valeurs', () => {
    expect(chargeAdvantage(3, 1)).toBe(0);
    expect(chargeAdvantage(3, 2)).toBe(1); // seuil ceil(3/2)=2
    expect(chargeAdvantage(3, 7)).toBe(1); // 2M+1
    expect(chargeAdvantage(3, 8)).toBe(0);
    expect(chargeAdvantage(5, 2)).toBe(0); // seuil 3 → dist 2 : rien
    expect(chargeAdvantage(5, 3)).toBe(1);
  });
});
